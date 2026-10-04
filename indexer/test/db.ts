// Local replica of the production ask-docs schema in PGlite (real Postgres in WASM, with roles, grants,
// RLS and pgvector), plus the helpers the tests share. No network, no remote database.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import type { Embedder, Store } from '../indexer.ts'

const root = new URL('../../', import.meta.url)
export const MIGRATION = readFileSync(new URL('supabase/migrations/20260929000000_docs_generations.sql', root), 'utf8')
export const ROLLBACK = readFileSync(new URL('supabase/migrations/rollback/20260929000000_docs_generations.down.sql', root), 'utf8')
const REPLICA = readFileSync(new URL('indexer/test/replica.sql', root), 'utf8')

export type Role = 'anon' | 'authenticated' | 'service_role'
export const ROLES: Role[] = ['anon', 'authenticated', 'service_role']
export const DIMS = 1024

/** Deterministic unit vector for a text (or any seed). */
export function fakeVector(seed: string, dims = DIMS): number[] {
  const out: number[] = []
  let block = Buffer.alloc(0)
  for (let i = 0; out.length < dims; i++) {
    if (block.length === 0) block = createHash('sha256').update(`${seed}#${i}`).digest()
    out.push(block.readInt8(0) / 128)
    block = block.subarray(1)
  }
  const norm = Math.hypot(...out)
  return out.map((x) => Number((x / norm).toFixed(6)))
}

export const vectorLiteral = (v: number[]) => `[${v.join(',')}]`

/** The production schema (legacy tables, RLS, grants, both search_docs overloads) with two legacy docs. */
export async function replica({ migrated = true } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } })
  await db.exec(REPLICA)
  await db.exec(`
    insert into documents (file_path, title, url_path, content_hash) values
      ('docs/getting-started/quick-start.md', 'Quick Start', '/getting-started/quick-start', 'legacy-hash-1'),
      ('docs/authentication/api-keys.md', 'API Keys', '/authentication/api-keys', 'legacy-hash-2');
    insert into document_chunks (document_id, content, chunk_index, embedding) values
      (1, 'Quick Start\n\nlegacy text one', 0, '${vectorLiteral(fakeVector('legacy-1'))}'),
      (1, 'Quick Start\n\nlegacy text two', 1, '${vectorLiteral(fakeVector('legacy-2'))}'),
      (2, 'API Keys\n\nlegacy keys text', 0, '${vectorLiteral(fakeVector('legacy-3'))}');
  `)
  if (migrated) await db.exec(MIGRATION)
  return db
}

/** One statement as an API role, in its own transaction, like a PostgREST request. */
export async function asRole<T = any>(db: PGlite, role: Role, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx: Transaction) => {
    await tx.exec(`set local role ${role}`)
    return (await tx.query<T>(sql, params)).rows
  })
}

