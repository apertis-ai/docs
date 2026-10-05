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

### Requirement: Native articles
The operator decided on 2026-09-30 (canary review) that the candidate carries articles beside the docs, after the claude.dev blog: `/blog/<slug>/` for each article and a `/blog/` index. On 2026-10-03 the operator decided that the header, homepage and footer link `/blog/` before the first article is published. Articles are written for the candidate, not converted from the legacy tree:
- each is `site-nimbus/src/articles/<slug>.md`, plain Markdown with front matter `title`, `description`, `date` (YYYY-MM-DD), `author`, `category`, optional `draft` and optional `related` (comma-separated served paths of the documentation pages the article follows on from); the body has no H1 and no MDX, and anything else fails the conversion;
- a published article is the manifest entry `blog:<slug>` at `/blog/<slug>/`, identified as native by its source path (the manifest v1 shape is unchanged), eligible for HTML, search, the clean Markdown artifact and retrieval, and listed in the sitemap;
- a draft yields nothing: no manifest entry, page, artifact, sitemap URL or search record;
- the route inventory is never edited and records no native article. A slug whose path or id any inventory row names (the retired legacy blog posts, tags, authors, archive and feeds) SHALL fail the conversion;
- every `related` path SHALL be a published documentation page (not an article); anything else fails the conversion. Each of those pages lists the article under "Related articles" after its body, outside the search index;
- the `/blog/` index offers a category filter once the published articles span two or more categories; without JavaScript every article stays listed;
- the `/blog/` index supersedes the retired legacy `/blog` row (and only it), with or without published articles (operator review 2026-10-03: readers should see that articles live here): the retirement rewrite no longer applies there. Without articles the index says the first articles are on their way; it is not a manifest document, so it has no Markdown, search record or sitemap URL. Every other retired `/blog/**` path keeps answering 404.

Articles are not `agent`-eligible for `llms*` outputs unless a later change says so. The no-`llms*` rule that stood here was superseded on 2026-10-05 by the operator (change `docs-reader-features`, `docs-agent-access`): `/llms.txt` and `/llms-full.txt` derive from the `publish`- and `agent`-eligible manifest entries.

#### Scenario: No published article
- **WHEN** the candidate is built with no article, or only drafts
- **THEN** the manifest, sitemap and search index have no article, `/blog/` answers 200 with the "on their way" line, the homepage "From the blog" column says the same, and every other retired `/blog/**` path answers 404

#### Scenario: Draft
- **WHEN** an article has `draft: true`
- **THEN** its text appears in no built file and it has no manifest entry

#### Scenario: Published article
- **WHEN** an article without `draft` is built
- **THEN** `/blog/<slug>/` renders the document page header with its category, author, published date and reading time, `/blog/` lists it newest first, and its Markdown artifact, sitemap URL, search record and retrieval chunks exist

#### Scenario: Related documentation
- **WHEN** a published article names `/getting-started/quick-start/` in `related`, and a draft names it too
- **THEN** the quick start page links the published article under "Related articles" and never the draft, and a `related` path that is not a published documentation page fails the conversion

#### Scenario: Slug of a retired route
- **WHEN** an article's slug names a retired legacy blog route, such as `welcome`
- **THEN** the conversion fails and names the file
