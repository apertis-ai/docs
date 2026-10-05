/// <reference types="@cloudflare/workers-types" />

// POST /_nimbus/feedback (openspec docs-reader-shell-extras "Page feedback"): the DocLayout widget's
// "Was this page helpful?" answer, stored in D1 (bound as FEEDBACK_DB, operator decision 2026-10-05) as
// one row of path/helpful/comment/created_at (schema: site-nimbus/d1/feedback.sql). No IP, user agent,
// cookie or other identifier is ever read or stored. Only POST is exported: other methods fall through
// to the static 404. Validation is the pure site-nimbus/src/components/feedback/feedback.ts (unit-tested
// in site-nimbus/test/feedback.test.ts); this file only turns its result into HTTP.
import { manifest } from '../../site-nimbus/src/manifest/manifest.ts'
import { LIMITS, parseFeedback, publishedPaths } from '../../site-nimbus/src/components/feedback/feedback.ts'

interface Env {
  FEEDBACK_DB?: D1Database
}

// Computed once per isolate, not per request: the manifest is build-time data, never re-derived.
const PUBLISHED = publishedPaths(manifest.documents)
const noStore = { 'cache-control': 'no-store' } as const
const json = (status: number, body: unknown) => Response.json(body, { status, headers: noStore })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json(400, { error: 'cross-origin request' })
  if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json(400, { error: 'Content-Type must be application/json' })
  }

  const bytes = await request.arrayBuffer()
  let body: unknown
  try {
    body = bytes.byteLength > LIMITS.MAX_BODY_BYTES ? undefined : JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return json(400, { error: 'invalid JSON' })
  }

  let feedback
  try {
    feedback = parseFeedback(bytes.byteLength, body, PUBLISHED)
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : 'invalid feedback' })
  }

  if (!env.FEEDBACK_DB) return json(503, { error: 'feedback storage unavailable' })
  try {
    await env.FEEDBACK_DB.prepare('INSERT INTO feedback (path, helpful, comment) VALUES (?, ?, ?)')
      .bind(feedback.path, feedback.helpful ? 1 : 0, feedback.comment)
      .run()
  } catch (e) {
    console.error('feedback:', e instanceof Error ? e.message : e)
    return json(503, { error: 'feedback storage unavailable' })
  }
  return new Response(null, { status: 204, headers: noStore })
}
