## ADDED Requirements

### Requirement: Route inventory is the route authority
Every route discovered in the legacy source, the legacy build or the live site SHALL appear in `migration/nimbus/route-inventory.json` with a kind, a stable `documentId` where one applies, a disposition and explicit eligibility. A candidate SHALL NOT add, remove or move a public route unless the inventory row permits it or a recorded decision on #4 changes the row.

#### Scenario: Candidate omits a preserved route
- **WHEN** a candidate build does not serve a route whose disposition is `preserve` or `preserve-pending-decision`
- **THEN** the full-scope route fixtures fail for that route
- **AND** the omission is not accepted as a coverage exception outside the PoC scope

#### Scenario: A new route appears in a candidate
- **WHEN** a candidate emits an HTML, Markdown or feed route that is not in the inventory
- **THEN** the route is accepted only if it derives from a manifest entry whose eligibility allows that output, or is listed as an `absent-at-baseline` path introduced under this contract

### Requirement: Observed slash and canonical behavior is preserved
A candidate SHALL reproduce the observed URL semantics of the serving deployment: a documentation page at `/x` answers `308` to `/x/`, `/x/` answers `200`, and its canonical link is the no-slash form `https://docs.apertis.ai/x`. Directory index documents (`/`, `/api/`, `/api/sdks/python-sdk/`) answer `200` at the slash form, `/api` and `/api/sdks/python-sdk` answer `308` to the slash form, and their canonical keeps the trailing slash. Unknown paths, including unknown paths under `/api/`, answer `404`. The canonical pointing at a redirecting URL is a recorded baseline defect; changing it requires a recorded decision.

#### Scenario: Fixture check against a candidate
- **WHEN** `node scripts/nimbus/route-fixtures.mjs check <candidateBaseUrl> --scope poc` runs against the candidate served by `wrangler pages dev`
- **THEN** every PoC-scope status, redirect target, canonical and anchor fixture passes

### Requirement: Critical anchors are preserved
A candidate SHALL keep every heading id on each PoC page and every heading id targeted by an internal `#fragment` link anywhere in the corpus; the full-corpus conversion SHALL keep every heading id recorded in the inventory for each preserved page.

#### Scenario: Cross-page fragment link
- **WHEN** `/billing/subscription-plans` links to `/installation/claude-code#coding-model-ids`
- **THEN** the candidate page at `/installation/claude-code/` contains an element with id `coding-model-ids`

### Requirement: Explicit publication eligibility
Each document SHALL carry four explicit booleans: `publish` (HTML route exists), `search` (in the local search index), `agent` (clean Markdown artifact and llms outputs) and `rag` (retrieval generation). Candidate eligibility SHALL equal the inventory row. Only these intentional deltas from legacy behavior are accepted: every `docs/` and `docs-api/` document, `.md` and `.mdx`, is `agent` and `rag` eligible; standalone pages and blog content are not `agent` or `rag` eligible.

#### Scenario: MDX integration page
- **WHEN** `/installation/claude-code` (source `docs/installation/claude-code.mdx`) is built
- **THEN** it is published, searchable, has a clean Markdown artifact, and is included in the retrieval generation
- **AND** this differs from legacy retrieval, which indexed only `.md` sources

### Requirement: Navigation hiding is not access control
Sidebar placement and `noindex` SHALL NOT decide publication. A document that is published but absent from the sidebars (for example `/help/ideas`) SHALL remain published with `listed: false`. Draft, private, unpublished or internal-planning material SHALL be excluded by explicit eligibility, never by omission from navigation.

#### Scenario: Unlisted page
- **WHEN** `docs/help/ideas.md` is converted
- **THEN** `/help/ideas/` is served, searchable and RAG-eligible exactly as the inventory row states, and no sidebar entry is added

### Requirement: No unintended public content
Every public output (HTML, `.md`, raw source, `llms*`, sitemap, search index, retrieval generation) SHALL derive only from manifest entries with the matching eligibility, from inventory rows for generated routes and legacy `static/` files (kept at their paths), or from assets the build references. Repository material outside the publication roots (`docs/`, `docs-api/`, `src/pages/`, `blog/`, `static/`), including `openspec/`, `migration/`, `scripts/`, `functions/` source and planning documents, SHALL NOT be emitted. Raw `.mdx` sources SHALL NOT be served.

#### Scenario: Build emits an untraceable file
- **WHEN** a candidate output file is neither derived from an eligible manifest entry nor a referenced static asset
- **THEN** the publication check fails the build

### Requirement: Reserved runtime path
The path `/api/ask` SHALL remain reserved for the runtime handler. No document, redirect, catch-all route or static file SHALL be emitted at `/api/ask`, and `/api/*` documentation SHALL NOT shadow it. `GET /api/ask` answers `404` as observed at baseline.

#### Scenario: Static API docs coexist with the handler
- **WHEN** the candidate is served with its Pages Function
- **THEN** `POST /api/ask` reaches the handler and `/api/text-generation/chat-completions/` is served statically

### Requirement: Placeholder routes need a recorded decision
The live template blog (`/blog/**`, feeds), `/test`, `/markdown-page` and the `/404` locale-redirect page have disposition `preserve-pending-decision`. They SHALL be preserved unless a decision recorded on #4 retires them; retirement SHALL use an explicit status or one-hop redirect, never silent deletion. They are outside the PoC set.

#### Scenario: Full-corpus conversion without a decision
- **WHEN** #13 runs and no retirement decision exists
- **THEN** these routes are preserved with their observed status and redirect behavior
