## Context

Issue #5 (parent #4) freezes the migration boundary before implementation. Everything below was observed on 2026-09-29; the planning snapshot in #4 was revalidated rather than trusted.

### Baseline identities (recorded separately)

| Fact | Value | Certainty |
|---|---|---|
| Source base | `origin/main` = `7b6ef85abaaef50de5c8d277629b07a39c9c3065`, unchanged since the #4 snapshot; no open PRs | verified (`git fetch`, `gh pr list`) |
| Legacy build | `npm ci && npm run build` on Node 25.6.1 succeeded; 98 HTML files (97 unique routes, `/404` emitted twice) | verified locally |
| Activation guard | `npm run test:developer-activation` passed across 97 source files | verified locally |
| Serving deployment | Pages project `docs`, canonical and latest deployment `2efbe4c4-db00-4b7f-b4cd-34df32047ff2`, source `7b6ef85`, Production | verified (Pages API + bundle hash `main.9321920d.js` on all three domains) |
| Live content | 97 live HTML routes equal the local build by status, redirect, canonical and heading ids; article text equal except Cloudflare Email Obfuscation on 8 pages | verified (`route-fixtures.mjs snapshot` on both) |
| Build settings | command `npm run build`, output `build`, root `/`, compatibility date `2026-01-05`, no bindings; preview deployments for every branch | verified (read-only API) |
| Secrets | Production: seven secrets named in `legacy-rollback.json`; Preview: none | verified (names only) |
| Retrieval | Supabase project `ask-docs`, 77 documents / 245 chunks, digests recorded, no tracked migrations, shared with unrelated tables | verified (read-only SQL) |

The local build's bundle hashes differ from the deployed ones (`main.333b8d31.js` locally vs `main.9321920d.js` live) because the build environment differs; content equality, not bundle hash, ties the local build to production.

### Discrepancies between source, build and live

- Sitemap and canonical links use no-slash URLs, but every non-index route answers `308` to its slash form (Pages directory handling of `x/index.html`). Frozen as observed.
- `GET /api/ask` returns the static 404 page, not `405`.
- The live template blog, `/test`, `/markdown-page` and the `/404` locale-redirect page are public although they are create-docusaurus leftovers.
- `robots.txt`, `llms.txt` and `.md` URLs do not exist at baseline.
- `/cdn-cgi/l/email-protection` links appear only on the live site (edge obfuscation) and are excluded from contracts.

### Baseline defects (recorded, not fixed here)

