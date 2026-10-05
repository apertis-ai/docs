/// <reference types="@cloudflare/workers-types" />

// POST /_nimbus/feedback (openspec docs-reader-shell-extras "Page feedback"): the DocLayout widget's
// "Was this page helpful?" answer, stored in D1 (bound as FEEDBACK_DB, operator decision 2026-10-05) as
// one row of path/helpful/comment/created_at (schema: site-nimbus/d1/feedback.sql). Only POST is
// exported: other methods fall through to the static 404. This file is only the Workers binding: all
// validation and HTTP handling is the plain site-nimbus/src/components/feedback/feedback.ts
// (unit-tested in site-nimbus/test/feedback.test.ts), kept free of this file's `@cloudflare/workers-types`
// reference so importing it does not change what the rest of site-nimbus typechecks against.
import { manifest } from '../../site-nimbus/src/manifest/manifest.ts'
import { handleFeedback, publishedPaths } from '../../site-nimbus/src/components/feedback/feedback.ts'

interface Env {
  FEEDBACK_DB?: D1Database
}

// Computed once per isolate, not per request: the manifest is build-time data, never re-derived.
const PUBLISHED = publishedPaths(manifest.documents)

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleFeedback(request, env.FEEDBACK_DB, PUBLISHED)
