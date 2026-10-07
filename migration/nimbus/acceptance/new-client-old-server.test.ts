// ask-docs-api "Independent client and server deployment", scenario "New client, old server" (issue #12):
// the candidate wire client (site-nimbus/src/components/assistant/wire.ts) reads the answers of the
// deployed legacy handler (functions/api/ask.ts at bb057a7, loaded by assistant/test/harness.ts) with
// the provider doubles. Contract evidence only; no network.
//
// Excluded: an upstream error in the middle of the stream. The legacy relay (bb057a7
// functions/api/ask.ts, about lines 261-295) reads the upstream in an async IIFE with try/finally and
// no catch, so a mid-stream upstream error becomes an unhandled rejection in the legacy handler. That
// is a legacy baseline defect, not a client behaviour this test can assert; the candidate server
// handles it (assistant/test/failure.test.ts "midstream upstream error").
//   node --test migration/nimbus/acceptance/new-client-old-server.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { askBody, errorMessage, QUERY_LIMIT_MESSAGE, readAnswer, REJECTED_MESSAGE, sourceLinks, UNAVAILABLE_MESSAGE } from '../../../site-nimbus/src/components/assistant/wire.ts'
import { delta, ENV, loadLegacyHandler, providers, readAll, sse, VALID, withGlobalFetch, type Script } from '../../../assistant/test/harness.ts'

const legacy = await loadLegacyHandler()
const page = { title: 'Quick Start', href: '/getting-started/quick-start' }

// One request from the new client to the old server, read the way the new client reads it.
async function ask(script: Script, body: unknown) {
  const p = providers(script)
  return withGlobalFetch(p.fetch, async () => {
    const request = new Request('https://docs.test/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const res = await legacy.onRequestPost({ request, env: ENV })
    if (!res.ok) return { status: res.status, message: await errorMessage(res) }
    // The new client stops reading at [DONE]; the second branch reads the body to its end, so the
    // legacy handler's writes after [DONE] still have a reader (as in the harness's own tests).
    const [client, drain] = res.body!.tee()
    let text = ''
    const [end] = await Promise.all([readAnswer(client, (d) => { text += d }), readAll(new Response(drain))])
    return { status: res.status, text, end, sources: sourceLinks(text) }
  })
}

test('the answer streams to [DONE] and its citation renders as a source link', async () => {
  const r = await ask({}, askBody(VALID.question, 'new-client-ok', 'tok', page))
  assert.deepEqual(r, {
    status: 200,
    text: 'See [Quick Start](/getting-started/quick-start) — 你好 🚀.',
    end: 'done',
    sources: [{ title: 'Quick Start', href: '/getting-started/quick-start' }],
  })
})

test('400 shows the reader-facing rejected message', async () => {
  const r = await ask({}, askBody('a'.repeat(2001), 'new-client-400', 'tok'))
  assert.equal(r.status, 400)
  assert.equal(r.message, REJECTED_MESSAGE)
})

test('403 shows the reader-facing rejected message', async () => {
  const r = await ask({ turnstile: { success: false, codes: ['timeout-or-duplicate'] } }, askBody(VALID.question, 'new-client-403', 'tok', page))
  assert.equal(r.status, 403)
  assert.equal(r.message, REJECTED_MESSAGE)
})

test('429 shows the fixed legacy limit message', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await ask({}, askBody(VALID.question, 'new-client-429', 'tok'))).status, 200)
  const r = await ask({}, askBody(VALID.question, 'new-client-429', 'tok'))
  assert.deepEqual(r, { status: 429, message: QUERY_LIMIT_MESSAGE })
})

test('500 shows the reader-facing unavailable message, not the upstream detail', async () => {
  const r = await ask({ jina: { status: 502, text: 'upstream' } }, askBody(VALID.question, 'new-client-500', 'tok', page))
  assert.equal(r.status, 500)
  assert.ok(r.message!.startsWith(UNAVAILABLE_MESSAGE), r.message)
  assert.doesNotMatch(r.message!, /Jina|502/)
})

test('an upstream that closes without [DONE] keeps the partial answer and reads as interrupted', async () => {
  const r = await ask({ apertis: { chunks: [sse(delta('Partial '), delta('answer'))], end: 'close' } }, askBody(VALID.question, 'new-client-eof', 'tok', page))
  assert.deepEqual(r, { status: 200, text: 'Partial answer', end: 'interrupted', sources: [] })
})
