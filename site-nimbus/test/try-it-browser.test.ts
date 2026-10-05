// Try it (openspec docs-api-reference-ux "Try it") in a real browser (system Chrome via Playwright) against a
// running `npm run preview`, as m3-browser:
//   PREVIEW_URL=http://127.0.0.1:8803 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/try-it-browser.test.ts
// Skipped when either variable is unset. Every stub case routes https://api.apertis.ai/** to a local reply
// before the page loads; only the last case sends one real request, with a fake key the gateway rejects (401,
// free). No real key is ever used.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const PAGE = '/api/text-generation/chat-completions/';
const API = 'https://api.apertis.ai/';
const KEY = 'sk-invalid-docs-tryit-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
let browser: Any;
before(async () => {
  if (skip) return;
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => browser?.close());

/** Opens PAGE with every request and console message recorded; `stub` answers api.apertis.ai (null = real). */
async function open(stub: ((route: Any) => unknown) | null, init?: () => void, pathname = PAGE) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const requests: { url: string; method: string; headers: Record<string, string>; body: string | null }[] = [];
  const consoleText: string[] = [];
  const errors: string[] = [];
  page.on('request', async (r: Any) => requests.push({ url: r.url(), method: r.method(), headers: await r.allHeaders().catch(() => r.headers()), body: r.postData() }));
  page.on('console', (m: Any) => consoleText.push(m.text()));
  page.on('pageerror', (e: Error) => errors.push(e.message));
  if (stub) await page.route(`${API}**`, stub);
  await page.goto(base + pathname, { waitUntil: 'load' });
  const api = () => requests.filter((r) => r.url.startsWith(API) && r.method !== 'OPTIONS');
  return { context, page, requests, consoleText, errors, api };
}

/** Opens the first Try it panel and enters the key. */
async function openPanel(page: Any, trigger = '.try-it-open >> nth=0') {
  await page.click(trigger);
  await page.locator('.try-it').waitFor();
  await page.fill('.try-it input', KEY);
}
const status = (page: Any) => page.textContent('.try-it__status');

/** The key appears only in the Authorization header of requests to api.apertis.ai: no URL, body, other host,
 *  console line, storage or cookie. */
async function assertKeyContained(o: Awaited<ReturnType<typeof open>>) {
  for (const r of o.requests) {
    assert.ok(!r.url.includes(KEY), `key in URL ${r.url}`);
    assert.ok(!(r.body ?? '').includes(KEY), `key in body to ${r.url}`);
    for (const [name, value] of Object.entries(r.headers)) {
      if (!value.includes(KEY)) continue;
      assert.ok(r.url.startsWith(API) && name === 'authorization' && value === `Bearer ${KEY}`, `key in ${name} to ${r.url}`);
    }
  }
  assert.ok(!o.consoleText.some((t) => t.includes(KEY)), 'key in the console');
  const stored = await o.page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]));
  assert.ok(!stored.includes(KEY), `key in storage or cookies: ${stored}`);
  assert.ok(!JSON.stringify(await o.context.cookies()).includes(KEY), 'key in a cookie');
}

