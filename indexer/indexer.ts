// Manifest-driven, generation-isolated indexer (#11). Inputs are only the #7 publication manifest and the
// clean Markdown artifacts in the built site; identity, title and canonical URL come from the manifest.
//   plan()  reads and validates everything, without credentials and without writing (the dry run);
//   run()   writes one new generation through the migration's functions and marks it ready only after
//           the database re-validated it. It never activates anything and never touches legacy tables.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CHUNKER_VERSION, type Chunk, chunkMarkdown, chunksSha256, sha256 } from './chunker.ts'

export interface Embedder {
  /** Embedding identity (model and task); part of the cache key together with the dimensions. */
  model: string
  dimensions: number
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>
}

/** One database function call, as PostgREST `POST /rest/v1/rpc/<name>` does it: one transaction per call. */
export interface Store {
  rpc(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<any[]>
}

export interface PlannedDocument {
  id: string
  title: string
  urlPath: string
  canonicalUrl: string
  sourcePath: string
  servedPath: string
  contentSha256: string
  chunks: Chunk[]
  chunksSha256: string
}

export interface Plan {
  buildId: string
  sourceSha: string
  manifestSha256: string
  chunkerVersion: string
  documents: PlannedDocument[]
  /** Manifest ids that are not rag-eligible and therefore not in the generation. */
  excluded: string[]
}

export class PlanError extends Error {
  problems: string[]
  constructor(problems: string[]) {
    super(`manifest plan invalid:\n${problems.join('\n')}`)
    this.problems = problems
  }
}

const SITE = 'https://docs.apertis.ai'
const RESERVED = '/api/ask'

/** Heading ids of the built page for a served path (the page the citation lands on), and its H1 id. */
function pageHeadings(distDir: string, servedPath: string): { ids: Set<string>; h1: string } | null {
  let html: string
  try {
    html = readFileSync(path.join(distDir, servedPath, 'index.html'), 'utf8')
  } catch {
    return null
  }
  const found = [...html.matchAll(/<h([1-6])\b[^>]*\sid="([^"]+)"/g)]
  return { ids: new Set(found.map((m) => m[2])), h1: found.find((m) => m[1] === '1')?.[2] ?? '' }
}

export function plan(manifestFile: string, distDir: string): Plan {
  const bytes = readFileSync(manifestFile)
  const m = JSON.parse(bytes.toString('utf8'))
  const problems: string[] = []
  const fail = (s: string) => problems.push(s)

  if (m.manifestVersion !== 1) fail(`manifestVersion ${m.manifestVersion} is not 1`)
  if (m.site !== SITE) fail(`site ${m.site} is not ${SITE}`)
  if (!/^[0-9a-f]{40}$/.test(m.sourceSha ?? '')) fail('sourceSha is not a 40-hex commit')
  if (!/^[0-9a-f]{40}\.[0-9a-f]{12}$/.test(m.buildId ?? '') || !m.buildId.startsWith(`${m.sourceSha}.`)) {
    fail(`buildId ${m.buildId} is not <sourceSha>.<12 hex>`)
  }
  if (!Array.isArray(m.documents)) throw new PlanError([...problems, 'documents is not an array'])

  const ids = new Set<string>()
  const urls = new Set<string>()
  const documents: PlannedDocument[] = []
  const excluded: string[] = []
  const dist = path.resolve(distDir)

  for (const d of m.documents) {
    const where = `document ${d?.id}`
    if (typeof d?.id !== 'string' || !d.id) { fail('document without id'); continue }
    if (ids.has(d.id)) fail(`${where}: duplicate id`)
    ids.add(d.id)
    let url: URL
    try {
      url = new URL(d.canonicalUrl)
    } catch {
      fail(`${where}: canonicalUrl ${d.canonicalUrl} is not a URL`)
      continue
    }
    if (urls.has(url.href)) fail(`${where}: duplicate canonicalUrl ${url.href}`)
    urls.add(url.href)
    if (d.eligibility?.rag !== true) {
      excluded.push(d.id)
      continue
    }

    if (url.origin !== SITE || url.search || url.hash) fail(`${where}: canonicalUrl ${url.href} is not a ${SITE} page`)
    if (url.pathname.replace(/\/$/, '') === RESERVED) fail(`${where}: canonicalUrl is the reserved ${RESERVED}`)
    if (typeof d.title !== 'string' || !d.title.trim()) fail(`${where}: missing title`)
    if (typeof d.servedPath !== 'string' || !d.servedPath.startsWith('/') || !d.servedPath.endsWith('/')) {
      fail(`${where}: servedPath ${d.servedPath} is not a slash-terminated path`)
      continue
    }
    const md = d.markdown
    if (!md || typeof md.path !== 'string' || !/^[0-9a-f]{64}$/.test(md.sha256 ?? '')) {
      fail(`${where}: rag-eligible without a Markdown artifact`)
      continue
    }
    if (d.contentSha256 !== md.sha256) fail(`${where}: contentSha256 differs from markdown.sha256`)
    const file = path.resolve(dist, `.${md.path}`)
    if (!md.path.startsWith('/') || !md.path.endsWith('.md') || !file.startsWith(dist + path.sep)) {
      fail(`${where}: markdown.path ${md.path} is outside the build output`)
      continue
    }
    let artifact: Buffer
    try {
      artifact = readFileSync(file)
    } catch {
      fail(`${where}: artifact ${md.path} is missing from ${distDir}`)
      continue
    }
    if (sha256(artifact) !== md.sha256) {
      fail(`${where}: artifact ${md.path} hash differs from the manifest`)
      continue
    }
    const page = pageHeadings(dist, d.servedPath)
    if (!page) {
      fail(`${where}: built page for ${d.servedPath} is missing`)
      continue
    }
    const chunks = chunkMarkdown(artifact.toString('utf8'), d.title, page.h1)
    if (chunks.length === 0) {
      fail(`${where}: artifact ${md.path} has no content`)
      continue
    }
    for (const c of chunks) {
      if (!page.ids.has(c.anchor)) fail(`${where}: chunk ${c.index} anchor "${c.anchor}" is not a heading id of ${d.servedPath}`)
    }
    documents.push({
      id: d.id,
      title: d.title,
      urlPath: url.pathname,
      canonicalUrl: url.href,
      sourcePath: d.sourcePath,
      servedPath: d.servedPath,
      contentSha256: md.sha256,
      chunks,
      chunksSha256: chunksSha256(chunks),
    })
  }
  if (documents.length === 0) fail('no rag-eligible documents')
  if (problems.length) throw new PlanError(problems)
  return { buildId: m.buildId, sourceSha: m.sourceSha, manifestSha256: sha256(bytes), chunkerVersion: CHUNKER_VERSION, documents, excluded }
}

export type DocumentState = 'planned' | 'pending' | 'complete' | 'failed'

export interface Receipt {
  ok: boolean
  mode: 'dry-run' | 'index'
  environment: string
  buildId: string
  sourceSha: string
  manifestSha256: string
  chunkerVersion: string
  embedding: { model: string; dimensions: number } | null
  generationId: number | null
  generationState: 'building' | 'ready' | 'failed' | null
  /** True when this buildId was already ready in this environment with identical inputs: nothing written. */
  alreadyReady: boolean
  documents: Record<DocumentState, number> & { excluded: number }
  chunks: { planned: number; written: number; embedded: number; reused: number }
  items: Array<{ id: string; urlPath: string; contentSha256: string; chunks: number; chunksSha256: string; state: DocumentState }>
  excluded: string[]
  error: string | null
}

export function receiptFor(p: Plan, environment: string, mode: Receipt['mode']): Receipt {
  const state: DocumentState = mode === 'dry-run' ? 'planned' : 'pending'
  return {
    ok: mode === 'dry-run',
    mode,
    environment,
    buildId: p.buildId,
    sourceSha: p.sourceSha,
    manifestSha256: p.manifestSha256,
    chunkerVersion: p.chunkerVersion,
    embedding: null,
    generationId: null,
    generationState: null,
    alreadyReady: false,
    documents: { planned: 0, pending: 0, complete: 0, failed: 0, [state]: p.documents.length, excluded: p.excluded.length },
    chunks: { planned: p.documents.reduce((n, d) => n + d.chunks.length, 0), written: 0, embedded: 0, reused: 0 },
    items: p.documents.map((d) => ({ id: d.id, urlPath: d.urlPath, contentSha256: d.contentSha256, chunks: d.chunks.length, chunksSha256: d.chunksSha256, state })),
    excluded: p.excluded,
    error: null,
  }
}

export interface RunOptions {
  environment: string
  store: Store
  embedder: Embedder
  signal?: AbortSignal
  /** Texts per embedding request. */
  batchSize?: number
  /** Lease renewed by every document write; a run that stalls longer loses its generation. */
  leaseSeconds?: number
}

export const ENVIRONMENT = /^[a-z][a-z0-9-]{0,31}$/
const MAX_BATCH = 64

function vectorsValid(vectors: unknown, count: number, dimensions: number): vectors is number[][] {
  return Array.isArray(vectors) && vectors.length === count &&
    vectors.every((v) => Array.isArray(v) && v.length === dimensions && v.every((x) => typeof x === 'number' && Number.isFinite(x)))
}

export async function run(p: Plan, o: RunOptions): Promise<Receipt> {
  const { store, embedder, signal } = o
  const batchSize = o.batchSize ?? 32
  const leaseSeconds = o.leaseSeconds ?? 900
  if (!ENVIRONMENT.test(o.environment)) throw new Error(`environment ${o.environment} is not ${ENVIRONMENT}`)
  if (!(batchSize >= 1 && batchSize <= MAX_BATCH)) throw new Error(`batchSize must be 1..${MAX_BATCH}`)
  const r = receiptFor(p, o.environment, 'index')
  r.embedding = { model: embedder.model, dimensions: embedder.dimensions }
  const setState = (i: number, s: DocumentState) => {
    r.documents[r.items[i].state]--
    r.documents[s]++
    r.items[i].state = s
  }

  let generationId: number | null = null
  let runToken: string | null = null
  let current = -1
  try {
    const [g] = await store.rpc('docs_generation_begin', {
      p_environment: o.environment,
      p_build_id: p.buildId,
      p_source_sha: p.sourceSha,
      p_manifest_sha256: p.manifestSha256,
      p_chunker_version: p.chunkerVersion,
      p_embedding_model: embedder.model,
      p_embedding_dimensions: embedder.dimensions,
      p_documents: p.documents.map((d) => ({
        doc_id: d.id, title: d.title, url_path: d.urlPath, canonical_url: d.canonicalUrl, source_path: d.sourcePath,
        served_path: d.servedPath, content_sha256: d.contentSha256, chunk_count: d.chunks.length, chunks_sha256: d.chunksSha256,
      })),
      p_lease_seconds: leaseSeconds,
    }, signal)
    generationId = Number(g.generation_id)
    r.generationId = generationId
    r.generationState = g.state
    if (g.state === 'ready') {
      r.alreadyReady = true
      for (let i = 0; i < r.items.length; i++) setState(i, 'complete')
      r.ok = true
      return r
    }
    runToken = g.run_token

    const hashes = [...new Set(p.documents.flatMap((d) => d.chunks.map((c) => c.contentSha256)))]
    const cache = new Map<string, number[]>()
    for (const row of await store.rpc('docs_embedding_cache_lookup', {
      p_content_sha256: hashes, p_chunker_version: p.chunkerVersion, p_embedding_model: embedder.model, p_embedding_dimensions: embedder.dimensions,
    }, signal)) {
      const v = JSON.parse(row.embedding)
      if (vectorsValid([v], 1, embedder.dimensions)) cache.set(row.content_sha256, v)
    }

    for (const [i, d] of p.documents.entries()) {
      current = i
      signal?.throwIfAborted()
      const missing = [...new Set(d.chunks.map((c) => c.contentSha256).filter((h) => !cache.has(h)))]
      const texts = new Map(d.chunks.map((c) => [c.contentSha256, c.content]))
      for (let at = 0; at < missing.length; at += batchSize) {
        const batch = missing.slice(at, at + batchSize)
        const vectors = await embedder.embed(batch.map((h) => texts.get(h)!), signal)
        if (!vectorsValid(vectors, batch.length, embedder.dimensions)) {
          throw new Error(`embedding response for ${d.id} has the wrong count or dimensions`)
        }
        batch.forEach((h, k) => cache.set(h, vectors[k]))
        r.chunks.embedded += batch.length
      }
      r.chunks.reused += d.chunks.length - missing.length
      signal?.throwIfAborted()
      await store.rpc('docs_generation_put_document', {
        p_generation_id: generationId,
        p_run_token: runToken,
        p_doc_id: d.id,
        p_chunks: d.chunks.map((c) => ({ chunk_index: c.index, content: c.content, anchor: c.anchor, embedding: cache.get(c.contentSha256) })),
        p_lease_seconds: leaseSeconds,
      }, signal)
      r.chunks.written += d.chunks.length
      setState(i, 'complete')
    }
    current = -1
    signal?.throwIfAborted()
    await store.rpc('docs_generation_finish', { p_generation_id: generationId, p_run_token: runToken }, signal)
    r.generationState = 'ready'
    r.ok = true
  } catch (e) {
    r.ok = false
    r.error = e instanceof Error ? e.message : String(e)
    if (current >= 0) setState(current, 'failed')
    if (generationId !== null && runToken !== null) {
      try {
        // Not tied to the run's signal: a cancelled run still records its failure when it can.
        // false: this run already lost the generation (lease expired and taken over), which is failed too.
        await store.rpc('docs_generation_fail', { p_generation_id: generationId, p_run_token: runToken, p_reason: r.error })
        r.generationState = 'failed'
      } catch {
        // The lease expires instead; the generation can never become ready without finish().
      }
    }
  }
  return r
}
