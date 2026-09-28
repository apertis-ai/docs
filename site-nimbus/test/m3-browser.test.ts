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
  await page.click('[data-drawer-open]');
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
  await page.mouse.click(380, 420); // backdrop, right of the drawer panel
  assert.equal(await page.isVisible('#shell-drawer'), false);
  await page.click('[data-drawer-open]');
  await page.click('#shell-drawer [data-drawer-close]');
  assert.equal(await page.isVisible('#shell-drawer'), false);
  await page.goto(base + '/', { waitUntil: 'load' });
  assert.ok(await noOverflow(), 'no horizontal overflow on / at 390 px');
  await context.close();
});

test('triggers dispatch apertis-docs:open with the right surface; the shell binds no Cmd/Ctrl+K', { skip }, async () => {
  const { context, page } = await open('/api/');
  await page.click('.navbar__search');
  await page.click('.ask-docs-trigger');
  await page.keyboard.press('ControlOrMeta+k');
  assert.deepEqual(await opens(page), [{ surface: 'search' }, { surface: 'ask' }]);
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.click('.hero__search');
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
  const hrefs = await page.$$eval('.page-actions__menu a', (as: HTMLAnchorElement[]) => as.map((a) => [a.dataset.action, a.getAttribute('href'), a.target, a.rel]));
  assert.deepEqual(hrefs, [
    ['claude', `https://claude.ai/new?q=${prompt}`, '_blank', 'noopener noreferrer'],
    ['chatgpt', `https://chatgpt.com/?hints=search&prompt=${prompt}`, '_blank', 'noopener noreferrer'],
    ['cursor', `https://cursor.com/link/prompt?text=${prompt}`, '_blank', 'noopener noreferrer'],
    ['view', md, '_blank', 'noopener noreferrer'],
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
  await page.goto(base + '/', { waitUntil: 'load' });
  const cards = await page.$$eval('.feature-card', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  assert.deepEqual(cards, [
    ['/intro', '', ''], ['/installation/models', '', ''], ['/api', '', ''], ['/installation/claude-code', '', ''],
    ['/billing/subscription-plans', '', ''], ['https://playground.apertis.ai', '_blank', 'noopener noreferrer'],
  ]);
  const nav = await page.$$eval('.navbar a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
  assert.deepEqual(nav, ['/', '/intro', '/api', 'https://apertis.ai/changelog', 'https://apertis.ai/login', 'https://apertis.ai/register']);
  await context.close();
});

const CHAT = '/api/text-generation/chat-completions/';

test('the drawer really locks page scrolling at 390x844 (wheel and touch)', { skip }, async () => {
  const { context, page } = await open(CHAT, MOBILE);
  const y = () => page.evaluate(() => scrollY);
  await page.click('[data-drawer-open]');
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
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const r = await page.evaluate(() => {
      const art = document.querySelector('article.docs-content')!;
      const pre = art.querySelector('pre.astro-code')!;
      const body = getComputedStyle(art).color;
      const tokens = new Set([...pre.querySelectorAll('.line span')].map((s) => getComputedStyle(s).color));
      const a = art.getBoundingClientRect(), p = pre.getBoundingClientRect();
      return { body, tokens: [...tokens], left: p.left - a.left, right: a.right - p.right };
    });
    assert.ok(r.tokens.filter((c) => c !== r.body).length >= 2, `${theme}: tokens ${r.tokens} vs body ${r.body}`);
    assert.ok(Math.abs(r.left) <= 1 && Math.abs(r.right) <= 1, `${theme}: code inset ${r.left}/${r.right}`);
  }
  await context.close();
});

test('admonitions carry the legacy per-type styling in both themes', { skip }, async () => {
  const { context, page } = await open('/installation/claude-code/');
  // Legacy Infima mapping: note->secondary, tip->success, info->info, warning/caution->warning, danger->danger.
  const border: Record<string, string> = {
    note: 'rgb(59, 130, 246)', tip: 'rgb(34, 197, 94)', info: 'rgb(6, 182, 212)',
    warning: 'rgb(245, 158, 11)', caution: 'rgb(245, 158, 11)', danger: 'rgb(239, 68, 68)',
  };
  const title: Record<string, [string, string]> = {
    note: ['rgb(71, 71, 72)', 'rgb(253, 253, 254)'], tip: ['rgb(0, 49, 0)', 'rgb(230, 246, 230)'],
    info: ['rgb(25, 60, 71)', 'rgb(238, 249, 253)'], warning: ['rgb(77, 56, 0)', 'rgb(255, 248, 230)'],
    caution: ['rgb(77, 56, 0)', 'rgb(255, 248, 230)'], danger: ['rgb(75, 17, 19)', 'rgb(255, 235, 236)'],
  };
  assert.ok((await page.$$('article aside.admonition')).length >= 2, 'the page has converted admonitions');
  await page.evaluate((types) => {
    const art = document.querySelector('article')!;
    for (const t of types) art.insertAdjacentHTML('beforeend', `<aside class="admonition admonition-${t}" data-probe><p class="admonition-title">${t}</p><p>Body</p></aside>`);
  }, Object.keys(border));
  for (const [i, theme] of ['light', 'dark'].entries()) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const got = await page.$$eval('aside[data-probe]', (els: HTMLElement[]) => els.map((el) => {
      const cs = getComputedStyle(el);
      return [el.className.replace('admonition admonition-', ''), cs.borderLeftColor, cs.borderLeftWidth, cs.backgroundImage !== 'none',
        getComputedStyle(el.querySelector('.admonition-title')!).color, getComputedStyle(el.querySelector('.admonition-title')!).textTransform];
    }));
    for (const [type, color, width, gradient, titleColor, transform] of got) {
      assert.deepEqual([color, width, gradient, titleColor, transform], [border[type], '4px', true, title[type][i], 'uppercase'], `${theme} ${type}`);
    }
  }
  await context.close();
});

test('wide tables scroll inside the content column and keep legacy column sizing', { skip }, async () => {
  const { context, page } = await open('/api/text-generation/messages/', { viewport: { width: 1100, height: 900 } });
  const tables = () => page.$$eval('article table', (ts: HTMLElement[]) => ts.map((t) => {
    const a = t.closest('article')!.getBoundingClientRect(), r = t.getBoundingClientRect();
    return { spill: Math.round(r.right - a.right), scroll: t.scrollWidth > t.clientWidth + 1, overflow: getComputedStyle(t).overflowX };
  }));
  const narrow = await tables();
  assert.deepEqual(narrow.filter((t) => t.spill > 0), [], 'no table crosses into the TOC column');
  assert.ok(narrow.some((t) => t.scroll && t.overflow === 'auto'), 'the widest table scrolls horizontally');
  await page.goto(base + CHAT, { waitUntil: 'load' });
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = await page.$eval('article table', (t: HTMLElement) => ({
    width: Math.round(t.getBoundingClientRect().width), cols: [...t.querySelector('tr')!.children].map((c) => Math.round(c.getBoundingClientRect().width)),
  }));
  // Legacy build at 1440: 792 px wide, columns 104/69/617 (its X-Timeout cell wraps the same way).
  assert.ok(Math.abs(first.width - 792) <= 2, `table width ${first.width}`);
  [104, 69, 617].forEach((w, i) => assert.ok(Math.abs(first.cols[i] - w) <= 6, `column ${i}: ${first.cols[i]} vs ${w}`));
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
  await page.waitForFunction((id) => (document.querySelector('.doc-page__toc a.active') as HTMLAnchorElement | null)?.hash === `#${id}`, expected);
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

test('no GitHub raw or other-release requests and no uncaught page errors', { skip }, () => {
  assert.deepEqual(external.filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)), []);
  assert.deepEqual(errors, []);
});
