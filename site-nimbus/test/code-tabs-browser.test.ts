// Code tab groups in a real browser (openspec docs-api-reference-ux "Code tab groups", "Persisted language choice"):
//   PREVIEW_URL=http://127.0.0.1:8802 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/code-tabs-browser.test.ts
// Skipped when either variable is unset, as test/m3-browser.test.ts.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const CHAT = '/api/text-generation/chat-completions/';
const RESPONSES = '/api/text-generation/responses/';
const KEY = 'apertis-docs:code-tab';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any;
const errors: string[] = [];
before(async () => {
  if (skip) return;
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => browser?.close());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function open(pathname: string, options: Record<string, unknown> = {}, init?: () => void): Promise<{ context: any; page: any }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('pageerror', (e: Error) => errors.push(`${pathname}: ${e.message}`));
  await page.goto(base + pathname, { waitUntil: 'load' });
  return { context, page };
}
/** Per group: tab labels, the selected label(s), visible panels, focused tab, visible no-JS labels and copy buttons. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = (page: any) => page.evaluate(() => [...document.querySelectorAll('.code-tabs')].map((g) => {
  const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
  return {
    listVisible: visible(g.querySelector('[role="tablist"]')!),
    tabs: [...g.querySelectorAll('[role="tab"]')].map((t) => t.textContent),
    selected: [...g.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent),
    shown: [...g.querySelectorAll('.code-tabs__panel')].filter(visible).map((p) => (p as HTMLElement).dataset.tab),
    roles: [...g.querySelectorAll('.code-tabs__panel')].map((p) => p.getAttribute('role')),
    labels: [...g.querySelectorAll('.code-tabs__label')].filter(visible).map((l) => l.textContent),
    focused: g.contains(document.activeElement) ? document.activeElement!.textContent : null,
    copies: [...g.querySelectorAll('.code-tabs__panel')].map((p) => p.querySelectorAll('.nb-code-copy:not(.try-it-open)').length),
  };
}));

test('a group renders as one tablist with only the selected panel shown, each panel keeping its copy button', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const groups = await state(page);
  assert.equal(groups.length, 3);
  for (const g of groups) {
    assert.deepEqual(g.tabs, ['cURL', 'Python', 'JavaScript']);
    assert.deepEqual([g.listVisible, g.selected, g.shown, g.labels, g.roles], [true, ['cURL'], ['cURL'], [], ['tabpanel', 'tabpanel', 'tabpanel']]);
    assert.deepEqual(g.copies, [1, 1, 1]);
  }
  // Untagged request/response fences stay separate plain code blocks.
  const plain = await page.evaluate(() => [...document.querySelectorAll('article pre')].filter((p) => !p.closest('.code-tabs')).length);
  assert.ok(plain >= 1, `${plain} plain code blocks`);
  // The copy button copies the visible panel's code.
  await page.locator('.code-tabs').first().locator('[role="tab"]', { hasText: 'Python' }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const panel = page.locator('.code-tabs').first().locator('.code-tabs__panel[data-tab="Python"]');
  await panel.hover();
  await panel.locator('.nb-code-copy:not(.try-it-open)').click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^from openai import OpenAI\n/);
  await context.close();
});

test('arrow keys, Home and End move between tabs and select them in every group', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const first = page.locator('.code-tabs').first().locator('[role="tab"]').first();
  await first.focus();
  const steps: [string, string][] = [['ArrowRight', 'Python'], ['End', 'JavaScript'], ['ArrowRight', 'cURL'], ['ArrowLeft', 'JavaScript'], ['Home', 'cURL'], ['ArrowLeft', 'JavaScript']];
  for (const [key, label] of steps) {
    await page.keyboard.press(key);
    const groups = await state(page);
    assert.equal(groups[0].focused, label, key);
    for (const g of groups) assert.deepEqual([g.selected, g.shown], [[label], [label]], `${key}: every group on ${label}`);
  }
  await context.close();
});

test('the choice persists: Python on chat completions opens every Python group on responses', { skip }, async () => {
  const { context, page } = await open(CHAT);
  const tab = page.locator('.code-tabs').nth(2).locator('[role="tab"]', { hasText: 'Python' });
  await tab.scrollIntoViewIfNeeded();
  const top = await tab.evaluate((t: Element) => t.getBoundingClientRect().top);
  await tab.click();
  // The clicked tab stays put although the groups above it changed height.
  assert.ok(Math.abs(await tab.evaluate((t: Element) => t.getBoundingClientRect().top) - top) < 1, 'clicked tab kept its position');
  assert.equal(await page.evaluate((k: string) => localStorage.getItem(k), KEY), 'Python');
  await page.goto(base + RESPONSES, { waitUntil: 'load' });
  const groups = await state(page);
  assert.ok(groups.length >= 1);
  for (const g of groups) assert.deepEqual([g.selected, g.shown], [['Python'], ['Python']]);
  // A stored label a group lacks leaves it on its first tab and is not overwritten.
  await page.evaluate((k: string) => localStorage.setItem(k, 'TypeScript'), KEY);
  await page.goto(base + RESPONSES, { waitUntil: 'load' });
  for (const g of await state(page)) assert.deepEqual(g.selected, ['cURL']);
  assert.equal(await page.evaluate((k: string) => localStorage.getItem(k), KEY), 'TypeScript');
  await context.close();
});

test('blocked storage falls back to the first tab without error, and selecting still works', { skip }, async () => {
  const seen = errors.length;
  const { context, page } = await open(CHAT, {}, () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  for (const g of await state(page)) assert.deepEqual(g.selected, ['cURL']);
  await page.locator('.code-tabs').first().locator('[role="tab"]', { hasText: 'JavaScript' }).click();
  for (const g of await state(page)) assert.deepEqual(g.shown, ['JavaScript']);
  assert.deepEqual(errors.slice(seen), []);
  await context.close();
});

test('without JavaScript every panel is visible and labelled with its tab name', { skip }, async () => {
  const { context, page } = await open(CHAT, { javaScriptEnabled: false });
  for (const g of await state(page)) {
    assert.deepEqual([g.listVisible, g.shown, g.labels], [false, ['cURL', 'Python', 'JavaScript'], ['cURL', 'Python', 'JavaScript']]);
  }
  await context.close();
});

for (const [name, options] of [['desktop', {}], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]] as const) {
  test(`loading with a persisted non-first label causes no layout shift (${name})`, { skip }, async () => {
    const { context, page } = await open(CHAT, options, () => {
      localStorage.setItem('apertis-docs:code-tab', 'Python');
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 500))));
    for (const g of await state(page)) assert.deepEqual(g.shown, ['Python']);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`# CLS ${name} ${CHAT} (persisted Python): ${cls}`);
    assert.ok(cls < 0.01, `CLS ${cls}`);
    await context.close();
  });
}
