// Framework-independent Ask Docs service: Request in, Response out. functions/api/ask.ts is only the
// Pages adapter. Wire contract: migration/nimbus/fixtures/ask-wire.json.
import { createRetrieval, RetrievalError, type RetrievalEnv, type RetrievalRow } from './retrieval.ts'

export interface AskEnv extends RetrievalEnv {
  JINA_API_KEY?: string
  APERTIS_API_KEY?: string
  APERTIS_BASE_URL?: string
  APERTIS_MODEL?: string
  TURNSTILE_SECRET_KEY?: string
}

export interface Timeouts {
  turnstile: number
  jina: number
  retrieval: number
  // Whole Apertis call: connection, headers and the entire relayed stream.
  apertis: number
}

export interface AskDeps {
  fetch?: typeof fetch
  timeouts?: Partial<Timeouts>
}

const DEFAULT_TIMEOUTS: Timeouts = { turnstile: 10_000, jina: 15_000, retrieval: 15_000, apertis: 120_000 }

export const MAX_QUERIES_PER_SESSION = 20
export const MAX_BODY_BYTES = 64 * 1024
export const MAX_SESSION_ID_LENGTH = 128

// Known limitation, not abuse protection: this counter lives in one isolate, resets on cold start and is
// keyed by a client-chosen sessionId. Real abuse protection is Turnstile plus operator-side controls.
const sessionQueries = new Map<string, number>()

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

class UpstreamError extends Error {}

function log(traceId: string, stage: string, detail: Record<string, unknown> = {}) {
  // Stage, status and codes only: provider bodies, messages and secrets are never logged.
  console.error(JSON.stringify({ at: 'ask', traceId, stage, ...detail }))
}

function errorName(err: unknown): string {
  return err instanceof Error || err instanceof DOMException ? err.name : typeof err
}

export interface PageContext {
  title: string
  href: string
}

// Untrusted reference data: used only as text in the embedding input and prompt, never fetched or trusted.
export function normalizePageContext(pageContext: unknown): PageContext | null {
  if (!pageContext || typeof pageContext !== 'object') return null
  const { title, href } = pageContext as { title?: unknown; href?: unknown }
  if (typeof title !== 'string' || typeof href !== 'string') return null
  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120)
  const cleanHref = href.trim().slice(0, 240)
  if (!cleanTitle || !cleanHref.startsWith('/') || cleanHref.startsWith('//')) return null
  return { title: cleanTitle, href: cleanHref }
}

