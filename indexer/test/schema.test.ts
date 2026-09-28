// Migration against the local production replica: privileges per API role, legacy compatibility, rollback.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ROLLBACK, MIGRATION, ROLES, asRole, catalogDigest, fakeVector, legacyDigest, replica, vectorLiteral } from './db.ts'

const COLUMN: Record<string, string> = { docs_generations: 'state', docs_generation_documents: 'title', docs_generation_chunks: 'content', docs_generation_slots: 'environment' }
const NEW_TABLES = Object.keys(COLUMN)
const WRITER_CALLS = [
  `select public.docs_generation_begin('preview', '${'a'.repeat(40)}.${'b'.repeat(12)}', '${'a'.repeat(40)}', '${'c'.repeat(64)}', 'v', 'm', 1024, '[]'::jsonb)`,
  `select public.docs_generation_put_document(1, gen_random_uuid(), 'x', '[]'::jsonb)`,
  `select public.docs_generation_finish(1, gen_random_uuid())`,
  `select public.docs_generation_fail(1, gen_random_uuid(), 'x')`,
  `select public.docs_embedding_cache_lookup(array['x'], 'v', 'm', 1024)`,
]
const OPERATOR_CALLS = [
  `select public.docs_generation_activate('preview', 1)`,
  `select public.docs_generation_set_reader('preview', '${'d'.repeat(64)}')`,
  `select public.docs_generation_claim(1, gen_random_uuid())`,
]
const Q = vectorLiteral(fakeVector('legacy-1'))

async function denied(p: Promise<unknown>, what: string) {
  await assert.rejects(p, /permission denied/, what)
}

test('anon and authenticated can neither read nor write any new table, nor call any writer or operator function', async () => {
  const db = await replica()
  for (const role of ['anon', 'authenticated'] as const) {
    for (const t of NEW_TABLES) {
      await denied(asRole(db, role, `select * from public.${t}`), `${role} select ${t}`)
      await denied(asRole(db, role, `insert into public.${t} default values`), `${role} insert ${t}`)
      await denied(asRole(db, role, `update public.${t} set ${COLUMN[t]} = ${COLUMN[t]}`), `${role} update ${t}`)
      await denied(asRole(db, role, `delete from public.${t}`), `${role} delete ${t}`)
      await denied(asRole(db, role, `truncate public.${t}`), `${role} truncate ${t}`)
    }
    for (const call of [...WRITER_CALLS, ...OPERATOR_CALLS]) await denied(asRole(db, role, call), `${role} ${call}`)
  }
})

test('service_role reads the new tables, writes them only through the indexer functions, and cannot activate', async () => {
  const db = await replica()
  for (const t of NEW_TABLES) {
    assert.deepEqual(await asRole(db, 'service_role', `select * from public.${t}`), [])
    await denied(asRole(db, 'service_role', `insert into public.${t} default values`), `insert ${t}`)
    await denied(asRole(db, 'service_role', `update public.${t} set ${COLUMN[t]} = ${COLUMN[t]}`), `update ${t}`)
    await denied(asRole(db, 'service_role', `delete from public.${t}`), `delete ${t}`)
    await denied(asRole(db, 'service_role', `truncate public.${t}`), `truncate ${t}`)
  }
  for (const call of OPERATOR_CALLS) await denied(asRole(db, 'service_role', call), call)
  // Writer functions are executable (they fail on their own validation, not on privileges).
  await assert.rejects(asRole(db, 'service_role', WRITER_CALLS[0]), /the plan has no documents/)
  await assert.rejects(asRole(db, 'service_role', WRITER_CALLS[2]), /not owned by this run/)
  assert.deepEqual(await asRole(db, 'service_role', WRITER_CALLS[4]), [])
})

test('legacy tables and both search_docs overloads keep working for anon after the migration', async () => {
  const db = await replica()
  const before = await legacyDigest(db)
  for (const role of ROLES) {
    const three = await asRole(db, role, `select * from public.search_docs($1::extensions.vector, 5, 0.3)`, [Q])
    assert.equal(three[0].url_path, '/getting-started/quick-start', role)
    assert.ok(three.every((r: any) => r.similarity > 0.3))
    const named = await asRole(db, role, `select * from public.search_docs(query_embedding => $1::extensions.vector, match_count => 5, similarity_threshold => 0.3)`, [Q])
    assert.deepEqual(named, three)
    // Pre-existing in production: a two-argument call matches both overloads (the 3-argument one has a
    // default), so it is ambiguous; the handler uses the 3-argument form. Unchanged by this migration.
    await assert.rejects(asRole(db, role, `select * from public.search_docs($1::extensions.vector, 2)`, [Q]), /is not unique/)
    assert.equal((await asRole(db, role, `select count(*)::int as n from public.documents`))[0].n, 2)
  }
  // anon writes to legacy: INSERT is refused by RLS; UPDATE and DELETE match no row (no policy).
  for (const role of ['anon', 'authenticated'] as const) {
    await assert.rejects(asRole(db, role, `insert into public.documents (file_path, title, url_path) values ('x', 'x', '/x')`), /row-level security/)
    await asRole(db, role, `update public.documents set title = 'x'`)
    await asRole(db, role, `delete from public.document_chunks`)
  }
  assert.equal(await legacyDigest(db), before)
  // search_docs is still exactly the two legacy overloads, so PostgREST's named-argument call stays unambiguous.
  const overloads = await db.query<{ sig: string }>(`select oid::regprocedure::text as sig from pg_proc where proname = 'search_docs' order by 1`)
  assert.deepEqual(overloads.rows.map((r) => r.sig), [
    'search_docs(extensions.vector,integer)',
    'search_docs(extensions.vector,integer,double precision)',
  ])
})

test('pre-existing, unchanged by this migration: legacy grants still include TRUNCATE for anon (RLS does not cover it)', async () => {
  const before = await replica({ migrated: false })
  const after = await replica()
  for (const db of [before, after]) {
    const { rows } = await db.query<{ t: boolean }>(`select has_table_privilege('anon', 'public.documents', 'TRUNCATE') and has_table_privilege('anon', 'public.document_chunks', 'TRUNCATE') as t`)
    assert.equal(rows[0].t, true)
  }
})

test('rollback restores the replica catalog exactly and refuses while generations exist', async () => {
  const db = await replica({ migrated: false })
  const pristine = await catalogDigest(db)
  const legacy = await legacyDigest(db)
  await db.exec(MIGRATION)
  const migrated = await catalogDigest(db)
  assert.notEqual(migrated, pristine)
  await db.exec(ROLLBACK)
  assert.equal(await catalogDigest(db), pristine)
  assert.equal(await legacyDigest(db), legacy)

  // Re-apply, create a generation, and the rollback refuses (generations are never dropped implicitly).
  await db.exec(MIGRATION)
  await db.query(`insert into docs_generations (environment, build_id, source_sha, manifest_sha256, chunker_version, embedding_model, embedding_dimensions, lease_expires_at, expected_documents, expected_chunks)
    values ('preview', '${'a'.repeat(40)}.${'b'.repeat(12)}', '${'a'.repeat(40)}', '${'c'.repeat(64)}', 'v', 'm', 1024, now(), 1, 1)`)
  await assert.rejects(db.exec(ROLLBACK), /refusing to roll back/)
  assert.equal(await catalogDigest(db), migrated)
})
