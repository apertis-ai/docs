// /models/ and /changelog/ in a browser (openspec docs-live-catalog), against a running preview:
//   PREVIEW_URL=http://127.0.0.1:8805 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/live-catalog-browser.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const json = (f: string) => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/catalog', f), 'utf8'));

async function open(url: string, options: { javaScriptEnabled?: boolean; viewport?: { width: number; height: number } } = {}, route?: (r: any) => Promise<void>, changelog: (r: any) => Promise<void> = (r) => r.abort()) {
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext(options);
  if (route) await context.route('**/_nimbus/catalog', route);
  // The page's live swap is tested on its own; elsewhere it is aborted, so the DOM is the build's copy the snapshot describes.
  await context.route('**/_nimbus/changelog', changelog);
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
    // Each note links to its full note on apertis.ai, in a new tab; the page carries no note body.
    assert.deepEqual(await page.$$eval('.note', (els: HTMLElement[]) => els.map((e) => [e.querySelector('.note__more a')?.getAttribute('href'), e.querySelector('.note__more a')?.getAttribute('rel')])),
      notes.map((n: { version: string }) => [`https://apertis.ai/changelog/${encodeURIComponent(n.version)}`, 'noopener']));
    assert.equal(await page.$$eval('.note__content, .note__items', (els: Element[]) => els.length), 0);
    assert.equal(await page.getAttribute('.navbar__links a[aria-current="true"]', 'href'), '/changelog/');
  } finally {
    await close();
  }
});

test('changelog live swap: notes, months and rail come from /_nimbus/changelog, as text; a note newer than the build is scrolled to; a failure keeps the build\'s copy', { skip }, async () => {
  const snapshot = json('changelog.json');
  const live = [
    { version: '9.9.9', date: '2027-01-05', title: '<b>New</b>', description: '', category: 'weird' },
    { version: '9.9.8', date: '2026-12-05', title: 'Two', description: 'A summary', category: 'fix' },
  ];
  const swapped = await open('/changelog/#9.9.9', { viewport: { width: 1440, height: 900 } }, undefined, (r) => r.fulfill({ json: live }));
  try {
    await swapped.page.waitForFunction(() => document.querySelectorAll('.note').length === 2);
    assert.deepEqual(await swapped.page.$$eval('.note', (els: HTMLElement[]) => els.map((e) => [e.id, e.dataset.category, e.querySelector('h2')!.textContent, e.querySelector<HTMLElement>('.note__desc')!.hidden, e.querySelector('.note__more a')!.getAttribute('href')])),
      [['9.9.9', 'weird', '<b>New</b>', true, 'https://apertis.ai/changelog/9.9.9'], ['9.9.8', 'fix', 'Two', false, 'https://apertis.ai/changelog/9.9.8']]);
    assert.equal(await swapped.page.$$eval('.note h2 b', (els: Element[]) => els.length), 0);
    assert.deepEqual(await swapped.page.$$eval('.changelog__month', (els: HTMLElement[]) => els.map((e) => e.id)), ['2027-01', '2026-12']);
    assert.deepEqual(await swapped.page.$$eval('.changelog__rail a', (els: HTMLElement[]) => els.map((e) => [e.getAttribute('href'), e.textContent])), [['#2027-01', 'January 2027'], ['#2026-12', 'December 2026']]);
    assert.equal(await swapped.page.$$eval('input[name="category"]', (els: HTMLInputElement[]) => els.some((e) => e.value === 'weird')), false);
    assert.equal((await visible(swapped.page, '.note')).length, 2);
    assert.equal(await swapped.page.evaluate(() => { const r = document.getElementById('9.9.9')!.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; }), true);
  } finally {
    await swapped.close();
  }
  const failing = await open('/changelog/', {}, undefined, (r) => r.fulfill({ status: 502, json: { error: 'changelog unavailable' } }));
  try {
    assert.deepEqual(await failing.page.$$eval('.note', (els: HTMLElement[]) => els.map((e) => e.id)), snapshot.map((n: { version: string }) => n.version));
  } finally {
    await failing.close();
  }
});

test('changelog layout: a note reads at a 720px measure; a wide screen has a month rail whose links all land; a phone has no rail and no sideways scroll', { skip }, async () => {
  const months = [...new Set(json('changelog.json').map((n: { date: string }) => n.date.slice(0, 7)))];
  const wide = await open('/changelog/', { viewport: { width: 1440, height: 900 } });
  try {
    const measure = await wide.page.$$eval('.note__body', (els: HTMLElement[]) => Math.max(...els.map((e) => e.getBoundingClientRect().width)));
    assert.ok(measure > 600 && measure <= 720, `the note text column is ${measure}px wide`);
    assert.equal(await wide.page.isVisible('.changelog__rail'), true);
    assert.deepEqual(await wide.page.$$eval('.changelog__rail a', (els: HTMLElement[]) => els.map((e) => e.getAttribute('href'))), months.map((m) => `#${m}`));
    for (const m of months) assert.equal(await wide.page.$$eval(`[id="${m}"]`, (els: Element[]) => els.length), 1, `${m} has one anchor`);
    // A month's link lands even while the filter hides the notes of that month.
    await wide.page.click('label:has(#category-fix)');
    await wide.page.click(`.changelog__rail a[href="#${months.at(-1)}"]`);
    assert.ok(await wide.page.evaluate(() => scrollY) > 0);
  } finally {
    await wide.close();
  }
  const phone = await open('/changelog/', { viewport: { width: 390, height: 844 } });
  try {
    assert.equal(await phone.page.isVisible('.changelog__rail'), false);
    assert.ok(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page scrolls sideways at 390px');
  } finally {
    await phone.close();
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

test('models on a phone: each model is a card with its prices in view, nothing scrolls sideways', { skip }, async () => {
  const { page, close } = await open('/models/', { viewport: { width: 390, height: 844 } }, (r) => r.abort());
  try {
    const m = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('.catalog__scroll')!;
      const input = document.querySelector<HTMLElement>('.catalog__table tbody tr td[data-f="input"]')!;
      const r = input.getBoundingClientRect();
      return { doc: document.documentElement.scrollWidth, view: innerWidth, frame: frame.scrollWidth - frame.clientWidth,
        input: input.innerText.trim(), label: getComputedStyle(input, '::before').content, right: r.right, display: getComputedStyle(input.parentElement!).display };
    });
    assert.ok(m.doc <= m.view, `page is ${m.doc}px wide in a ${m.view}px viewport`);
    assert.equal(m.frame, 0, 'the catalog does not scroll sideways');
    assert.equal(m.display, 'grid');
    assert.equal(m.label, '"Input"', 'the price carries its label');
    assert.match(m.input, /^\$/);
    assert.ok(m.right <= m.view, `the input price ends at ${m.right}px`);
    // The filter still hides cards (a grid row must not override [hidden]).
    await page.fill('.catalog__filters input', 'no-such-model-zzz');
    assert.equal(await page.$$eval('.catalog__table tbody tr', (trs: HTMLElement[]) => trs.filter((t) => t.offsetParent !== null).length), 0);
  } finally {
    await close();
  }
});