// Reads at most `limit` bytes; returns null when the body is larger.
async function readBody(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function buildSystemPrompt(docs: RetrievalRow[], pageContext: PageContext | null): string {
  // Kept byte-for-byte equal to the legacy handler (tests compare the Apertis request bodies).
  const docContext = docs && docs.length > 0
    ? docs.map((d) => `## ${d.title} (relevance: ${(d.similarity * 100).toFixed(0)}%)\nSource: ${d.url_path}\n\n${d.content}`).join('\n\n---\n\n')
    : 'No relevant documentation found.'

  const currentPageContext = pageContext
    ? `\n## Current Page Context:\nThe user opened [${pageContext.title}](${pageContext.href}) when asking this question. If the retrieved documentation includes this page or directly related pages, prioritize that context. Do not cite this page unless it appears in the relevant documentation above.\n`
    : ''

  return `You are the Apertis AI Documentation Assistant. Answer user questions based strictly on the documentation content provided below.

Guidelines:
- Answer based ONLY on the provided documentation. Do not make up information.
- If the documentation does not contain the answer, say: "I couldn't find this in the Apertis documentation. You can browse the full docs at [docs.apertis.ai](https://docs.apertis.ai) or contact support at hi@apertis.ai."
- Always cite your sources using markdown links: [Page Title](/url-path)
- Include code examples from the documentation when relevant — use the exact code snippets provided, do not invent new ones.
- Be concise. Lead with the direct answer, then provide supporting details.
- When multiple documentation sections are relevant, prioritize the ones listed first (they have higher relevance scores).
${currentPageContext}

## Relevant Documentation:

${docContext}`
}

export async function handleAsk(request: Request, env: AskEnv, deps: AskDeps = {}): Promise<Response> {
  const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const timeouts = { ...DEFAULT_TIMEOUTS, ...deps.timeouts }
  const within = (ms: number) => AbortSignal.any([request.signal, AbortSignal.timeout(ms)])

  // Environment first, as in legacy: an unconfigured deployment answers 500 to every POST.
  let retrieval
  try {
    if (!env.JINA_API_KEY || !env.APERTIS_API_KEY || !env.APERTIS_BASE_URL || !env.APERTIS_MODEL || !env.TURNSTILE_SECRET_KEY) {
      throw new Error('missing binding')
    }
    retrieval = createRetrieval(env, deps.fetch)
  } catch {
    return json(500, { error: 'Server configuration error' })
  }

  const raw = await readBody(request, MAX_BODY_BYTES)
  if (raw === null) return json(413, { error: 'Request body too large' })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }
  const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const { question, sessionId, turnstileToken } = body
  const pageContext = normalizePageContext(body.pageContext)

  if (!question || typeof question !== 'string') return json(400, { error: 'Missing or invalid question' })
  if (question.length > 2000) return json(400, { error: 'Question too long (max 2000 characters)' })
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > MAX_SESSION_ID_LENGTH) {
    return json(400, { error: 'Missing or invalid sessionId' })
  }
  if (!turnstileToken || typeof turnstileToken !== 'string') return json(400, { error: 'Missing Turnstile token' })

  const traceId = crypto.randomUUID()

  // Turnstile runs before any paid provider call.
  let turnstile: { success?: boolean; 'error-codes'?: string[] }
  try {
    const res = await doFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP') || undefined,
      }),
      signal: within(timeouts.turnstile),
    })
    turnstile = await res.json()
  } catch (err) {
    log(traceId, 'turnstile', { error: errorName(err) })
    return json(500, { error: 'Turnstile verification unavailable', traceId })
  }
  if (!turnstile?.success) {
    return json(403, { error: 'Turnstile verification failed', codes: turnstile?.['error-codes'] })
  }

  const count = sessionQueries.get(sessionId) || 0
  if (count >= MAX_QUERIES_PER_SESSION) return json(429, { error: 'Query limit reached for this session' })
  sessionQueries.set(sessionId, count + 1)

  let stage = 'jina'
  try {
    const embeddingInput = pageContext
      ? `${question}\nCurrent docs page: ${pageContext.title} (${pageContext.href})`
      : question
    const embeddingRes = await doFetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.JINA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jina-embeddings-v4', input: [embeddingInput], task: 'retrieval.query', dimensions: 1024 }),
      signal: within(timeouts.jina),
    })
    if (!embeddingRes.ok) {
      await embeddingRes.body?.cancel().catch(() => {})
      log(traceId, stage, { status: embeddingRes.status })
      throw new UpstreamError(`Jina API error: ${embeddingRes.status}`)
    }
    const embeddingData = (await embeddingRes.json()) as { data?: Array<{ embedding?: unknown }> }
    const queryEmbedding = embeddingData?.data?.[0]?.embedding
    if (!Array.isArray(queryEmbedding)) throw new Error('embedding missing')

    stage = 'retrieval'
    let docs: RetrievalRow[]
    try {
      docs = await retrieval({ queryEmbedding, matchCount: 5, similarityThreshold: 0.3 }, within(timeouts.retrieval))
    } catch (err) {
      log(traceId, stage, { error: errorName(err), code: err instanceof RetrievalError ? err.code : undefined })
      throw new UpstreamError('Documentation search error')
    }

    stage = 'apertis'
    const upstream = new AbortController()
    const chatSignal = AbortSignal.any([upstream.signal, request.signal, AbortSignal.timeout(timeouts.apertis)])
    const chatRes = await doFetch(`${env.APERTIS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.APERTIS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.APERTIS_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt(docs, pageContext) },
          { role: 'user', content: question },
        ],
      }),
      signal: chatSignal,
    })
    if (!chatRes.ok || !chatRes.body) {
      await chatRes.body?.cancel().catch(() => {})
      log(traceId, stage, { status: chatRes.status })
      throw new UpstreamError(`Apertis API error: ${chatRes.status}`)
    }

    return new Response(relay(chatRes.body, upstream, traceId), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    if (err instanceof UpstreamError) return json(500, { error: err.message, traceId })
    const timedOut = errorName(err) === 'TimeoutError'
    log(traceId, stage, { error: errorName(err) })
    if (timedOut && stage !== 'retrieval') {
      return json(500, { error: `${stage === 'jina' ? 'Jina' : 'Apertis'} API error: timeout`, traceId })
    }
    return json(500, { error: 'An error occurred processing your request', traceId })
  }
}

// Converts the upstream OpenAI-style stream into legacy frames: `data: {"content":…}` for each non-empty
// delta and exactly one `data: [DONE]` on success. On an upstream failure it emits one
// `data: {"error":…,"traceId":…}` frame (no `content` key, so legacy clients ignore it) and closes
// without [DONE]. Cancelling the response aborts and cancels the upstream request.
function relay(body: ReadableStream<Uint8Array>, upstream: AbortController, traceId: string): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const frame = (data: unknown) => encoder.encode(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)
  let buffer = ''
  let finished = false

  const stop = (reason?: unknown) => {
    finished = true
    upstream.abort(reason)
    reader.cancel(reason).catch(() => {})
  }

  // Returns 'done' for [DONE], 'error' for an in-band upstream error, otherwise pushes content frames.
  const handleLine = (rawLine: string, out: Uint8Array[]): 'done' | 'error' | undefined => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line.startsWith('data:')) return
    const data = line.slice(line.startsWith('data: ') ? 6 : 5)
    if (data === '[DONE]') return 'done'
    let parsed: { error?: unknown; choices?: Array<{ delta?: { content?: unknown } }> }
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    if (parsed?.error) return 'error'
    const content = parsed?.choices?.[0]?.delta?.content
    if (typeof content === 'string' && content) out.push(frame({ content }))
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = done ? '' : (lines.pop() ?? '')
          const out: Uint8Array[] = []
          let terminal: 'done' | 'error' | undefined
          for (const line of lines) {
            terminal = handleLine(line, out)
            if (terminal) break
          }
          if (finished) return
          for (const f of out) controller.enqueue(f)
          if (terminal === 'error') throw new Error('upstream error frame')
          if (terminal === 'done' || done) {
            controller.enqueue(frame('[DONE]'))
            controller.close()
            stop()
            return
          }
          if (out.length) return
        }
      } catch (err) {
        if (finished) return
        log(traceId, 'stream', { error: errorName(err) })
        controller.enqueue(frame({ error: 'Upstream stream interrupted', traceId }))
        controller.close()
        stop(err)
      }
    },
    cancel(reason) {
      if (!finished) stop(reason)
    },
  })
}

export function handleOptions(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
