// #8 shell in a real browser (system Chrome via Playwright) against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8802 PLAYWRIGHT=<path>/playwright/index.mjs npm run test:m3-browser
// Use a localhost origin: the Clipboard API only exists in secure contexts. Skipped when either variable
// is unset, so `npm test` stays browser-free. The successful Copy-as-Markdown case serves a stub `.md`
// through page.route (contract evidence); the failure case hits the preview's real 404.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { TITLE_SUFFIX } from '../src/contracts/page.ts';
import type { RouteInventory } from '../src/contracts/navigation.ts';
import type { ManifestV1 } from '../src/contracts/manifest.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const inventory: RouteInventory = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../migration/nimbus/route-inventory.json'), 'utf8'),
);
// The manifest the running build was generated with (a build rewrites it in place).
const liveManifest = (): ManifestV1 => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/manifest/manifest.json'), 'utf8'));
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any;
const external: string[] = [];
const errors: string[] = [];

before(async () => {
  if (skip) return;
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => browser?.close());

async function open(pathname: string, options: object = DESKTOP) {
  const context = await browser.newContext(options);
  // Record every open event the page dispatches (the #9 listener is not part of this packet).
  await context.addInitScript(() => {
    (window as unknown as { __opens: unknown[] }).__opens = [];
    window.addEventListener('apertis-docs:open', (e) => (window as unknown as { __opens: unknown[] }).__opens.push(e.detail));
  });
  const page = await context.newPage();
  page.on('request', (r: { url(): string }) => { if (!r.url().startsWith(base!)) external.push(r.url()); });
  page.on('pageerror', (e: Error) => errors.push(`${pathname}: ${e.message}`));
  await page.goto(base + pathname, { waitUntil: 'load' });
  // Layout measurements depend on the web font; on a loaded machine it can arrive after `load`.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return { context, page };
}
const opens = (page: { evaluate: Function }) => page.evaluate(() => (window as unknown as { __opens: unknown[] }).__opens);

test('the /api/ sidebar renders the inventory apiSidebar placement', { skip }, async () => {
  const { context, page } = await open('/api/');
  const rows = inventory.routes.filter((r) => r.sidebar?.sidebar === 'apiSidebar').sort((a, b) => a.sidebar!.order - b.sidebar!.order);
  const decode = (s: string) => s.replace(/&amp;/g, '&');
  const expected = rows.map((r) => [
    r.sidebar!.trail.join(' / '),
    r.sidebar!.label ?? decode(r.live!.title!.replace(TITLE_SUFFIX, '')),
  ]);
  const rendered = await page.$$eval('.doc-page__sidebar .sidebar__link', (links: HTMLAnchorElement[]) => links.map((a) => {
    const trail: string[] = [];
    for (let el = a.parentElement; el && !el.classList.contains('sidebar'); el = el.parentElement) {
      const label = el.matches('li.sidebar__section') ? el.querySelector(':scope > .sidebar__heading')?.textContent
        : el.matches('details') ? el.querySelector(':scope > summary')?.textContent : null;
      if (label) trail.unshift(label.trim());
    }
    return [trail.join(' / '), a.textContent!.trim()];
  }));
  assert.deepEqual(rendered, expected);
  assert.equal(await page.getAttribute('.doc-page__sidebar [aria-current="page"]', 'href'), '/api/');
  assert.equal(await page.getAttribute('.navbar__links a.active', 'href'), '/api');
  assert.equal(await page.getAttribute('.doc-page__sidebar .sidebar__console', 'href'), 'https://apertis.ai/setting?tab=keys');
  await context.close();
});

test('light is the default, prefers-color-scheme is ignored, and the switch persists across pages', { skip }, async () => {
  const { context, page } = await open('/api/', { ...DESKTOP, colorScheme: 'dark' });
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  assert.equal(await theme(), 'light');
  await page.click('.navbar__right [data-theme-toggle]');
  assert.equal(await theme(), 'dark');
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.equal(await theme(), 'dark');
  // Palette revised on 2026-09-29 (#4): the dark token --bg is the neutral #121212 (was the warm #1b1a17).
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(18, 18, 18)');
  await page.reload();
  assert.equal(await theme(), 'dark');
  await page.click('.navbar__right [data-theme-toggle]');
  await page.reload();
  assert.equal(await theme(), 'light');
  await context.close();
});

test('the mobile drawer opens and closes at 390x844 with focus contained and returned', { skip }, async () => {
  const { context, page } = await open('/api/', MOBILE);
  assert.equal(await page.isVisible('.doc-page__sidebar'), false);
  assert.equal(await page.isVisible('#shell-drawer'), false);
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.ok(await noOverflow(), 'no document-wide horizontal overflow');
  // The drawer is a React island (NavSheet.tsx, client:idle): a click before hydration is handed over and
  // opens it once hydrated, so wait for it instead of asserting on the same tick.
  const opened = async () => {
    await page.locator('#shell-drawer').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#shell-drawer')!.contains(document.activeElement), null, { timeout: 2000 });
  };
  await page.click('[data-drawer-open]');
  await opened();
  assert.equal(await page.isVisible('#shell-drawer'), true);
  assert.equal(await page.getAttribute('[data-drawer-open]', 'aria-expanded'), 'true');
  assert.ok(await page.isVisible('#shell-drawer .sidebar [aria-current="page"]'));
  assert.ok(await page.evaluate(() => document.querySelector('#shell-drawer')!.contains(document.activeElement)), 'focus moved into the drawer');
  assert.equal(await page.evaluate(() => document.body.hasAttribute('data-scroll-locked')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#shell-drawer'), false);
  assert.ok(await page.evaluate(() => document.activeElement?.matches('[data-drawer-open]')), 'focus returned to the menu button');
  // The dialog `close` event is queued after Escape; the lock must lift once it fires.
  await page.waitForFunction(() => !document.body.hasAttribute('data-scroll-locked'), null, { timeout: 2000 });
  await page.click('[data-drawer-open]');
  await opened();
  await page.mouse.click(380, 420); // backdrop, right of the drawer panel
  assert.equal(await page.isVisible('#shell-drawer'), false);
  await page.click('[data-drawer-open]');
  await opened();
  await page.click('#shell-drawer [data-drawer-close]');
  assert.equal(await page.isVisible('#shell-drawer'), false);
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.ok(await noOverflow(), 'no horizontal overflow on / at 390 px');
  await context.close();
});

test('triggers dispatch apertis-docs:open with the right surface; the shell binds no Cmd/Ctrl+K', { skip }, async () => {
  const { context, page } = await open('/api/');
  // #9's dialog opens on each trigger; close it before the next click.
  await page.click('.navbar__search');
  await page.keyboard.press('Escape');
  await page.click('.ask-docs-trigger');
  await page.keyboard.press('Escape');
  const before = (await opens(page)).length;
  await page.keyboard.press('ControlOrMeta+k');
  assert.deepEqual((await opens(page)).slice(0, before), [{ surface: 'search' }, { surface: 'ask' }]);
  // The shell dispatches nothing for Cmd/Ctrl+K; #9 is the only key owner.
  assert.equal((await opens(page)).length, before);
  await page.keyboard.press('Escape');
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.click('.navbar__search'); // canary step 5b: the homepage search is the header's
  assert.deepEqual(await opens(page), [{ surface: 'search' }]);
  await context.close();
});

test('page actions read the same-origin .md from the page meta and report failures', { skip }, async () => {
  const { context, page } = await open('/api/');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const md = `${base}/api/index.md`;
  assert.equal(await page.getAttribute('meta[name="apertis-docs:markdown"]', 'content'), '/api/index.md');
  const clip = () => page.evaluate(() => navigator.clipboard.readText());
  await page.evaluate(() => navigator.clipboard.writeText('sentinel'));

  // Forced failures on the same URL: the reader sees the error and nothing is copied.
  await page.route(md, (route: { fulfill: Function }) => route.fulfill({ status: 404, body: 'missing' }));
  const [miss] = await Promise.all([page.waitForResponse(md), page.click('.page-actions__primary')]);
  assert.equal(miss.status(), 404);
  await page.waitForSelector('.page-actions__status[data-state="error"]');
  assert.match(await page.textContent('.page-actions__status'), /HTTP 404.*Nothing was copied/);
  assert.ok(await page.isVisible('.page-actions__status'));
  assert.equal(await clip(), 'sentinel');
  await page.unroute(md);
  await page.route(md, (route: { abort: Function }) => route.abort('internetdisconnected'));
  await page.evaluate(() => { document.querySelector('.page-actions__status')!.textContent = ''; });
  await Promise.all([page.waitForRequest(md), page.click('.page-actions__primary')]);
  await page.waitForFunction(() => /Nothing was copied/.test(document.querySelector('.page-actions__status')?.textContent ?? ''));
  assert.equal(await page.getAttribute('.page-actions__status', 'data-state'), 'error');
  assert.equal(await clip(), 'sentinel');
  await page.unroute(md);

  // The real artifact of this deployment: copied bytes equal it, and its hash is the manifest's.
  const [hit] = await Promise.all([page.waitForResponse(md), page.click('.page-actions__primary')]);
  assert.equal(hit.status(), 200);
  const body = await hit.text();
  await page.waitForSelector('.page-actions__status[data-state="ok"]');
  assert.equal(await clip(), body);
  const entry = liveManifest().documents.find((d) => d.id === 'api:index');
  assert.equal(crypto.createHash('sha256').update(body).digest('hex'), entry?.markdown?.sha256);

  await page.click('.page-actions__toggle');
  assert.equal(await page.getAttribute('.page-actions__toggle', 'aria-expanded'), 'true');
  await page.click('.page-actions__menu [data-action="copy-url"]');
  assert.equal(await clip(), md);
  assert.equal(await page.getAttribute('.page-actions__toggle', 'aria-expanded'), 'false');

  const prompt = encodeURIComponent(`Load the contents of ${md} into this chat's context so we can discuss it.`);
  // The links as the reader gets them: inside the open menu (Radix mounts it only while open).
  await page.click('.page-actions__toggle');
  await page.locator('[role="menu"]').waitFor();
  const hrefs = await page.$$eval('[role="menu"] a', (as: HTMLAnchorElement[]) => as.map((a) => [a.dataset.action, a.getAttribute('href'), a.target, a.rel]));
  await page.keyboard.press('Escape');
  await page.locator('[role="menu"]').waitFor({ state: 'detached' });
  // Claude Docs order (canary step 4): View as Markdown with the copy actions, then the AI tools.
  assert.deepEqual(hrefs, [
    ['view', md, '_blank', 'noopener noreferrer'],
    ['claude', `https://claude.ai/new?q=${prompt}`, '_blank', 'noopener noreferrer'],
    ['chatgpt', `https://chatgpt.com/?hints=search&prompt=${prompt}`, '_blank', 'noopener noreferrer'],
    ['cursor', `https://cursor.com/link/prompt?text=${prompt}`, '_blank', 'noopener noreferrer'],
  ]);
  await page.click('.page-actions__toggle');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('.page-actions__menu [data-action="view"]')]);
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(popup.url(), md);
  await page.keyboard.press('Escape');

  // No Markdown meta, no actions.
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.equal(await page.$('[data-page-actions]'), null);
  await context.close();
});

test('without JavaScript the navigation and landing links still work and no dead page actions show', { skip }, async () => {
  const { context, page } = await open('/api/', { ...DESKTOP, javaScriptEnabled: false });
  assert.ok(await page.isVisible('.doc-page__sidebar a[href="/api/"]'));
  assert.equal(await page.isVisible('[data-page-actions]'), false);
  // The mobile TOC disclosure states nothing in ARIA that JavaScript would have to keep current.
  assert.ok(await page.$('article .toc-mobile > summary'));
  assert.equal(await page.getAttribute('article .toc-mobile > summary', 'aria-expanded'), null);
  await page.goto(base + '/', { waitUntil: 'load' });
  // The homepage (redesigned 2026-09-29 and revised 2026-10-03, #4) carries the feature-card destinations as
  // its "Start building" items, so their order follows them; the Playground is gone and SDKs joined them.
  const cards = await page.$$eval('.feature-card', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  const byHref = (a: string[], b: string[]) => a[0].localeCompare(b[0]);
  assert.deepEqual(cards.sort(byHref), [
    ['/intro', '', ''], ['/installation/models', '', ''], ['/api', '', ''], ['/installation/claude-code', '', ''],
    ['/billing/subscription-plans', '', ''], ['/installation/scripts', '', ''],
  ].sort(byHref));
  const nav = await page.$$eval('.navbar a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
  // Two header rows (canary step 5a): logo and account actions, then the section tabs with Blog.
  assert.deepEqual(nav, ['/', 'https://apertis.ai/login', 'https://apertis.ai/register', '/intro', '/api', '/blog/', 'https://apertis.ai/changelog']);
  await context.close();
});

const CHAT = '/api/text-generation/chat-completions/';

test('the drawer really locks page scrolling at 390x844 (wheel and touch)', { skip }, async () => {
  const { context, page } = await open(CHAT, MOBILE);
  const y = () => page.evaluate(() => scrollY);
  await page.click('[data-drawer-open]');
  await page.locator('#shell-drawer').waitFor({ state: 'visible' }); // a React island: opens once hydrated
  await page.mouse.move(380, 500);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(400);
  assert.equal(await y(), 0, 'wheel over the backdrop must not scroll the page');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', { x: 380, y: 600, yDistance: -500, gestureSourceType: 'touch', speed: 2000 });
  await page.waitForTimeout(400);
  assert.equal(await y(), 0, 'touch scroll over the backdrop must not scroll the page');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.hasAttribute('data-scroll-locked'));
  await page.mouse.wheel(0, 800);
  await page.waitForFunction(() => scrollY > 0, null, { timeout: 3000 });
  await context.close();
});

test('code blocks are full width and their tokens are coloured in both themes', { skip }, async () => {
  const { context, page } = await open(CHAT);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t: string) => { document.documentElement.dataset.theme = t; }, theme);
    const r = await page.evaluate(() => {
      const art = document.querySelector('article.docs-content')!;
      const pre = art.querySelector('pre.astro-code')!;
      const body = getComputedStyle(art).color;
      const tokens = new Set([...pre.querySelectorAll('.line span')].map((s) => getComputedStyle(s).color));
      const a = art.getBoundingClientRect(), p = pre.getBoundingClientRect();
      return { body, tokens: [...tokens], left: p.left - a.left, right: a.right - p.right };
    });
    assert.ok(r.tokens.filter((c: string) => c !== r.body).length >= 2, `${theme}: tokens ${r.tokens} vs body ${r.body}`);
    assert.ok(Math.abs(r.left) <= 1 && Math.abs(r.right) <= 1, `${theme}: code inset ${r.left}/${r.right}`);
  }
  await context.close();
});

