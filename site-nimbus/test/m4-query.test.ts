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

test('literal matches rank first, then part matches, without duplicates', async () => {
  const index: Record<string, string[]> = { 'chat/completions': ['quick-start'], 'chat completions': ['chat-completions', 'quick-start', 'responses'] };
  const seen: string[] = [];
  const ids = await searchWithVariants('chat/completions', async (q) => {
    seen.push(q);
    return (index[q] ?? []).map((id) => ({ id }));
  });
  assert.deepEqual(ids.map((r) => r.id), ['quick-start', 'chat-completions', 'responses']);
  assert.deepEqual(seen, ['chat/completions', 'chat completions']);
  assert.deepEqual((await searchWithVariants('base url', async (q) => [{ id: q }])).map((r) => r.id), ['base url']);
});
