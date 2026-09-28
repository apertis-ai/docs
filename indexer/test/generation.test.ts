// Generation lifecycle against the local replica: corpus changes, failures, cancellation, concurrency,
// idempotent re-runs with embedding reuse, and activation/rollback. Every write goes through the
// migration's functions as service_role; the legacy tables and older generations must not change.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { type Receipt, type RunOptions, plan, run } from '../indexer.ts'
import { type FakeEmbedder, fakeEmbedder, generationDigest, legacyDigest, pgliteStore, replica } from './db.ts'
import { type FixtureDoc, fixture, page } from './fixture.ts'

const V1: FixtureDoc[] = [
  { id: 'default:a', path: '/guide/a', title: 'Alpha', body: page('Alpha', ['Install', 'Alpha install text.'], ['Use', 'Alpha use text.']) },
  { id: 'default:b', path: '/guide/b', title: 'Beta', body: page('Beta', ['Keys', 'Beta keys text.']) },
  { id: 'default:c', path: '/guide/c', title: 'Gamma', body: page('Gamma', ['Models', 'Gamma models text.']), sourcePath: 'docs/guide/c.md' },
  { id: 'default:d', path: '/guide/d', title: 'Delta', body: page('Delta', ['Billing', 'Delta billing text.']) },
  { id: 'default:e', path: '/guide/e', title: 'Epsilon', body: page('Epsilon', ['Old', 'Epsilon text.']) },
  { id: 'page:home', path: '/', title: 'Home', body: '# Home', rag: false },
]
const CHUNKS_PER_DOC = 2 // intro + one section, except Alpha (3)

async function start(docs = V1, seed = 'v1') {
  const db = await replica()
  return { db, store: pgliteStore(db), fx: fixture(docs, seed), legacy: await legacyDigest(db) }
}

function index(fx: { manifest: string; dist: string }, o: Omit<RunOptions, 'environment'> & { environment?: string }): Promise<Receipt> {
  return run(plan(fx.manifest, fx.dist), { environment: 'preview', ...o })
}

async function one<T = any>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]
}

async function generations(db: PGlite) {
  return (await db.query<{ id: number; state: string; build_id: string; failure: string | null }>(`select id, state, build_id, failure from docs_generations order by id`)).rows
}

async function docStates(db: PGlite, id: number) {
  return (await db.query<{ doc_id: string; state: string; n: number }>(
    `select d.doc_id, d.state, (select count(*)::int from docs_generation_chunks c where c.generation_id = d.generation_id and c.doc_id = d.doc_id) as n
     from docs_generation_documents d where d.generation_id = $1 order by d.doc_id`, [id])).rows
}

/** Not servable: it cannot be activated, so no reader can ever select it. */
async function assertNotActivatable(db: PGlite, id: number) {
  await assert.rejects(db.query(`select * from docs_generation_activate('preview', $1)`, [id]), /is not a ready generation/)
}

test('add, update, rename, delete and exclude produce the expected new generation; the old one and legacy stay byte-identical', async () => {
  const { db, store, fx, legacy } = await start()
  const e1 = fakeEmbedder()
  const r1 = await index(fx, { store, embedder: e1 })
  assert.equal(r1.ok, true, r1.error ?? '')
  assert.equal(r1.generationState, 'ready')
  assert.deepEqual(r1.documents, { planned: 0, pending: 0, complete: 5, failed: 0, excluded: 1 })
  assert.equal(r1.chunks.written, 11)
  assert.equal(e1.texts, 11)
  await db.query(`select * from docs_generation_activate('preview', $1)`, [r1.generationId])
  const g1 = await generationDigest(db, r1.generationId!)

  const v2: FixtureDoc[] = [
    V1[0], // a unchanged
    { ...V1[1], body: page('Beta', ['Keys', 'Beta keys text, updated.']) }, // b updated
    { ...V1[2], path: '/guide/c-renamed', sourcePath: 'docs/guide/c-renamed.mdx' }, // c renamed, same id
    { ...V1[3], rag: false }, // d excluded
    // e deleted
    { id: 'default:f', path: '/guide/f', title: 'Zeta', body: page('Zeta', ['New', 'Zeta text.']) }, // f added
    V1[5],
  ]
  const fx2 = fixture(v2, 'v2')
  const e2 = fakeEmbedder()
  const r2 = await index(fx2, { store, embedder: e2 })
  assert.equal(r2.ok, true, r2.error ?? '')
  assert.notEqual(r2.generationId, r1.generationId)
  assert.deepEqual(r2.excluded, ['default:d', 'page:home'])

  const docs = (await db.query<any>(`select doc_id, url_path, canonical_url, source_path, title, state from docs_generation_documents where generation_id = $1 order by doc_id`, [r2.generationId])).rows
  assert.deepEqual(docs.map((d) => [d.doc_id, d.url_path, d.state]), [
    ['default:a', '/guide/a', 'complete'],
    ['default:b', '/guide/b', 'complete'],
    ['default:c', '/guide/c-renamed', 'complete'],
    ['default:f', '/guide/f', 'complete'],
  ])
  assert.equal(docs[2].source_path, 'docs/guide/c-renamed.mdx')
  assert.equal(docs[2].canonical_url, 'https://docs.apertis.ai/guide/c-renamed')
  const updated = await one(db, `select content from docs_generation_chunks where generation_id = $1 and doc_id = 'default:b' and chunk_index = 1`, [r2.generationId])
  assert.match(updated.content, /updated/)

  // Only the changed text was embedded: b's changed section and f; a and the renamed c were reused.
  assert.equal(e2.texts, 3)
  assert.equal(r2.chunks.embedded, 3)
  assert.equal(r2.chunks.reused, 6)

  assert.equal(await generationDigest(db, r1.generationId!), g1, 'previous generation unchanged')
  assert.equal(await legacyDigest(db), legacy, 'legacy tables unchanged')
  const slot = await one(db, `select active_generation_id from docs_generation_slots where environment = 'preview'`)
  assert.equal(Number(slot.active_generation_id), r1.generationId, 'the indexer never activates')
})