test('admonitions carry per-type token styling in both themes', { skip }, async () => {
  const { context, page } = await open('/installation/claude-code/');
  // Reading layout (#8) replaces the legacy Infima gradients: a panel with a hairline, a 3px stripe in the
  // type colour and a mono uppercase title in the same colour. note, tip, info, warning = caution, danger.
  const tokenOf: Record<string, string> = { note: 'note', tip: 'tip', info: 'info', warning: 'warning', caution: 'warning', danger: 'danger' };
  assert.ok((await page.$$('article aside.admonition')).length >= 2, 'the page has converted admonitions');
  await page.evaluate((types: string[]) => {
    const art = document.querySelector('article')!;
    for (const t of types) art.insertAdjacentHTML('beforeend', `<aside class="admonition admonition-${t}" data-probe><p class="admonition-title">${t}</p><p>Body</p></aside>`);
  }, Object.keys(tokenOf));
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t: string) => { document.documentElement.dataset.theme = t; }, theme);
    const got = await page.$$eval('aside[data-probe]', (els: HTMLElement[]) => els.map((el) => {
      const cs = getComputedStyle(el), title = getComputedStyle(el.querySelector('.admonition-title')!);
      const probe = document.createElement('i');
      document.body.append(probe);
      const token = (name: string) => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const type = el.className.replace('admonition admonition-', '');
      const r = { type, stripe: cs.borderLeftColor, width: cs.borderLeftWidth, bg: cs.backgroundColor, image: cs.backgroundImage,
        title: title.color, transform: title.textTransform, font: title.fontFamily, panel: token('--panel'),
        tokens: Object.fromEntries(['note', 'tip', 'info', 'warning', 'danger'].map((t) => [t, token(`--adm-${t}`)])) };
      probe.remove();
      return r;
    }));
    for (const g of got) {
      const want = g.tokens[tokenOf[g.type]];
      assert.deepEqual([g.stripe, g.width, g.bg, g.image, g.title, g.transform], [want, '3px', g.panel, 'none', want, 'uppercase'], `${theme} ${g.type}`);
      assert.match(g.font, /monospace/, `${theme} ${g.type} title font`);
    }
    assert.equal(new Set(got.map((g: { stripe: string }) => g.stripe)).size, 5, `${theme}: five distinct type colours`);
  }
  await context.close();
});

