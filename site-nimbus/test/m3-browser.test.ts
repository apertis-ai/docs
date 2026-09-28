// #8 shell in a real browser (system Chrome via Playwright) against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8802 PLAYWRIGHT=<path>/playwright/index.mjs npm run test:m3-browser
// Use a localhost origin: the Clipboard API only exists in secure contexts. Skipped when either variable
// is unset, so `npm test` stays browser-free. The successful Copy-as-Markdown case serves a stub `.md`
// through page.route (contract evidence); the failure case hits the preview's real 404.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { TITLE_SUFFIX } from '../src/contracts/page.ts';
import type { RouteInventory } from '../src/contracts/navigation.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const inventory: RouteInventory = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../migration/nimbus/route-inventory.json'), 'utf8'),
);
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

  // Real preview: the artifact does not exist yet (#7), so the reader sees the failure and nothing is copied.
  const [miss] = await Promise.all([page.waitForResponse(md), page.click('.page-actions__primary')]);
  assert.equal(miss.status(), 404);
  await page.waitForSelector('.page-actions__status[data-state="error"]');
  assert.match(await page.textContent('.page-actions__status'), /HTTP 404.*Nothing was copied/);
  assert.ok(await page.isVisible('.page-actions__status'));
  assert.equal(await clip(), 'sentinel');

  // Contract stub for the same URL: the copied bytes equal the served artifact.
  const body = '# API Reference\n\nWelcome to the Apertis API Reference.\n';
  await page.route(md, (route: { fulfill: Function }) => route.fulfill({ status: 200, contentType: 'text/markdown; charset=utf-8', body }));
  const [hit] = await Promise.all([page.waitForRequest(md), page.click('.page-actions__primary')]);
  assert.equal(hit.url(), md);
  await page.waitForSelector('.page-actions__status[data-state="ok"]');
  assert.equal(await clip(), body);

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

test('no GitHub raw or other-release requests and no uncaught page errors', { skip }, () => {
  assert.deepEqual(external.filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)), []);
  assert.deepEqual(errors, []);
});