test('re-running a ready build is a no-op; a new build reuses every unchanged embedding', async () => {
  const { db, store, fx, legacy } = await start()
  const r1 = await index(fx, { store, embedder: fakeEmbedder() })
  assert.equal(r1.ok, true)
  const g1 = await generationDigest(db, r1.generationId!)

  const again = fakeEmbedder()
  const r2 = await index(fx, { store, embedder: again })
  assert.equal(r2.ok, true)
  assert.equal(r2.alreadyReady, true)
  assert.equal(r2.generationId, r1.generationId)
  assert.equal(again.calls, 0)
  assert.equal((await generations(db)).length, 1)
  assert.equal(await generationDigest(db, r1.generationId!), g1)

  // Same content under a new build id: a new generation, zero embedding calls.
  const rebuilt = fakeEmbedder()
  const r3 = await index(fixture(V1, 'v1-rebuild'), { store, embedder: rebuilt })
  assert.equal(r3.ok, true)
  assert.notEqual(r3.generationId, r1.generationId)
  assert.equal(rebuilt.calls, 0)
  assert.equal(r3.chunks.reused, 11)
  assert.equal(await generationDigest(db, r1.generationId!), g1)
  assert.equal(await legacyDigest(db), legacy)

  // A different embedding identity never reuses: same content, other model.
  const other: FakeEmbedder = { ...fakeEmbedder(), model: 'other-model' }
  let otherTexts = 0
  other.embed = async (texts) => { otherTexts += texts.length; return fakeEmbedder().embed(texts) }
  const r4 = await index(fixture(V1, 'v1-other-model'), { store, embedder: other })
  assert.equal(r4.ok, true)
  assert.equal(otherTexts, 11)
})

async function assertRetryRecovers(db: PGlite, store: ReturnType<typeof pgliteStore>, fx: { manifest: string; dist: string }, failed: Receipt, legacy: string) {
  assert.equal(failed.ok, false)
  assert.equal(failed.generationState, 'failed')
  const [g] = await generations(db)
  assert.equal(g.state, 'failed')
  await assertNotActivatable(db, g.id)
  const states = await docStates(db, g.id)
  const done = states.filter((s) => s.state === 'complete')
  assert.ok(states.filter((s) => s.state === 'pending').every((s) => s.n === 0), 'no partial chunks for an incomplete document')
  assert.equal(failed.documents.complete, done.length)
  assert.equal(failed.documents.failed, 1)
  assert.equal(failed.documents.pending, states.length - done.length - 1)

  // Retry: new generation, ready; everything not completed before is embedded again (nothing skipped).
  const retry = fakeEmbedder()
  const r = await index(fx, { store, embedder: retry })
  assert.equal(r.ok, true, r.error ?? '')
  assert.notEqual(r.generationId, g.id)
  const expectEmbedded = 11 - done.reduce((n, s) => n + s.n, 0)
  assert.equal(retry.texts, expectEmbedded)
  assert.ok((await docStates(db, r.generationId!)).every((s) => s.state === 'complete' && s.n >= CHUNKS_PER_DOC))
  assert.equal((await generations(db)).find((x) => x.id === g.id)!.state, 'failed')
  assert.equal(await legacyDigest(db), legacy)
}

test('embedding failure: generation failed, not servable, receipt accurate, retry embeds the rest', async () => {
  const { db, store, fx, legacy } = await start()
  const r = await index(fx, { store, embedder: fakeEmbedder((_, call) => { if (call === 3) throw new Error('Jina answered 503') }) })
  assert.match(r.error!, /503/)
  await assertRetryRecovers(db, store, fx, r, legacy)
})

