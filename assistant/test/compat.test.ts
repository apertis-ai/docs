// Compatibility between the legacy handler/client (bb057a7, deployed as 2efbe4c4) and the new service.
import assert from 'node:assert/strict'
import { after, afterEach, describe, test } from 'node:test'
import { handleAsk } from '../service.ts'
import {
  ENV, SENTINEL, UPSTREAM_OK, VALID, askRequest, captureLogs, delta, loadLegacyClient, loadLegacyHandler,
  providers, readAll, sse, trackRejections, withGlobalFetch, type Script,
} from './harness.ts'

const legacy = await loadLegacyHandler()
const client = await loadLegacyClient()

const rejections = trackRejections()
afterEach(() => rejections.assertNone())
after(() => rejections.stop())

// Runs one request through the legacy handler (global fetch stubbed for the request and its stream).
async function viaLegacy(request: Request, script: Script = {}) {
  const p = providers(script)
  const text = await withGlobalFetch(p.fetch, async () => readAll(await legacy.onRequestPost({ request, env: ENV })))
  return { text, p }
}
async function viaNew(request: Request, script: Script = {}) {
  const p = providers(script)
  const text = await readAll(await handleAsk(request, ENV, { fetch: p.fetch }))
  return { text, p }
}
const upstreamCalls = (p: ReturnType<typeof providers>) => p.calls.map(({ signal, ...c }) => c)

describe('differential: new service sends the same upstream requests and frames as legacy', () => {
  const cases: Array<[string, Record<string, unknown>, Script, Record<string, string>?]> = [
    ['plain question', VALID, {}],
    ['page context', { ...VALID, pageContext: { title: '  Quick \n Start  ', href: ' /getting-started/quick-start ' } }, {}],
    ['long page context is cut to 120/240', { ...VALID, pageContext: { title: 'T'.repeat(300), href: `/${'h'.repeat(300)}` } }, {}],
    ['relative href dropped', { ...VALID, pageContext: { title: 'x', href: 'getting-started' } }, {}],
    ['protocol-relative href dropped', { ...VALID, pageContext: { title: 'x', href: '//evil.test/a' } }, {}],
    ['non-string title dropped', { ...VALID, pageContext: { title: 5, href: '/a' } }, {}],
    ['empty retrieval', VALID, { supabase: { rows: [] } }],
    ['client IP forwarded to siteverify', VALID, {}, { 'CF-Connecting-IP': '203.0.113.9' }],
    ['upstream split into 1-byte chunks (split UTF-8 and SSE lines)', VALID, { apertis: { chunks: [...new TextEncoder().encode(UPSTREAM_OK)].map((b) => new Uint8Array([b])) } }],
  ]
  for (const [label, body, script, headers] of cases) {
    test(label, async () => {
      const a = await viaLegacy(askRequest({ ...body, sessionId: `diff-${label}` }, { headers }), script)
      const b = await viaNew(askRequest({ ...body, sessionId: `diff-${label}` }, { headers }), script)
      assert.deepEqual(upstreamCalls(b.p), upstreamCalls(a.p))
      assert.deepEqual(b.p.called('supabase').map((c) => [c.url, c.body]), [[`${ENV.SUPABASE_URL}/rest/v1/rpc/search_docs`, { query_embedding: [0.1, 0.2, 0.3], match_count: 5, similarity_threshold: 0.3 }]])
      assert.equal(b.text, a.text)
    })
  }

  test('empty retrieval still answers with the legacy "no documentation" prompt', async () => {
    const { p } = await viaNew(askRequest({ ...VALID, sessionId: 'empty-prompt' }), { supabase: { rows: [] } })
    assert.match(p.called('apertis')[0].body.messages[0].content, /## Relevant Documentation:\n\nNo relevant documentation found\.$/)
  })
})

describe('old client -> new server: the legacy client renders the same result', () => {
  const cases: Array<[string, Script, { question?: string }?]> = [
    ['streamed answer with citation', {}],
    ['answer split into 1-byte chunks', { apertis: { chunks: [...new TextEncoder().encode(UPSTREAM_OK)].map((b) => new Uint8Array([b])) } }],
    ['400 question too long', {}, { question: 'a'.repeat(2001) }],
    ['403 Turnstile failure', { turnstile: { success: false, codes: ['timeout-or-duplicate'] } }],
  ]
  for (const [label, script, opts] of cases) {
    test(label, async () => {
      const oldServer = providers(script)
      const newServer = providers(script)
      const sessionId = `client-${label}`
      const viaOld = await withGlobalFetch(oldServer.fetch, () => client((req) => legacy.onRequestPost({ request: req, env: ENV }), { ...opts, sessionId }))
      const viaNewServer = await client((req) => handleAsk(req, ENV, { fetch: newServer.fetch }), { ...opts, sessionId })
      assert.deepEqual(viaNewServer, viaOld)
    })
  }

  test('rendered answer and sources', async () => {
    const p = providers()
    const messages = await client((req) => handleAsk(req, ENV, { fetch: p.fetch }), { sessionId: 'client-render' })
    assert.deepEqual(messages.at(-1), {
      role: 'assistant',
      content: 'See [Quick Start](/getting-started/quick-start) — 你好 🚀.',
      sources: [{ title: 'Quick Start', href: '/getting-started/quick-start' }],
    })
  })

  test('429 shows the fixed limit message', async () => {
    const p = providers()
    for (let i = 0; i < 20; i++) await readAll(await handleAsk(askRequest({ ...VALID, sessionId: 'client-429' }), ENV, { fetch: p.fetch }))
    const messages = await client((req) => handleAsk(req, ENV, { fetch: p.fetch }), { sessionId: 'client-429' })
    assert.equal(messages.at(-1)?.content, 'You have reached the query limit. Please refresh to continue.')
  })

  test('500 shows the sanitized error, never provider text', async () => {
    const logs = captureLogs()
    try {
      const p = providers({ jina: { status: 502, text: `upstream says ${SENTINEL}` } })
      const messages = await client((req) => handleAsk(req, ENV, { fetch: p.fetch }), { sessionId: 'client-500' })
      assert.equal(messages.at(-1)?.content, 'Sorry, an error occurred. Please try again.\n\n```\nJina API error: 502\n```')
    } finally {
      logs.restore()
    }
    assert.ok(!logs.lines.join('\n').includes(SENTINEL))
  })

  test('midstream failure: partial answer renders, the added error frame is ignored', async () => {
    const logs = captureLogs()
    try {
      const p = providers({ apertis: { chunks: [sse(delta('Partial '), delta('answer'))], end: 'error' } })
      const messages = await client((req) => handleAsk(req, ENV, { fetch: p.fetch }), { sessionId: 'client-mid' })
      assert.deepEqual(messages.at(-1), { role: 'assistant', content: 'Partial answer', sources: [] })
    } finally {
      logs.restore()
    }
  })

  test('frames without a `content` key are ignored by the legacy parser', async () => {
    const stream = (extra: string) => async () =>
      new Response(sse('{"content":"A [Keys](/authentication/api-keys)"}') + extra + sse('{"content":" B"}', '[DONE]'), {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    const baseline = await client(stream(''))
    const withExtras = await client(stream(sse('{"error":"Upstream stream interrupted","traceId":"t-1"}', '{"meta":{"generation":"g1"}}', '{"sources":[{"href":"/x"}]}') + 'event: ping\n\n'))
    assert.deepEqual(withExtras, baseline)
    assert.equal(baseline.at(-1)?.content, 'A [Keys](/authentication/api-keys) B')
  })
})
