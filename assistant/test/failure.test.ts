// Failure paths from #10: validation, Turnstile, upstream errors/timeouts, stream lifecycle, cancellation.
import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, describe, test } from 'node:test'
import { MAX_BODY_BYTES, handleAsk, normalizePageContext, type AskDeps } from '../service.ts'
import {
  ENV, SENTINEL, VALID, askRequest, captureLogs, delta, frames, providers, readAll, sse, trackRejections, type Script,
} from './harness.ts'

const rejections = trackRejections()
let logs: ReturnType<typeof captureLogs>
beforeEach(() => { logs = captureLogs() })
afterEach(async () => {
  logs.restore()
  assert.ok(!logs.lines.join('\n').includes(SENTINEL), 'no secret or provider text in logs')
  await rejections.assertNone()
})
after(() => rejections.stop())

let n = 0
const session = () => `f-${++n}`
const FAST: AskDeps['timeouts'] = { turnstile: 50, jina: 50, retrieval: 50, apertis: 150 }

async function ask(body: unknown, script: Script = {}, init: Parameters<typeof askRequest>[1] = {}) {
  const p = providers(script)
  const res = await handleAsk(askRequest(body, init), ENV, { fetch: p.fetch, timeouts: FAST })
  const text = await readAll(res)
  assert.ok(!text.includes(SENTINEL), 'no secret or provider text in the response')
  return { res, text, p, body: res.headers.get('content-type') === 'application/json' ? JSON.parse(text) : undefined }
}

describe('request validation', () => {
  const bad: Array<[string, unknown, number, string]> = [
    ['null body', 'null', 400, 'Missing or invalid question'],
    ['array body', '[1]', 400, 'Missing or invalid question'],
    ['number body', '7', 400, 'Missing or invalid question'],
    ['empty body', '', 400, 'Invalid JSON body'],
    ['question not a string', { ...VALID, question: 42 }, 400, 'Missing or invalid question'],
    ['empty question', { ...VALID, question: '' }, 400, 'Missing or invalid question'],
    ['question 2001 chars', { ...VALID, question: 'q'.repeat(2001) }, 400, 'Question too long (max 2000 characters)'],
    ['sessionId not a string', { ...VALID, sessionId: 1 }, 400, 'Missing or invalid sessionId'],
    ['sessionId over 128 chars', { ...VALID, sessionId: 's'.repeat(129) }, 400, 'Missing or invalid sessionId'],
    ['turnstileToken not a string', { ...VALID, turnstileToken: ['x'] }, 400, 'Missing Turnstile token'],
    ['body over the size cap', { ...VALID, pad: 'x'.repeat(MAX_BODY_BYTES) }, 413, 'Request body too large'],
  ]
  for (const [label, body, status, error] of bad) {
    test(label, async () => {
      const r = await ask(body)
      assert.equal(r.res.status, status)
      assert.deepEqual(r.body, { error })
      assert.equal(r.p.calls.length, 0)
    })
  }

  test('oversized chunked body without Content-Length is cut off', async () => {
    const p = providers()
    const chunk = new TextEncoder().encode('x'.repeat(16 * 1024))
    let sent = 0
    const body = new ReadableStream<Uint8Array>({ pull(c) { sent++; c.enqueue(chunk) } })
    const req = new Request('https://docs.test/api/ask', { method: 'POST', body, duplex: 'half' } as RequestInit)
    const res = await handleAsk(req, ENV, { fetch: p.fetch })
    assert.equal(res.status, 413)
    assert.ok(sent <= 6, 'stopped reading shortly after the cap')
  })

  test('question of exactly 2000 chars is accepted', async () => {
    assert.equal((await ask({ ...VALID, question: 'q'.repeat(2000), sessionId: session() })).res.status, 200)
  })

  test('pageContext normalization', () => {
    assert.deepEqual(normalizePageContext({ title: ' a \n\t b ', href: ' /x ' }), { title: 'a b', href: '/x' })
    assert.deepEqual(normalizePageContext({ title: 't'.repeat(200), href: `/${'h'.repeat(300)}` }), { title: 't'.repeat(120), href: `/${'h'.repeat(239)}` })
    for (const bad of [null, 'x', [], { title: 't' }, { title: '  ', href: '/x' }, { title: 't', href: 'x' }, { title: 't', href: '//x' }, { title: 't', href: 'https://x' }, { title: 1, href: '/x' }]) {
      assert.equal(normalizePageContext(bad), null, JSON.stringify(bad))
    }
  })
})