test('Try it loads its panel only on open, and a 200 JSON reply shows status, time and body', { skip }, async () => {
  let seen: Any = null;
  const o = await open((route: Any) => {
    seen = { method: route.request().method(), headers: route.request().headers(), body: route.request().postData() };
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"id":"chatcmpl-stub","choices":[{"message":{"content":"Hello from the stub"}}]}' });
  });
  const { page } = o;
  assert.ok((await page.locator('pre[data-try-it]').count()) >= 1);
  assert.equal(await page.locator('.try-it-open').count(), await page.locator('pre[data-try-it]').count());
  assert.ok(!o.requests.some((r) => r.url.includes('try-it-panel')), 'panel module loaded before Try it was opened');
  await openPanel(page);
  assert.ok(o.requests.some((r) => r.url.includes('try-it-panel')), 'panel module loads on open');
  assert.equal(await page.getAttribute('.try-it-open >> nth=0', 'aria-expanded'), 'true');
  const input = page.locator('.try-it input');
  assert.equal(await input.getAttribute('type'), 'password');
  assert.equal(await input.getAttribute('autocomplete'), 'off');
  assert.equal(await input.getAttribute('name'), null);
  assert.equal(await page.locator('.try-it form').count(), 0);
  assert.match(await page.textContent('.try-it__req'), /^POST\s*https:\/\/api\.apertis\.ai\/v1\/chat\/completions$/);
  assert.match(await page.textContent('.try-it__notice'), /your API key.*billed to your account/);
  const prefilled = await page.inputValue('.try-it textarea');
  JSON.parse(prefilled);

  await page.click('.try-it__send');
  await page.waitForFunction(() => /HTTP 200 .*\d+ ms/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.equal(await page.getAttribute('.try-it__status', 'data-state'), 'ok');
  assert.match(await page.textContent('.try-it__out'), /"content": "Hello from the stub"/);
  assert.equal(seen.method, 'POST');
  assert.equal(seen.headers.authorization, `Bearer ${KEY}`);
  assert.equal(seen.headers['content-type'], 'application/json');
  assert.equal(seen.body, prefilled);
  // Only headers the gateway's CORS preflight allows (CORS_HEADERS in curl.ts).
  const allowed = new Set(['origin', 'content-type', 'accept', 'authorization', 'x-requested-with', 'x-csrf-token', 'api-key']);
  const NAV = /^(accept|origin|referer|user-agent|sec-ch-ua.*)$/;
  assert.deepEqual(Object.keys(seen.headers).filter((h) => !allowed.has(h) && !NAV.test(h)), []);
  assert.equal(o.api().length, 1);

  // Closing removes the panel and the key with it.
  await page.click('.try-it__close');
  assert.equal(await page.locator('.try-it').count(), 0);
  assert.equal(await page.getAttribute('.try-it-open >> nth=0', 'aria-expanded'), 'false');
  assert.ok(!(await page.evaluate((k: string) => document.documentElement.outerHTML.includes(k) || [...document.querySelectorAll('input')].some((i) => i.value === k), KEY)));
  await assertKeyContained(o);
  assert.deepEqual(o.errors, []);
  await o.context.close();
});

