// Search-relevance and performance measurement for the Docusaurus -> Nimbus migration (issue #5).
//
//   PLAYWRIGHT=<path to playwright/index.mjs> node scripts/nimbus/measure.mjs search <baseUrl> [--scope poc|full]
//   PLAYWRIGHT=<path to playwright/index.mjs> node scripts/nimbus/measure.mjs perf   <baseUrl> [--runs 5] [--page /path/]
//
// Both modes drive the reader-facing surface: search opens with Cmd/Ctrl+K, takes typed input,
// and navigates with ArrowDown/Enter, so the same protocol measures the legacy site and a
// candidate without selector coupling. Serve each build with `wrangler pages dev <dir>` on this
// machine; compare only runs taken with the same harness. Protocol and budgets:
// migration/nimbus/budgets.json. Playwright is intentionally not a root dependency.
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const root = new URL('../../migration/nimbus/', import.meta.url);
const budgets = JSON.parse(fs.readFileSync(new URL('budgets.json', root), 'utf8'));
const { queries, hitRule } = JSON.parse(fs.readFileSync(new URL('search-queries.json', root), 'utf8'));

const [mode, rawBase, ...rest] = process.argv.slice(2);
const base = rawBase?.replace(/\/$/, '');
const opt = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const norm = (p) => { const s = p.replace(/#.*$/, ''); return s.length > 1 ? s.replace(/\/$/, '') : s; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const SETTLE_MS = budgets.protocol.searchSettleMs;

const DIALOG = 'dialog[open], [role="dialog"]';
const DIALOG_INPUT = ['input', '[role="combobox"]', 'textarea'].flatMap((i) => DIALOG.split(', ').map((d) => `${d} ${i}:visible`)).join(', ');

// Opens search with Cmd/Ctrl+K. Returns the time until a visible text input inside a dialog
// (`<dialog open>` or role="dialog") exists and whether keyboard focus landed in it. When focus
// did not land (a legacy defect), the input is focused explicitly so relevance can still be
// measured; `keyboardFocus` records it.
async function openSearch(page) {
  const t0 = Date.now();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.locator(DIALOG_INPUT).first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  const ms = Date.now() - t0;
  await page.waitForTimeout(300);
  const keyboardFocus = await input.evaluate((el) => el === document.activeElement);
  if (!keyboardFocus) await input.focus();
  return { ms, keyboardFocus };
}

// Waits until the text of the dialog that holds the focused search input has not changed for
// `searchSettleMs` (max 10 s).
async function settle(page) {
  let last = null, stableSince = Date.now();
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const text = await page.evaluate((sel) => document.activeElement?.closest(sel)?.innerText ?? '', DIALOG);
    if (text !== last) { last = text; stableSince = Date.now(); }
    else if (Date.now() - stableSince >= SETTLE_MS) return;
    await page.waitForTimeout(100);
  }
}

async function search() {
  const scope = opt('scope', 'full');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
  await openSearch(page); // warm the index so the first measured query is not a cold miss
  await page.keyboard.type('warm up');
  await page.waitForTimeout(SETTLE_MS * 2);
  const rows = [];
  let keyboardFocus = true;
  let retyped = 0;
  for (const { q, expect, scope: s } of queries) {
    if (scope === 'poc' && s !== 'poc') continue;
    const top = [];
    for (let i = 0; i < 3; i++) {
      await page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
      keyboardFocus = (await openSearch(page)).keyboardFocus && keyboardFocus;
      await page.keyboard.type(q);
      await settle(page);
      for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown');
      const before = page.url();
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => u.href !== before, { timeout: 3000 }).catch(() => {});
      if (page.url() === before) {
        // A query typed before the index is ready can stay empty (legacy defect, gated separately
        // by the shell spec). Retype it once so this run measures relevance, not readiness.
        retyped++;
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type(q);
        await settle(page);
        for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForURL((u) => u.href !== before, { timeout: 3000 }).catch(() => {});
      }
      const after = page.url();
      top.push(after === before ? null : norm(new URL(after).pathname));
    }
    // ArrowDown clamps at the last result and section results repeat their page, so a path already
    // seen at a better position counts only once.
    const ranked = top.map((p, i) => (top.slice(0, i).includes(p) ? null : p));
    const rank = ranked.findIndex((p) => p && expect.includes(p));
    rows.push({ q, scope: s, expect, top3: ranked, rank: rank >= 0 ? rank + 1 : null, pass: rank >= 0 });
  }
  await browser.close();
  console.log(JSON.stringify({ base, hitRule, measuredAt: new Date().toISOString(), keyboardFocus, retyped, rows }, null, 2));
}

