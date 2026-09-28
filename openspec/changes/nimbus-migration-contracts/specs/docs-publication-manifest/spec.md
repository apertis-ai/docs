## ADDED Requirements

### Requirement: One build-time publication manifest
Each candidate build SHALL produce exactly one publication manifest (v1) that every downstream consumer — HTML metadata, Markdown artifacts and page actions, local search, llms outputs, sitemap and the retrieval indexer — reads. No consumer SHALL re-derive identity, canonical URL or eligibility from file paths. #6 defines the single TypeScript type and file location in `site-nimbus/`; #7 produces the manifest; no sibling defines a second schema.

#### Scenario: Indexer needs a citation URL
- **WHEN** the retrieval indexer (#11) builds chunks for a document
- **THEN** it takes `canonicalUrl`, `title` and `id` from the manifest entry and never computes a URL from `sourcePath`

### Requirement: Manifest v1 fields
The manifest SHALL have top-level `manifestVersion: 1`, `site` (`https://docs.apertis.ai`), `sourceSha` (40-hex commit of the legacy content the candidate was generated from), `buildId` (identifies the build inputs: `<sourceSha>.<first 12 hex of SHA-256 over the candidate package lockfile and converter sources>`, so identical inputs give the same id and any input change gives a new one) and `documents`. Entries exist for inventory rows of kind `doc`, `page` and `blog-post`. Generated routes (blog listings, tags, authors, feeds, sitemap, `/search`), static assets and runtime paths are governed by their inventory rows and have no manifest entry. Each document SHALL have:
- `id`: stable document identity, the plugin-qualified legacy id from `route-inventory.json` (`default:<doc id>`, `api:<doc id>`, `page:<name>`, `blog:<slug>`); a rename or move keeps the id and changes `sourcePath`.
- `sourcePath`: repository-relative legacy source path.
- `servedPath`: the path that answers `200` (for example `/getting-started/quick-start/`).
- `canonicalUrl`: the absolute canonical exactly as recorded in the inventory.
- `title`: the document title as rendered in the page `<title>` before the site suffix.
- `eligibility`: `{ publish, search, agent, rag }` booleans.
- `markdown`: `{ path, sha256 }` for `agent`-eligible documents, else `null`; `path` is `<canonical path>.md`, with `/index.md` for slash-canonical documents (`/getting-started/quick-start.md`, `/api/index.md`, `/api/sdks/python-sdk/index.md`).
- `contentSha256`: SHA-256 of the clean Markdown bytes (equal to `markdown.sha256`) or, for entries without Markdown, of the text content of the page's `<main>` element with whitespace runs collapsed to one space and trimmed, encoded as UTF-8.

#### Scenario: Validation
- **WHEN** the manifest is validated
- **THEN** `id`, `servedPath` and `canonicalUrl` are each unique, every `markdown.path` exists in the build output with the recorded hash, no entry maps to `/api/ask`, and every entry's eligibility equals its inventory row

### Requirement: Deterministic regeneration
Generating the manifest and candidate content twice from the same `sourceSha` and converter SHALL produce byte-identical manifest and artifacts. Legacy content stays authoritative: candidate content is regenerated from it, never edited independently.

#### Scenario: Rebuild
- **WHEN** the converter runs twice on the same source commit
- **THEN** the manifest digest and every artifact hash are identical

### Requirement: Build identity is traceable
Every published HTML page SHALL carry `<meta name="apertis-docs:build" content="<buildId>">` and `<meta name="apertis-docs:id" content="<id>">`. The manifest itself is a build artifact and SHALL NOT be deployed publicly unless it is filtered to `publish`-eligible entries.

#### Scenario: Match HTML to its Markdown
- **WHEN** a reviewer opens a candidate page and its `.md` artifact
- **THEN** the page's build meta equals the manifest `buildId` and the `.md` bytes hash to the manifest `markdown.sha256`
