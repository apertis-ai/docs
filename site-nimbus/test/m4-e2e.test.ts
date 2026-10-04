// #9 browser proof of the search dialog and the Ask Docs client, against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8803 PLAYWRIGHT=<path to playwright/index.mjs> node --test test/m4-e2e.test.ts
// Skipped (visibly) without both variables, so `npm test` stays hermetic.
// Evidence classes: every /api/ask stub and the Turnstile stub are CONTRACT evidence; the one test that
// lets /api/ask reach the root Pages Function is LOCAL-BUILD evidence. No request leaves the preview
// origin: challenges.cloudflare.com is always stubbed, anything else off-origin is aborted and counted.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ManifestDocument } from '../src/contracts/manifest.ts';
import { manifest } from '../src/manifest/manifest.ts';
import { buildSearchIndex, searchDocuments } from '../src/search/index-build.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = base && process.env.PLAYWRIGHT ? false : 'set PREVIEW_URL and PLAYWRIGHT to run the browser proof';

type Page = any; // Playwright is not a dependency (see scripts/nimbus/measure.mjs); typed loosely.
let browser: any;
let offOrigin: string[] = [];

// Expectations come from the manifest, so the proof holds for whatever #7 publishes.
const searchable = searchDocuments(manifest.documents);
const target = searchable[0];
const home = manifest.documents.find((d) => d.servedPath === '/')!;

const sse = (...deltas: string[]) => deltas.map((d) => `data: ${JSON.stringify({ content: d })}\n\n`).join('');
const DONE = 'data: [DONE]\n\n';

type TurnstileMode = 'ok' | 'error' | 'offline' | 'silent';
/**
 * Turnstile stub: 'ok' issues a fresh token per render/reset, 'error' reports 110200, 'offline' fails to
 * load, 'silent' never calls back. The render options are exposed as `window.__ts` so tests can fire
 * expired/timeout callbacks. `mode.value` may change between loads (retry after a load failure).
 */
async function newPage(turnstile: TurnstileMode | { value: TurnstileMode } = 'ok', options: Record<string, unknown> = { viewport: { width: 1440, height: 900 } }): Promise<Page> {
  const mode = typeof turnstile === 'string' ? { value: turnstile } : turnstile;
  const context = await browser.newContext(options);
  await context.route('**/*', (route: any) => {
    const url = route.request().url();
    if (url.startsWith(base!)) return route.fallback();
    if (url.startsWith('https://challenges.cloudflare.com/') && mode.value !== 'offline') {
      const first = { ok: "o.callback('stub-token-' + (++n))", error: "o['error-callback']('110200')", silent: '0' }[mode.value];
      return route.fulfill({
        contentType: 'text/javascript',
        body: `(() => { let n = 0, o;
          window.turnstile = {
            render(el, opts) { o = window.__ts = opts; setTimeout(() => ${first}, 10); return 'w1'; },
            reset() { setTimeout(() => o.callback('stub-token-' + (++n)), 10); },
          }; })();`,
      });
    }
    // The shell's Google Fonts stylesheet is inherited from legacy (docusaurus.config.js); aborted, not counted.
    if (!url.startsWith('https://challenges.cloudflare.com/') && !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) offOrigin.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e: Error) => offOrigin.push(`pageerror: ${e.message}`));
  return page;
}

async function goto(page: Page, p: string) {
  await page.goto(base + p, { waitUntil: 'load' });
}

const openAsk = (page: Page) => page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));

/** Stubs /api/ask with a fixed response and records every request body. */
async function stubAsk(page: Page, status: number, body: string, contentType = 'text/event-stream') {
  const bodies: unknown[] = [];
  await page.route('**/api/ask', (route: any) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status, contentType, body });
  });
  return bodies;
}

async function ask(page: Page, text: string) {
  await page.locator('#aa-send').waitFor({ state: 'visible' });
  await page.fill('#aa-question', text);
  await page.waitForFunction(() => !(document.getElementById('aa-send') as HTMLButtonElement).disabled);
  await page.press('#aa-question', 'Enter');
}

