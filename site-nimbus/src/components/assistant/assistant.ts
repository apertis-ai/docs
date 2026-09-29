// Search + Ask Docs client (#9). The only `apertis-docs:open` listener and the only Cmd/Ctrl+K owner.
// Search loads Pagefind lazily on first use; Ask Docs posts the legacy wire request to /api/ask.
import { OPEN_EVENT } from '../../contracts/events.ts';
import { searchWithVariants } from '../../search/query.ts';
import { ASK_PATH, askBody, currentPageContext, errorMessage, readAnswer, sourceLinks } from './wire.ts';
import { answerNodes } from './answer-render.ts';

type Surface = 'search' | 'ask';

interface PagefindResult {
  id: string;
  data(): Promise<PagefindResultData>;
}

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

interface Pagefind {
  init(): Promise<void>;
  search(q: string): Promise<{ results: PagefindResult[] } | null>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  state?: 'streaming' | 'done' | 'interrupted' | 'error';
}

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}


const PAGEFIND_URL = '/pagefind/pagefind.js';
const MAX_RESULTS = 10;
// The legacy widget (src/components/UnifiedSearchModal/AskAITab.tsx, ask-wire.json).
const TURNSTILE_SITE_KEY = '0x4AAAAAACS2SzpYBFytHb_E';
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 30000;
const SESSION_KEY = 'askai_session_id';
const OPEN_KEY = 'askdocs_open';

/**
 * Binds the search and Ask Docs behaviour to the markup Assistant.tsx rendered at build time (ids aa-*).
 * Called once by AssistantRoot's page script, before the load event, like the pre-redesign client.
 */