test('a text/event-stream reply is shown as it arrives', { skip }, async () => {
  // The page's fetch to the API returns a stream the test feeds chunk by chunk (route.fulfill would buffer it).
  const o = await open((route: Any) => route.abort(), () => {
    const real = window.fetch;
    const w = window as unknown as { __sse: ReadableStreamDefaultController<Uint8Array>; __sseCalls: number };
    w.__sseCalls = 0;
    window.fetch = (input, init) => {
      if (!String(input).startsWith('https://api.apertis.ai/')) return real(input, init);
      w.__sseCalls++;
      const body = new ReadableStream<Uint8Array>({ start: (c) => { w.__sse = c; } });
      return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    };
  });
  const { page } = o;
  await openPanel(page);
  await page.click('.try-it__send');
  const push = (s: string) => page.evaluate((t: string) => (window as unknown as { __sse: ReadableStreamDefaultController<Uint8Array> }).__sse.enqueue(new TextEncoder().encode(t)), s);
  await page.waitForFunction(() => (window as unknown as { __sse?: unknown }).__sse);
  await push('data: {"choices":[{"delta":{"content":"chunk-one"}}]}\n\n');
  await page.waitForFunction(() => document.querySelector('.try-it__out')?.textContent?.includes('chunk-one'));
  assert.ok(!(await page.textContent('.try-it__out')).includes('chunk-two'));
  assert.match(await status(page), /HTTP 200 .*streaming/);
  await push('data: {"choices":[{"delta":{"content":"chunk-two"}}]}\n\ndata: [DONE]\n\n');
  await page.waitForFunction(() => document.querySelector('.try-it__out')?.textContent?.includes('chunk-two'));
  await page.evaluate(() => (window as unknown as { __sse: ReadableStreamDefaultController<Uint8Array> }).__sse.close());
  await page.waitForFunction(() => /HTTP 200 .*\d+ ms/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.equal(await page.evaluate(() => (window as unknown as { __sseCalls: number }).__sseCalls), 1);
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});

test('Cancel aborts a request in flight and the panel can send again', { skip }, async () => {
  // The API fetch never answers on its own; it rejects only when its signal aborts, as a real fetch does.
  const o = await open((route: Any) => route.abort(), () => {
    const real = window.fetch;
    const w = window as unknown as { __aborted: boolean };
    w.__aborted = false;
    window.fetch = (input, init) => {
      if (!String(input).startsWith('https://api.apertis.ai/')) return real(input, init);
      return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => { w.__aborted = true; reject(new DOMException('aborted', 'AbortError')); }));
    };
  });
  const { page } = o;
  await openPanel(page);
  assert.equal(await page.isDisabled('.try-it__cancel'), true);
  await page.click('.try-it__send');
  await page.waitForFunction(() => /Sending/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.equal(await page.isDisabled('.try-it__send'), true);
  await page.click('.try-it__cancel');
  await page.waitForFunction(() => /Cancelled after \d+ ms/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.equal(await page.evaluate(() => (window as unknown as { __aborted: boolean }).__aborted), true);
  assert.equal(await page.isDisabled('.try-it__send'), false);
  assert.equal(await page.isDisabled('.try-it__cancel'), true);
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});

test('an invalid JSON body sends nothing and shows the parse error', { skip }, async () => {
  let routed = 0;
  const o = await open((route: Any) => { routed++; return route.abort(); });
  const { page } = o;
  await openPanel(page);
  await page.fill('.try-it textarea', '{"model": "gpt-4.1",');
  await page.click('.try-it__send');
  await page.waitForFunction(() => /Invalid JSON/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.match(await status(page), /Invalid JSON body, nothing was sent: .+/);
  assert.equal(await page.getAttribute('.try-it__status', 'data-state'), 'error');
  await page.waitForTimeout(300);
  assert.equal(routed, 0);
  assert.equal(o.api().length, 0);
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});

test('a 401 reply and a network failure are shown as errors, and the key is not persisted', { skip }, async () => {
  let fail = false;
  const o = await open((route: Any) => (fail ? route.abort('internetdisconnected')
    : route.fulfill({ status: 401, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"error":{"message":"Invalid API key","type":"invalid_request_error"}}' })));
  const { page } = o;
  await openPanel(page);
  await page.click('.try-it__send');
  await page.waitForFunction(() => /HTTP 401/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.match(await status(page), /HTTP 401 .*\d+ ms/);
  assert.equal(await page.getAttribute('.try-it__status', 'data-state'), 'error');
  assert.match(await page.textContent('.try-it__out'), /Invalid API key/);
  fail = true;
  await page.click('.try-it__send');
  await page.waitForFunction(() => /Network error/.test(document.querySelector('.try-it__status')?.textContent ?? ''));
  assert.equal(await page.getAttribute('.try-it__status', 'data-state'), 'error');
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});

test('real gateway: a fake key gets 401 across CORS, rendered in the panel, with nothing persisted', { skip }, async () => {
  const o = await open(null);
  const { page } = o;
  await openPanel(page);
  const [res] = await Promise.all([
    page.waitForResponse((r: Any) => r.url() === 'https://api.apertis.ai/v1/chat/completions' && r.request().method() === 'POST', { timeout: 30000 }),
    page.click('.try-it__send'),
  ]);
  assert.equal(res.status(), 401);
  await page.waitForFunction(() => /HTTP 401|Network error/.test(document.querySelector('.try-it__status')?.textContent ?? ''), null, { timeout: 30000 });
  const shown = await status(page);
  assert.match(shown, /HTTP 401 .*\d+ ms/, `panel showed: ${shown}`);
  assert.ok((await page.textContent('.try-it__out')).trim().length > 0, 'error body shown');
  console.log(`real gateway: ${shown} | ${(await page.textContent('.try-it__out')).slice(0, 200).replace(/\s+/g, ' ')}`);
  assert.equal(o.api().length, 1);
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});

test('real gateway, Messages: anthropic-version is not sent (named in the panel), and the fake key gets a rendered 401', { skip }, async () => {
  const o = await open(null, undefined, '/api/text-generation/messages/');
  const { page } = o;
  await openPanel(page, '.nb-code-figure:has(pre[data-try-it]:has-text("anthropic-version")) .try-it-open');
  assert.match(await page.textContent('.try-it__dropped'), /Not sent from the browser: anthropic-version \(the gateway's CORS policy/);
  const [res] = await Promise.all([
    page.waitForResponse((r: Any) => r.url() === 'https://api.apertis.ai/v1/messages' && r.request().method() === 'POST', { timeout: 30000 }),
    page.click('.try-it__send'),
  ]);
  assert.equal(res.status(), 401);
  const sentHeaders = await res.request().allHeaders();
  assert.equal(sentHeaders['anthropic-version'], undefined);
  assert.equal(sentHeaders['x-api-key'], undefined);
  assert.equal(sentHeaders.authorization, `Bearer ${KEY}`);
  await page.waitForFunction(() => /HTTP 401|Network error/.test(document.querySelector('.try-it__status')?.textContent ?? ''), null, { timeout: 30000 });
  const shown = await status(page);
  assert.match(shown, /HTTP 401 .*\d+ ms/, `panel showed: ${shown}`);
  console.log(`real gateway (messages): ${shown} | ${(await page.textContent('.try-it__out')).slice(0, 200).replace(/\s+/g, ' ')}`);
  assert.equal(o.api().length, 1);
  await page.click('.try-it__close');
  await assertKeyContained(o);
  await o.context.close();
});