/** Replaces fetch('/api/ask') with a stream the test drives: __delta(text), __finish(); records __aborted. */
async function controlledAsk(page: Page) {
  await page.addInitScript(() => {
    const realFetch = window.fetch;
    const w = window as any;
    w.__aborted = false;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/ask') return realFetch(input, init);
      const enc = new TextEncoder();
      const body = new ReadableStream({
        start(c) {
          w.__delta = (t: string) => c.enqueue(enc.encode(`data: ${JSON.stringify({ content: t })}\n\n`));
          w.__finish = () => { c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); };
          init?.signal?.addEventListener('abort', () => { w.__aborted = true; c.error(new DOMException('aborted', 'AbortError')); });
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
    };
  });
}

const stored = (page: Page) => page.evaluate(() => {
  const id = sessionStorage.getItem('askai_session_id');
  return JSON.parse(sessionStorage.getItem(`askdocs_messages_${id}`) ?? '[]');
});

const lastAnswer = (page: Page) => page.locator('.aa-msg[data-role="assistant"]').last();

describe('m4 search and Ask Docs (browser)', { skip }, () => {
  before(async () => {
    const { chromium } = await import(process.env.PLAYWRIGHT!);
    browser = await chromium.launch({ channel: 'chrome' });
  });
  after(async () => {
    await browser?.close();
    assert.deepEqual(offOrigin, [], 'no off-origin request or page error');
  });

  test('Cmd/Ctrl+K opens search with focus in the input, locks scroll, Escape closes and restores focus', async () => {
    const page = await newPage();
    await goto(page, '/');
    await page.evaluate(() => {
      const spacer = Object.assign(document.createElement('div'), { style: 'height:5000px' });
      const button = Object.assign(document.createElement('button'), { id: 'opener', textContent: 'opener' });
      document.body.prepend(button);
      document.body.append(spacer);
      button.focus();
    });
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('dialog[open] #aa-q').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'aa-q', 'focus lands in the search input');
    assert.equal(await page.getAttribute('#apertis-assistant', 'aria-label'), 'Search documentation');
    assert.equal(await page.evaluate(() => (document.getElementById('apertis-assistant') as HTMLDialogElement).matches(':modal')), true);
    await page.keyboard.type('api key');
    assert.equal(await page.inputValue('#aa-q'), 'api key', 'typed characters, including spaces, go to the input');
    await page.mouse.wheel(0, 1500);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => scrollY), 0, 'the page behind the open dialog does not scroll');
    await page.keyboard.press('Escape');
    await page.locator('#apertis-assistant').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'opener', 'focus returns to the opener');
    await page.mouse.wheel(0, 1500);
    await page.waitForFunction(() => scrollY > 0);
    // Cmd/Ctrl+K toggles.
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('dialog[open] #aa-q').waitFor();
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('#apertis-assistant').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#apertis-assistant').count(), 1, 'one assistant dialog (the shell may own others)');
    await page.context().close();
  });

  test('apertis-docs:open with a query shows results; Enter opens the selected result; backdrop click closes', async () => {
    const page = await newPage();
    await goto(page, '/');
    await page.evaluate((q: string) => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search', query: q } })), target.title);
    await page.locator('#aa-results [role="option"]').first().waitFor();
    assert.equal(await page.inputValue('#aa-q'), target.title);
    assert.equal(await page.getAttribute('#aa-results [role="option"] >> nth=0', 'aria-selected'), 'true', 'first result selected');
    assert.equal(await page.getAttribute('#aa-q', 'aria-activedescendant'), 'aa-result-0');
    await page.mouse.click(5, 5);
    await page.locator('#apertis-assistant').waitFor({ state: 'hidden' });
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.locator('#aa-results [role="option"]').first().waitFor();
    await page.waitForTimeout(300);
    const first = await page.getAttribute('#aa-results a >> nth=0', 'href');
    await page.keyboard.press('Enter');
    await page.waitForURL(base + first);
    await page.context().close();
  });

  test('switching between Search and Ask Docs keeps one open dialog; only Search locks scroll', async () => {
    const page = await newPage();
    await goto(page, '/');
    const state = () => page.evaluate(() => ({
      open: (document.getElementById('apertis-assistant') as HTMLDialogElement).open,
      surface: document.getElementById('apertis-assistant')!.dataset.surface,
      locked: document.documentElement.classList.contains('aa-scroll-lock'),
    }));
    await page.keyboard.press('ControlOrMeta+k');
    await page.click('#aa-tab-ask');
    await page.waitForTimeout(200);
    assert.deepEqual(await state(), { open: true, surface: 'ask', locked: false });
    assert.deepEqual([await page.isVisible('#aa-q'), await page.isVisible('#aa-question')], [false, true], 'only the Ask surface shows');
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForTimeout(200);
    assert.deepEqual(await state(), { open: true, surface: 'search', locked: true });
    assert.deepEqual([await page.isVisible('#aa-q'), await page.isVisible('#aa-question')], [true, false], 'only the Search surface shows');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'aa-q');
    await page.context().close();
  });

  test('a query typed before the index loads is answered once it loads (defect 10)', async () => {
    const page = await newPage();
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    await page.route('**/pagefind/pagefind.js', async (route: any) => { await held; await route.fallback(); });
    await goto(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.waitForTimeout(300);
    assert.equal(await page.textContent('#aa-status'), 'Loading search index…');
    assert.equal(await page.locator('#aa-results [role="option"]').count(), 0);
    release();
    await page.locator('#aa-results [role="option"]').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const hrefs: string[] = await page.$$eval('#aa-results a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
    assert.ok(hrefs.slice(0, 3).includes(target.servedPath), hrefs.join(', '));
    assert.equal(await page.inputValue('#aa-q'), target.title, 'not retyped');
    await page.context().close();
  });

  test('search payload is lazy: nothing under /pagefind/ loads before the dialog opens', async () => {
    const page = await newPage();
    const loaded: string[] = [];
    page.on('request', (r: any) => { if (r.url().includes('/pagefind/')) loaded.push(r.url()); });
    await goto(page, '/');
    await page.waitForTimeout(1000);
    assert.equal(loaded.length, 0, loaded.join(', '));
    await page.keyboard.press('ControlOrMeta+k');
    for (let i = 0; i < 50 && !loaded.some((u) => u.includes('/pagefind/pagefind-entry.json')); i++) await page.waitForTimeout(100);
    assert.ok(loaded.some((u) => u.includes('/pagefind/pagefind-entry.json')), 'the index loads once search opens');
    await page.context().close();
  });

  // The real failure (#9 repair): the chat-completions page shows its path only inside a URL and code,
  // which Pagefind indexes as one compound word, while another page has the literal `chat/completions`.
  describe('identifiers and punctuation (synthetic Pagefind index served in place of /pagefind/)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4-e2e-index-'));
    const pages: Record<string, string> = {
      '/installation/claude-code/': '<h1>Claude Code</h1><p>Export ANTHROPIC_BASE_URL=https://api.apertis.ai and ANTHROPIC_AUTH_TOKEN.</p>',
      '/api/text-generation/chat-completions/': '<h1>Chat Completion</h1><p>Create a model response for a conversation.</p><pre><code>curl https://api.apertis.ai/v1/chat/completions -H "Content-Type: application/json"</code></pre>',
      // Pagefind keeps a full URL as one word, so the endpoint must also appear on its own (as the real
      // API pages show it above their curl example); see README #9 "Known search limits".
      '/api/text-generation/messages/': '<h1>Messages API</h1><p>POST /v1/messages</p><p>curl https://api.apertis.ai/v1/messages for the Anthropic format.</p>',
      '/api/sdks/ai-sdk-provider/': '<h1>AI SDK Provider</h1><p>npm install @apertis/ai-sdk-provider then import { createApertis } from it.</p>',
      '/billing/rate-limits/': '<h1>Rate Limits</h1><p>Requests over the limit return 429. Chat completions and messages both count.</p>',
      '/getting-started/quick-start/': '<h1>Quick Start</h1><p>Set the base URL and your API key, then call chat/completions. The provider package is optional.</p>',
    };
    const docs = Object.keys(pages).map((servedPath) => ({ servedPath, id: servedPath, eligibility: { publish: true, search: true } }) as ManifestDocument);
    before(async () => {
      for (const [p, body] of Object.entries(pages)) {
        fs.mkdirSync(path.join(dir, p), { recursive: true });
        fs.writeFileSync(path.join(dir, p, 'index.html'), `<html lang="en"><body><article>${body}</article></body></html>`);
      }
      await buildSearchIndex(dir, docs);
    });

    for (const [q, expected] of [
      ['ANTHROPIC_BASE_URL', '/installation/claude-code/'],
      ['chat/completions', '/api/text-generation/chat-completions/'],
      ['/v1/messages', '/api/text-generation/messages/'],
      ['@apertis/ai-sdk-provider', '/api/sdks/ai-sdk-provider/'],
      ['createApertis', '/api/sdks/ai-sdk-provider/'],
    ] as const) {
      test(`"${q}" finds ${expected} in the top 3; ArrowDown/ArrowUp move the selection`, async () => {
        const page = await newPage();
        await page.route('**/pagefind/**', (route: any) => {
          const file = path.join(dir, new URL(route.request().url()).pathname);
          return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
        });
        await goto(page, '/');
        await page.keyboard.press('ControlOrMeta+k');
        await page.keyboard.type(q);
        await page.locator('#aa-results [role="option"]').first().waitFor();
        await page.waitForTimeout(400);
        const hrefs: string[] = await page.$$eval('#aa-results a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
        assert.ok(hrefs.slice(0, 3).includes(expected), `${q}: ${hrefs.join(', ')}`);
        const n = hrefs.length;
        for (let i = 0; i < n + 1; i++) await page.keyboard.press('ArrowDown');
        assert.equal(await page.getAttribute('#aa-q', 'aria-activedescendant'), `aa-result-${n - 1}`, 'ArrowDown clamps at the last result');
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.getAttribute('#aa-q', 'aria-activedescendant'), `aa-result-${Math.max(0, n - 2)}`);
        await page.context().close();
      });
    }
  });

  test('Ask Docs sends exactly the wire request with the current page and renders the answer until [DONE]', async () => {
    const page = await newPage();
    await goto(page, '/');
    const bodies = await stubAsk(page, 200, sse('See ', '[Quick Start](/getting-started/quick-start).') + DONE + sse('ignored'));
    await openAsk(page);
    assert.equal(await page.textContent('#aa-context-title'), home.title);
    assert.equal(await page.evaluate(() => (document.getElementById('apertis-assistant') as HTMLDialogElement).matches(':modal')), false, 'non-blocking');
    await ask(page, 'How do I start?');
    await lastAnswer(page).locator('.aa-sources a').waitFor();
    assert.equal(await lastAnswer(page).evaluate((el: HTMLElement) => { const p = el.querySelector('p')!; return `${p.childNodes[0].textContent}${(p.childNodes[1] as HTMLAnchorElement).textContent}`; }), 'See Quick Start');
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'done');
    assert.equal(await lastAnswer(page).locator('.aa-sources a').getAttribute('href'), '/getting-started/quick-start');
    const body = bodies[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['pageContext', 'question', 'sessionId', 'turnstileToken']);
    assert.equal(body.question, 'How do I start?');
    assert.match(String(body.turnstileToken), /^stub-token-/);
    assert.deepEqual(body.pageContext, { title: home.title, href: '/' });
    assert.equal(body.sessionId, await page.evaluate(() => sessionStorage.getItem('askai_session_id')));
    // A second question needs a fresh one-shot token.
    await ask(page, 'And then?');
    await page.waitForFunction(() => document.querySelectorAll('.aa-msg[data-state="done"]').length === 2);
    assert.notEqual((bodies[1] as Record<string, unknown>).turnstileToken, body.turnstileToken);
    await page.context().close();
  });

  test('the answer renders its Markdown like the legacy widget, as DOM nodes and never as HTML', async () => {
    const page = await newPage();
    await goto(page, '/');
    const md = [
      '**Create a key** in `Settings`:', '',
      '1. Open **Settings → API Keys**.', '2. Click *Create New Key*.', '',
      '- one', '- two', '',
      '```bash', 'curl https://api.apertis.ai/v1/models', '```', '',
      '| Model | Use |', '|---|:--|', '| gpt-5.5 | general |', '',
      '<img src=x onerror="window.__xss=1"> [bad](javascript:window.__xss=1) See [Quick Start](/getting-started/quick-start).',
    ].join('\n');
    await stubAsk(page, 200, sse(md.slice(0, 40), md.slice(40)) + DONE);
    await openAsk(page);
    await ask(page, 'How?');
    const answer = lastAnswer(page);
    await answer.locator('.aa-sources a').waitFor();
    const shape = await answer.evaluate((el: HTMLElement) => ({
      strong: [...el.querySelectorAll('strong')].map((n) => n.textContent),
      em: [...el.querySelectorAll('em')].map((n) => n.textContent),
      inlineCode: [...el.querySelectorAll(':not(pre) > code')].map((n) => n.textContent),
      ol: [...el.querySelectorAll('ol > li')].map((n) => n.textContent),
      ul: [...el.querySelectorAll('ul > li')].map((n) => n.textContent),
      pre: el.querySelector('pre > code')?.textContent,
      table: [...el.querySelectorAll('table tr')].map((r) => [...r.children].map((c) => `${c.tagName}:${c.textContent}`)),
      links: [...el.querySelectorAll(':not(.aa-sources) > a, p a')].map((a) => a.getAttribute('href')),
      img: el.querySelectorAll('img').length,
      raw: /\*\*|```|\|---/.test(el.textContent ?? ''),
    }));
    assert.deepEqual(shape.strong, ['Create a key', 'Settings → API Keys']);
    assert.deepEqual(shape.em, ['Create New Key']);
    assert.deepEqual(shape.inlineCode, ['Settings']);
    assert.deepEqual(shape.ol, ['Open Settings → API Keys.', 'Click Create New Key.']);
    assert.deepEqual(shape.ul, ['one', 'two']);
    assert.equal(shape.pre, 'curl https://api.apertis.ai/v1/models');
    assert.deepEqual(shape.table, [['TH:Model', 'TH:Use'], ['TD:gpt-5.5', 'TD:general']]);
    assert.deepEqual([...new Set(shape.links)], ['/getting-started/quick-start'], 'only safe links become anchors');
    assert.equal(shape.img, 0, 'HTML in the answer stays text');
    assert.equal(shape.raw, false, 'no raw Markdown syntax left');
    assert.equal(await page.evaluate(() => (window as any).__xss), undefined);
    await page.context().close();
  });

  test('streamed content renders incrementally before [DONE]', async () => {
    const page = await newPage();
    await page.addInitScript(() => {
      const realFetch = window.fetch;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) !== '/api/ask') return realFetch(input, init);
        const enc = new TextEncoder();
        const body = new ReadableStream({
          start(c) {
            c.enqueue(enc.encode('data: {"content":"First part"}\n\n'));
            (window as any).__finish = () => {
              c.enqueue(enc.encode('data: {"content":", second part"}\n\ndata: [DONE]\n\n'));
              c.close();
            };
          },
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      };
    });
    await goto(page, '/');
    await openAsk(page);
    await ask(page, 'stream please');
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.textContent === 'First part');
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'streaming');
    await page.evaluate(() => (window as any).__finish());
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.getAttribute('data-state') === 'done');
    assert.equal(await lastAnswer(page).textContent(), 'First part, second part');
    await page.context().close();
  });

  test('a stream that ends without [DONE] is shown as interrupted', async () => {
    const page = await newPage();
    await goto(page, '/');
    await stubAsk(page, 200, sse('Partial answer'));
    await openAsk(page);
    await ask(page, 'q');
    await lastAnswer(page).locator('.aa-note').waitFor();
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'interrupted');
    assert.match(await lastAnswer(page).textContent(), /^Partial answer.*interrupted/);
    await page.context().close();
  });

  for (const [status, body, expected] of [
    [400, { error: 'Missing Turnstile token' }, 'Ask Docs could not answer (HTTP 400): Missing Turnstile token'],
    [403, { error: 'Turnstile verification failed', codes: ['invalid-input-response'] }, 'Ask Docs could not answer (HTTP 403): Turnstile verification failed'],
    [429, { error: 'Query limit reached for this session' }, 'You have reached the query limit. Please refresh to continue.'],
    [500, { error: 'An error occurred processing your request', traceId: 't-1' }, 'Ask Docs could not answer (HTTP 500): An error occurred processing your request'],
    [502, '<html>Bad gateway</html>', 'Ask Docs could not answer (HTTP 502): <html>Bad gateway</html>'],
  ] as const) {
    test(`HTTP ${status} is shown in the panel`, async () => {
      const page = await newPage();
      await goto(page, '/');
      await stubAsk(page, status, typeof body === 'string' ? body : JSON.stringify(body), typeof body === 'string' ? 'text/html' : 'application/json');
      await openAsk(page);
      await ask(page, 'q');
      const alert = page.locator('.aa-msg[data-state="error"][role="alert"]');
      await alert.waitFor();
      assert.equal(await alert.textContent(), expected);
      await page.context().close();
    });
  }

  test('a network failure is shown in the panel', async () => {
    const page = await newPage();
    await goto(page, '/');
    await page.route('**/api/ask', (route: any) => route.abort('connectionrefused'));
    await openAsk(page);
    await ask(page, 'q');
    await page.locator('.aa-msg[data-state="error"]').waitFor();
    assert.match(await page.textContent('.aa-msg[data-state="error"]'), /could not be reached/);
    await page.context().close();
  });

  for (const [mode, expected] of [
    ['error', /Questions can't be sent: this site could not be verified \(Turnstile error 110200\)/],
    ['offline', /Questions can't be sent: the verification check \(Cloudflare Turnstile\) could not be loaded/],
  ] as const) {
    test(`Turnstile ${mode} is a visible message and sending stays disabled (defect 11)`, async () => {
      const page = await newPage(mode);
      await goto(page, '/');
      await openAsk(page);
      await page.waitForFunction(() => document.getElementById('aa-ask-status')?.dataset.kind === 'error');
      assert.match(await page.textContent('#aa-ask-status'), expected);
      assert.equal(await page.isVisible('#aa-ask-status'), true);
      await page.fill('#aa-question', 'hello');
      assert.equal(await page.isDisabled('#aa-send'), true);
      await page.context().close();
    });
  }

  test('page context is read fresh after navigating between pages with the panel open (defect 4)', async () => {
    const page = await newPage();
    await goto(page, '/');
    const bodies: any[] = [];
    await page.context().route('**/api/ask', (route: any) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('ok') + DONE });
    });
    await openAsk(page);
    await ask(page, 'one');
    await page.waitForFunction(() => document.querySelectorAll('.aa-msg[data-state="done"]').length === 1);
    await goto(page, target.servedPath);
    await page.locator('dialog[open] #aa-ask').waitFor();
    assert.equal(await page.textContent('#aa-context-title'), target.title, 'chip names the new page');
    assert.equal(await page.locator('.aa-msg').count(), 2, 'conversation persists for the session');
    await ask(page, 'two');
    await page.waitForFunction(() => document.querySelectorAll('.aa-msg[data-state="done"]').length === 2);
    await page.evaluate(() => { location.hash = 'overview'; });
    await ask(page, 'three');
    await page.waitForFunction(() => document.querySelectorAll('.aa-msg[data-state="done"]').length === 3);
    assert.deepEqual(bodies.map((b) => b.pageContext), [
      { title: home.title, href: '/' },
      { title: target.title, href: target.servedPath },
      { title: target.title, href: `${target.servedPath}#overview` },
    ]);
    await page.context().close();
  });

  test('Ask Docs keyboard: Shift+Enter is a newline, Escape in the composer does not close, elsewhere it does', async () => {
    const page = await newPage();
    await goto(page, '/');
    await openAsk(page);
    await page.locator('#aa-question').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'aa-question');
    await page.keyboard.type('a');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('b');
    assert.equal(await page.inputValue('#aa-question'), 'a\nb');
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#aa-ask'), true, 'still open while typing');
    await page.focus('#aa-tab-ask');
    await page.keyboard.press('Escape');
    await page.locator('#apertis-assistant').waitFor({ state: 'hidden' });
    await page.context().close();
  });

  test('LOCAL-BUILD: without .dev.vars the real /api/ask answers 500 and the panel shows it', async () => {
    const page = await newPage();
    await goto(page, target.servedPath);
    await openAsk(page);
    await ask(page, 'What is Apertis?');
    const alert = page.locator('.aa-msg[data-state="error"]');
    await alert.waitFor({ timeout: 20000 });
    assert.equal(await alert.textContent(), 'Ask Docs could not answer (HTTP 500): Server configuration error');
    await page.context().close();
  });

  test('a streaming answer keeps rendering after the panel re-renders (open event mid-stream)', async () => {
    const page = await newPage();
    await controlledAsk(page);
    await goto(page, '/');
    await openAsk(page);
    await ask(page, 'q');
    await page.waitForFunction(() => typeof (window as any).__delta === 'function');
    await page.evaluate(() => (window as any).__delta('one'));
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.textContent === 'one');
    await openAsk(page);
    await page.evaluate(() => (window as any).__delta(' two'));
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.textContent === 'one two', null, { timeout: 5000 });
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'streaming');
    await page.evaluate(() => (window as any).__finish());
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.getAttribute('data-state') === 'done');
    assert.equal(await lastAnswer(page).textContent(), 'one two');
    await page.context().close();
  });

  test('closing the panel mid-stream aborts the request and keeps the turn as interrupted', async () => {
    const page = await newPage();
    await controlledAsk(page);
    await goto(page, '/');
    await openAsk(page);
    await ask(page, 'long question');
    await page.waitForFunction(() => typeof (window as any).__delta === 'function');
    await page.evaluate(() => (window as any).__delta('partial'));
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.textContent === 'partial');
    await page.click('#aa-close');
    await page.waitForFunction(() => (window as any).__aborted === true);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem(`askdocs_messages_${sessionStorage.getItem('askai_session_id')}`) ?? '[]')[1]?.state === 'interrupted');
    assert.deepEqual(await stored(page), [
      { role: 'user', content: 'long question' },
      { role: 'assistant', content: 'partial', state: 'interrupted' },
    ]);
    await openAsk(page);
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'interrupted');
    await page.context().close();
  });

  test('navigating mid-stream keeps the question and partial answer, stored as interrupted', async () => {
    const page = await newPage();
    await controlledAsk(page);
    await goto(page, '/');
    await openAsk(page);
    await ask(page, 'question before navigating');
    await page.waitForFunction(() => typeof (window as any).__delta === 'function');
    assert.deepEqual((await stored(page))[0], { role: 'user', content: 'question before navigating' }, 'saved when sent');
    await page.evaluate(() => (window as any).__delta('half an answer'));
    await page.waitForFunction(() => document.querySelector('.aa-msg[data-role="assistant"]')?.textContent === 'half an answer');
    await goto(page, target.servedPath);
    await page.locator('dialog[open] #aa-ask').waitFor();
    assert.deepEqual(await stored(page), [
      { role: 'user', content: 'question before navigating' },
      { role: 'assistant', content: 'half an answer', state: 'interrupted' },
    ]);
    assert.equal(await lastAnswer(page).getAttribute('data-state'), 'interrupted');
    await page.context().close();
  });

  test('a failing result load (fragment request aborted) shows a visible error, not a stuck loading state', async () => {
    const page = await newPage();
    await page.route('**/pagefind/fragment/**', (route: any) => route.abort());
    await goto(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.waitForFunction(() => /could not be completed/.test(document.getElementById('aa-status')?.textContent ?? ''), null, { timeout: 10000 });
    assert.equal(await page.isVisible('#aa-status'), true);
    await page.context().close();
  });

  test('an index chunk failure ends in a terminal state (Pagefind itself reports it as no results)', async () => {
    const page = await newPage();
    await page.route('**/pagefind/index/**', (route: any) => route.abort());
    page.on('console', () => {}); // Pagefind logs the failed chunk
    await goto(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.waitForFunction(() => /^No results for/.test(document.getElementById('aa-status')?.textContent ?? ''), null, { timeout: 10000 });
    await page.context().close();
  });

  test('losing the connection after the index loaded turns an empty search into a visible error, not "No results"', async () => {
    const page = await newPage();
    page.on('console', () => {}); // Pagefind logs the failed chunk
    await goto(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.locator('#aa-results [role="option"]').first().waitFor();
    await page.route('**/pagefind/**', (route: any) => route.abort());
    await page.fill('#aa-q', 'zzqxvnonexistentword');
    await page.waitForFunction(() => /could not be completed/.test(document.getElementById('aa-status')?.textContent ?? ''), null, { timeout: 10000 });
    // Back online, the same empty search reports no results.
    await page.unroute('**/pagefind/**');
    await page.fill('#aa-q', 'zzqxvnonexistentwords');
    await page.waitForFunction(() => /^No results for/.test(document.getElementById('aa-status')?.textContent ?? ''), null, { timeout: 10000 });
    await page.context().close();
  });

  test('with site storage blocked, search and Ask Docs still work (in-memory session)', async () => {
    const page = await newPage();
    await page.addInitScript(() => {
      for (const name of ['sessionStorage', 'localStorage']) {
        Object.defineProperty(window, name, { get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
      }
    });
    const bodies = await stubAsk(page, 200, sse('ok') + DONE);
    await goto(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type(target.title);
    await page.locator('#aa-results [role="option"]').first().waitFor();
    await openAsk(page);
    await ask(page, 'q');
    await page.locator('.aa-msg[data-state="done"]').waitFor();
    assert.match(String((bodies[0] as Record<string, unknown>).sessionId), /^[0-9a-f-]{32,36}$/);
    await page.context().close();
  });

  test('a Turnstile load failure can be retried by reopening Ask Docs', async () => {
    const mode = { value: 'offline' as TurnstileMode };
    const page = await newPage(mode);
    await goto(page, '/');
    await openAsk(page);
    await page.waitForFunction(() => document.getElementById('aa-ask-status')?.dataset.kind === 'error');
    assert.match(await page.textContent('#aa-ask-status'), /could not be loaded.*reopen Ask Docs/);
    mode.value = 'ok';
    await page.click('#aa-close');
    await openAsk(page);
    await page.fill('#aa-question', 'hello');
    await page.waitForFunction(() => !(document.getElementById('aa-send') as HTMLButtonElement).disabled);
    assert.equal(await page.textContent('#aa-ask-status'), '');
    await page.context().close();
  });

  test('Turnstile expiry re-verifies; a challenge timeout is shown', async () => {
    const page = await newPage();
    await goto(page, '/');
    await openAsk(page);
    await page.fill('#aa-question', 'hello');
    await page.waitForFunction(() => !(document.getElementById('aa-send') as HTMLButtonElement).disabled);
    // Read the state in the same task as the callback: the stub's reset() issues a fresh token 10 ms later.
    const expired = await page.evaluate(() => {
      (window as any).__ts['expired-callback']();
      return { disabled: (document.getElementById('aa-send') as HTMLButtonElement).disabled, status: document.getElementById('aa-ask-status')!.textContent };
    });
    assert.equal(expired.disabled, true, 'no sending with an expired token');
    assert.match(expired.status ?? '', /expired/);
    await page.waitForFunction(() => !(document.getElementById('aa-send') as HTMLButtonElement).disabled);
    await page.evaluate(() => (window as any).__ts['timeout-callback']());
    await page.waitForFunction(() => document.getElementById('aa-ask-status')?.dataset.kind === 'error');
    assert.match(await page.textContent('#aa-ask-status'), /timed out/);
    assert.equal(await page.isDisabled('#aa-send'), true);
    await page.context().close();
  });

  test('a Turnstile widget that never answers is reported after 30 s', async () => {
    const page = await newPage('silent');
    await page.clock.install();
    await goto(page, '/');
    await openAsk(page);
    await page.waitForFunction(() => Boolean((window as any).__ts));
    assert.match(await page.textContent('#aa-ask-status'), /Verifying/);
    await page.clock.fastForward(29000);
    assert.notEqual(await page.getAttribute('#aa-ask-status', 'data-kind'), 'error');
    await page.clock.fastForward(2000);
    await page.waitForFunction(() => document.getElementById('aa-ask-status')?.dataset.kind === 'error');
    assert.match(await page.textContent('#aa-ask-status'), /did not respond/);
    await page.context().close();
  });

  test('mobile 390 px: touch scrolling does not move the page behind the open search sheet', async () => {
    const page = await newPage('ok', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await goto(page, '/');
    await page.evaluate(() => document.body.append(Object.assign(document.createElement('div'), { style: 'height:5000px' })));
    const cdp = await page.context().newCDPSession(page);
    // Two ways to swipe: raw touch events through the input pipeline, and the compositor's synthetic
    // gesture. Which one scrolls depends on the browser build (CI's Linux Chromium ignores the synthetic
    // gesture), so the control below picks the first that works and every later swipe reuses it.
    const touchEvents = async () => {
      const at = (y: number) => [{ x: 195, y, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(700) });
      for (let y = 650; y >= 100; y -= 50) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(y) });
      // Hold before lifting the finger: a release at speed starts a fling that keeps scrolling after
      // the test resets scrollY.
      await page.waitForTimeout(150);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(100) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const gesture = () => cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 200, yDistance: -600, gestureSourceType: 'touch', speed: 2000 });
    // Control: the environment must turn a swipe into a page scroll, or "did not scroll while open"
    // below would pass vacuously.
    let swipe: () => Promise<unknown> = touchEvents;
    let control = false;
    for (const candidate of [touchEvents, gesture]) {
      await page.evaluate(() => scrollTo(0, 0));
      await candidate();
      control = await page.waitForFunction(() => scrollY > 0, null, { timeout: 5000 }).then(() => true, () => false);
      if (control) { swipe = candidate; break; }
    }
    assert.ok(control, 'control: a touch swipe scrolls the page before the sheet opens (this browser cannot synthesize touch scrolling)');
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search' } })));
    await page.locator('dialog[open] #aa-q').waitFor();
    await swipe();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => scrollY), 0, 'page did not scroll while the sheet is open');
    await page.click('#aa-close');
    // After close the same gesture must scroll the page. A slow runner can drop a gesture that starts
    // while the dialog is still closing, so the swipe repeats a bounded number of times.
    let scrolled = false;
    for (let i = 0; i < 5 && !scrolled; i++) {
      await swipe();
      scrolled = await page.waitForFunction(() => scrollY > 0, null, { timeout: 2000 }).then(() => true, () => false);
    }
    assert.ok(scrolled, 'the page scrolls once the sheet is closed');
    await page.context().close();
  });
});
