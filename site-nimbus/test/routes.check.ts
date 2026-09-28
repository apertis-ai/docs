// M1 routing proof against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8795 npm run test:routes
// Page coverage is gated by scripts/nimbus/route-fixtures.mjs; this pins the rows M1 owns.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_META, TITLE_SUFFIX } from '../src/contracts/page.ts';
import { documentAt } from '../src/manifest/manifest.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
if (!base) throw new Error('set PREVIEW_URL to the running preview origin');

const get = (path: string, init?: RequestInit) => fetch(base + path, { redirect: 'manual', ...init });
const meta = (html: string, name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];

for (const [path, canonical, id] of [
  ['/', 'https://docs.apertis.ai/', 'page:index'],
  ['/api/', 'https://docs.apertis.ai/api/', 'api:index'],
] as const) {
  test(`${path} is a static page carrying its manifest identity`, async () => {
    const res = await get(path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    const html = await res.text();
    assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], canonical);
    assert.equal(meta(html, PAGE_META.id), id);
    assert.match(meta(html, PAGE_META.build) ?? '', /^[0-9a-f]{40}\.[0-9a-f]{12}$/);
    assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], documentAt(path).title + TITLE_SUFFIX);
    assert.equal(html.match(/<meta charset=/g)?.length, 1, 'exactly one charset meta');
    assert.equal(html.match(/<meta name="viewport"/g)?.length, 1, 'exactly one viewport meta');
  });
}

test('/api redirects once to /api/', async () => {
  const res = await get('/api');
  assert.equal(res.status, 308);
  assert.equal(new URL(res.headers.get('location') ?? '', base).pathname, '/api/');
});

for (const path of ['/does-not-exist', '/api/does-not-exist', '/api/ask', '/api/ask/']) {
  test(`GET ${path} is a real 404`, async () => {
    assert.equal((await get(path)).status, 404);
  });
}

test('POST /api/ask reaches the root Pages Function', async () => {
  const res = await get('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'What is Apertis?', sessionId: 'm1-routing', turnstileToken: 'none' }),
  });
  // Without .dev.vars the function answers its own configuration error; a static file never would.
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'Server configuration error' });
});
