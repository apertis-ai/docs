// The production clients with fake fetches: Jina request shape, bounds and response validation;
// PostgREST rpc calls. No network.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JINA_URL, jinaEmbedder, postgrestStore } from '../index.ts'

type Answer = Response | Error
function fakeFetch(answers: Answer[]) {
  const calls: Array<{ url: string; init: RequestInit; body: any }> = []
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) })
    const a = answers.shift() ?? new Error('no more answers')
    if (a instanceof Error) throw a
    return a
  }) as unknown as typeof fetch
  return { f, calls }
}
const vectors = (n: number, dims = 1024) => Response.json({ data: Array.from({ length: n }, (_, index) => ({ index, embedding: new Array(dims).fill(0.5) })) })

test('Jina: legacy request shape (jina-embeddings-v4, retrieval.passage, 1024), bounded timeout', async () => {
  const { f, calls } = fakeFetch([vectors(2)])
  const e = jinaEmbedder('jina-secret', { fetch: f })
  assert.equal((await e.embed(['a', 'b'])).length, 2)
  assert.equal(calls[0].url, JINA_URL)
  assert.deepEqual(calls[0].body, { model: 'jina-embeddings-v4', input: ['a', 'b'], task: 'retrieval.passage', dimensions: 1024 })
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer jina-secret')
  assert.ok(calls[0].init.signal instanceof AbortSignal)
  assert.equal(e.model, 'jina-embeddings-v4/retrieval.passage')
})

test('Jina: 429/5xx and network errors retry at most `attempts` times; 4xx and bad responses do not retry', async () => {
  const retrying = fakeFetch([new Response('busy', { status: 429 }), new TypeError('reset'), vectors(1)])
  assert.equal((await jinaEmbedder('k', { fetch: retrying.f, retryDelayMs: 1 }).embed(['a'])).length, 1)
  assert.equal(retrying.calls.length, 3)

  const exhausted = fakeFetch([new Response('', { status: 503 }), new Response('', { status: 503 }), new Response('', { status: 503 }), vectors(1)])
  await assert.rejects(jinaEmbedder('k', { fetch: exhausted.f, retryDelayMs: 1 }).embed(['a']), /Jina answered 503/)
  assert.equal(exhausted.calls.length, 3)

  const unauthorized = fakeFetch([new Response('no', { status: 401 }), vectors(1)])
  await assert.rejects(jinaEmbedder('k', { fetch: unauthorized.f, retryDelayMs: 1 }).embed(['a']), /Jina answered 401/)
  assert.equal(unauthorized.calls.length, 1)

  for (const bad of [vectors(1), vectors(2, 512), Response.json({ data: [{ index: 0, embedding: new Array(1024).fill(null) }, { index: 1, embedding: [] }] })]) {
    const wrong = fakeFetch([bad])
    await assert.rejects(jinaEmbedder('k', { fetch: wrong.f }).embed(['a', 'b']), /wrong count or dimensions/)
  }
})

test('Jina: a cancelled run stops retrying at once', async () => {
  const ac = new AbortController()
  const { f, calls } = fakeFetch([new TypeError('reset'), vectors(1)])
  ac.abort(new Error('cancelled by SIGINT'))
  await assert.rejects(jinaEmbedder('k', { fetch: f, retryDelayMs: 1 }).embed(['a'], ac.signal), /cancelled by SIGINT/)
  assert.equal(calls.length, 0)
})

test('PostgREST store: one POST per call with the service key; errors carry the database message only', async () => {
  const { f, calls } = fakeFetch([Response.json([{ generation_id: 3 }]), Response.json(true), Response.json({ code: 'P0001', message: 'generation 3 is being built by another run' }, { status: 400 })])
  const s = postgrestStore('https://db.test/', 'service-secret', { fetch: f })
  assert.deepEqual(await s.rpc('docs_generation_begin', { p_environment: 'preview' }), [{ generation_id: 3 }])
  assert.deepEqual(await s.rpc('docs_generation_fail', {}), [{ docs_generation_fail: true }])
  await assert.rejects(s.rpc('docs_generation_begin', {}), (e: Error) => /being built by another run/.test(e.message) && !e.message.includes('service-secret'))
  assert.equal(calls[0].url, 'https://db.test/rest/v1/rpc/docs_generation_begin')
  assert.deepEqual(calls[0].body, { p_environment: 'preview' })
  const h = calls[0].init.headers as Record<string, string>
  assert.equal(h.apikey, 'service-secret')
  assert.equal(h.Authorization, 'Bearer service-secret')
})

test('Jina: embeddings are placed by the response index, which must be exactly 0..n-1', async () => {
  const v = (x: number) => new Array(1024).fill(x)
  const shuffled = fakeFetch([Response.json({ data: [{ index: 2, embedding: v(0.3) }, { index: 0, embedding: v(0.1) }, { index: 1, embedding: v(0.2) }] })])
  const got = await jinaEmbedder('k', { fetch: shuffled.f }).embed(['a', 'b', 'c'])
  assert.deepEqual(got.map((e) => e[0]), [0.1, 0.2, 0.3])
  for (const idx of [[0, 0, 1], [0, 1, 3], [0, 1, undefined], [1, 2, 3]]) {
    const bad = fakeFetch([Response.json({ data: idx.map((index) => ({ index, embedding: v(0.5) })) })])
    await assert.rejects(jinaEmbedder('k', { fetch: bad.f }).embed(['a', 'b', 'c']), /wrong count or dimensions|index/, JSON.stringify(idx))
  }
})
