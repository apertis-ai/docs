// /models/ and /changelog/ in a browser (openspec docs-live-catalog), against a running preview:
//   PREVIEW_URL=http://127.0.0.1:8805 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/live-catalog-browser.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const json = (f: string) => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/catalog', f), 'utf8'));

async function open(url: string, options: { javaScriptEnabled?: boolean; viewport?: { width: number; height: number } } = {}, route?: (r: any) => Promise<void>) {
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext(options);
  if (route) await context.route('**/_nimbus/catalog', route);
  const page = await context.newPage();
  await page.goto(base + url, { waitUntil: 'networkidle' });
  return { page, close: () => browser.close() };
}
const visible = (page: any, sel: string) => page.$$eval(sel, (els: HTMLElement[]) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.category ?? e.id));

test('changelog: every note listed newest first with its anchor, the feed advertised; selecting fix leaves only fix notes', { skip }, async () => {
  const notes = json('changelog.json');
  const { page, close } = await open('/changelog/');
  try {
    assert.equal(await page.getAttribute('link[rel="alternate"][type="application/rss+xml"]', 'href'), '/changelog/rss.xml');
    assert.deepEqual(await page.$$eval('.note', (els: HTMLElement[]) => els.map((e) => e.id)), notes.map((n: { version: string }) => n.version));
    assert.equal((await visible(page, '.note')).length, notes.length);
    await page.click('label:has(#category-fix)');
    const shown = await visible(page, '.note');
    assert.ok(shown.length > 0 && shown.length < notes.length);
    assert.deepEqual([...new Set(shown)], ['fix']);
    assert.equal(shown.length, notes.filter((n: { category: string }) => n.category === 'fix').length);
    await page.click('label:has(#category-all)');
    assert.equal((await visible(page, '.note')).length, notes.length);
    // Raw HTML in a note body is never markup: no element from it, and no script anywhere in the notes.
    assert.equal(await page.$$eval('.note__content script, .note__content [align], .note__content img[width]', (els: Element[]) => els.length), 0);
    assert.equal(await page.getAttribute('.navbar__links a[aria-current="true"]', 'href'), '/changelog/');
  } finally {
    await close();
  }
});

test('changelog without JavaScript: every note is listed', { skip }, async () => {
  const { page, close } = await open('/changelog/', { javaScriptEnabled: false });
  try {
    assert.equal((await visible(page, '.note')).length, json('changelog.json').length);
  } finally {
    await close();
  }
});

test('models without JavaScript: the full table from the snapshot, no filter controls', { skip }, async () => {
  const { page, close } = await open('/models/', { javaScriptEnabled: false });
  try {
    assert.equal(await page.$$eval('[data-rows] tr', (r: Element[]) => r.length), json('models.json').models.length);
    assert.equal(await page.isVisible('[data-filters]'), false);
  } finally {
    await close();
  }
});

test('models: the live catalog replaces the rows; text, provider and category filters narrow them; a failing catalog keeps the snapshot', { skip }, async () => {
  const live = { version: 'x', models: [
    { id: 'live-a', name: 'Live <b>A</b>', provider: 'OpenAI', category: 'chat', context: 1000000, charge: 'Pay As You Go', price: { kind: 'token', input: '$2.00', output: '$10.00' } },
    { id: 'live-b', name: 'Live B', provider: 'NewCo', category: 'video', context: null, charge: 'Pay Per Request', price: { kind: 'request', price: '$1.26' } },
    { id: 'live-c', name: 'Live C', provider: 'OpenAI', category: 'embedding', context: 8000, charge: 'Pay As You Go', price: { kind: 'token', input: '$0.02', output: null } },
  ] };
  const { page, close } = await open('/models/', {}, (r) => r.fulfill({ json: live }));
  try {
    await page.waitForFunction(() => document.querySelectorAll('[data-rows] tr').length === 3);
    const rows = () => page.$$eval('[data-rows] tr:not([hidden])', (r: HTMLElement[]) => r.map((t) => [...t.children].map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())));
    assert.deepEqual((await rows())[1], ['Live B live-b', 'NewCo', 'Video', '—', 'Pay Per Request', '$1.26 / request', '']);
    assert.equal(await page.$$eval('[data-rows] b', (e: Element[]) => e.length), 0, 'names are text, never markup');
    assert.equal(await page.getAttribute('[data-rows] tr a', 'href'), 'https://apertis.ai/models/live-a');
    await page.selectOption('select[name="provider"]', 'NewCo');
    assert.deepEqual((await rows()).map((r: string[]) => r[0]), ['Live B live-b']);
    await page.selectOption('select[name="provider"]', '');
    await page.selectOption('select[name="category"]', 'embedding');
    assert.deepEqual((await rows()).map((r: string[]) => r[0]), ['Live C live-c']);
    await page.selectOption('select[name="category"]', '');
    await page.fill('input[name="q"]', 'LIVE-A');
    assert.deepEqual((await rows()).map((r: string[]) => r[0]), ['Live <b>A</b> live-a']);
    assert.equal(await page.textContent('[data-count]'), '1 model');
    await page.fill('input[name="q"]', 'nothing matches');
    assert.equal(await page.isVisible('[data-empty]'), true);
  } finally {
    await close();
  }
  const failing = await open('/models/', {}, (r) => r.fulfill({ status: 502, json: { error: 'catalog unavailable' } }));
  try {
    assert.equal(await failing.page.$$eval('[data-rows] tr', (r: Element[]) => r.length), json('models.json').models.length);
    assert.equal(await failing.page.isVisible('[data-filters]'), true);
  } finally {
    await failing.close();
  }
});

test('models on a phone: the table scrolls inside its frame, the page does not', { skip }, async () => {
  const { page, close } = await open('/models/', { viewport: { width: 390, height: 844 } }, (r) => r.abort());
  try {
    const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: innerWidth, frame: document.querySelector('.catalog__scroll')!.scrollWidth }));
    assert.ok(m.doc <= m.view, `page is ${m.doc}px wide in a ${m.view}px viewport`);
    assert.ok(m.frame > m.view, 'the table is wider than the phone and scrolls in its frame');
  } finally {
    await close();
  }
});