test('wrong embedding dimension or count is rejected before any write for that document', async () => {
  for (const bad of [(t: string[]) => t.map(() => [0.1, 0.2, 0.3]), (t: string[]) => t.slice(1).map(() => new Array(1024).fill(0.01))]) {
    const { db, store, fx, legacy } = await start()
    const r = await index(fx, { store, embedder: fakeEmbedder((texts, call) => (call === 2 ? bad(texts) : undefined)) })
    assert.match(r.error!, /wrong count or dimensions/)
    await assertRetryRecovers(db, store, fx, r, legacy)
  }
})

test('chunk-write failure inside the database leaves no partial document and no ready generation', async () => {
  const { db, store, fx, legacy } = await start()
  await db.exec(`
    create function test_fail_gamma() returns trigger language plpgsql as $$
    begin
      if new.content like 'Gamma > Models%' then raise exception 'disk full'; end if;
      return new;
    end $$;
    create trigger test_fail_gamma after insert on docs_generation_chunks for each row execute function test_fail_gamma();`)
  const r = await index(fx, { store, embedder: fakeEmbedder() })
  assert.match(r.error!, /disk full/)
  const [g] = await generations(db)
  const gamma = (await docStates(db, g.id)).find((s) => s.doc_id === 'default:c')!
  assert.deepEqual(gamma, { doc_id: 'default:c', state: 'pending', n: 0 }, 'the intro chunk written before the failure was rolled back')
  await db.exec(`drop trigger test_fail_gamma on docs_generation_chunks`)
  await assertRetryRecovers(db, store, fx, r, legacy)
})

test('the database refuses incomplete or mismatched documents and an incomplete finish, whatever the client does', async () => {
  const { db, store, fx } = await start()
  const p = plan(fx.manifest, fx.dist)
  const [g] = await store.rpc('docs_generation_begin', {
    p_environment: 'preview', p_build_id: p.buildId, p_source_sha: p.sourceSha, p_manifest_sha256: p.manifestSha256,
    p_chunker_version: p.chunkerVersion, p_embedding_model: 'm', p_embedding_dimensions: 1024,
    p_documents: p.documents.map((d) => ({ doc_id: d.id, title: d.title, url_path: d.urlPath, canonical_url: d.canonicalUrl, source_path: d.sourcePath, served_path: d.servedPath, content_sha256: d.contentSha256, chunk_count: d.chunks.length, chunks_sha256: d.chunksSha256 })),
  })
  const doc = p.documents[0]
  const chunks = doc.chunks.map((c) => ({ chunk_index: c.index, content: c.content, anchor: c.anchor, embedding: new Array(1024).fill(0.01) }))
  const put = (cs: unknown[], token = g.run_token) => store.rpc('docs_generation_put_document', { p_generation_id: g.generation_id, p_run_token: token, p_doc_id: doc.id, p_chunks: cs })
  await assert.rejects(put(chunks.slice(1)), /has 2 chunks, planned 3/)
  await assert.rejects(put(chunks.map((c, i) => (i === 1 ? { ...c, content: 'tampered' } : c))), /do not match the plan/)
  await assert.rejects(put(chunks.map((c) => ({ ...c, embedding: [1, 2] }))), /expected 1024 dimensions/)
  await assert.rejects(put(chunks, '00000000-0000-0000-0000-000000000000'), /not owned by this run/)
  await assert.rejects(store.rpc('docs_generation_finish', { p_generation_id: g.generation_id, p_run_token: g.run_token }), /is incomplete/)
  assert.deepEqual((await docStates(db, g.generation_id)).filter((s) => s.n > 0), [])
  assert.equal(await put(chunks).then((rows) => rows[0].docs_generation_put_document), 3)
  await assert.rejects(put(chunks), /already complete/)
  await assert.rejects(store.rpc('docs_generation_finish', { p_generation_id: g.generation_id, p_run_token: g.run_token }), /is incomplete: default:b/)
  assert.equal((await generations(db))[0].state, 'building')
})

