// Replays every case in migration/nimbus/fixtures/ask-wire.json against each target handler with
// network-free doubles for Turnstile, Jina, Supabase and Apertis.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, afterEach, describe, test } from 'node:test'
import {
  ENV, REPO_ROOT, SENTINEL, VALID, askRequest, frames, loadLegacyHandler, providers, readAll,
  trackRejections, withGlobalFetch, type PagesModule, type Script,
} from './harness.ts'

const wire = JSON.parse(readFileSync(`${REPO_ROOT}migration/nimbus/fixtures/ask-wire.json`, 'utf8'))
const fixture = (name: string) => {
  const c = wire.cases.find((x: { name: string }) => x.name === name)
  assert.ok(c, `fixture case ${name}`)
  return c
}
// Placeholders in the fixture are expanded here; every other body is sent verbatim.
const expandBody = (body: unknown) =>
  body && typeof body === 'object' && (body as { question?: string }).question === "<2001 x 'a'>"
    ? { ...body, question: 'a'.repeat(2001) }
    : body

const targets: Array<[string, PagesModule]> = [
  ['legacy', await loadLegacyHandler()],
  ['new', (await import('../../functions/api/ask.ts')) as unknown as PagesModule],
]

const rejections = trackRejections()
afterEach(() => rejections.assertNone())
after(() => rejections.stop())

async function run(mod: PagesModule, request: Request, script: Script = {}, env: Record<string, string | undefined> = ENV) {
  const p = providers(script)
  return withGlobalFetch(p.fetch, async () => {
    const res = await mod.onRequestPost({ request, env })
    const text = await readAll(res)
    return { res, text, p }
  })
}

for (const [name, mod] of targets) {
  describe(`ask-wire replay: ${name}`, () => {
    for (const c of ['invalid-json', 'empty', 'no-session', 'no-turnstile', 'question-too-long']) {
      test(c, async () => {
        const f = fixture(c)
        const { res, text, p } = await run(mod, askRequest(expandBody(f.body)))
        assert.equal(res.status, f.status)
        assert.equal(res.headers.get('content-type'), 'application/json')
        assert.deepEqual(JSON.parse(text), f.json)
        assert.equal(p.calls.length, 0, 'no provider call before validation passes')
      })
    }

    test('bad-turnstile', async () => {
      const f = fixture('bad-turnstile')
      const { res, text, p } = await run(mod, askRequest(f.body), { turnstile: { success: false, codes: ['invalid-input-response'] } })
      assert.equal(res.status, 403)
      assert.deepEqual(JSON.parse(text), f.json)
      assert.deepEqual(p.calls.map((c) => c.provider), ['turnstile'], 'no paid call after a failed Turnstile check')
    })

    test('missing-server-bindings', async () => {
      const f = fixture('missing-server-bindings')
      for (const body of ['{', {}, VALID, 'any']) {
        const { res, text, p } = await run(mod, askRequest(body), {}, {})
        assert.equal(res.status, f.status)
        assert.deepEqual(JSON.parse(text), f.json)
        assert.equal(p.calls.length, 0)
      }
    })

    test('preflight', async () => {
      const f = fixture('preflight')
      const res = await mod.onRequestOptions({})
      assert.equal(res.status, f.status)
      for (const [k, v] of Object.entries(f.headers)) assert.equal(res.headers.get(k), v)
    })

    test('get: only POST and OPTIONS handlers are exported, so GET falls through to the static 404', () => {
      assert.deepEqual(Object.keys(mod).sort(), ['onRequestOptions', 'onRequestPost'])
    })

    test('session-limit: the 21st question on one sessionId is refused', async () => {
      const f = fixture('session-limit')
      const body = { ...VALID, sessionId: `limit-${name}` }
      for (let i = 0; i < 20; i++) assert.equal((await run(mod, askRequest(body))).res.status, 200)
      const { res, text, p } = await run(mod, askRequest(body))
      assert.equal(res.status, f.status)
      assert.deepEqual(JSON.parse(text), f.json)
      assert.deepEqual(p.calls.map((c) => c.provider), ['turnstile'], 'counter runs after Turnstile, before paid calls')
    })

    test('success-stream', async () => {
      const f = fixture('success-stream')
      const { res, text } = await run(mod, askRequest(VALID))
      assert.equal(res.status, 200)
      for (const [k, v] of Object.entries(f.headers)) assert.equal(res.headers.get(k), v)
      assert.deepEqual(frames(text), [
        'data: {"content":"See "}\n\n',
        'data: {"content":"[Quick Start](/getting-started/quick-start)"}\n\n',
        'data: {"content":" — 你好 🚀."}\n\n',
        'data: [DONE]\n\n',
      ])
    })

    describe('upstream-error', () => {
      const failures: Array<[string, Script, RegExp]> = [
        ['jina non-2xx', { jina: { status: 401, text: `bad key ${SENTINEL}` } }, /^Jina API error: 401$/],
        ['supabase error', { supabase: { status: 404, text: JSON.stringify({ code: 'PGRST202', message: `no function ${SENTINEL}` }) } }, /./],
        ['apertis non-2xx', { apertis: { status: 503, text: `overloaded ${SENTINEL}` } }, /^Apertis API error: 503$/],
      ]
      for (const [label, script, error] of failures) {
        test(label, async () => {
          const { res, text } = await run(mod, askRequest(VALID), script)
          assert.equal(res.status, 500)
          const body = JSON.parse(text)
          if (name === 'legacy') {
            // Characterizes the defect being repaired: legacy forwards raw provider text.
            assert.ok(text.includes(SENTINEL), 'legacy leaks provider text')
            return
          }
          assert.match(body.error, error)
          assert.deepEqual(Object.keys(body).filter((k) => k !== 'traceId'), ['error'])
          assert.ok(!text.includes(SENTINEL), 'sanitized')
        })
      }
    })
  })
}

test('fixture replay covers every recorded case', () => {
  const covered = ['invalid-json', 'empty', 'no-session', 'no-turnstile', 'question-too-long', 'bad-turnstile', 'missing-server-bindings', 'get', 'preflight', 'session-limit', 'upstream-error', 'success-stream']
  assert.deepEqual(wire.cases.map((c: { name: string }) => c.name).sort(), covered.sort())
})