test('wide tables scroll inside the content column and size columns to their content', { skip }, async () => {
  const { context, page } = await open('/api/text-generation/messages/', { viewport: { width: 1100, height: 900 } });
  const tables = () => page.$$eval('article table', (ts: HTMLElement[]) => ts.map((t) => {
    const a = t.closest('article')!.getBoundingClientRect(), r = t.getBoundingClientRect();
    return { spill: Math.round(r.right - a.right), scroll: t.scrollWidth > t.clientWidth + 1, overflow: getComputedStyle(t).overflowX };
  }));
  const narrow = await tables();
  assert.deepEqual(narrow.filter((t: { spill: number }) => t.spill > 0), [], 'no table crosses into the TOC column');
  assert.ok(narrow.some((t: { scroll: boolean; overflow: string }) => t.scroll && t.overflow === "auto"), 'the widest table scrolls horizontally');
  await page.goto(base + CHAT, { waitUntil: 'load' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = await page.$eval('article table', (t: HTMLElement) => ({
    width: Math.round(t.getBoundingClientRect().width), cols: [...t.querySelector('tr')!.children].map((c) => Math.round(c.getBoundingClientRect().width)),
  }));
  // At 1440 the table fills the 792 px content column (tables may use the full column; prose stops at the
  // measure). Reading layout (#8) restyles the cells (mono header labels), so the legacy pixel sizes
  // (104/69/617) no longer hold; what they stood for does: auto layout, where the short Header and Type
  // columns shrink to their content and the description column takes the rest.
  assert.ok(Math.abs(first.width - 792) <= 2, `table width ${first.width}`);
  assert.equal(first.cols.length, 3);
  assert.ok(first.cols[0] >= 40 && first.cols[0] < 140 && first.cols[1] >= 30 && first.cols[1] < 100 && first.cols[2] > 0.7 * first.width, `columns ${first.cols}`);
  const mobile = await open('/api/text-generation/messages/', MOBILE);
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow at 390');
  assert.ok((await mobile.page.$$eval('article table', (ts: HTMLElement[]) => ts.map((t) => t.scrollWidth > t.clientWidth))).some(Boolean));
  await mobile.context.close();
  await context.close();
});

test('the desktop TOC follows the legacy rule: h3s show only under the active h2', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const visible = () => page.$$eval('.doc-page__toc a', (as: HTMLElement[]) => as.filter((a) => a.offsetParent !== null).map((a) => a.textContent!.trim()));
  const active = () => page.$$eval('.doc-page__toc a.active', (as: HTMLElement[]) => as.map((a) => a.textContent!.trim()));
  assert.deepEqual(await visible(), ['HTTP Request', 'Optional Headers', 'Optional Parameters']);
  assert.deepEqual(await active(), ['HTTP Request']);
  // Next heading below the navbar but in the lower half of the viewport: the heading before it is active.
  const expected = await page.evaluate(() => {
    const hs = [...document.querySelectorAll<HTMLElement>('article.docs-content :is(h2, h3)[id]')];
    const y = (h: HTMLElement) => h.getBoundingClientRect().top + scrollY;
    const at = innerHeight / 2 + 10; // just below the top half
    const i = hs.findIndex((h, k) => k > 0 && y(h) - y(hs[k - 1]) > at);
    scrollTo(0, y(hs[i]) - at);
    return hs[i - 1].id;
  });
  await page.waitForFunction((id: string) => (document.querySelector('.doc-page__toc a.active') as HTMLAnchorElement | null)?.hash === `#${id}`, expected);
  await page.evaluate(() => document.getElementById('request-timeout')!.scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.doc-page__toc a.active')?.textContent?.trim() === 'Request Timeout');
  assert.deepEqual(await visible(), ['HTTP Request', 'Optional Headers', 'Optional Parameters', 'Context Compression', 'Request Timeout']);
  await page.goto(base + '/api/', { waitUntil: 'load' });
  assert.deepEqual(await visible(), ['Quick Links', 'Text Generation', 'Multimodal', 'Utilities', 'SDKs & Libraries', 'Base URL', 'Authentication']);
  await context.close();
});

test('a converted page has exactly one H1 and TOC links equal its h2/h3 ids', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/');
  assert.equal(await page.$$eval('h1', (hs: Element[]) => hs.length), 1);
  const ids = await page.$$eval('article.docs-content :is(h2, h3)[id]', (hs: Element[]) => hs.map((h) => h.id));
  assert.ok(ids.length > 3);
  for (const toc of ['.doc-page__toc', '.toc-mobile']) {
    assert.deepEqual(await page.$$eval(`${toc} a`, (as: HTMLAnchorElement[]) => as.map((a) => decodeURIComponent(a.hash.slice(1)))), ids, toc);
  }
  await context.close();
});

test('prev/next only link converted pages', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/');
  const served = new Set(liveManifest().documents.map((d) => d.servedPath));
  const hrefs = await page.$$eval('.pagination a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
  assert.ok(hrefs.length > 0);
  for (const h of hrefs) assert.ok(served.has(h!), `${h} has no manifest entry`);
  await context.close();
});

// ---- #8 reading layout (openspec docs-shell-interfaces "Reading layout and page header") ----
const QS = '/getting-started/quick-start/';
const pageMeta = (): Record<string, { updated: string; readingMinutes: number }> =>
  JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/content/docs/page-meta.json'), 'utf8'));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shownDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

/** Top edges, in document order, of the page-header parts and what follows them. */
const layout = (page: { evaluate: Function }) => page.evaluate(() => {
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);
  const top = (el: Element | null) => (el && (el as HTMLElement).offsetParent !== null ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
  const hr = q('article .doc-header__rule')!;
  const firstBody = hr.nextElementSibling;
  return {
    navbarBottom: Math.round(q('.navbar')!.getBoundingClientRect().bottom),
    breadcrumbs: top(q('.breadcrumbs')), tag: top(q('article .doc-header__tag')), h1: top(q('article .doc-header h1')),
    desc: top(q('article .doc-header__desc')), meta: top(q('article .doc-meta')), actions: top(q('article .doc-header .page-actions')),
    toc: top(q('article .toc-mobile')), rule: top(hr), body: top(firstBody),
    actionsBottom: Math.round(q('article .page-actions')!.getBoundingClientRect().bottom), metaBottom: Math.round(q('article .doc-meta')!.getBoundingClientRect().bottom),
    ruleWidth: Math.round(hr.getBoundingClientRect().width), articleWidth: Math.round(q('article')!.getBoundingClientRect().width),
    firstBodyText: firstBody?.textContent?.trim() ?? '',
  };
});

test('every document page opens with the header block: tag, title, description, meta and actions, then a hairline', { skip }, async () => {
  const { context, page } = await open(QS);
  const doc = liveManifest().documents.find((d) => d.servedPath === QS)!;
  const meta = pageMeta()[doc.id];
  const text = (sel: string) => page.$eval(sel, (e: HTMLElement) => e.innerText.trim());
  assert.equal(await text('article .doc-header__tag'), 'Getting Started'); // the inventory label as written (operator review 2026-10-03)
  assert.equal(await page.$eval('article .doc-header__tag', (e: HTMLElement) => e.textContent), 'Getting Started');
  assert.equal(await text('article .doc-header h1'), 'Quick Start');
  const desc = await text('article .doc-header__desc');
  assert.equal(desc, 'Get up and running with the Apertis API in under 5 minutes.');
  assert.deepEqual(await page.$$eval('article .doc-meta dt', (d: HTMLElement[]) => d.map((e) => e.textContent)), ['Updated', 'Reading time']);
  assert.deepEqual(await page.$$eval('article .doc-meta dd', (d: HTMLElement[]) => d.map((e) => e.textContent)), [shownDate(meta.updated), `${meta.readingMinutes} min`]);
  assert.equal(await page.getAttribute('article .doc-meta time', 'datetime'), meta.updated);
  const l = await layout(page);
  assert.ok(l.tag! < l.h1! && l.h1! < l.desc! && l.desc! < l.meta! && l.meta! < l.rule! && l.rule! < l.body!, JSON.stringify(l));
  // Desktop: the page actions sit at the right of the title row (the Claude Docs pattern, canary step 4 on
  // 2026-09-30; m9-shell checks the alignment), above the meta row; the hairline spans the content column.
  // The page actions are a React island: its <astro-island> wrapper (display: contents) sits in between.
  assert.ok(await page.$('article .doc-header > .doc-header__actions > astro-island > .page-actions'), 'the page actions have their own header slot');
  assert.ok(l.actions !== null && l.actionsBottom < l.meta!, `actions ${l.actions}-${l.actionsBottom} vs meta ${l.meta}-${l.metaBottom}`);
  assert.equal(l.ruleWidth, l.articleWidth);
  assert.equal(l.toc, null, 'the mobile TOC disclosure is hidden on desktop');
  // The description moved out of the lead paragraph, so the body does not repeat it.
  assert.ok(!l.firstBodyText.startsWith(desc.slice(0, 20)), `body repeats the description: ${l.firstBodyText}`);
  assert.equal(await page.$$eval('article p', (ps: HTMLElement[]) => ps.filter((p) => p.textContent!.includes('Get up and running')).length), 1);
  // Search indexes the title and body, not the header chrome.
  assert.deepEqual(await page.$$eval('article .doc-header > *', (els: HTMLElement[]) => els.map((e) => [e.className || e.tagName, e.hasAttribute('data-pagefind-ignore')])),
    [['doc-header__tag', true], ['H1', false], ['doc-header__desc', false], ['doc-header__meta', true], ['doc-header__actions', true]]);
  // No category (the API overview has an empty sidebar trail) and no sidebar at all: no tag, the rest stays.
  for (const p of ['/api/', '/help/ideas/']) {
    await page.goto(base + p, { waitUntil: 'load' });
    assert.equal(await page.$('article .doc-header__tag'), null, p);
    assert.equal(await page.$$eval('article .doc-header h1', (h: Element[]) => h.length), 1, p);
    assert.ok((await text('article .doc-header__desc')).length > 10, p);
    assert.ok(await page.isVisible('article .doc-meta'), p);
  }
  // No qualifying description (the body opens with code; later paragraphs are never borrowed): no element
  // and no gap, the meta row follows the title at its usual distance.
  await page.goto(base + CHAT, { waitUntil: 'load' });
  assert.equal(await page.$('article .doc-header__desc'), null);
  const gap = await page.evaluate(() => {
    const h1 = document.querySelector('article .doc-header h1')!.getBoundingClientRect();
    const meta = document.querySelector<HTMLElement>('article .doc-header__meta')!;
    return { gap: Math.round(meta.getBoundingClientRect().top - h1.bottom), margin: parseFloat(getComputedStyle(meta).marginTop) };
  });
  assert.equal(gap.gap, Math.round(gap.margin), JSON.stringify(gap));
  await context.close();
});

test('on a phone the title block comes first, then the page actions and the "On this page" disclosure', { skip }, async () => {
  const { context, page } = await open(QS, MOBILE);
  const l = await layout(page);
  // Below the navbar: breadcrumb, then tag, title, description and meta, then actions, disclosure, hairline, body.
  assert.ok(l.breadcrumbs! >= l.navbarBottom && l.breadcrumbs! < l.tag!, JSON.stringify(l));
  const order = [l.tag, l.h1, l.desc, l.meta, l.actions, l.toc, l.rule, l.body];
  assert.ok(order.every((y) => y !== null) && order.every((y, i) => i === 0 || y! > order[i - 1]!), JSON.stringify(l));
  assert.ok(l.actions! >= l.metaBottom, 'actions sit below the meta row');
  const summary = 'article .toc-mobile > summary';
  // The disclosure is a React island: it states aria-expanded once hydrated (never before, see the no-JS test).
  await page.waitForSelector(`${summary}[aria-expanded]`, { state: 'attached' });
  assert.equal(await page.getAttribute(summary, 'aria-expanded'), 'false');
  assert.ok(await page.$(`${summary} svg`), 'chevron icon');
  await page.click(summary);
  await page.waitForFunction((s: string) => document.querySelector(s)!.getAttribute('aria-expanded') === 'true', summary);
  assert.ok(await page.isVisible('article .toc-mobile .toc a'));
  await page.click(summary);
  await page.waitForFunction((s: string) => document.querySelector(s)!.getAttribute('aria-expanded') === 'false', summary);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
  await context.close();
});

test('reading type: 17px body at ~1.65, prose measure <= 70ch, sans headings clearly above body, code at ~1.7', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const t = await page.evaluate(() => {
    const art = document.querySelector('article.docs-content')!;
    const cs = (el: Element) => getComputedStyle(el);
    const p = [...art.querySelectorAll(':scope > p')].find((x) => x.getBoundingClientRect().width > 0)!;
    const ch = document.createElement('span');
    ch.style.cssText = 'display:inline-block;width:1ch';
    p.append(ch);
    const chPx = ch.getBoundingClientRect().width;
    ch.remove();
    const px = (v: string) => parseFloat(v);
    const pre = art.querySelector('pre')!;
    return {
      body: px(cs(p).fontSize), lh: px(cs(p).lineHeight) / px(cs(p).fontSize), measure: px(cs(p).maxWidth) / chPx, pmax: px(cs(p).maxWidth),
      article: art.getBoundingClientRect().width, pre: pre.getBoundingClientRect().width,
      h1: [px(cs(art.querySelector('h1')!).fontSize), Number(cs(art.querySelector('h1')!).fontWeight), cs(art.querySelector('h1')!).fontFamily],
      h2: [px(cs(art.querySelector('h2')!).fontSize), cs(art.querySelector('h2')!).fontFamily],
      h3: px(cs(art.querySelector('h3')!).fontSize), h3face: [cs(art.querySelector('h3')!).fontFamily, cs(art.querySelector('h3')!).fontWeight],
      code: px(cs(pre).lineHeight) / px(cs(pre).fontSize), mono: cs(pre).fontFamily,
    };
  });
  assert.equal(t.body, 17);
  assert.ok(Math.abs(t.lh - 1.65) < 0.02, `line-height ${t.lh}`);
  assert.ok(t.measure >= 60 && t.measure <= 70, `measure ${t.measure}ch`);
  assert.ok(t.pre > t.pmax && Math.abs(t.pre - t.article) <= 1, `code uses the full column: ${t.pre} vs ${t.article}, prose ${t.pmax}`);
  // Titles, h2 and h3 in the LINE Seed display face at 400 (canary steps 5a and 5b, 2026-09-30): an Inter
  // 600 h3 read heavier than the h2 above it. Inter stays the text face (h4 and below, body).
  assert.ok(t.h1[0] >= 34 && t.h1[0] <= 36 && t.h1[1] === 400 && /^"?LINE Seed"?, Inter/.test(t.h1[2] as string), `h1 ${t.h1}`);
  assert.ok((t.h2[0] as number) >= 1.3 * t.body && /^"?LINE Seed"?, Inter/.test(t.h2[1] as string) && t.h3 >= 1.15 * t.body && t.h3 < (t.h2[0] as number), `h2 ${t.h2} h3 ${t.h3}`);
  assert.ok(/^"?LINE Seed"?, Inter/.test(t.h3face[0]) && t.h3face[1] === '400', `h3 ${t.h3face}`);
  assert.ok(Math.abs(t.code - 1.7) < 0.05, `code line-height ${t.code}`);
  assert.match(t.mono, /^ui-monospace/);
  await context.close();
});

