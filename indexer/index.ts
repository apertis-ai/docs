// CLI: node indexer/index.ts --environment <env> [--dry-run] [--manifest <file>] [--dist <dir>] [--receipt <file>]
// Exit 0 only when the plan is valid (dry run) or the generation is ready; 1 on any failed or incomplete
// document or validation; 2 on usage or missing configuration. The receipt (JSON) never contains secrets.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ENVIRONMENT, type Embedder, PlanError, type Receipt, type Store, plan, receiptFor, run } from './indexer.ts'

export const JINA_URL = 'https://api.jina.ai/v1/embeddings'

/** Jina embeddings with the legacy request shape; bounded timeout and retries, response validated. */
export function jinaEmbedder(apiKey: string, o: { fetch?: typeof fetch; timeoutMs?: number; attempts?: number; retryDelayMs?: number } = {}): Embedder {
  const doFetch = o.fetch ?? fetch
  const timeoutMs = o.timeoutMs ?? 30_000
  const attempts = o.attempts ?? 3
  const retryDelayMs = o.retryDelayMs ?? 1_000
  const dimensions = 1024
  return {
    model: 'jina-embeddings-v4/retrieval.passage',
    dimensions,
    async embed(texts, signal) {
      let last: unknown
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** (attempt - 2)))
        signal?.throwIfAborted()
        let res: Response
        try {
          res = await doFetch(JINA_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'jina-embeddings-v4', input: texts, task: 'retrieval.passage', dimensions }),
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
          })
        } catch (e) {
          signal?.throwIfAborted()
          last = new Error(`Jina request failed: ${(e as Error).name}`)
          continue
        }
        if (res.status === 429 || res.status >= 500) {
          await res.body?.cancel()
          last = new Error(`Jina answered ${res.status}`)
          continue
        }
        if (!res.ok) {
          await res.body?.cancel()
          throw new Error(`Jina answered ${res.status}`)
        }
        const data = (await res.json()) as { data?: Array<{ embedding?: unknown }> }
        const vectors = data.data?.map((d) => d.embedding)
        if (!Array.isArray(vectors) || vectors.length !== texts.length ||
            !vectors.every((v) => Array.isArray(v) && v.length === dimensions && v.every((x) => typeof x === 'number' && Number.isFinite(x)))) {
          throw new Error('Jina response has the wrong count or dimensions')
        }
        return vectors as number[][]
      }
      throw last
    },
  }
}

/** Database functions through PostgREST (`POST /rest/v1/rpc/<name>`), one transaction per call, no retries. */
export function postgrestStore(url: string, serviceKey: string, o: { fetch?: typeof fetch; timeoutMs?: number } = {}): Store {
  const doFetch = o.fetch ?? fetch
  const timeoutMs = o.timeoutMs ?? 60_000
  return {
    async rpc(name, args, signal) {
      const res = await doFetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(args),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(`${name} failed (${res.status} ${body?.code ?? ''}): ${body?.message ?? 'no message'}`)
      return Array.isArray(body) ? body : [{ [name]: body }]
    },
  }
}

export async function main(argv: string[], env: Record<string, string | undefined>, out: (s: string) => void, signal?: AbortSignal): Promise<number> {
  let values
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        environment: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        manifest: { type: 'string', default: 'site-nimbus/src/manifest/manifest.json' },
        dist: { type: 'string', default: 'site-nimbus/dist' },
        receipt: { type: 'string' },
      },
    }))
  } catch (e) {
    out(`usage: ${(e as Error).message}`)
    return 2
  }
  const environment = values.environment ?? ''
  if (!ENVIRONMENT.test(environment)) {
    out(`usage: --environment must match ${ENVIRONMENT}`)
    return 2
  }
  const emit = (r: Receipt | { ok: false; error: string; problems?: string[] }) => {
    const json = JSON.stringify(r, null, 2)
    if (values.receipt) writeFileSync(values.receipt, `${json}\n`)
    out(json)
  }

  let p
  try {
    p = plan(values.manifest, values.dist)
  } catch (e) {
    emit({ ok: false, error: e instanceof PlanError ? 'manifest plan invalid' : (e as Error).message, problems: e instanceof PlanError ? e.problems : undefined })
    return 1
  }
  if (values['dry-run']) {
    emit(receiptFor(p, environment, 'dry-run'))
    return 0
  }

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JINA_API_KEY'].filter((k) => !env[k])
  if (missing.length) {
    out(`configuration: missing ${missing.join(', ')}`)
    return 2
  }
  const r = await run(p, {
    environment,
    store: postgrestStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!),
    embedder: jinaEmbedder(env.JINA_API_KEY!),
    signal,
  })
  emit(r)
  return r.ok ? 0 : 1
}

if (import.meta.main) {
  const ac = new AbortController()
  for (const s of ['SIGINT', 'SIGTERM'] as const) process.once(s, () => ac.abort(new Error(`cancelled by ${s}`)))
  process.exitCode = await main(process.argv.slice(2), process.env, (s) => console.log(s), ac.signal)
}
