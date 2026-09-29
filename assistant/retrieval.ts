// Server-side retrieval boundary for Ask Docs. The source is chosen ONLY from server environment
// configuration: createRetrieval never sees the request, so no body field, header, cookie or query
// parameter can influence which data is read.
import { createClient } from '@supabase/supabase-js'
import { generationSearchDocs } from './retrieval-generation.ts'

export interface RetrievalRow {
  title: string
  url_path: string
  content: string
  similarity: number
}

export interface RetrievalQuery {
  queryEmbedding: number[]
  matchCount: number
  similarityThreshold: number
}

export type Retrieval = (query: RetrievalQuery, signal?: AbortSignal) => Promise<RetrievalRow[]>

export interface RetrievalEnv {
  ASK_RETRIEVAL_SOURCE?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  /** #11, generation mode: the environment whose active ready generation is served. */
  ASK_GENERATION_ENVIRONMENT?: string
  /** #11, generation mode: that environment's reader secret (the database stores only its SHA-256). */
  ASK_GENERATION_READER_TOKEN?: string
}

export class RetrievalConfigError extends Error {}

// Error message is internal only; the caller logs its code, never the provider text.
export class RetrievalError extends Error {
  code?: string
}

// Throws RetrievalConfigError when the configuration is missing or unknown. There is no default and no
// fallback: an unconfigured or misconfigured deployment fails closed instead of reading another source.
export function createRetrieval(env: RetrievalEnv, fetchImpl?: typeof fetch): Retrieval {
  switch (env.ASK_RETRIEVAL_SOURCE) {
    case 'legacy':
      return legacySearchDocs(env, fetchImpl)
    // #11: the environment's active ready generation; throws RetrievalConfigError without its bindings
    // and never falls back to 'legacy'.
    case 'generation':
      return generationSearchDocs(env, fetchImpl)
    default:
      throw new RetrievalConfigError('ASK_RETRIEVAL_SOURCE is missing or unknown')
  }
}

// Legacy tables through the existing three-argument search_docs RPC, called exactly as the legacy
// handler (7b6ef85) does. SUPABASE_URL decides which project is read, so an isolated environment must
// point it at isolated data.
function legacySearchDocs(env: RetrievalEnv, fetchImpl?: typeof fetch): Retrieval {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new RetrievalConfigError('legacy retrieval needs SUPABASE_URL and SUPABASE_ANON_KEY')
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl ? { global: { fetch: fetchImpl } } : undefined)
  return async ({ queryEmbedding, matchCount, similarityThreshold }, signal) => {
    let rpc = supabase.rpc('search_docs', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      similarity_threshold: similarityThreshold,
    })
    if (signal) rpc = rpc.abortSignal(signal)
    const { data, error } = await rpc
    if (error) {
      const err = new RetrievalError('search_docs failed')
      err.code = error.code
      throw err
    }
    return ((data ?? []) as RetrievalRow[]).map(({ title, url_path, content, similarity }) => ({ title, url_path, content, similarity }))
  }
}