test('every Shiki token class stays >= 4.5:1 on the code panel in both themes', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const classes = [...new Set((await (await fetch(`${base}/_nimbus/shiki.css`)).text()).match(/nb-shiki-[a-z0-9]+/g))];
  assert.ok(classes.length > 10, `${classes.length} token classes`);
  await page.evaluate((cls: string[]) => {
    const pre = document.querySelector('article pre.astro-code')!.cloneNode(false) as HTMLElement;
    pre.dataset.probe = '';
    pre.innerHTML = `<code><span class="line">${cls.map((c) => `<span class="${c}">tok</span>`).join(' ')}</span></code>`;
    document.querySelector('article')!.append(pre);
  }, classes);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t: string) => { document.documentElement.dataset.theme = t; }, theme);
    const low = await page.evaluate(() => {
      // Resolve any CSS colour (rgb, oklch from the relative-colour clamp) through a canvas pixel.
      const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!;
      const rgb = (c: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const pre = document.querySelector<HTMLElement>('pre[data-probe]')!;
      const bg = rgb(getComputedStyle(pre).backgroundColor);
      return [...pre.querySelectorAll('.line > span')].map((s) => [s.className, Math.round(ratio(rgb(getComputedStyle(s).color), bg) * 100) / 100] as const).filter(([, r]) => r < 4.5);
    });
    assert.deepEqual(low, [], `${theme}: token classes under 4.5:1`);
  }
  await context.close();
});

