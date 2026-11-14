// The blog's live authors: what authors-feed.ts accepts from GET https://apertis.ai/api/blog/authors, and
// the edge function that serves it. The swap into the page is tested in the browser (m9-shell.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOURCE, fetchAuthors, liveAuthors } from '../src/components/home/authors-feed.ts';

const lee = { slug: 'yu-ting-lee', name: ' Yu-Ting Lee ', title: 'CTO', avatar_url: 'https://avatars.example/u/1?v=4' };
const answer = (body: unknown, status = 200) => (async (url: string) => {
  assert.equal(url, SOURCE);
  return new Response(JSON.stringify(body), { status });
}) as unknown as typeof fetch;

test('live authors are keyed by slug; an unusable entry is skipped, an unusable avatar is no avatar', () => {
  assert.deepEqual(liveAuthors([lee]), { 'yu-ting-lee': { name: 'Yu-Ting Lee', title: 'CTO', avatar: 'https://avatars.example/u/1?v=4' } });
  const odd = liveAuthors([
    { slug: 'a', name: 'A', avatar_url: 'http://plain.example/a.png' }, { slug: 'b', name: 'B', title: 7, avatar_url: 'javascript:alert(1)' },
    { slug: 'c', name: 'C', avatar_url: 'https://user:pw@host.example/c.png' }, { slug: 'Not A Slug', name: 'X' }, { slug: 'd', name: '  ' }, null, 'e',
    { slug: '__proto__', name: 'P' },
  ]);
  assert.deepEqual(odd, { a: { name: 'A', title: '', avatar: '' }, b: { name: 'B', title: '', avatar: '' }, c: { name: 'C', title: '', avatar: '' } });
  assert.deepEqual(liveAuthors([]), {});
  for (const bad of [null, {}, 'x']) assert.throws(() => liveAuthors(bad), /expected a list/);
});

test('fetchAuthors reads the public endpoint and throws on a failure it reports', async () => {
  assert.deepEqual(Object.keys(await fetchAuthors(answer({ success: true, data: [lee] }))), ['yu-ting-lee']);
  await assert.rejects(fetchAuthors(answer({ success: false, message: 'Blog authors are unavailable' }, 503)), /HTTP 503/);
  await assert.rejects(fetchAuthors(answer({ success: false, message: 'nope' })), /nope/);
  await assert.rejects(fetchAuthors(answer({ success: true, data: null })), /expected a list/);
});

test('GET /_nimbus/blog-authors: edge-cached for ten minutes; an upstream failure answers 502 and is not cached', async () => {
  // A computed specifier: typecheck must not follow it into the Workers types, which replace the DOM's.
  const { onRequestGet } = await import(new URL('../../functions/_nimbus/blog-authors.ts', import.meta.url).href);
  const put: string[] = [];
  (globalThis as any).caches = { default: { match: async () => undefined, put: async (k: Request) => { put.push(k.url); } } };
  const real = globalThis.fetch;
  const call = () => onRequestGet({ request: new Request('https://docs.example/_nimbus/blog-authors?x=1'), waitUntil: (p: Promise<unknown>) => p } as never);
  try {
    globalThis.fetch = answer({ success: true, data: [lee] });
    const ok = await call();
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'public, max-age=600');
    assert.equal((await ok.json())['yu-ting-lee'].title, 'CTO');
    assert.deepEqual(put, ['https://docs.example/_nimbus/blog-authors']);
    globalThis.fetch = answer({}, 404);
    const bad = await call();
    assert.equal(bad.status, 502);
    assert.equal(bad.headers.get('cache-control'), 'no-store');
    assert.equal(put.length, 1);
  } finally {
    globalThis.fetch = real;
  }
});