export function initAssistant(): void {
  // sessionStorage throws when site data is blocked; fall back to memory for this page.
  const memory = new Map<string, string>();
  const store = {
    get(key: string): string | null {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key: string, value: string) {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
    remove(key: string) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        memory.delete(key);
      }
    },
  };

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>('apertis-assistant');
  const input = $<HTMLInputElement>('aa-q');
  const status = $('aa-status');
  const results = $<HTMLUListElement>('aa-results');
  const panels: Record<Surface, HTMLElement> = { search: $('aa-search'), ask: $('aa-ask') };
  const tabs: Record<Surface, HTMLElement> = { search: $('aa-tab-search'), ask: $('aa-tab-ask') };
  const question = $<HTMLTextAreaElement>('aa-question');
  const sendButton = $<HTMLButtonElement>('aa-send');
  const askStatus = $('aa-ask-status');
  const messagesEl = $('aa-messages');
  const clearButton = $<HTMLButtonElement>('aa-clear');

  let surface: Surface | null = null;
  let opener: Element | null = null;

  // ---------------------------------------------------------------- dialog and keyboard

  function show(next: Surface, { query, focus = true }: { query?: string; focus?: boolean } = {}) {
    if (!surface) opener = document.activeElement;
    // Switching surfaces: showModal() throws on an open dialog. The async `close` event this queues
    // finds the dialog open again and is ignored by closed().
    if (dialog.open) dialog.close();
    surface = next;
    dialog.dataset.surface = next;
    dialog.setAttribute('aria-label', next === 'search' ? 'Search documentation' : 'Ask Docs');
    for (const s of ['search', 'ask'] as const) {
      panels[s].hidden = s !== next;
      tabs[s].setAttribute('aria-selected', String(s === next));
    }
    document.documentElement.classList.toggle('aa-scroll-lock', next === 'search');
    if (next === 'search') {
      store.remove(OPEN_KEY);
      dialog.showModal();
      if (query !== undefined) input.value = query;
      input.focus();
      input.select();
      void loadEngine().catch(() => {});
      void runSearch();
    } else {
      store.set(OPEN_KEY, '1');
      dialog.show();
      openAsk();
      if (focus) question.focus();
    }
  }

  /** Closed-state cleanup, run synchronously by hide() and again (as a no-op) by the async `close` event. */
  function closed() {
    if (!surface || dialog.open) return;
    if (surface === 'ask') {
      store.remove(OPEN_KEY);
      controller?.abort(); // closing the panel stops a streaming answer
    }
    surface = null;
    document.documentElement.classList.remove('aa-scroll-lock');
    const back = opener as HTMLElement | null;
    opener = null;
    if (back?.isConnected && back !== document.body) back.focus();
  }

  function hide() {
    if (dialog.open) dialog.close();
    closed();
  }

  // Native closes (Escape on the modal search dialog) arrive here.
  dialog.addEventListener('close', closed);

  // Backdrop click: the modal dialog itself (not its frame) receives clicks outside the frame.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && surface === 'search') hide();
  });

  $('aa-close').addEventListener('click', hide);
  for (const s of ['search', 'ask'] as const) tabs[s].addEventListener('click', () => show(s));



  window.addEventListener(OPEN_EVENT, (e) => show(e.detail.surface, { query: e.detail.query }));

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (surface === 'search' && dialog.open) hide();
      else show('search');
      return;
    }
    // Modal search closes on Escape natively (cancel). The non-modal Ask panel closes on Escape
    // except while typing in its composer.
    if (e.key === 'Escape' && surface === 'ask' && e.target !== question) {
      e.preventDefault();
      hide();
    }
  });

  // ---------------------------------------------------------------- search


  let engine: Promise<Pagefind> | null = null;
  let selected = -1;
  let searchSeq = 0;

  function loadEngine(): Promise<Pagefind> {
    engine ??= (import(/* @vite-ignore */ PAGEFIND_URL) as Promise<Pagefind>).then(async (pf) => {
      await pf.init();
      return pf;
    });
    engine.catch(() => {
      engine = null; // retried on the next query
    });
    return engine;
  }

  /** Pagefind excerpt HTML reduced to text and <mark>; nothing else from the index reaches the DOM. */
  function excerptNodes(html: string): Node[] {
    const t = document.createElement('template');
    t.innerHTML = html;
    return [...t.content.childNodes].map((n) => {
      if (n.nodeName === 'MARK') {
        const m = document.createElement('mark');
        m.textContent = n.textContent;
        return m;
      }
      return document.createTextNode(n.textContent ?? '');
    });
  }

  function select(i: number) {
    const items = results.children;
    if (!items.length) {
      selected = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    selected = Math.max(0, Math.min(i, items.length - 1));
    [...items].forEach((li, k) => li.setAttribute('aria-selected', String(k === selected)));
    input.setAttribute('aria-activedescendant', items[selected].id);
    items[selected].scrollIntoView({ block: 'nearest' });
  }

  function renderResults(list: PagefindResultData[], message: string) {
    results.replaceChildren(...list.map((r, i) => {
      const li = document.createElement('li');
      li.id = `aa-result-${i}`;
      li.setAttribute('role', 'option');
      const a = document.createElement('a');
      a.href = r.url;
      a.tabIndex = -1;
      const title = document.createElement('span');
      title.className = 'aa-title';
      title.textContent = r.meta.title || r.url;
      const where = document.createElement('span');
      where.className = 'aa-path';
      where.textContent = r.url;
      const excerpt = document.createElement('span');
      excerpt.className = 'aa-excerpt';
      excerpt.append(...excerptNodes(r.excerpt));
      a.append(title, where, excerpt);
      li.append(a);
      return li;
    }));
    input.setAttribute('aria-expanded', String(list.length > 0));
    status.textContent = message;
    select(0);
  }

  /** Searches the current input. A query typed before the index loads runs as soon as it is ready. */
  async function runSearch() {
    const seq = ++searchSeq;
    const q = input.value.trim();
    if (!q) return renderResults([], 'Type to search the documentation');
    let pf: Pagefind;
    try {
      const pending = loadEngine();
      status.textContent = 'Loading search index…';
      pf = await pending;
    } catch {
      if (seq === searchSeq) renderResults([], 'The search index could not be loaded. Check your connection and type again to retry.');
      return;
    }
    let list: PagefindResultData[];
    try {
      const found = await searchWithVariants(q, async (v) => (await pf.search(v))?.results ?? [], () => seq === searchSeq);
      if (seq !== searchSeq) return;
      list = await Promise.all(found.slice(0, MAX_RESULTS).map((r) => r.data()));
    } catch {
      if (seq === searchSeq) renderResults([], 'The search could not be completed. Check your connection and try again.');
      return;
    }
    if (seq !== searchSeq) return;
    renderResults(list, list.length ? '' : `No results for “${q}”`);
  }

  input.addEventListener('input', () => void runSearch());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(selected + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && selected >= 0) {
      e.preventDefault();
      const href = results.children[selected]?.querySelector('a')?.href;
      if (href) {
        hide();
        location.assign(href);
      }
    }
  });

  // ---------------------------------------------------------------- Ask Docs



  // crypto.randomUUID exists only in secure contexts; plain-HTTP hosts (a tailnet preview) need the fallback.
  const newSessionId = () => typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const sessionId = store.get(SESSION_KEY) ?? newSessionId();
  store.set(SESSION_KEY, sessionId);
  const messagesKey = `askdocs_messages_${sessionId}`;
  /** A turn that was still streaming when saved or loaded did not finish. */
  const settled = (list: Message[]) => list.map((m) => (m.state === 'streaming' ? { ...m, state: 'interrupted' as const } : m));
  let messages: Message[] = [];
  try {
    messages = settled(JSON.parse(store.get(messagesKey) ?? '[]'));
  } catch {
    messages = [];
  }

  let token: string | null = null;
  let widgetId: string | null = null;
  let turnstileStarted = false;
  let verifyFailed = false;
  let streaming = false;
  let controller: AbortController | null = null;

  function setAskStatus(text: string, kind: 'info' | 'error' = 'info') {
    askStatus.textContent = text;
    askStatus.dataset.kind = kind;
  }

  function updateSend() {
    sendButton.disabled = streaming || !token || !question.value.trim();
  }

  function verificationFailed(detail: string) {
    verifyFailed = true;
    token = null;
    setAskStatus(`Questions can't be sent: ${detail}`, 'error');
    updateSend();
  }

  function startTurnstile() {
    if (turnstileStarted) return;
    turnstileStarted = true;
    verifyFailed = false;
    setAskStatus('Verifying your browser before you can send…');
    const timer = setTimeout(() => {
      if (!token && !verifyFailed) verificationFailed('the verification check (Cloudflare Turnstile) did not respond.');
    }, TURNSTILE_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      turnstileStarted = false; // the next open retries
      verificationFailed('the verification check (Cloudflare Turnstile) could not be loaded. Close and reopen Ask Docs to retry, or reload the page.');
    };
    script.onload = () => {
      const ts = window.turnstile;
      if (!ts) return script.onerror?.(new Event('error'));
      widgetId = ts.render($('aa-turnstile'), {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => {
          clearTimeout(timer);
          verifyFailed = false;
          token = t;
          setAskStatus('');
          updateSend();
        },
        'error-callback': (code: string) => {
          clearTimeout(timer);
          verificationFailed(`this site could not be verified (Turnstile error ${code}).`);
          return true;
        },
        'expired-callback': () => {
          token = null;
          setAskStatus('Verification expired, verifying again…');
          updateSend();
          if (widgetId) ts.reset(widgetId);
        },
        'timeout-callback': () => verificationFailed('the verification challenge timed out. Reload the page to try again.'),
      });
    };
    document.head.append(script);
  }

  function messageEl(msg: Message): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aa-msg';
    el.dataset.role = msg.role;
    if (msg.state) el.dataset.state = msg.state;
    if (msg.state === 'error') {
      el.setAttribute('role', 'alert');
      el.textContent = msg.content;
      return el;
    }
    el.append(...(msg.role === 'assistant' ? answerNodes(msg.content) : [document.createTextNode(msg.content)]));
    if (msg.state === 'interrupted') {
      const note = document.createElement('span');
      note.className = 'aa-note';
      note.setAttribute('role', 'alert');
      note.textContent = 'The answer was interrupted before it finished. Ask again to retry.';
      el.append(note);
    }
    const sources = msg.role === 'assistant' && msg.state !== 'streaming' ? sourceLinks(msg.content) : [];
    if (sources.length) {
      const box = document.createElement('div');
      box.className = 'aa-sources';
      box.append(...sources.map((s) => Object.assign(document.createElement('a'), { href: s.href, textContent: s.title })));
      el.append(box);
    }
    return el;
  }

  function renderMessages() {
    messagesEl.replaceChildren(...messages.map(messageEl));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    clearButton.hidden = messages.length === 0 || streaming;
  }

  function saveMessages() {
    store.set(messagesKey, JSON.stringify(settled(messages)));
  }

  function refreshContext() {
    $('aa-context-title').textContent = currentPageContext(document.title, location)?.title ?? 'this site';
  }

  function openAsk() {
    refreshContext();
    renderMessages();
    startTurnstile();
    updateSend();
  }

  async function send(text: string) {
    const turnstileToken = token;
    if (!turnstileToken || streaming) return;
    token = null;
    streaming = true;
    question.value = '';
    updateSend();
    // Read at send time, never cached: the current page, even after navigation.
    const context = currentPageContext(document.title, location);
    const answer: Message = { role: 'assistant', content: '', state: 'streaming' };
    messages.push({ role: 'user', content: text }, answer);
    saveMessages();
    renderMessages();
    const abort = (controller = new AbortController());
    try {
      const res = await fetch(ASK_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(askBody(text, sessionId, turnstileToken, context)),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        answer.state = 'error';
        answer.content = await errorMessage(res);
      } else {
        answer.state = await readAnswer(res.body, (delta) => {
          answer.content += delta;
          // Requeried per delta: reopening the panel re-renders the list. The streaming turn is always last.
          messagesEl.lastElementChild?.replaceChildren(...answerNodes(answer.content));
        });
      }
    } catch {
      if (answer.content || abort.signal.aborted) answer.state = 'interrupted';
      else {
        answer.state = 'error';
        answer.content = 'Ask Docs could not be reached. Check your connection and try again.';
      }
    } finally {
      streaming = false;
      controller = null;
      saveMessages();
      renderMessages();
      if (widgetId) window.turnstile?.reset(widgetId);
      updateSend();
    }
  }

  $<HTMLFormElement>('aa-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = question.value.trim();
    if (text) void send(text);
  });
  question.addEventListener('input', updateSend);
  question.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      question.form?.requestSubmit();
    }
  });
  clearButton.addEventListener('click', () => {
    messages = [];
    store.remove(messagesKey);
    renderMessages();
  });
  window.addEventListener('hashchange', refreshContext);
  window.addEventListener('popstate', refreshContext);
  // Leaving mid-stream keeps the question and the partial answer (as interrupted).
  window.addEventListener('pagehide', saveMessages);

  // The panel stays open across page loads within the session; its context is the new page.
  if (store.get(OPEN_KEY)) show('ask', { focus: false });

}
