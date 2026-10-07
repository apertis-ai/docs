// Shared test doubles and legacy loaders for the Ask Docs service.
// Everything here is network-free: the fake fetch throws on any URL it does not own.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LEGACY_REF = 'bb057a7'
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

// Lower-case so it also fits in hostnames. Every fake secret and every upstream error body carries it,
// so "no provider text / secret reached the browser or logs" is a substring check.
export const SENTINEL = 'sntl7f3a'

export const ENV = {
  SUPABASE_URL: `https://${SENTINEL}-supabase.test`,
  SUPABASE_ANON_KEY: `anon-${SENTINEL}`,
  JINA_API_KEY: `jina-${SENTINEL}`,
  APERTIS_API_KEY: `apertis-${SENTINEL}`,
  APERTIS_BASE_URL: `https://${SENTINEL}-apertis.test/v1`,
  APERTIS_MODEL: `model-${SENTINEL}`,
  TURNSTILE_SECRET_KEY: `turnstile-${SENTINEL}`,
  ASK_RETRIEVAL_SOURCE: 'legacy',
}

export const ROWS = [
  { id: 1, file_path: 'docs/q.md', title: 'Quick Start', url_path: '/getting-started/quick-start', content: 'Create a key.', similarity: 0.81 },
  { id: 2, file_path: 'docs/k.md', title: 'API Keys', url_path: '/authentication/api-keys', content: 'Keys live in the console.', similarity: 0.52 },
]

export function sse(...events: string[]): string {
  return events.map((e) => `data: ${e}\n\n`).join('')
}
export function delta(content: string): string {
  return JSON.stringify({ choices: [{ delta: { content } }] })
}

// A normal upstream answer: role frame, content with a citation and multi-byte text, a comment, [DONE].
export const UPSTREAM_OK =
  sse(JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }), delta('See '), delta('[Quick Start](/getting-started/quick-start)'), delta(' — 你好 🚀.'), delta('')) +
  ': keep-alive\n\n' +
  sse('[DONE]')

type Reply = { status: number; text: string } | 'throw' | 'hang'

export interface Script {
  turnstile?: { success: boolean; codes?: string[] } | Reply
  jina?: { embedding: number[] } | Reply
  supabase?: { rows: unknown[] } | Reply
  apertis?: Reply | { chunks: Array<string | Uint8Array>; end?: 'close' | 'error' | 'hang' }
}

export interface Call {
  provider: 'turnstile' | 'jina' | 'supabase' | 'apertis'
  url: string
  method: string
  headers: Record<string, string>
  body: any
  signal?: AbortSignal
}

const enc = new TextEncoder()

function hangUntilAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

function reply(r: Reply, signal?: AbortSignal): Promise<Response> | Response {
  if (r === 'throw') throw new TypeError(`network down ${SENTINEL}`)
  if (r === 'hang') return hangUntilAbort(signal)
  return new Response(r.text, { status: r.status })
}

export function providers(script: Script = {}) {
  const calls: Call[] = []
  const apertisStream = { cancelled: false, aborted: false }

  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const req = new Request(input, init)
    const signal = init.signal ?? undefined
    const text = await req.text()
    const url = req.url
    const provider: Call['provider'] | undefined =
      url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify' ? 'turnstile'
        : url === 'https://api.jina.ai/v1/embeddings' ? 'jina'
          : url.startsWith(`${ENV.SUPABASE_URL}/`) ? 'supabase'
            : url === `${ENV.APERTIS_BASE_URL}/chat/completions` ? 'apertis'
              : undefined
    if (!provider) throw new Error(`unexpected network call: ${req.method} ${url}`)
    calls.push({ provider, url, method: req.method, headers: Object.fromEntries(req.headers), body: text ? JSON.parse(text) : undefined, signal })

    const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } })
    if (provider === 'turnstile') {
      const t = script.turnstile ?? { success: true }
      return typeof t === 'object' && 'success' in t ? json({ success: t.success, 'error-codes': t.codes ?? [] }) : reply(t as Reply, signal)
    }
    if (provider === 'jina') {
      const j = script.jina ?? { embedding: [0.1, 0.2, 0.3] }
      return typeof j === 'object' && 'embedding' in j ? json({ data: [{ embedding: j.embedding }] }) : reply(j as Reply, signal)
    }
    if (provider === 'supabase') {
      const s = script.supabase ?? { rows: ROWS }
      if (typeof s === 'object' && 'rows' in s) return json(s.rows)
      if (s === 'throw' || s === 'hang') return reply(s, signal)
      return new Response(s.text, { status: s.status, headers: { 'Content-Type': 'application/json' } })
    }
    const a = script.apertis ?? { chunks: [UPSTREAM_OK] }
    if (!(typeof a === 'object' && 'chunks' in a)) return reply(a as Reply, signal)
    let i = 0
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        signal?.addEventListener('abort', () => {
          apertisStream.aborted = true
          try { c.error(signal.reason) } catch { /* already closed */ }
        }, { once: true })
      },
      async pull(c) {
        if (i < a.chunks.length) {
          const chunk = a.chunks[i++]
          c.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk)
          return
        }
        if (a.end === 'error') return c.error(new Error(`upstream reset ${SENTINEL}`))
        if (a.end === 'hang') return hangUntilAbort(signal).catch(() => {})
        c.close()
      },
      cancel() {
        apertisStream.cancelled = true
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  return { fetch: fetch as typeof globalThis.fetch, calls, apertisStream, called: (p: Call['provider']) => calls.filter((c) => c.provider === p) }
}

