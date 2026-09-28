// #11 generation-aware retrieval (ASK_RETRIEVAL_SOURCE=generation). Reads the active ready generation of
// ONE environment through search_docs_generation (supabase/migrations/20260929000000_docs_generations.sql).
// The environment and its reader secret come only from server bindings; the database resolves the active
// generation itself, so neither the browser nor this code can pick a generation id. Missing, not-ready or
// foreign-environment state fails closed (RetrievalError); there is no fallback to legacy or elsewhere.
import { createClient } from '@supabase/supabase-js'
import { RetrievalConfigError, RetrievalError, type Retrieval, type RetrievalEnv, type RetrievalRow } from './retrieval.ts'

const ENVIRONMENT = /^[a-z][a-z0-9-]{0,31}$/
const MIN_READER_TOKEN = 32

interface GenerationRow extends RetrievalRow {
  generation_id: number
  environment: string
}

export function generationSearchDocs(env: RetrievalEnv, fetchImpl?: typeof fetch): Retrieval {
  const environment = env.ASK_GENERATION_ENVIRONMENT
  const readerToken = env.ASK_GENERATION_READER_TOKEN
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !environment || !readerToken) {
    throw new RetrievalConfigError('generation retrieval needs SUPABASE_URL, SUPABASE_ANON_KEY, ASK_GENERATION_ENVIRONMENT and ASK_GENERATION_READER_TOKEN')
  }
  if (!ENVIRONMENT.test(environment)) throw new RetrievalConfigError('ASK_GENERATION_ENVIRONMENT is invalid')
  if (readerToken.length < MIN_READER_TOKEN) throw new RetrievalConfigError('ASK_GENERATION_READER_TOKEN is too short')

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl ? { global: { fetch: fetchImpl } } : undefined)
  return async ({ queryEmbedding, matchCount, similarityThreshold }, signal) => {
    let rpc = supabase.rpc('search_docs_generation', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      similarity_threshold: similarityThreshold,
      target_environment: environment,
      reader_token: readerToken,
    })
    if (signal) rpc = rpc.abortSignal(signal)
    const { data, error } = await rpc
    if (error) {
      const err = new RetrievalError('search_docs_generation failed')
      err.code = error.code
      throw err
    }
    const rows = (data ?? []) as GenerationRow[]
    if (rows.some((r) => r.environment !== environment) || new Set(rows.map((r) => r.generation_id)).size > 1) {
      const err = new RetrievalError('search_docs_generation returned rows of another environment or generation')
      err.code = 'FOREIGN_GENERATION'
      throw err
    }
    return rows.map(({ title, url_path, content, similarity }) => ({ title, url_path, content, similarity }))
  }
}
