// End to end through the #10 seam: assistant createRetrieval('generation') -> PostgREST-shaped fetch ->
// search_docs_generation executed as anon in the local replica.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { RetrievalError, createRetrieval } from '../../assistant/retrieval.ts'
import { plan, run } from '../indexer.ts'
import { asRole, fakeEmbedder, fakeVector, pgliteStore, postgrestFetch, replica } from './db.ts'
import { fixture, page } from './fixture.ts'

const URL_ = 'https://replica.test'
const T_PREVIEW = 'preview-reader-secret-0123456789abcdef'
const T_STAGING = 'staging-reader-secret-0123456789abcdef'
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const genEnv = (environment: string, token: string) => ({
  ASK_RETRIEVAL_SOURCE: 'generation', SUPABASE_URL: URL_, SUPABASE_ANON_KEY: 'anon-key', ASK_GENERATION_ENVIRONMENT: environment, ASK_GENERATION_READER_TOKEN: token,
})
const q = (text: string) => ({ queryEmbedding: fakeVector(text), matchCount: 5, similarityThreshold: 0.3 })
const ALPHA = 'Alpha > Install\n\nAlpha install text.'

async function setup() {
  const db = await replica()
  const store = pgliteStore(db)
  const index = async (docs: Parameters<typeof fixture>[0], seed: string, environment: string) => {
    const f = fixture(docs, seed)
    const r = await run(plan(f.manifest, f.dist), { environment, store, embedder: fakeEmbedder() })
    assert.equal(r.ok, true, r.error ?? '')
    return r.generationId!
  }
  const alpha = { id: 'default:a', path: '/guide/a', title: 'Alpha', body: page('Alpha', ['Install', 'Alpha install text.']) }
  const api = { id: 'api:index', path: '/api/', title: 'API Reference', body: page('API Reference', ['Endpoints', 'Endpoint list.']) }
  const g1 = await index([alpha, api], 'v1', 'preview')
  const g2 = await index([{ ...alpha, path: '/guide/alpha-moved' }, api], 'v2', 'preview')
  const gs = await index([{ ...alpha, body: page('Alpha', ['Install', 'Staging-only install text.']) }], 's1', 'staging')
  await db.query(`select docs_generation_set_reader('preview', $1)`, [hash(T_PREVIEW)])
  await db.query(`select docs_generation_set_reader('staging', $1)`, [hash(T_STAGING)])
  await db.query(`select * from docs_generation_activate('preview', $1)`, [g1])
  await db.query(`select * from docs_generation_activate('staging', $1)`, [gs])
  return { db, fetch: postgrestFetch(db, URL_), g1, g2, gs }
}

test('the configured environment gets its active generation, with manifest canonical paths; activation and rollback switch it', async () => {
  const { db, fetch, g1, g2 } = await setup()
  const retrieve = createRetrieval(genEnv('preview', T_PREVIEW), fetch)
  assert.deepEqual(await retrieve(q(ALPHA)), [{ title: 'Alpha', url_path: '/guide/a', content: ALPHA, similarity: 1 }])
  const api = await retrieve(q('API Reference > Endpoints\n\nEndpoint list.'))
  assert.equal(api[0].url_path, '/api/')
  assert.deepEqual(fetch.calls.map((c) => c.name), ['search_docs_generation', 'search_docs_generation'])

  await db.query(`select * from docs_generation_activate('preview', $1)`, [g2])
  assert.equal((await retrieve(q(ALPHA)))[0].url_path, '/guide/alpha-moved', 'the new release cites its own route')
  await db.query(`select * from docs_generation_activate('preview', $1)`, [g1])
  assert.equal((await retrieve(q(ALPHA)))[0].url_path, '/guide/a', 'rollback serves the previous generation again')
  // Staging content is never visible to preview.
  assert.deepEqual(await retrieve(q('Alpha > Install\n\nStaging-only install text.')), [])
})

test('missing, unauthorized, building, failed and foreign selections all fail closed', async () => {
  const { db, fetch, g1, gs } = await setup()
  const code = async (env: ReturnType<typeof genEnv>) => {
    try {
      await createRetrieval(env, fetch)(q(ALPHA))
    } catch (e) {
      assert.ok(e instanceof RetrievalError)
      return e.code
    }
    assert.fail('retrieval succeeded')
  }
  assert.equal(await code(genEnv('qa', T_PREVIEW)), '42501', 'unconfigured environment')
  assert.equal(await code(genEnv('staging', T_PREVIEW)), '42501', "another environment's name with this secret")
  assert.equal(await code(genEnv('preview', T_STAGING)), '42501', "this environment's name with another secret")
  await db.query(`select docs_generation_set_reader('qa', $1)`, [hash('qa-reader-secret-0123456789abcdef00')])
  assert.equal(await code(genEnv('qa', 'qa-reader-secret-0123456789abcdef00')), 'P0002', 'no active generation')

  // States the activation function refuses to create, forced as superuser to reach the reader's own checks.
  const f = fixture([{ id: 'default:x', path: '/x', title: 'X', body: page('X', ['Y', 'Unfinished.']) }], 'building')
  let reached!: () => void
  const atHang = new Promise<void>((r) => { reached = r })
  void run(plan(f.manifest, f.dist), { environment: 'preview', store: pgliteStore(db), embedder: fakeEmbedder(async () => { reached(); await new Promise(() => {}) }) })
  await atHang
  const building = (await db.query<{ id: number }>(`select id from docs_generations where state = 'building'`)).rows[0].id
  for (const [id, why] of [[building, 'building'], [gs, 'foreign environment']] as const) {
    await db.query(`update docs_generation_slots set active_generation_id = $1 where environment = 'preview'`, [id])
    assert.equal(await code(genEnv('preview', T_PREVIEW)), 'P0003', why)
  }
  await db.query(`update docs_generations set state = 'failed' where id = $1`, [g1])
  await db.query(`update docs_generation_slots set active_generation_id = $1 where environment = 'preview'`, [g1])
  assert.equal(await code(genEnv('preview', T_PREVIEW)), 'P0003', 'failed')
  assert.ok(fetch.calls.every((c) => c.name === 'search_docs_generation'), 'never a legacy fallback')
})

test('anon can execute only the legacy search_docs overloads and the secret-gated reader; no RPC takes a generation id', async () => {
  const { db } = await setup()
  const { rows } = await db.query<{ sig: string }>(`select oid::regprocedure::text as sig from pg_proc where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute') order by 1`)
  assert.deepEqual(rows.map((r) => r.sig), [
    'search_docs(extensions.vector,integer)',
    'search_docs(extensions.vector,integer,double precision)',
    'search_docs_generation(extensions.vector,integer,double precision,text,text)',
  ])
  // Reading generation tables directly as anon is denied (the reader is the only path).
  await assert.rejects(asRole(db, 'anon', `select count(*) from docs_generation_chunks`), /permission denied/)
})

test('legacy mode through the same seam still reads the legacy tables with the three-argument search_docs', async () => {
  const { db } = await setup()
  const fetch = postgrestFetch(db, URL_)
  const rows = await createRetrieval({ ASK_RETRIEVAL_SOURCE: 'legacy', SUPABASE_URL: URL_, SUPABASE_ANON_KEY: 'anon-key' }, fetch)(q('legacy-1'))
  assert.equal(rows[0].url_path, '/getting-started/quick-start')
  assert.equal(rows[0].content, 'Quick Start\n\nlegacy text one')
  assert.deepEqual(fetch.calls.map((c) => [c.name, Object.keys(c.body)]), [['search_docs', ['query_embedding', 'match_count', 'similarity_threshold']]])
})
