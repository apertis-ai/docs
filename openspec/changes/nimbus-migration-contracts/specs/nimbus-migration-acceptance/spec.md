## ADDED Requirements

### Requirement: Isolated candidate package
The Nimbus candidate SHALL live in `site-nimbus/` with its own package manifest and committed lockfile. The root Docusaurus build (`npm run build` → `build/`, which Cloudflare Pages project `docs` runs on every branch push and on `main`), root `package.json`, root lockfile, the Pages build settings and the indexing workflow and its trigger SHALL NOT change until a release step under #14 is separately authorized. The Pages Function under `functions/` stays the `/api/ask` route; #10 may refactor it on its task branch, but because merging to `main` deploys it to production, that merge is a separately authorized release that requires the old-client/new-server compatibility evidence.

The release branch (`claude/nimbus-release`, #14) is that release step, prepared but not merged. The root `npm run build` runs `scripts/nimbus/pages-build.sh`, which unshallows the clone, runs the checked candidate build and publishes `site-nimbus/dist` as `build/`. The Docusaurus build stays available as `npm run build:legacy`. The Pages build settings, the root lockfile, `index-docs.yml` and its trigger stay unchanged. The branch merges to `main` only with the operator approval that #14 Part B names.

#### Scenario: Pushed candidate branch
- **WHEN** a branch containing `site-nimbus/` is pushed
- **THEN** the Pages preview build for that branch still builds the legacy Docusaurus site and the production deployment is unaffected

### Requirement: Frozen PoC page set
The PoC SHALL convert exactly these 12 real pages: `/`, `/getting-started/quick-start`, `/authentication/api-keys`, `/billing/subscription-plans`, `/installation/claude-code`, `/installation/roocode`, `/api/`, `/api/text-generation/chat-completions`, `/api/text-generation/messages`, `/api/text-generation/responses`, `/api/text-generation/streaming`, `/api/sdks/ai-sdk-provider`. Links from these pages to routes outside the set are PoC coverage limits: `route-fixtures.json` lists them in `pocCoverageLimits` (18 targets at baseline), and `route-fixtures.mjs check --scope poc` fails any PoC-page link that is neither a PoC route nor a listed limit. Limits are never counted as passing pages.

#### Scenario: PoC link to an unconverted page
- **WHEN** `/getting-started/quick-start/` links to `/installation/models`
- **THEN** the PoC report lists that link as a known coverage limit and #13 must resolve it

### Requirement: Frozen search relevance
Every query in `migration/nimbus/search-queries.json` is critical. Under its hit rule, each `poc` query SHALL reach an expected target within the first three results on the PoC candidate, and every query SHALL do so on the full corpus in #13, measured with `scripts/nimbus/measure.mjs search` through Cmd/Ctrl+K typing and ArrowDown/Enter navigation. The legacy baseline result (`migration/nimbus/baseline/search-legacy.json`: 14 of 24 queries, 7 of 14 PoC queries, keyboard focus defect) is recorded and SHALL NOT lower the target.

#### Scenario: Candidate search run
- **WHEN** `measure.mjs search <candidate> --scope poc` runs
- **THEN** all 14 PoC queries pass and `keyboardFocus` is true

### Requirement: Frozen performance budgets
Performance SHALL be measured with the protocol in `migration/nimbus/budgets.json` (12 PoC pages, mobile and desktop profiles, 5 runs, medians, same local `wrangler pages dev` harness) Byte metrics (`jsGzip`, `cssGzip`, `dataGzip`, `searchPayloadGzip`) are compared with the recorded legacy baseline and must not exceed its median. Timing metrics (`lcp`, `tbt`, `searchOpenMs`) are compared with a legacy run taken in the same window on the same machine, legacy and candidate alternating per page, and must not exceed max(legacy median × 1.10, legacy median + 50 ms); the recorded timing baseline is informational because the shared machine's load varies. Budgets were fixed before any candidate measurement and SHALL NOT be re-derived from candidate results or relaxed without a recorded decision.

#### Scenario: One page regresses
- **WHEN** any page and profile exceeds a budget
- **THEN** the performance gate fails and no speedup claim is made

### Requirement: Evidence classes are kept apart
Acceptance reports SHALL label each result as `contract` (fixtures, stubs, mocked services), `local-build` (candidate served locally), `isolated-real` (authorized isolated environment with real services) or `production-observation` (read-only). A missing required `isolated-real` proof SHALL be reported BLOCKED. Every result SHALL name the candidate commit, `buildId` and, for retrieval, the generation id.

#### Scenario: Only mocked assistant evidence exists
- **WHEN** the assistant path has contract evidence but no isolated-real run
- **THEN** #12 records the assistant gate as BLOCKED and cannot record GO

### Requirement: Rollback identities stay available
The legacy Pages deployment `2efbe4c4-db00-4b7f-b4cd-34df32047ff2` (source `7b6ef85`) and the legacy retrieval identity in `migration/nimbus/legacy-rollback.json` (tables `documents`/`document_chunks`, both `search_docs` overloads, row counts and ordered digests) SHALL remain restorable until a release explicitly retires them. Retrieval changes SHALL be additive in the shared `ask-docs` Supabase project and SHALL NOT touch unrelated tables.

#### Scenario: Rehearsed rollback
- **WHEN** #14 rehearses a rollback
- **THEN** the site returns to a deployment serving `main.9321920d.js` or an explicitly recorded successor, and retrieval returns to the recorded legacy identity or a recorded generation, without data loss

### Requirement: Release and rollback
The release SHALL follow `migration/nimbus/release/RUNBOOK.md`. Its steps are:
- the read-only preflight `scripts/nimbus/release-preflight.mjs`;
- production `ASK_RETRIEVAL_SOURCE=legacy` before the merge, because the candidate handler fails closed without it and the legacy handler ignores it;
- one merge of the release branch to `main`;
- smoke checks against `https://docs.apertis.ai`.

Rollback is the Pages rollback to the recorded production deployment (`legacy-rollback.json` `currentProductionDeployment`), followed by reverting the merge on `main`. Retrieval needs no change, because the legacy tables are never written by the release. Production generation retrieval is a later, separately approved step.

#### Scenario: Preflight refuses an unready release
- **WHEN** the candidate is not the approved commit, CI is not green, the Pages preview build does not serve its buildId, production moved since the rollback point was recorded, or `ASK_RETRIEVAL_SOURCE` is not `legacy`
- **THEN** the preflight exits non-zero and names each failure, and nothing is changed

#### Scenario: Rehearsed release and rollback
- **WHEN** the isolated rehearsal deploys the legacy artifact with its 7b6ef85 Functions, then the candidate with `ASK_RETRIEVAL_SOURCE=legacy`, then rolls back and forward through the Pages API
- **THEN** each state serves its own identity and answers Ask Docs with citations, and a new-client request to the legacy handler is answered

### Requirement: Authority boundaries
Push, pull requests, merge, deployment, Pages or Supabase configuration, secrets, database execution beyond read-only inspection, index activation, DNS and destructive cleanup SHALL require separately established authority. Pushing any branch triggers a Pages preview build; merging to `main` deploys production and, for `docs/**` or `docs-api/**` changes, runs the production indexing workflow.

#### Scenario: Release preparation complete without operator approval
- **WHEN** #14 rehearsal passes but no explicit operator authorization exists
- **THEN** the terminal state is READY_FOR_OPERATOR and no production action is taken
