// Retrieval source selection: server env only, fail closed, legacy = three-argument search_docs.
import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { RetrievalConfigError, createRetrieval } from '../retrieval.ts'
import { handleAsk } from '../service.ts'
import { ENV, ROWS, VALID, askRequest, captureLogs, providers, readAll, trackRejections } from './harness.ts'

const rejections = trackRejections()
afterEach(() => rejections.assertNone())
after(() => rejections.stop())

test('missing or unknown ASK_RETRIEVAL_SOURCE fails closed', () => {
  const { ASK_RETRIEVAL_SOURCE, ...rest } = ENV
  for (const source of [undefined, '', 'production', 'generation', 'LEGACY', ' legacy']) {
    assert.throws(() => createRetrieval({ ...rest, ASK_RETRIEVAL_SOURCE: source }), RetrievalConfigError, String(source))
  }
})

test('legacy mode without Supabase bindings fails closed', () => {
  assert.throws(() => createRetrieval({ ASK_RETRIEVAL_SOURCE: 'legacy', SUPABASE_URL: ENV.SUPABASE_URL }), RetrievalConfigError)
  assert.throws(() => createRetrieval({ ASK_RETRIEVAL_SOURCE: 'legacy', SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY }), RetrievalConfigError)
})

test('legacy mode calls the three-argument search_docs and returns the four contract fields', async () => {
  const p = providers()
  const rows = await createRetrieval(ENV, p.fetch)({ queryEmbedding: [1, 2], matchCount: 5, similarityThreshold: 0.3 })
  assert.deepEqual(rows, ROWS.map(({ title, url_path, content, similarity }) => ({ title, url_path, content, similarity })))
  const [call] = p.called('supabase')
  assert.equal(call.method, 'POST')
  assert.equal(call.url, `${ENV.SUPABASE_URL}/rest/v1/rpc/search_docs`)
  assert.deepEqual(call.body, { query_embedding: [1, 2], match_count: 5, similarity_threshold: 0.3 })
  assert.equal(call.headers.apikey, ENV.SUPABASE_ANON_KEY)
})

test('handler without retrieval configuration answers 500 before any provider call and logs the class only', async () => {
  const { ASK_RETRIEVAL_SOURCE, ...rest } = ENV
  const cases: Array<[Record<string, string | undefined>, string]> = [
    [rest, 'RetrievalConfigError'],
    [{ ...rest, ASK_RETRIEVAL_SOURCE: 'generation' }, 'RetrievalConfigError'],
    [{ ...ENV, SUPABASE_URL: undefined }, 'RetrievalConfigError'],
    [{ ...ENV, JINA_API_KEY: undefined }, 'MissingBinding'],
  ]
  for (const [env, errorClass] of cases) {
    const p = providers()
    const logs = captureLogs()
    let res: Response
    try {
      res = await handleAsk(askRequest({ ...VALID, source: 'legacy', ASK_RETRIEVAL_SOURCE: 'legacy' }), env, { fetch: p.fetch })
    } finally {
      logs.restore()
    }
    assert.equal(res.status, 500)
    assert.deepEqual(JSON.parse(await res.text()), { error: 'Server configuration error' })
    assert.equal(p.calls.length, 0)
    assert.deepEqual(logs.lines.map((l) => JSON.parse(l)), [{ at: 'ask', traceId: 'none', stage: 'config', error: errorClass }])
  }
})

test('no request field, header, cookie or query parameter can select the source', async () => {
  const logs = captureLogs()
  try {
    const attempts = [
      askRequest({ ...VALID, sessionId: 'sel-0' }),
      askRequest({ ...VALID, sessionId: 'sel-1', generation: 'g-prod', environment: 'production', index: 'other', ASK_RETRIEVAL_SOURCE: 'generation', SUPABASE_URL: 'https://attacker.test' }),
      askRequest({ ...VALID, sessionId: 'sel-2' }, { headers: { 'X-Retrieval-Source': 'generation', 'X-Generation': 'g-prod', 'Cookie': 'generation=g-prod; ASK_RETRIEVAL_SOURCE=generation' } }),
      askRequest({ ...VALID, sessionId: 'sel-3' }, { url: 'https://docs.test/api/ask?generation=g-prod&source=generation&SUPABASE_URL=https://attacker.test' }),
    ]
    const seen = []
    for (const req of attempts) {
      const p = providers()
      const res = await handleAsk(req, ENV, { fetch: p.fetch })
      assert.equal(res.status, 200)
      await readAll(res)
      seen.push(p.called('supabase').map((c) => ({ url: c.url, body: c.body, apikey: c.headers.apikey })))
      assert.ok(p.calls.every((c) => !c.url.includes('attacker')))
    }
    for (const s of seen) assert.deepEqual(s, seen[0], 'every attempt hits the configured source with the same query')
  } finally {
    logs.restore()
  }
})