test('the TOC reading progress moves with the page, shifts nothing, never scrolls, and respects reduced motion', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const state = () => page.evaluate(() => {
    const aside = document.querySelector('.doc-page__toc')!.getBoundingClientRect();
    const v = document.querySelector<HTMLElement>('.toc-progress__value')!;
    return { value: v.textContent, now: document.querySelector('.toc-progress')!.getAttribute('aria-valuenow'), width: v.getBoundingClientRect().width,
      title: document.querySelector('.doc-page__toc-title')!.getBoundingClientRect().top, aside: aside.width, y: scrollY };
  });
  const top = await state();
  assert.equal(await page.textContent('.doc-page__toc-title'), 'On this page');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.doc-page__toc-title')!).textTransform), 'none', 'sentence case in the text face, as on the Claude docs');
  assert.deepEqual([top.value, top.now], ['0%', '0']);
  const middle = await page.evaluate(() => { scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2); return scrollY; });
  await page.waitForFunction(() => !['0%', '100%'].includes(document.querySelector('.toc-progress__value')!.textContent!));
  const mid = await state();
  assert.equal(mid.y, middle, 'the progress never moves the page');
  assert.ok(Math.abs(mid.width - top.width) < 0.5 && mid.aside === top.aside && mid.title === top.title, 'no layout shift in the rail');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('.toc-progress__value')!.textContent === '100%');
  // The active link's colour transitions (0.16s); compare colours once it has settled, not mid-transition.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))).then(() => undefined));
  // A plain list, as on the Claude docs (operator review 2026-10-04): no tree glyph, h3s indented under their h2,
  // and only the current section in the ink colour.
  const toc = await page.evaluate(() => {
    const links = [...document.querySelectorAll<HTMLElement>('.doc-page__toc .toc a')].filter((a) => a.checkVisibility());
    const h3 = links.find((a) => a.closest('ul ul'));
    const ink = getComputedStyle(document.querySelector('.doc-page__title, h1')!).color;
    return {
      glyphs: links.map((a) => getComputedStyle(a, '::before').content).filter((c) => c !== 'none' && c !== 'normal'),
      indent: h3 ? h3.getBoundingClientRect().left - links[0].getBoundingClientRect().left : null,
      inked: links.filter((a) => getComputedStyle(a).color === ink).map((a) => a.classList.contains('active')),
    };
  });
  assert.deepEqual(toc.glyphs, [], 'no TOC entry draws a glyph');
  assert.ok(toc.indent === null || toc.indent >= 12, `h3 entries are indented (${toc.indent}px)`);
  assert.deepEqual(toc.inked, [true], 'exactly the current section is in the ink colour');
  const reduced = await open(CHAT, { ...DESKTOP, reducedMotion: 'reduce' });
  assert.equal(await reduced.page.$eval('.toc-progress__fill', (e: Element) => getComputedStyle(e).transitionDuration), '0s');
  assert.notEqual(await page.$eval('.toc-progress__fill', (e: Element) => getComputedStyle(e).transitionDuration), '0s');
  await reduced.context.close();
  await context.close();
});

test('no GitHub raw or other-release requests and no uncaught page errors', { skip }, () => {
  // Google Fonts (inherited from legacy) and #9's Turnstile, loaded when the Ask surface opens: its script
  // and its own challenge-platform requests, all on the one provider host the legacy site uses.
  const allowed = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'challenges.cloudflare.com']);
  // A `blob:` URL (Turnstile's worker) belongs to the origin that created it: judge that origin.
  const origin = (u: string) => { const url = new URL(u); return url.protocol === 'blob:' ? new URL(url.pathname) : url; };
  // The footer's service status reads BetterStack's public status JSON, as the apertis.ai footer does.
  const allowedUrls = new Set(['https://status.apertis.ai/index.json']);
  assert.deepEqual(external.filter((u) => { const url = origin(u); return !allowedUrls.has(u) && (url.protocol !== 'https:' || !allowed.has(url.host)); }), []);
  assert.deepEqual(errors, []);
});