test('cancellation: an aborted run records failure; a killed run blocks nothing after its lease and can never write again', async () => {
  // Graceful: the signal aborts during the second document.
  {
    const { db, store, fx, legacy } = await start()
    const ac = new AbortController()
    const r = await index(fx, { store, embedder: fakeEmbedder((_, call) => { if (call === 2) ac.abort(new Error('cancelled by SIGTERM')) }), signal: ac.signal })
    assert.match(r.error!, /cancelled by SIGTERM/)
    await assertRetryRecovers(db, store, fx, r, legacy)
  }
  // Hard kill: the run stops mid-way and never cleans up (its embedder never answers).
  const { db, store, fx, legacy } = await start()
  let release!: () => void
  let reached!: () => void
  const hung = new Promise<void>((resolve) => { release = resolve })
  const atHang = new Promise<void>((resolve) => { reached = resolve })
  const zombie = index(fx, { store, embedder: fakeEmbedder(async (_, call) => { if (call === 2) { reached(); await hung } }) })
  await atHang
  const [g] = await generations(db)
  assert.equal(g.state, 'building')
  await assertNotActivatable(db, g.id)

  const blocked = await index(fx, { store, embedder: fakeEmbedder() })
  assert.equal(blocked.ok, false)
  assert.match(blocked.error!, /being built by another run/)
  assert.equal((await generations(db)).length, 1)

  await db.query(`update docs_generations set lease_expires_at = now() - interval '1 second' where id = $1`, [g.id])
  const retry = fakeEmbedder()
  const r = await index(fx, { store, embedder: retry })
  assert.equal(r.ok, true, r.error ?? '')
  const after = await generations(db)
  assert.deepEqual(after.map((x) => [x.id, x.state, x.failure]), [[g.id, 'failed', 'lease expired'], [r.generationId, 'ready', null]])
  const digest = await generationDigest(db, r.generationId!)

  release()
  const z = await zombie
  assert.equal(z.ok, false)
  assert.match(z.error!, /is failed, not building/)
  assert.equal(await generationDigest(db, r.generationId!), digest, 'the zombie could not touch the new generation')
  assert.equal(await legacyDigest(db), legacy)
})

test('concurrent runs on one buildId: the second is refused, the first completes; the database allows one live generation', async () => {
  const { db, store, fx } = await start()
  let release!: () => void
  let reached!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const atGate = new Promise<void>((resolve) => { reached = resolve })
  const first = index(fx, { store, embedder: fakeEmbedder(async (_, call) => { if (call === 1) { reached(); await gate } }) })
  await atGate
  const second = await index(fx, { store, embedder: fakeEmbedder() })
  assert.equal(second.ok, false)
  assert.match(second.error!, /being built by another run/)
  assert.equal(second.generationId, null)
  release()
  const r = await first
  assert.equal(r.ok, true, r.error ?? '')
  assert.deepEqual((await generations(db)).map((g) => g.state), ['ready'])

  // The guard is a unique index, not only the function's check: a second live row cannot exist.
  const insert = (state: string) => db.query(`insert into docs_generations (environment, build_id, source_sha, manifest_sha256, chunker_version, embedding_model, embedding_dimensions, state, lease_expires_at, expected_documents, expected_chunks)
    select environment, build_id, source_sha, manifest_sha256, chunker_version, embedding_model, embedding_dimensions, $1, now() + interval '1 hour', 1, 1 from docs_generations limit 1`, [state])
  await assert.rejects(insert('building'), /docs_generations_one_live_build/)
  await assert.rejects(insert('ready'), /docs_generations_one_live_build/)
  await insert('failed')
})

test('activation is operator-only, takes only ready generations of its own environment, and rolls back', async () => {
  const { db, store, fx } = await start()
  const r1 = await index(fx, { store, embedder: fakeEmbedder() })
  const r2 = await index(fixture(V1.slice(0, 3), 'v2'), { store, embedder: fakeEmbedder() })
  const other = await index(fixture(V1, 'v1'), { store, embedder: fakeEmbedder(), environment: 'staging' })
  assert.ok(r1.ok && r2.ok && other.ok)
  const activate = async (env: string, id: number) => one(db, `select * from docs_generation_activate($1, $2)`, [env, id])
  assert.deepEqual(await activate('preview', r1.generationId!), { environment: 'preview', active_generation_id: r1.generationId, previous_generation_id: null })
  assert.deepEqual(await activate('preview', r2.generationId!), { environment: 'preview', active_generation_id: r2.generationId, previous_generation_id: r1.generationId })
  // Rollback: activate the previous generation again.
  assert.deepEqual(await activate('preview', r1.generationId!), { environment: 'preview', active_generation_id: r1.generationId, previous_generation_id: r2.generationId })
  await assert.rejects(activate('preview', other.generationId!), /is not a ready generation of preview/)
  const failed = await index(fixture([{ ...V1[0], body: page('Alpha', ['New', 'Never embedded.']) }], 'v3'), { store, embedder: fakeEmbedder(() => { throw new Error('boom') }) })
  assert.equal(failed.generationState, 'failed')
  await assert.rejects(activate('preview', failed.generationId!), /is not a ready generation/)
  assert.equal((await db.query(`select * from docs_generation_slots`)).rows.length, 1, 'one slot per environment')
  // Nothing is ever deleted: all four generations are retained.
  assert.equal((await generations(db)).length, 4)
})
