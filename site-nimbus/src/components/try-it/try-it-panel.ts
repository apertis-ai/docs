// Try it panel (openspec docs-api-reference-ux "Try it"), imported by TryIt.astro on the first open. It sends
// the sample's request with the reader's key: one fetch, only to https://api.apertis.ai, with the key in the
// Authorization header. The key lives in the password input and in a local variable of send(); it is never
// stored, logged or put in a URL, and closing the panel removes the input with it.
import { API_ORIGIN, parseCurl } from './curl.ts';

// Panel styles, added on the first open (tokens from src/styles/tokens.css; inputs as the Ask Docs form: a
// hairline that turns muted on focus, never an ink frame).
const CSS = `
.try-it { display: grid; gap: 12px; margin: -0.8em 0 1.6em; padding: 16px 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); font-size: var(--fs-sm); }
.try-it__head { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
.try-it__req { margin: 0; min-width: 0; overflow-wrap: anywhere; font-family: var(--mono); color: var(--ink); }
.try-it__method { margin-right: 8px; padding: 2px 6px; border-radius: 4px; background: var(--panel); font-weight: 600; }
.try-it__notice { margin: 0; color: var(--muted); font-size: var(--fs-xs); }
.try-it__field { display: grid; gap: 6px; color: var(--muted); font-size: var(--fs-xs); font-weight: 500; }
.try-it__field :is(input, textarea) {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  outline: 0;
  background: var(--bg);
  color: var(--ink);
  font: var(--fs-base) / 1.5 var(--mono);
  transition: border-color 0.16s ease;
}
.try-it__field textarea { resize: vertical; }
.try-it__field :is(input, textarea):focus { border-color: var(--muted); }
.try-it__actions { display: flex; gap: 8px; }
.try-it button:not(.try-it__close) { height: 32px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--card); color: var(--ink); font: 500 var(--fs-ui) / 1 var(--font); cursor: pointer; }
.try-it button.try-it__send { border-color: var(--primary); background: var(--primary); color: var(--primary-fg); }
.try-it button:disabled { opacity: 0.5; cursor: default; }
.try-it__close { width: 30px; height: 30px; flex: none; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 18px; line-height: 1; cursor: pointer; }
.try-it__close:hover { background: var(--hover); color: var(--ink); }
.try-it__status { margin: 0; color: var(--muted); font-family: var(--mono); }
.try-it__status:empty { display: none; }
.try-it__status[data-state='ok'] { color: var(--ink); }
.try-it__status[data-state='error'] { padding: 8px 10px; border: 1px solid var(--error); border-radius: 6px; color: var(--error); }
.docs-content pre.try-it__out { max-height: 360px; margin: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
`;
const panels = new WeakMap<HTMLElement, () => void>();
// The sample's own credential headers are placeholders; the reader's key replaces them.
const KEY_HEADERS = new Set(['authorization', 'x-api-key']);

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: object = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

export function toggle(pre: HTMLElement, trigger: HTMLButtonElement) {
  const close = panels.get(pre);
  if (close) return close();
  const req = parseCurl(pre.querySelector('code')?.textContent ?? '');
  if ('reason' in req) return;
  if (!document.getElementById('try-it-css')) document.head.append(el('style', { id: 'try-it-css', textContent: CSS }));

  const id = `try-it-${Math.random().toString(36).slice(2)}`;
  const key = el('input', { type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'sk-...' });
  const body = req.body === null ? null : el('textarea', { spellcheck: false, rows: Math.min(16, req.body.split('\n').length + 1), value: req.body });
  const send = el('button', { type: 'button', className: 'try-it__send', textContent: 'Send' });
  const cancel = el('button', { type: 'button', className: 'try-it__cancel', textContent: 'Cancel', disabled: true });
  const closeBtn = el('button', { type: 'button', className: 'try-it__close', textContent: '×' });
  closeBtn.setAttribute('aria-label', 'Close Try it');
  const status = el('p', { className: 'try-it__status' });
  status.setAttribute('role', 'status');
  const out = el('pre', { className: 'try-it__out', hidden: true });
  const panel = el('div', { className: 'try-it', id },
    el('div', { className: 'try-it__head' },
      el('p', { className: 'try-it__req' }, el('span', { className: 'try-it__method', textContent: req.method }), el('code', { textContent: req.url })),
      closeBtn),
    el('p', { className: 'try-it__notice', textContent: 'Requests run with your API key and are billed to your account. The key stays on this page and is sent only to api.apertis.ai.' }),
    el('label', { className: 'try-it__field' }, el('span', { textContent: 'API key' }), key),
    ...(body ? [el('label', { className: 'try-it__field' }, el('span', { textContent: 'Body (JSON)' }), body)] : []),
    el('div', { className: 'try-it__actions' }, send, cancel),
    status,
    out);
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `Try it: ${req.method} ${req.url}`);

  let controller: AbortController | null = null;
  const show = (text: string, state: 'ok' | 'error' | 'busy') => { status.textContent = text; status.dataset.state = state; };
  const done = () => { controller = null; send.disabled = false; cancel.disabled = true; };

  send.addEventListener('click', async () => {
    out.hidden = true;
    out.textContent = '';
    let payload: string | undefined;
    if (body) {
      try { JSON.parse(body.value); } catch (e) { return show(`Invalid JSON body, nothing was sent: ${(e as Error).message}`, 'error'); }
      payload = body.value;
    }
    const apiKey = key.value.trim();
    if (!apiKey) return show('Enter your API key to send the request.', 'error');
    const url = new URL(req.url);
    if (url.origin !== API_ORIGIN) return show(`Refused: requests go only to ${API_ORIGIN}.`, 'error');
    const headers = new Headers(req.headers.filter(([name]) => !KEY_HEADERS.has(name.toLowerCase())));
    headers.set('Authorization', `Bearer ${apiKey}`);
    if (payload !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    controller = new AbortController();
    send.disabled = true;
    cancel.disabled = false;
    show('Sending...', 'busy');
    const t0 = performance.now();
    const ms = () => `${Math.round(performance.now() - t0)} ms`;
    try {
      // redirect: 'error' keeps the key from following a redirect to any other URL.
      const res = await fetch(url, { method: req.method, headers, body: payload, signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store' });
      const line = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
      const state = res.ok ? 'ok' : 'error';
      const type = res.headers.get('content-type') ?? '';
      out.hidden = false;
      if (type.includes('text/event-stream') && res.body) {
        show(`${line} · streaming...`, state);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        for (let r = await reader.read(); !r.done; r = await reader.read()) out.append(r.value);
      } else if (/json|^text\/|xml/.test(type) || !type) {
        const text = await res.text();
        try { out.textContent = type.includes('json') ? JSON.stringify(JSON.parse(text), null, 2) : text; } catch { out.textContent = text; }
      } else {
        out.textContent = `${(await res.arrayBuffer()).byteLength} bytes of ${type} (not shown).`;
      }
      show(`${line} · ${ms()}`, state);
    } catch (e) {
      if ((e as Error).name === 'AbortError') show(`Cancelled after ${ms()}.`, 'busy');
      else show(`Network error or blocked by CORS after ${ms()}: ${(e as Error).message}`, 'error');
    } finally {
      done();
    }
  });
  cancel.addEventListener('click', () => controller?.abort());

  const closePanel = () => {
    controller?.abort();
    key.value = '';
    panel.remove();
    panels.delete(pre);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    trigger.focus();
  };
  closeBtn.addEventListener('click', closePanel);
  panels.set(pre, closePanel);

  (pre.closest('.nb-code-figure') ?? pre).after(panel);
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', id);
  key.focus();
}