describe('Turnstile runs before any paid call', () => {
  for (const [label, codes] of [['invalid token', ['invalid-input-response']], ['expired or reused token', ['timeout-or-duplicate']]] as const) {
    test(label, async () => {
      const r = await ask({ ...VALID, sessionId: session() }, { turnstile: { success: false, codes: [...codes] } })
      assert.equal(r.res.status, 403)
      assert.deepEqual(r.body, { error: 'Turnstile verification failed', codes })
      assert.deepEqual(r.p.calls.map((c) => c.provider), ['turnstile'])
    })
  }

  test('secret and token are sent server-side to siteverify', async () => {
    const r = await ask({ ...VALID, sessionId: session() })
    assert.deepEqual(r.p.called('turnstile')[0].body, { secret: ENV.TURNSTILE_SECRET_KEY, response: VALID.turnstileToken })
  })

  for (const [label, turnstile] of [['non-JSON 502', { status: 502, text: `<html>${SENTINEL}</html>` }], ['network error', 'throw'], ['timeout', 'hang']] as const) {
    test(`provider failure: ${label}`, async () => {
      const r = await ask({ ...VALID, sessionId: session() }, { turnstile })
      assert.equal(r.res.status, 500)
      assert.equal(r.body.error, 'Turnstile verification unavailable')
      assert.match(r.body.traceId, /^[0-9a-f-]{36}$/)
      assert.deepEqual(r.p.calls.map((c) => c.provider), ['turnstile'])
    })
  }
})

describe('upstream failures are visible but sanitized', () => {
  const cases: Array<[string, Script, string, string[]]> = [
    ['Jina non-2xx', { jina: { status: 429, text: SENTINEL } }, 'Jina API error: 429', ['turnstile', 'jina']],
    ['Jina timeout', { jina: 'hang' }, 'Jina API error: timeout', ['turnstile', 'jina']],
    ['Jina network error', { jina: 'throw' }, 'An error occurred processing your request', ['turnstile', 'jina']],
    ['Jina malformed body', { jina: { status: 200, text: `{"oops":"${SENTINEL}"}` } }, 'An error occurred processing your request', ['turnstile', 'jina']],
    ['search_docs error', { supabase: { status: 400, text: JSON.stringify({ code: '42883', message: SENTINEL, details: SENTINEL, hint: SENTINEL }) } }, 'Documentation search error', ['turnstile', 'jina', 'supabase']],
    ['search_docs timeout', { supabase: 'hang' }, 'Documentation search error', ['turnstile', 'jina', 'supabase']],
    ['Apertis non-2xx', { apertis: { status: 401, text: SENTINEL } }, 'Apertis API error: 401', ['turnstile', 'jina', 'supabase', 'apertis']],
    ['Apertis timeout before headers', { apertis: 'hang' }, 'Apertis API error: timeout', ['turnstile', 'jina', 'supabase', 'apertis']],
  ]
  for (const [label, script, error, order] of cases) {
    test(label, async () => {
      const r = await ask({ ...VALID, sessionId: session() }, script)
      assert.equal(r.res.status, 500)
      assert.deepEqual(Object.keys(r.body).sort(), ['error', 'traceId'])
      assert.equal(r.body.error, error)
      assert.deepEqual(r.p.calls.map((c) => c.provider), order)
      assert.ok(logs.lines.some((l) => l.includes(r.body.traceId)), 'trace id is logged server-side')
    })
  }
})

