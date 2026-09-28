import '../../styles/shell.css';
// Shell behavior, one entry for every page: surface triggers, theme switch, mobile drawer, page
// actions, TOC highlight, and Nimbus's code-copy buttons and heading anchors.
// Search and Ask Docs open only through the contract event; this file binds no keyboard shortcut.
import { codeCopy, headingAnchors, lockScroll, makeDisclosure, unlockScroll } from '@cloudflare/nimbus-docs/client';
import { openAskDocs, openSearch } from '../../contracts/events.ts';
import { PAGE_META } from '../../contracts/page.ts';
import { aiToolUrls, markdownUrl } from './page-actions.ts';

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)] as T[];

// Surface triggers (navbar search, homepage hero, Ask Docs button).
for (const el of $$('[data-open-surface]')) {
  el.addEventListener('click', () => (el.dataset.openSurface === 'ask' ? openAskDocs() : openSearch()));
}

// Theme: light default, the reader's choice persists under the legacy `theme` key. Styling only.
const root = document.documentElement;
function syncThemeButtons() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  for (const b of $$('[data-theme-toggle]')) b.setAttribute('aria-label', `Switch to ${next} mode`);
}
for (const b of $$('[data-theme-toggle]')) {
  b.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* storage blocked: session-only */ }
    syncThemeButtons();
  });
}
syncThemeButtons();

// Mobile drawer: a modal <dialog> gives focus containment, Escape and focus return natively.
const drawer = document.querySelector<HTMLDialogElement>('#shell-drawer');
const drawerOpener = document.querySelector<HTMLElement>('[data-drawer-open]');
if (drawer && drawerOpener) {
  drawerOpener.addEventListener('click', () => {
    drawer.showModal();
    lockScroll();
    drawerOpener.setAttribute('aria-expanded', 'true');
    drawer.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'center' });
  });
  drawer.addEventListener('close', () => {
    unlockScroll();
    drawerOpener.setAttribute('aria-expanded', 'false');
  });
  drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });
  for (const b of $$('[data-drawer-close]', drawer)) b.addEventListener('click', () => drawer.close());
  // Leaving the mobile breakpoint with the drawer open would leave the page locked.
  matchMedia('(min-width: 997px)').addEventListener('change', (e) => { if (e.matches && drawer.open) drawer.close(); });
}

// Page actions: every action reads this deployment's Markdown artifact from the page meta.
const actions = document.querySelector<HTMLElement>('[data-page-actions]');
const mdUrl = markdownUrl(location.origin, document.querySelector<HTMLMetaElement>(`meta[name="${PAGE_META.markdown}"]`)?.content);
if (actions && !mdUrl) actions.remove();
if (actions && mdUrl) {
  const status = actions.querySelector<HTMLElement>('.page-actions__status')!;
  const label = actions.querySelector<HTMLElement>('[data-copy-label]')!;
  const menu = makeDisclosure({
    trigger: actions.querySelector<HTMLElement>('.page-actions__toggle')!,
    content: actions.querySelector<HTMLElement>('.page-actions__menu')!,
  });
  const tools = aiToolUrls(mdUrl);
  const hrefs: Record<string, string> = { claude: tools.claude, chatgpt: tools.chatgpt, cursor: tools.cursor, view: mdUrl };
  for (const a of $$<HTMLAnchorElement>('a[data-action]', actions)) {
    a.href = hrefs[a.dataset.action!];
    a.addEventListener('click', () => menu.close());
  }

  let reset: number | undefined;
  const report = (message: string, ok: boolean, short?: string) => {
    status.textContent = message;
    status.dataset.state = ok ? 'ok' : 'error';
    label.textContent = short ?? 'Copy as Markdown';
    clearTimeout(reset);
    if (ok) reset = window.setTimeout(() => { status.textContent = ''; label.textContent = 'Copy as Markdown'; }, 1800);
  };
  const clipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      report('Copying is blocked in this browser. Use View as Markdown to open the file instead.', false);
      return false;
    }
  };
  const copyMarkdown = async () => {
    let text: string;
    try {
      const res = await fetch(mdUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      // No silent fallback to rendered text: the reader is told nothing was copied.
      report(`Could not load this page's Markdown (${(err as Error).message}). Nothing was copied.`, false);
      return;
    }
    if (await clipboard(text)) report('Page copied as Markdown.', true, 'Copied');
  };
  for (const b of $$('button[data-action="copy-markdown"]', actions)) b.addEventListener('click', () => { menu.close(); copyMarkdown(); });
  actions.querySelector('button[data-action="copy-url"]')!.addEventListener('click', async () => {
    menu.close();
    if (await clipboard(mdUrl)) report('Markdown URL copied.', true, 'URL Copied');
  });
  document.addEventListener('pointerdown', (e) => { if (menu.isOpen() && !actions.contains(e.target as Node)) menu.close(); });
  actions.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.isOpen()) {
      menu.close();
      actions.querySelector<HTMLElement>('.page-actions__toggle')!.focus();
    }
  });
}

// TOC highlight, the legacy Docusaurus rule (useTOCHighlight): the first h2/h3 at or below the navbar
// is active if it sits in the top half of the viewport, otherwise the heading before it; past the last
// heading, the last one. CSS shows an h2's h3 list only while it holds the active link.
const tocLinks = $$<HTMLAnchorElement>('.doc-page__toc a');
if (tocLinks.length) {
  const anchors = $$('article.docs-content :is(h2, h3)[id]');
  const navbar = document.querySelector<HTMLElement>('.navbar');
  const activeAnchor = () => {
    const top = navbar?.clientHeight ?? 0;
    const next = anchors.find((h) => h.getBoundingClientRect().top >= top);
    if (!next) return anchors[anchors.length - 1] ?? null;
    const r = next.getBoundingClientRect();
    return r.top > 0 && r.bottom < innerHeight / 2 ? next : anchors[anchors.indexOf(next) - 1] ?? null;
  };
  let queued = false;
  const update = () => {
    queued = false;
    const current = activeAnchor();
    for (const a of tocLinks) a.classList.toggle('active', !!current && decodeURIComponent(a.hash.slice(1)) === current.id);
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
}

codeCopy();
headingAnchors();
