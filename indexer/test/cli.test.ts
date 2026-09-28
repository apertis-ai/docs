// The CLI end to end: exit codes and receipts, with the real PostgREST and Jina clients talking to a
// fetch router (PostgREST rpc -> the local replica as service_role; Jina -> deterministic vectors).
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { main } from '../index.ts'
import { fakeVector, legacyDigest, postgrestFetch, replica } from './db.ts'
import { fixture, page } from './fixture.ts'

const URL_ = 'https://replica.test'
const ENV = { SUPABASE_URL: URL_, SUPABASE_SERVICE_KEY: 'service-key-sntl', JINA_API_KEY: 'jina-key-sntl' }
const DOCS = [
  { id: 'default:a', path: '/guide/a', title: 'Alpha', body: page('Alpha', ['Install', 'Alpha install text.']) },
  { id: 'api:index', path: '/api/', title: 'API Reference', body: page('API Reference', ['Endpoints', 'Endpoint list.']) },
]
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function route(db: Awaited<ReturnType<typeof replica>>, jina: 'ok' | 'fail') {
  const rest = postgrestFetch(db, URL_, 'service_role')
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    if (url.startsWith(`${URL_}/rest/v1/rpc/`)) return rest(input, init)
    if (url === 'https://api.jina.ai/v1/embeddings') {
      if (jina === 'fail') return new Response('bad request', { status: 400 })
      const { input: texts } = JSON.parse(String(init!.body))
      return Response.json({ data: texts.map((t: string) => ({ embedding: fakeVector(t) })) })
    }
    throw new TypeError(`unexpected fetch ${url}`)
  }) as typeof fetch
  return calls
}

async function cli(args: string[], env: Record<string, string> = ENV) {
  const out: string[] = []
  const code = await main(args, env, (s) => out.push(s))
  return { code, text: out.join('\n'), receipt: JSON.parse(out.join('\n')) }
}

test('an invalid plan exits 1 with a failed receipt, in dry-run and write mode, before any call', async () => {
  const f = fixture(DOCS, 'cli-bad')
  writeFileSync(path.join(f.dist, 'guide/a.md'), 'tampered')
  let fetches = 0
  globalThis.fetch = (async () => { fetches++; throw new Error('unexpected') }) as typeof fetch
  for (const extra of [['--dry-run'], []]) {
    const r = await cli(['--environment', 'preview', '--manifest', f.manifest, '--dist', f.dist, ...extra])
    assert.equal(r.code, 1)
    assert.equal(r.receipt.ok, false)
    assert.match(r.receipt.problems.join('\n'), /hash differs from the manifest/)
  }
  assert.equal(fetches, 0)
})

test('write mode: exit 0 with a ready receipt; a failing embedder exits 1 with a failed receipt; no secret in either', async () => {
  const db = await replica()
  const legacy = await legacyDigest(db)
  const f = fixture(DOCS, 'cli-1')
  const receiptFile = path.join(path.dirname(f.manifest), 'receipt.json')
  const calls = route(db, 'ok')
  const ok = await cli(['--environment', 'preview', '--manifest', f.manifest, '--dist', f.dist, '--receipt', receiptFile])
  assert.equal(ok.code, 0, ok.text)
  assert.equal(ok.receipt.generationState, 'ready')
  assert.deepEqual(ok.receipt.documents, { planned: 0, pending: 0, complete: 2, failed: 0, excluded: 0 })
  assert.equal(ok.receipt.chunks.written, ok.receipt.chunks.planned)
  assert.deepEqual(JSON.parse(readFileSync(receiptFile, 'utf8')), ok.receipt)
  assert.ok(calls.some((u) => u.endsWith('/rpc/docs_generation_finish')))
  const g = (await db.query<{ state: string }>(`select state from docs_generations where id = $1`, [ok.receipt.generationId])).rows[0]
  assert.equal(g.state, 'ready')

  route(db, 'fail')
  const changed = fixture([{ ...DOCS[0], body: page('Alpha', ['Install', 'Changed text.']) }, DOCS[1]], 'cli-2')
  const bad = await cli(['--environment', 'preview', '--manifest', changed.manifest, '--dist', changed.dist])
  assert.equal(bad.code, 1, bad.text)
  assert.equal(bad.receipt.ok, false)
  assert.equal(bad.receipt.generationState, 'failed')
  assert.match(bad.receipt.error, /Jina answered 400/)
  const states = (await db.query<{ state: string }>(`select state from docs_generations order by id`)).rows.map((r) => r.state)
  assert.deepEqual(states, ['ready', 'failed'])

  for (const r of [ok, bad]) assert.doesNotMatch(r.text, /sntl/)
  assert.equal(await legacyDigest(db), legacy)
})
