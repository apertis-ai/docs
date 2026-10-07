## Why

The Docusaurus → Cloudflare Nimbus migration (#4) runs as parallel packets (#6–#14) that must build against one agreed boundary. Deriving URLs from filenames, treating sidebar-hidden pages as private, assuming `main` equals production, or choosing budgets after seeing candidate results would silently break published URLs, citations, search, the assistant, or rollback. Issue #5 freezes that boundary from observed evidence before implementation starts.

## What Changes

- Record the verified production identity (Pages deployment `2efbe4c4` = source `bb057a7`), build/deployment settings, legacy retrieval identity, and baseline defects (`migration/nimbus/legacy-rollback.json`).
- Freeze a route inventory that classifies every discovered source, build and live route with a disposition and explicit publication/search/agent/RAG eligibility (`migration/nimbus/route-inventory.json`), plus executable route/redirect/canonical/anchor fixtures (`migration/nimbus/route-fixtures.json`, `scripts/nimbus/route-fixtures.mjs`).
- Freeze the publication manifest v1 contract, the `/api/ask` wire and compatibility contract (`migration/nimbus/fixtures/ask-wire.json`), the server-side retrieval boundary, and the shell/search/Ask Docs/page-context interfaces.
- Freeze the PoC page set, search relevance queries and hit rule (`migration/nimbus/search-queries.json`), and the performance protocol, legacy baseline and budgets (`migration/nimbus/budgets.json`, `scripts/nimbus/measure.mjs`) before any candidate measurement.
- Fix the candidate package directory as `site-nimbus/` and the evidence and authority rules every packet follows.

No production documentation, application or API behavior, indexer, UI, framework, Cloudflare or database configuration changes in this change.

## Capabilities

### New Capabilities
- `docs-routing-publication`: public route, slash/canonical, disposition and publication-eligibility contract, including leak prevention and the reserved `/api/ask` path.
- `docs-publication-manifest`: manifest v1 that ties stable document identity, canonical URL, Markdown artifact, eligibility, content hash, source SHA and build identity together.
- `ask-docs-api`: `POST /api/ask` request/response/SSE contract, old/new client-server compatibility, and the server-side retrieval-generation boundary.
- `docs-shell-interfaces`: navigation, search and Ask Docs trigger events, page metadata, page context, Markdown actions and preserved reader-facing behavior.
- `nimbus-migration-acceptance`: PoC set, relevance targets, performance budgets, evidence classes, rollback identities, candidate directory and authority boundaries.

### Modified Capabilities
- `ask-docs-panel`: page context is refreshed on navigation instead of being captured once when the panel opens.

## Impact

Adds contract data under `migration/nimbus/`, measurement/fixture scripts under `scripts/nimbus/`, and this OpenSpec change. The root Docusaurus build, `package.json`, lockfile, Pages Function, indexer, workflows and deployed content are unchanged.
