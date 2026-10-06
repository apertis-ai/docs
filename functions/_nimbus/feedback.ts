/// <reference types="@cloudflare/workers-types" />

// POST /_nimbus/feedback (openspec docs-reader-shell-extras "Page feedback"): the DocLayout widget's
// "Was this page helpful?" answer, stored in D1 (bound as FEEDBACK_DB, operator decision 2026-10-05) as
// one row of path/helpful/comment/created_at (schema: site-nimbus/d1/feedback.sql). Only POST is
// exported: other methods fall through to the static 404. This file is only the Workers binding: all
// validation and HTTP handling is the plain site-nimbus/src/components/feedback/feedback.ts
// (unit-tested in site-nimbus/test/feedback.test.ts), kept free of this file's `@cloudflare/workers-types`
// reference so importing it does not change what the rest of site-nimbus typechecks against.
import { handleFeedback, publishedFromSitemap } from '../../site-nimbus/src/components/feedback/feedback.ts'

interface Env {
  ASSETS: Fetcher
  FEEDBACK_DB?: D1Database
}

// The published paths, from this deployment's own /sitemap.xml: read once per isolate (a deployment's assets
// never change); a failed read is not kept, and that request answers 503 like any other storage failure.
let published: Promise<Set<string>> | undefined
const load = async (assets: Fetcher, origin: string) => {
  const res = await assets.fetch(new URL('/sitemap.xml', origin).toString())
  if (!res.ok) throw new Error(`/sitemap.xml: ${res.status}`)
  return publishedFromSitemap(await res.text())
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    published ??= load(env.ASSETS, request.url)
    return handleFeedback(request, env.FEEDBACK_DB, await published)
  } catch (e) {
    published = undefined
    console.error('feedback:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'feedback unavailable' }, { status: 503 })
  }
}