1. `legacy-index-writes-fail`: the indexing workflow has failed to update any existing document since at least 2026-07-20 while reporting success; production retrieval serves pre-PR #3 text containing the legacy key route in 29 documents and fixed model-count claims in 7. Fixing it on `main` triggers production reindexing, so it needs separate authority (reported on #4).
2. The legacy indexer ignores `.mdx`, and 7 stale rows remain for pages renamed to `.mdx`; `/installation/kilo-cli` is unindexed.
3. Cmd/Ctrl+K opens search but leaves focus on `<body>` (the search plugin's own shortcut competes); keyboard-only search does not work on desktop.
4. Ask Docs page context is captured once on open and goes stale after navigation.
5. Markdown page actions read `raw.githubusercontent.com/.../main/...`, not the displayed release.
6. The local-preview Ask Docs branch returns a canned answer on localhost and links to a non-existent `/docs/...` path.
7. The `/404` page redirects to non-existent `/en/...` paths.
8. The canonical of every non-index page points at a URL that redirects.
9. The search dialog does not lock page scroll: with focus on `<body>`, typed spaces scroll the page behind the open dialog (observed in Chrome on the Mac mini).
10. A query typed before the search index finishes loading shows "No results found" and is never retried (`desktop-search.jpg`).
11. On a hostname the Turnstile widget does not allow (error `110200`), Ask Docs silently disables sending with no visible message.

Visual baseline: `migration/nimbus/baseline-screens/` holds desktop (1440×900) and mobile (390×844, DPR 2, touch) captures of the legacy build served from this machine, taken with the system Chrome. Interactive checks (Cmd/Ctrl+K focus, scroll, page actions, theme switch, Ask Docs send) were run in the Mac mini Chrome through the browser extension.

### Reproducibility and privacy

- The live snapshot and its path list are committed under `migration/nimbus/baseline/`; `build-inventory.mjs` regenerates `route-inventory.json` and `route-fixtures.json` from them and a legacy build.
- This repository is public. Contract files record the Supabase project only by name and do not list the unrelated tables that share it; the project reference stays with operators.

## Goals / Non-Goals

**Goals:** give #6–#14 contracts precise enough to implement and verify independently; make baseline and acceptance evidence reproducible from committed scripts.

**Non-Goals:** changing production docs, UI, Pages Function, indexer, workflows, Cloudflare or Supabase state; choosing Nimbus/Astro versions (#6); fixing baseline defects outside the packet that owns them.

## Decisions

1. **Candidate directory `site-nimbus/`.** Keeps the root build that Pages runs untouched.
2. **Observed URL semantics are frozen exactly**, including the slash redirect and canonical form, so that the candidate is judged by the same `route-fixtures.json` as the legacy site (206/206 pass against live and local legacy).
3. **Stable document id = plugin-qualified legacy id** (`default:…`, `api:…`, `page:…`, `blog:…`); `route-inventory.json` is its registry. The alternative, a content hash or path, would change on rename and break retrieval rows and citations.
4. **Eligibility is explicit per document** and equals legacy behavior except two recorded deltas: all `docs/` and `docs-api/` documents become `agent` and `rag` eligible (legacy RAG missed `.mdx` by accident of its glob), and standalone pages/blog stay out of `agent`/`rag`.
5. **Markdown artifact location `<canonical path>.md`** (`/index.md` for slash-canonical documents), served by the same deployment, so page actions and agents read the release that is displayed.
6. **One open event (`apertis-docs:open`) and one Cmd/Ctrl+K owner** replace DOM interception, which caused baseline defect 3.
7. **Retrieval source is server configuration only and fails closed**, so preview can never read production data and the browser cannot pick a generation. Legacy mode calls the existing three-argument `search_docs` unchanged.
8. **Budgets are relative to a same-harness legacy baseline** with zero tolerance for bytes and max(+10 %, +50 ms) for timing medians. Absolute edge numbers are not comparable locally (edge obfuscation, compression), so both sides are measured with `wrangler pages dev` on this machine.
9. **Search relevance measured through the reader surface** (Cmd/Ctrl+K, typing, ArrowDown/Enter) so the same script judges legacy and candidate; targets were committed before the first legacy run.
10. **PoC set of 12 pages** covers homepage, Quick Start, API keys, billing, a `.mdx` coding-agent page, a `.mdx` page with bundled relative images (`/installation/roocode`), the `/api/` index, chat/messages/responses, streaming and a code-heavy SDK page.

## Risks / Trade-offs

- Freezing the redirecting canonical preserves a defect → changing it later is a single recorded decision with fixture updates, cheaper than an unreviewed drift now.
- Local timing budgets do not predict edge latency → #14 observes production metrics separately after an authorized release.
- Zero byte tolerance can block a candidate that is faster overall → the gate is explicit and changing it requires a recorded decision, not a silent relaxation.

## Dispatch boundaries

- **#6** (Nimbus foundation) and **#10** (assistant runtime) may start in parallel from the #5 commit. #6 owns `site-nimbus/` package, lockfile, base config and the single definitions of the manifest v1 type, page metadata and `apertis-docs:open` event types. #10 owns the Pages route adapter and the retrieval interface for the candidate; the legacy `functions/api/ask.ts` stays unchanged until a release step is authorized.
- **#7/#8/#9** start after #6's interfaces are reviewed and may use `migration/nimbus/fixtures/manifest-v1.example.json` until #7's real manifest exists.
- **#11** starts when #7's manifest producer and #10's retrieval interface are reviewed.
- **#12** consumes `route-fixtures.mjs`, `measure.mjs`, `search-queries.json`, `budgets.json` and `ask-wire.json` as its baseline instruments.

## Operator actions requested

1. Authority to push task branches (each push also creates a Pages preview build of the legacy site).
2. Isolated assistant environment for #10/#12 real evidence: preview-scoped Pages secrets and an isolated retrieval target (separate Supabase project or an isolated generation) — the preview environment currently has none.
3. Decision on the production indexer defect (`legacy-index-writes-fail`): fix now as a separate change, or leave it until #11 replaces the indexer.
4. Add the isolated environment's hostname to the Turnstile widget's allowed domains (site key `0x4AAAAAACS2SzpYBFytHb_E`), or provision a separate widget, otherwise Ask Docs cannot send there.
5. Disposition of placeholder routes (template blog, `/test`, `/markdown-page`, `/404`), needed by #13, not by the PoC.
