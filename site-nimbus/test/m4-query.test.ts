// #9 query tokenization: path/identifier punctuation is searched literally and as separate words.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { queryVariants, searchWithVariants } from '../src/search/query.ts';

test('punctuated queries also search their parts; words, identifiers and hyphens are unchanged', () => {
  assert.deepEqual(queryVariants('chat/completions'), ['chat/completions', 'chat completions']);
  assert.deepEqual(queryVariants('/v1/messages'), ['/v1/messages', 'v1 messages']);
  assert.deepEqual(queryVariants('@apertis/ai-sdk-provider'), ['@apertis/ai-sdk-provider', 'apertis ai-sdk-provider']);
  assert.deepEqual(queryVariants('api.apertis.ai'), ['api.apertis.ai', 'api apertis ai']);
  for (const q of ['ANTHROPIC_BASE_URL', 'createApertis', 'base url', 'ai-sdk-provider', 'api key', '429']) {
    assert.deepEqual(queryVariants(q), [q], q);
  }
  assert.deepEqual(queryVariants('  /  '), ['/']);
});

// Replaces the PoC rule "literal matches rank first": on the full corpus, pages that merely mention a
// path literally (`chat/completions` in a curl URL) outranked the endpoint's own page. Variants now merge
// by Pagefind score; a page keeps the best score any variant gave it.
test('variants merge by score, each page once at its best score', async () => {
  const index: Record<string, { id: string; score: number }[]> = {
    'chat/completions': [{ id: 'mentions', score: 6 }, { id: 'passing', score: 4 }],
    'chat completions': [{ id: 'sdk-page', score: 7.6 }, { id: 'endpoint-page', score: 7.5 }, { id: 'mentions', score: 3 }],
  };
  const seen: string[] = [];
  const ids = await searchWithVariants('chat/completions', async (q) => {
    seen.push(q);
    return index[q] ?? [];
  });
  assert.deepEqual(ids.map((r) => r.id), ['sdk-page', 'endpoint-page', 'mentions', 'passing']);
  assert.deepEqual(seen, ['chat/completions', 'chat completions']);
  assert.deepEqual((await searchWithVariants('base url', async (q) => [{ id: q }])).map((r) => r.id), ['base url']);
});

type Page = { url: string; meta: { title?: string }; anchors?: { text: string }[] };
const hit = (id: string, score: number, page: Page) => ({ id, score, data: async () => page });

test('the top 10 re-rank by how much of the query names the page: title or URL path, then headings', async () => {
  const noise = Array.from({ length: 7 }, (_, i) => hit(`noise-${i}`, 8 - i / 10, { url: `/noise/${i}/`, meta: { title: 'Noise' } }));
  const results = [
    hit('mentions', 9, { url: '/api/responses/', meta: { title: 'Responses API' }, anchors: [{ text: 'Request body' }] }),
    hit('heading', 8.5, { url: '/api/video/', meta: { title: 'Video API' }, anchors: [{ text: 'Alternative API: /v1/videos' }] }),
    ...noise,
    hit('endpoint-page', 3, { url: '/api/text-generation/messages/', meta: { title: 'Messages API (Native Anthropic)' } }), // 10th by score
    // 11th by score: never loaded or moved, so re-ranking fetches no fragment the dialog would not show.
    { id: 'eleventh', score: 1, data: async () => assert.fail('a result below the top 10 was loaded') },
  ];
  const ids = (await searchWithVariants('v1 messages', async () => results)).map((r) => r.id);
  // messages (title/URL) 1 of 2 words > v1 (heading only) half a word of 2 > nothing; ties keep score order.
  assert.deepEqual(ids.slice(0, 3), ['endpoint-page', 'heading', 'mentions']);
  assert.deepEqual(ids.slice(3), [...noise.map((r) => r.id), 'eleventh']);
  // Query words split on punctuation and `_`, as page words do: `base_url` in a heading names "base url".
  const guide = hit('guide', 1, { url: '/installation/connection/', meta: { title: 'Connection Guide' }, anchors: [{ text: 'BASE_URL' }] });
  const vision = hit('vision', 5, { url: '/api/sdks/python-sdk/vision/', meta: { title: 'Vision' }, anchors: [{ text: 'Local Image (Base64)' }, { text: 'Image URL Object' }] });
  assert.deepEqual((await searchWithVariants('base url', async () => [vision, guide])).map((r) => r.id), ['guide', 'vision']);
});

test('the URL section does not name every page under it, and singular/plural name the same word', async () => {
  // "api key": every /api/* page used to be named by "api" (its leading segment) and "key" missed "keys",
  // so the API keys page tied with an unrelated endpoint page and kept the lower Pagefind score.
  const endpoint = hit('endpoint', 9, { url: '/api/text-generation/chat-completions/', meta: { title: 'Chat Completions' } });
  const keys = hit('keys', 2, { url: '/authentication/api-keys/', meta: { title: 'API Keys' } });
  assert.deepEqual((await searchWithVariants('api key', async () => [endpoint, keys])).map((r) => r.id), ['keys', 'endpoint']);
  // Deeper segments still name the page: "streaming" is in the path only.
  const streaming = hit('streaming', 1, { url: '/api/text-generation/streaming/', meta: { title: 'Streams' } });
  const other = hit('other', 9, { url: '/api/text-generation/responses/', meta: { title: 'Responses' } });
  assert.deepEqual((await searchWithVariants('streaming', async () => [other, streaming])).map((r) => r.id), ['streaming', 'other']);
});

test('a result that fails to load fails the search instead of being ranked silently', async () => {
  const broken = { id: 'x', score: 1, data: () => Promise.reject(new Error('fragment aborted')) };
  await assert.rejects(searchWithVariants('api key', async () => [broken]), /fragment aborted/);
});

test('a superseded search loads no fragments (Pagefind caches and mutates them per page)', async () => {
  let loads = 0;
  const hit = (id: string) => ({ id, score: 1, data: async () => { loads++; return { url: `/${id}/`, meta: { title: id } }; } });
  const ids = (await searchWithVariants('api key', async () => [hit('a'), hit('b')], () => false)).map((r) => r.id);
  assert.equal(loads, 0);
  assert.deepEqual(ids, ['a', 'b']);
  await searchWithVariants('api key', async () => [hit('a'), hit('b')], () => true);
  assert.equal(loads, 2);
});
