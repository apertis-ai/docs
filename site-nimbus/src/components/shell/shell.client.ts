// Shell behavior, one entry for every page: surface triggers, theme switch, navigation sheet hand-off,
// TOC highlight and reading progress, and Nimbus's code-copy buttons and heading anchors. Page actions,
// the mobile TOC and the navigation sheet are React islands.
// Search and Ask Docs open only through the contract event; this file binds no keyboard shortcut.
import { codeCopy, headingAnchors } from '@cloudflare/nimbus-docs/client';
import { send } from '../../lib/bridge.ts';
import { openAskDocs, openSearch } from '../../contracts/events.ts';

// Over plain http (a tailnet preview) the browser offers no navigator.clipboard, and the code-copy and page
// copy buttons would fail. Outside a secure context only, copy through a selected textarea instead.
if (!window.isSecureContext && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: async (text: string) => {
        const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
        area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        const active = document.activeElement as HTMLElement | null;
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        active?.focus();
        if (!ok) throw new Error('copy failed');
      },
    },
  });
}

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)] as T[];

// Surface triggers (navbar search, homepage hero, Ask Docs button).
for (const el of $$('[data-open-surface]')) {
  el.addEventListener('click', () => (el.dataset.openSurface === 'ask' ? openAskDocs() : openSearch()));
}

// Theme: light default, the reader's choice persists under the legacy `theme` key. Styling only. Delegated,
// so the switch inside the navigation sheet (mounted later) works too.
const root = document.documentElement;
function syncThemeButtons() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  for (const b of $$('[data-theme-toggle]')) b.setAttribute('aria-label', `Switch to ${next} mode`);
}
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest?.('[data-theme-toggle]')) return;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* storage blocked: session-only */ }
  syncThemeButtons();
});
syncThemeButtons();

// Navigation sheet (NavSheet.tsx, hydrated on idle): the header's menu button hands its click over the
// bridge, so a click before hydration still opens the sheet.
for (const b of $$('[data-drawer-open]')) b.addEventListener('click', () => send('nav'));

// TOC highlight, the legacy Docusaurus rule (useTOCHighlight): the first h2/h3 at or below the navbar
// is active if it sits in the top half of the viewport, otherwise the heading before it; past the last
// heading, the last one. One addition for the reading layout: above the first heading (the page header
// is taller than legacy's H1) the first heading is active. CSS shows an h2's h3 list only while it
// holds the active link.
const tocLinks = $$<HTMLAnchorElement>('.doc-page__toc a');
if (tocLinks.length) {
  const anchors = $$('article.docs-content :is(h2, h3)[id]');
  const navbar = document.querySelector<HTMLElement>('.navbar');
  const activeAnchor = () => {
    const top = navbar?.clientHeight ?? 0;
    const next = anchors.find((h) => h.getBoundingClientRect().top >= top);
    if (!next) return anchors[anchors.length - 1] ?? null;
    const r = next.getBoundingClientRect();
    return r.top > 0 && r.bottom < innerHeight / 2 ? next : anchors[anchors.indexOf(next) - 1] ?? next;
  };
  let queued = false;
  const update = () => {
    queued = false;
    const current = activeAnchor();
    for (const a of tocLinks) a.classList.toggle('active', !!current && decodeURIComponent(a.hash.slice(1)) === current.id);
  };
  // Reading progress: how far the article has scrolled past the navbar, 100% when its end is in view.
  // Only a transform and a fixed-width label change, so nothing shifts; no scroll is ever set here.
  const article = document.querySelector<HTMLElement>('article.docs-content');
  const progress = document.querySelector<HTMLElement>('.toc-progress');
  const fill = progress?.querySelector<HTMLElement>('.toc-progress__fill');
  const value = progress?.querySelector<HTMLElement>('.toc-progress__value');
  const read = () => {
    if (!article || !progress || !fill || !value) return;
    const r = article.getBoundingClientRect(), top = navbar?.clientHeight ?? 0;
    const span = r.height - (innerHeight - top);
    const pct = span > 0 ? Math.round(Math.min(1, Math.max(0, (top - r.top) / span)) * 100) : 100;
    fill.style.transform = `scaleX(${pct / 100})`;
    value.textContent = `${pct}%`;
    progress.setAttribute('aria-valuenow', String(pct));
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { update(); read(); }); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
  read();
}

// Code copy buttons belong to document code blocks; the homepage sample has its own.
if (document.querySelector('article.docs-content')) codeCopy();
headingAnchors();
