/// <reference types="@cloudflare/workers-types" />

import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  JINA_API_KEY: string
  APERTIS_API_KEY: string
  APERTIS_BASE_URL: string
  APERTIS_MODEL: string
  TURNSTILE_SECRET_KEY: string
}

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

interface JinaEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

interface DocumentSearchResult {
  title: string
  url_path: string
  content: string
  similarity: number
}

interface PageContext {
  title?: string
  href?: string
}

interface AskRequestBody {
  question?: string
  sessionId?: string
  turnstileToken?: string
  pageContext?: PageContext | null
}

// Simple in-memory rate limiting (resets on cold start)
const sessionQueries = new Map<string, number>()
const MAX_QUERIES_PER_SESSION = 20

function normalizePageContext(pageContext: unknown): PageContext | null {
  if (!pageContext || typeof pageContext !== 'object') return null

  const { title, href } = pageContext as PageContext
  if (typeof title !== 'string' || typeof href !== 'string') return null

  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120)
  const cleanHref = href.trim().slice(0, 240)

  if (!cleanTitle || !cleanHref.startsWith('/') || cleanHref.startsWith('//')) {
    return null
  }

  return { title: cleanTitle, href: cleanHref }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Validate environment
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY ||
    !env.JINA_API_KEY ||
    !env.APERTIS_API_KEY ||
    !env.APERTIS_BASE_URL ||
    !env.APERTIS_MODEL ||
    !env.TURNSTILE_SECRET_KEY
  ) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

  let body: AskRequestBody
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { question, sessionId, turnstileToken } = body
  const pageContext = normalizePageContext(body.pageContext)

  if (!question || typeof question !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid question' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (question.length > 2000) {
    return new Response(
      JSON.stringify({ error: 'Question too long (max 2000 characters)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid sessionId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Verify Turnstile token
  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing Turnstile token' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') || undefined,
    }),
  })

  const turnstileData: TurnstileResponse = await turnstileRes.json()
  if (!turnstileData.success) {
    return new Response(
      JSON.stringify({ error: 'Turnstile verification failed', codes: turnstileData['error-codes'] }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit check
  const count = sessionQueries.get(sessionId) || 0
  if (count >= MAX_QUERIES_PER_SESSION) {
    return new Response(
      JSON.stringify({ error: 'Query limit reached for this session' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }
  sessionQueries.set(sessionId, count + 1)

  try {
    // 1. Embed query with Jina
    const embeddingInput = pageContext
      ? `${question}\nCurrent docs page: ${pageContext.title} (${pageContext.href})`
      : question

    const embeddingRes = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.JINA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v4',
        input: [embeddingInput],
        task: 'retrieval.query',
        dimensions: 1024,
      }),
    })

    if (!embeddingRes.ok) {
      const errText = await embeddingRes.text()
      return new Response(
        JSON.stringify({ error: `Jina API error: ${embeddingRes.status}`, details: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const embeddingData: JinaEmbeddingResponse = await embeddingRes.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // 2. Search Supabase
    const { data: docs, error } = await supabase
      .rpc('search_docs', {
        query_embedding: queryEmbedding,
        match_count: 5,
      })

    if (error) {
      return new Response(
        JSON.stringify({ error: `Supabase search error: ${error.message}`, code: error.code }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. Build context and prompt
    const docContext = docs && docs.length > 0
      ? docs.map((d: DocumentSearchResult) => `## ${d.title} (relevance: ${(d.similarity * 100).toFixed(0)}%)\nSource: ${d.url_path}\n\n${d.content}`).join('\n\n---\n\n')
      : 'No relevant documentation found.'

    const currentPageContext = pageContext
      ? `\n## Current Page Context:\nThe user opened [${pageContext.title}](${pageContext.href}) when asking this question. If the retrieved documentation includes this page or directly related pages, prioritize that context. Do not cite this page unless it appears in the relevant documentation above.\n`
      : ''

    const systemPrompt = `You are the Apertis AI Documentation Assistant. Answer user questions based strictly on the documentation content provided below.

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

    // 4. Call Apertis Chat API (Streaming)
    const chatRes = await fetch(`${env.APERTIS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.APERTIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.APERTIS_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      }),
    })

    if (!chatRes.ok) {
      const errText = await chatRes.text()
      return new Response(
        JSON.stringify({ error: `Apertis API error: ${chatRes.status}`, details: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 5. Transform and forward SSE stream
    if (!chatRes.body) {
      throw new Error('No response body from Apertis API')
    }

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()
    const reader = chatRes.body.getReader()
    const decoder = new TextDecoder()

    ;(async () => {
      try {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                await writer.write(encoder.encode('data: [DONE]\n\n'))
                break
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                if (content) {
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  )
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