export function askRequest(body: unknown, init: RequestInit & { url?: string } = {}): Request {
  return new Request(init.url ?? 'https://docs.test/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: init.signal,
  })
}

export const VALID = { question: 'How do I create an API key?', sessionId: 'sess-1', turnstileToken: 'tok' }

// Reads a whole response body, failing (instead of hanging the suite) past the deadline.
export async function readAll(res: Response, deadlineMs = 2000): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let out = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`stream did not close within ${deadlineMs}ms`)), deadlineMs)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) return out + dec.decode()
      out += dec.decode(value, { stream: true })
    }
  } finally {
    clearTimeout(timer)
  }
}

export function frames(text: string): string[] {
  assert.ok(text === '' || text.endsWith('\n\n'), 'every frame ends with a blank line')
  return text.split('\n\n').slice(0, -1).map((f) => `${f}\n\n`)
}

export async function withGlobalFetch<T>(f: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const prev = globalThis.fetch
  globalThis.fetch = f
  try {
    return await fn()
  } finally {
    globalThis.fetch = prev
  }
}

// Collects unhandled rejections so tests can assert there were none.
export function trackRejections() {
  const seen: unknown[] = []
  const onRejection = (e: unknown) => seen.push(e)
  process.on('unhandledRejection', onRejection)
  return {
    async assertNone() {
      await new Promise((r) => setTimeout(r, 20))
      assert.deepEqual(seen.map(String), [], 'no unhandled rejections')
    },
    stop: () => process.off('unhandledRejection', onRejection),
  }
}

// Captures console.error/console.log output so tests can assert nothing sensitive is logged.
export function captureLogs() {
  const lines: string[] = []
  const prev = { error: console.error, log: console.log, warn: console.warn }
  for (const k of ['error', 'log', 'warn'] as const) console[k] = (...args: unknown[]) => lines.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  return { lines, restore: () => Object.assign(console, prev) }
}

// ---- Legacy sources pinned at LEGACY_REF (the deployed 2efbe4c4 source) ----

const tmp = mkdtempSync(join(tmpdir(), 'ask-legacy-'))
function gitShow(path: string): string {
  return execFileSync('git', ['show', `${LEGACY_REF}:${path}`], { cwd: REPO_ROOT, encoding: 'utf8' })
}
function writeTmp(name: string, src: string): string {
  const file = join(tmp, name)
  writeFileSync(file, src)
  return pathToFileURL(file).href
}

export interface PagesModule {
  onRequestPost: (ctx: { request: Request; env: Record<string, string | undefined> }) => Promise<Response>
  onRequestOptions: (ctx?: unknown) => Promise<Response>
}

// The legacy PagesFunction, unmodified except for resolving its one bare import. It uses the global fetch,
// so callers wrap it in withGlobalFetch(providers().fetch, ...) for the whole request and stream.
export async function loadLegacyHandler(): Promise<PagesModule> {
  const spec = "from '@supabase/supabase-js'"
  const src = gitShow('functions/api/ask.ts')
  assert.ok(src.includes(spec), 'legacy handler import anchor found')
  return import(writeTmp('legacy-ask.ts', src.replace(spec, `from '${import.meta.resolve('@supabase/supabase-js')}'`)))
}

export interface Message { role: string; content: string; sources?: Array<{ title: string; href: string }> }

// The legacy browser client's real submit logic (handleSubmit from AskAITab.tsx at LEGACY_REF), with React
// state replaced by a plain array. `server` receives the Request the client would send to /api/ask.
export type LegacyClient = (server: (req: Request) => Promise<Response>, opts?: { question?: string; sessionId?: string }) => Promise<Message[]>
export async function loadLegacyClient(): Promise<LegacyClient> {
  const { extractDocumentationSources } = await import(writeTmp('assistantUtils.ts', gitShow('src/components/UnifiedSearchModal/assistantUtils.ts')))
  const tsx = gitShow('src/components/UnifiedSearchModal/AskAITab.tsx')
  const start = tsx.indexOf('  const handleSubmit = async (e: React.FormEvent) => {')
  const end = tsx.indexOf('  const handleSuggestion = ')
  assert.ok(start > 0 && end > start, 'legacy client handleSubmit anchors found')
  const js = stripTypeScriptTypes(tsx.slice(start, end))
  const names = ['input', 'isLoading', 'canSendQuestion', 'turnstileToken', 'isLocalPreview', 'isWaitingFirstToken', 'sessionId', 'pageContext', 'setInput', 'setTurnstileToken', 'setMessages', 'setIsLoading', 'setIsWaitingFirstToken', 'turnstileRef', 'getLocalPreviewAnswer', 'extractDocumentationSources', 'fetch', 'console']
  const factory = new Function(...names, `${js}\nreturn handleSubmit`)

  return async (server, { question = VALID.question, sessionId = 'client-session' } = {}) => {
    let messages: Message[] = []
    const noop = () => {}
    const fetch = (url: string, init: RequestInit) => server(new Request(new URL(url, 'https://docs.test'), init))
    const handleSubmit = factory(
      question, false, true, 'client-token', false, true, sessionId, { title: 'Quick Start', href: '/getting-started/quick-start' },
      noop, noop, (fn: (m: Message[]) => Message[]) => { messages = fn(messages) }, noop, noop, { current: { reset: noop } },
      () => { throw new Error('local preview must not run') }, extractDocumentationSources, fetch, { error: noop },
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      handleSubmit({ preventDefault: noop }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('legacy client did not finish')), 2000) }),
    ]).finally(() => clearTimeout(timer))
    return messages
  }
}