async function measurePage(browser, path, profile) {
  const p = budgets.protocol.profiles[profile];
  const context = await browser.newContext({ viewport: p.viewport, deviceScaleFactor: p.deviceScaleFactor, isMobile: p.isMobile, hasTouch: p.isMobile });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (p.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...p.network });
  if (p.cpuSlowdown > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpuSlowdown });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, tbt: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  // Every same-origin response body is gzip-sized into the bucket of the phase it arrived in.
  // Bodies are awaited before the context closes so no response is dropped.
  const bytes = { html: 0, js: 0, css: 0, data: 0, media: 0, search: 0, unreadable: 0 };
  const pending = [];
  let inflight = 0;
  let phase = 'load';
  page.on('request', (req) => { if (req.url().startsWith(base)) inflight++; });
  const done = (req) => { if (req.url().startsWith(base)) inflight--; };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.on('response', (res) => {
    if (!res.url().startsWith(base) || (res.status() >= 300 && res.status() < 400)) return;
    const ph = phase;
    const type = res.request().resourceType();
    const bucket = ph === 'search' ? 'search'
      : type === 'document' ? 'html' : type === 'script' ? 'js' : type === 'stylesheet' ? 'css'
      : ['image', 'font', 'media'].includes(type) ? 'media' : 'data';
    pending.push(res.body().then((body) => { bytes[bucket] += zlib.gzipSync(body, { level: 9 }).length; }, () => { bytes.unreadable++; }));
  });
  const quiet = async () => {
    const deadline = Date.now() + 120000;
    let since = Date.now();
    while (Date.now() < deadline) {
      if (inflight > 0) since = Date.now();
      else if (Date.now() - since >= 500) return;
      await page.waitForTimeout(100);
    }
    throw new Error(`requests still in flight after 120 s on ${path}`);
  };
  await page.goto(base + path, { waitUntil: 'load', timeout: 120000 });
  await quiet();
  await page.waitForTimeout(1000);
  const { lcp, tbt } = await page.evaluate(() => window.__m);
  phase = 'search';
  const { ms: searchOpenMs, keyboardFocus } = await openSearch(page);
  await page.keyboard.type(budgets.protocol.searchPayloadQuery);
  await settle(page);
  await quiet();
  await Promise.all(pending);
  await context.close();
  return {
    loadAvg1m: os.loadavg()[0], lcp: Math.round(lcp), tbt: Math.round(tbt), searchOpenMs, keyboardFocus: keyboardFocus ? 1 : 0,
    htmlGzip: bytes.html, jsGzip: bytes.js, cssGzip: bytes.css, dataGzip: bytes.data, mediaGzip: bytes.media, searchPayloadGzip: bytes.search, unreadableResponses: bytes.unreadable,
  };
}

async function perf() {
  const runs = Number(opt('runs', budgets.protocol.runs));
  const browser = await chromium.launch({ channel: 'chrome' });
  const out = {};
  for (const profile of Object.keys(budgets.protocol.profiles)) {
    for (const path of budgets.protocol.pages.filter((x) => !opt('page') || x === opt('page'))) {
      const samples = [];
      for (let i = 0; i < runs; i++) samples.push(await measurePage(browser, path, profile));
      const med = Object.fromEntries(Object.keys(samples[0]).map((k) => [k, median(samples.map((s) => s[k]))]));
      (out[profile] ??= {})[path] = { median: med, samples };
      console.error(`${profile} ${path} ${JSON.stringify(med)}`);
    }
  }
  await browser.close();
  console.log(JSON.stringify({ base, runs, measuredAt: new Date().toISOString(), results: out }, null, 2));
}

if (mode === 'search' && base) await search();
else if (mode === 'perf' && base) await perf();
else { console.error('usage: measure.mjs search|perf <baseUrl> [--scope poc|full] [--runs N]'); process.exit(2); }
