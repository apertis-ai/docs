-- D1 schema for the "Was this page helpful?" widget (openspec docs-reader-shell-extras "Page feedback",
-- operator decision 2026-10-05: D1, bound as FEEDBACK_DB). One row per answer; no IP, user agent, cookie
-- or other identifier. Never hand-edited output: this file is outside src/ and publicDir, so it is never
-- emitted into dist (confirmed by `find dist -name '*.sql'` after a build).
--
-- Apply locally (never --remote; the lead owns the remote database and its config). `wrangler d1
-- execute` resolves the binding name from a Wrangler config, so point --config at one that declares
-- it; this repo's config is the lead's, so during development that is a local-only, gitignored file,
-- e.g. site-nimbus/.wrangler/local-d1.jsonc:
--   { "name": "local-only-feedback-schema-helper", "compatibility_date": "2024-01-01",
--     "d1_databases": [{ "binding": "FEEDBACK_DB", "database_name": "feedback-local", "database_id": "<any UUID>" }] }
-- then, with the same <UUID> also passed to `wrangler pages dev --d1 FEEDBACK_DB=<UUID>`:
--   wrangler d1 execute FEEDBACK_DB --local --persist-to site-nimbus/.wrangler/state \
--     --config site-nimbus/.wrangler/local-d1.jsonc --file site-nimbus/d1/feedback.sql
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  helpful INTEGER NOT NULL CHECK (helpful IN (0,1)),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