describe('stream relay', () => {
  const run = async (chunks: Array<string | Uint8Array>, end?: 'close' | 'error' | 'hang') => ask({ ...VALID, sessionId: session() }, { apertis: { chunks, end } })

  test('split SSE frames and split UTF-8 across chunks', async () => {
    const bytes = new TextEncoder().encode(sse(delta('héllo 🚀'), '[DONE]'))
    const r = await run([bytes.slice(0, 20), bytes.slice(20, 37), bytes.slice(37)])
    assert.deepEqual(frames(r.text), ['data: {"content":"héllo 🚀"}\n\n', 'data: [DONE]\n\n'])
  })

  test('CRLF lines, "data:" without a space and final buffered data without a newline', async () => {
    const r = await run([`data: ${delta('a')}\r\n\r\ndata:${delta('b')}\n\ndata: ${delta('c')}\n\ndata: [DONE]`])
    assert.deepEqual(frames(r.text), ['data: {"content":"a"}\n\n', 'data: {"content":"b"}\n\n', 'data: {"content":"c"}\n\n', 'data: [DONE]\n\n'])
  })

  test('[DONE] exactly once: upstream [DONE] twice, content after [DONE] dropped, upstream released', async () => {
    const p = providers({ apertis: { chunks: [sse(delta('x'), '[DONE]', delta('late'), '[DONE]')], end: 'hang' } })
    const r = await readAll(await handleAsk(askRequest({ ...VALID, sessionId: session() }), ENV, { fetch: p.fetch, timeouts: FAST }))
    assert.deepEqual(frames(r), ['data: {"content":"x"}\n\n', 'data: [DONE]\n\n'])
    assert.ok(p.apertisStream.cancelled || p.apertisStream.aborted, 'upstream released after [DONE]')
  })

  test('upstream EOF without [DONE] is an interrupted stream: content, one error frame, no [DONE]', async () => {
    for (const chunks of [[sse(delta('x'))], [sse(delta('x')) + `data: ${delta('y')}`], []]) {
      const r = await run(chunks)
      const f = frames(r.text)
      const content = f.slice(0, -1)
      assert.deepEqual(content, chunks.length ? ['data: {"content":"x"}\n\n', ...(chunks[0].endsWith('}') ? ['data: {"content":"y"}\n\n'] : [])] : [])
      const err = JSON.parse(f.at(-1)!.slice(6))
      assert.deepEqual(Object.keys(err).sort(), ['error', 'traceId'])
      assert.equal(err.error, 'Upstream stream interrupted')
      assert.equal(f.filter((x) => x.includes('[DONE]')).length, 0)
    }
  })

  test('midstream upstream error: partial content, one error frame, no [DONE]', async () => {
    const r = await run([sse(delta('part'))], 'error')
    const f = frames(r.text)
    assert.equal(f[0], 'data: {"content":"part"}\n\n')
    assert.equal(f.length, 2)
    const err = JSON.parse(f[1].slice(6))
    assert.deepEqual(Object.keys(err).sort(), ['error', 'traceId'])
    assert.equal(err.error, 'Upstream stream interrupted')
  })

  test('in-band upstream error frame ends the stream without [DONE]', async () => {
    const r = await run([sse(delta('part'), JSON.stringify({ error: { message: SENTINEL } }), delta('never'))], 'hang')
    assert.deepEqual(frames(r.text).map((f) => f.slice(0, 20)), ['data: {"content":"pa', 'data: {"error":"Upst'])
  })

  test('stream lifetime is bounded: a stalled upstream is aborted and the stream closes', async () => {
    const p = providers({ apertis: { chunks: [sse(delta('slow'))], end: 'hang' } })
    const res = await handleAsk(askRequest({ ...VALID, sessionId: session() }), ENV, { fetch: p.fetch, timeouts: FAST })
    const text = await readAll(res, 1000)
    assert.equal(frames(text).at(-1)?.startsWith('data: {"error":"Upstream stream interrupted"'), true)
    assert.equal(p.apertisStream.aborted, true)
  })

  test('client cancellation (disconnected writer) aborts the upstream request', async () => {
    const p = providers({ apertis: { chunks: [sse(delta('first'))], end: 'hang' } })
    const res = await handleAsk(askRequest({ ...VALID, sessionId: session() }), ENV, { fetch: p.fetch })
    const reader = res.body!.getReader()
    const first = await reader.read()
    assert.equal(new TextDecoder().decode(first.value), 'data: {"content":"first"}\n\n')
    await reader.cancel('client went away')
    assert.equal(p.called('apertis')[0].signal?.aborted, true)
    assert.equal(p.apertisStream.aborted || p.apertisStream.cancelled, true)
  })

  test('client abort before the stream starts aborts the in-flight provider call', async () => {
    const p = providers({ jina: 'hang' })
    const ac = new AbortController()
    const pending = handleAsk(askRequest({ ...VALID, sessionId: session() }, { signal: ac.signal }), ENV, { fetch: p.fetch })
    await new Promise((r) => setTimeout(r, 20))
    ac.abort()
    const res = await pending
    assert.equal(res.status, 500)
    assert.equal(p.called('jina')[0].signal?.aborted, true)
    assert.equal(p.calls.some((c) => c.provider === 'apertis'), false)
  })

  test('SSE response headers are non-cacheable event-stream', async () => {
    const r = await run([sse(delta('x'), '[DONE]')])
    assert.equal(r.res.headers.get('content-type'), 'text/event-stream')
    assert.equal(r.res.headers.get('cache-control'), 'no-cache')
  })
})

describe('session counter (known limitation, per isolate)', () => {
  test('20 questions per sessionId, then 429 before any paid call', async () => {
    const id = session()
    for (let i = 0; i < 20; i++) assert.equal((await ask({ ...VALID, sessionId: id })).res.status, 200)
    const r = await ask({ ...VALID, sessionId: id })
    assert.equal(r.res.status, 429)
    assert.deepEqual(r.body, { error: 'Query limit reached for this session' })
    assert.deepEqual(r.p.calls.map((c) => c.provider), ['turnstile'])
    assert.equal((await ask({ ...VALID, sessionId: session() })).res.status, 200, 'a new client-chosen id resets it')
  })
})
