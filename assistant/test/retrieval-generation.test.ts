// #11 generation mode: server bindings only, fail closed, never legacy. The database side (active
// generation selection, grants, not-ready and foreign rejection) is proven against the local replica in
// indexer/test/retrieval.test.ts; here the adapter's own contract and the handler path.
import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { RetrievalConfigError, RetrievalError, createRetrieval } from '../retrieval.ts'
import { handleAsk } from '../service.ts'
import { ENV, SENTINEL, VALID, askRequest, captureLogs, providers, readAll, trackRejections } from './harness.ts'

const rejections = trackRejections()
afterEach(() => rejections.assertNone())
after(() => rejections.stop())

const TOKEN = `reader-${SENTINEL}-0123456789abcdef0123456789`
const GEN_ENV = { ...ENV, ASK_RETRIEVAL_SOURCE: 'generation', ASK_GENERATION_ENVIRONMENT: 'preview', ASK_GENERATION_READER_TOKEN: TOKEN }
const GEN_ROWS = [
  { title: 'Quick Start', url_path: '/getting-started/quick-start', content: 'Create a key.', similarity: 0.81, generation_id: 7, environment: 'preview' },
  { title: 'API Reference', url_path: '/api/', content: 'Endpoints.', similarity: 0.52, generation_id: 7, environment: 'preview' },
]
const Q = { queryEmbedding: [1, 2], matchCount: 5, similarityThreshold: 0.3 }

test('generation mode without any of its bindings, or with invalid ones, fails closed at configuration', () => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ASK_GENERATION_ENVIRONMENT', 'ASK_GENERATION_READER_TOKEN'] as const) {
    assert.throws(() => createRetrieval({ ...GEN_ENV, [key]: undefined }), RetrievalConfigError, key)
    assert.throws(() => createRetrieval({ ...GEN_ENV, [key]: '' }), RetrievalConfigError, key)
  }
  assert.throws(() => createRetrieval({ ...GEN_ENV, ASK_GENERATION_ENVIRONMENT: 'Production' }), RetrievalConfigError)
  assert.throws(() => createRetrieval({ ...GEN_ENV, ASK_GENERATION_ENVIRONMENT: 'preview;drop' }), RetrievalConfigError)
  assert.throws(() => createRetrieval({ ...GEN_ENV, ASK_GENERATION_READER_TOKEN: 'short' }), RetrievalConfigError)
})

test('generation mode calls only search_docs_generation with the configured environment and secret, and returns the four contract fields', async () => {
  const p = providers({ supabase: { rows: GEN_ROWS } })
  const rows = await createRetrieval(GEN_ENV, p.fetch)(Q)
  assert.deepEqual(rows, GEN_ROWS.map(({ title, url_path, content, similarity }) => ({ title, url_path, content, similarity })))
  const calls = p.called('supabase')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `${ENV.SUPABASE_URL}/rest/v1/rpc/search_docs_generation`)
  assert.deepEqual(calls[0].body, { query_embedding: [1, 2], match_count: 5, similarity_threshold: 0.3, target_environment: 'preview', reader_token: TOKEN })
  assert.equal(calls[0].headers.apikey, ENV.SUPABASE_ANON_KEY)
})

test('database refusals and foreign rows fail closed with RetrievalError and never fall back to legacy', async () => {
  const refusals: Array<[string, string]> = [['42501', 'generation retrieval is not configured'], ['P0002', 'no active generation'], ['P0003', 'active generation is not servable']]
  for (const [code, message] of refusals) {
    const p = providers({ supabase: { status: 400, text: JSON.stringify({ code, message, details: null, hint: null }) } })
    await assert.rejects(createRetrieval(GEN_ENV, p.fetch)(Q), (e: unknown) => e instanceof RetrievalError && e.code === code)
    assert.deepEqual(p.called('supabase').map((c) => c.url), [`${ENV.SUPABASE_URL}/rest/v1/rpc/search_docs_generation`])
  }
  for (const rows of [[{ ...GEN_ROWS[0], environment: 'production' }], [GEN_ROWS[0], { ...GEN_ROWS[1], generation_id: 8 }]]) {
    const p = providers({ supabase: { rows } })
    await assert.rejects(createRetrieval(GEN_ENV, p.fetch)(Q), (e: unknown) => e instanceof RetrievalError && e.code === 'FOREIGN_GENERATION')
  }
})

test('handler in generation mode: answers from the configured generation; a refusal is a sanitized 500 without the secret', async () => {
  const ok = providers({ supabase: { rows: GEN_ROWS } })
  const res = await handleAsk(askRequest({ ...VALID, generation: 99, environment: 'production' }), GEN_ENV, { fetch: ok.fetch })
  assert.equal(res.status, 200)
  await readAll(res)
  assert.equal(ok.called('supabase')[0].body.target_environment, 'preview')
  assert.equal(ok.called('supabase')[0].url.endsWith('/rpc/search_docs_generation'), true)
  assert.match(JSON.stringify(ok.called('apertis')[0].body), /\/getting-started\/quick-start/)

  const refused = providers({ supabase: { status: 400, text: JSON.stringify({ code: 'P0002', message: `no active generation ${SENTINEL}` }) } })
  const logs = captureLogs()
  let body: string
  try {
    const r = await handleAsk(askRequest({ ...VALID, sessionId: 'gen-2' }), GEN_ENV, { fetch: refused.fetch })
    assert.equal(r.status, 500)
    body = await r.text()
  } finally {
    logs.restore()
  }
  assert.doesNotMatch(body, new RegExp(SENTINEL))
  assert.doesNotMatch(logs.lines.join('\n'), new RegExp(SENTINEL))
  assert.equal(refused.called('apertis').length, 0)
})
