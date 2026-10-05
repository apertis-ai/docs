-- D1 schema for the "Was this page helpful?" widget (openspec docs-reader-shell-extras "Page feedback",
-- operator decision 2026-10-05: D1, bound as FEEDBACK_DB). One row per answer; no IP, user agent, cookie
-- or other identifier. Never hand-edited output: this file is outside src/ and publicDir, so it is never
-- emitted into dist (confirmed by `find dist -name '*.sql'` after a build).
--
-- Apply locally (never --remote; the lead owns the remote database):
--   wrangler d1 execute FEEDBACK_DB --local --persist-to site-nimbus/.wrangler/state --file site-nimbus/d1/feedback.sql
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  helpful INTEGER NOT NULL CHECK (helpful IN (0,1)),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