function rpcSql(name: string, args: Record<string, unknown>): [string, unknown[]] {
  const keys = Object.keys(args)
  return [`select * from public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, keys.map((k) => args[k])]
}

/** The indexer's Store over PGlite, as service_role, one transaction per call (PostgREST semantics). */
export function pgliteStore(db: PGlite, role: Role = 'service_role'): Store & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async rpc(name, args, signal) {
      signal?.throwIfAborted()
      calls.push(name)
      const [sql, params] = rpcSql(name, args)
      const rows = await asRole(db, role, sql, params)
      return rows.map((r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])))
    },
  }
}

/** A fetch that answers PostgREST rpc calls from PGlite as anon (the key's role), for the assistant adapter. */
export function postgrestFetch(db: PGlite, url: string, role: Role = 'anon'): typeof fetch & { calls: Array<{ name: string; body: any }> } {
  const calls: Array<{ name: string; body: any }> = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init)
    const prefix = `${url}/rest/v1/rpc/`
    if (!req.url.startsWith(prefix) || req.method !== 'POST') throw new TypeError(`unexpected fetch ${req.method} ${req.url}`)
    const name = req.url.slice(prefix.length)
    const body = await req.json()
    calls.push({ name, body })
    const args = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, k === 'query_embedding' ? vectorLiteral(v as number[]) : v]))
    try {
      const [sql, params] = rpcSql(name, args)
      const rows = await asRole(db, role, sql, params)
      return Response.json(rows.map((r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))))
    } catch (e: any) {
      return Response.json({ code: e.code ?? 'XX000', message: e.message, details: null, hint: null }, { status: 400 })
    }
  }) as typeof fetch & { calls: typeof calls }
  f.calls = calls
  return f
}

export interface FakeEmbedder extends Embedder {
  calls: number
  texts: number
}

/** Deterministic embedder; `fault(texts, callNo)` may throw or return a replacement response. */
export function fakeEmbedder(fault?: (texts: string[], call: number) => number[][] | Promise<number[][]> | void): FakeEmbedder {
  const e: FakeEmbedder = {
    model: 'fake-embedder/retrieval.passage',
    dimensions: DIMS,
    calls: 0,
    texts: 0,
    async embed(texts, signal) {
      signal?.throwIfAborted()
      e.calls++
      e.texts += texts.length
      const replaced = await fault?.(texts, e.calls)
      if (replaced) return replaced
      return texts.map((t) => fakeVector(t))
    },
  }
  return e
}

/** Digest of rows of a query (row order included), to prove data did not change. */
export async function rowsDigest(db: PGlite, sql: string): Promise<string> {
  const { rows } = await db.query(sql)
  return createHash('sha256').update(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v))).digest('hex')
}

export const LEGACY_DIGEST_SQL = [
  `select id, file_path, title, url_path, updated_at, content_hash from documents order by id`,
  `select id, document_id, content, chunk_index, embedding::text, created_at from document_chunks order by id`,
]

export async function legacyDigest(db: PGlite): Promise<string> {
  return (await Promise.all(LEGACY_DIGEST_SQL.map((s) => rowsDigest(db, s)))).join(':')
}

export async function generationDigest(db: PGlite, id: number): Promise<string> {
  return [
    await rowsDigest(db, `select id, environment, build_id, source_sha, manifest_sha256, chunker_version, embedding_model, state, expected_documents, expected_chunks, failure, created_at, finished_at from docs_generations where id = ${id}`),
    await rowsDigest(db, `select * from docs_generation_documents where generation_id = ${id} order by doc_id`),
    await rowsDigest(db, `select generation_id, doc_id, chunk_index, content, content_sha256, anchor, embedding::text from docs_generation_chunks where generation_id = ${id} order by doc_id, chunk_index`),
  ].join(':')
}

/** Everything a migration can change in the catalog: relations, columns, constraints, indexes, policies,
 *  triggers, functions, sequences, ACLs (relacl, proacl, nspacl) and default ACLs. */
export async function catalogDigest(db: PGlite): Promise<string> {
  const queries = [
    `select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','extensions') order by 1, 2`,
    `select c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attidentity, pg_get_expr(d.adbin, d.adrelid) from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped order by 1, 2`,
    `select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`,
    `select indexrelid::regclass::text, pg_get_indexdef(indexrelid) from pg_index i join pg_class c on c.oid = i.indrelid where c.relnamespace = 'public'::regnamespace order by 1`,
    `select polrelid::regclass::text, polname, polcmd, polroles::text, pg_get_expr(polqual, polrelid) from pg_policy order by 1, 2`,
    `select tgrelid::regclass::text, tgname from pg_trigger where not tgisinternal order by 1, 2`,
    `select p.oid::regprocedure::text, p.prosecdef, p.proconfig::text, p.proacl::text, md5(p.prosrc) from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1`,
    `select nspname, nspacl::text from pg_namespace where nspname in ('public','extensions') order by 1`,
    `select defaclrole::regrole::text, defaclnamespace::regnamespace::text, defaclobjtype, defaclacl::text from pg_default_acl order by 1, 2, 3`,
    `select extname, extversion, extnamespace::regnamespace::text from pg_extension order by 1`,
  ]
  const parts: string[] = []
  for (const q of queries) parts.push(await rowsDigest(db, q))
  return createHash('sha256').update(parts.join('\n')).digest('hex')
}
