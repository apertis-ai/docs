# Nimbus release and rollback (#14)

This runbook moves `docs.apertis.ai` from the Docusaurus build to the Nimbus candidate, and back if needed. It
covers Part B of #14. Every step that changes production needs the operator approval recorded on #14, naming
this runbook, the candidate commit and the rollback point. A GO record, CI or merge readiness is not that
approval.

## Identities

| | Value | Source |
|---|---|---|
| Production Pages project | `docs` (`docs.apertis.ai`, `docs.stima.tech`, `docs-2r1.pages.dev`), production branch `main`, build `npm run build` → `build/` | `legacy-rollback.json` |
| Rollback point | deployment `ae522f1d-fcef-4eb6-9b12-20c230b95070` (`993279f`, `main.0b5ee150.js`) | `legacy-rollback.json` `currentProductionDeployment` |
| Candidate | the head of `claude/nimbus-release`, merged as one PR; its buildId is `site-nimbus/src/manifest/manifest.json` | PR to `main` |
| Retrieval | legacy tables `documents` and `document_chunks` through `search_docs`. The release does not change them. | `legacy-rollback.json` `retrieval` |

**What changes in production.**
- The release changes only:
  - the served deployment;
  - the plain-text Pages variable `ASK_RETRIEVAL_SOURCE`.
- The release does not change:
  - DNS;
  - the domains;
  - the Pages build settings;
  - the existing secrets;
  - the database.
- The merge changes nothing under `docs/` or `docs-api/`, so `index-docs.yml` does not run. After the release, `index-docs.yml` stays the only production indexer. It writes the legacy tables, which the candidate reads in `legacy` mode. Its recorded baseline defect (`legacy-index-writes-fail`) is unchanged.

## Release

1. **Preflight (read-only).** Run this from a clean checkout of the candidate:
   ```
   node scripts/nimbus/release-preflight.mjs --candidate <sha> --account <cloudflare account id>
   ```
   It passes only when all of these hold:
   - the project and its build settings are the production ones;
   - the candidate is the approved commit, is clean and pushed, and its Pages preview build serves its buildId;
   - CI is green;
   - production still serves the rollback point;
   - `ASK_RETRIEVAL_SOURCE` is `legacy`.

   Before step 2, the only failure it reports is that last one.
2. **Server first.** Set the production variable `ASK_RETRIEVAL_SOURCE=legacy` (plain text) on project `docs`.
   - The serving legacy handler ignores the variable.
   - The candidate handler fails closed without it.
   - The variable takes effect only on the next deployment, so nothing changes until step 4.
   - Undo: remove the variable.
3. **Preflight again.** Expect PASS.
4. **Merge** the release PR to `main`. Pages builds the merge commit with `scripts/nimbus/pages-build.sh`. The build fails when:
   - the committed manifest is stale (`check-build-id.mjs`);
   - the checked build fails;
   - `test:dist` fails, which includes a test Turnstile key.

   If the build fails, production keeps serving the rollback point, but the merge is on `main`. The next successful build of `main`, from any push or a retry, would publish the candidate with no one watching. Revert the merge at once (see Rollback, step 2), and release again later from a new PR.
5. **Confirm the deployment** (about 5 minutes after the build). Expect PASS:
   ```
   node scripts/nimbus/release-preflight.mjs --candidate <sha> --account <id> --after-release
   ```
   Here `<sha>` is the merged candidate commit, checked out clean.
6. **Smoke**, within 15 minutes:
   - `node scripts/nimbus/route-fixtures.mjs check https://docs.apertis.ai` passes 228/228;
   - `PLAYWRIGHT=<path to playwright 1.63.0 index.mjs> node scripts/nimbus/measure.mjs search https://docs.apertis.ai --scope full` passes 24/24 with keyboard focus (Playwright is installed outside the repository, as in the PR gates);
   - `/getting-started/quick-start.md` is `text/markdown`, and `/_nimbus/home-feed` answers GET with JSON;
   - `/openspec/`, `/migration/` and `/site-nimbus/` answer 404;
   - Ask Docs answers two questions in a real browser on `docs.apertis.ai`, through the real Turnstile widget, with citations to existing pages:
     - "How do I create an API key?"
     - "Which models support streaming?"
   - `docs.stima.tech` serves the same buildId.

## Stop and roll back

Roll back immediately when any of these happens:
- a route fixture fails;
- any HTML page or asset answers 5xx;
- search scores below 24/24;
- any planning or unpublished material is served;
- Ask Docs fails both smoke questions, after one retry each. One upstream timeout alone is not a reason, because it also occurs on legacy.
- a cited link 404s.

During the first 24 hours, watch the `apertis.ai` zone's HTTP analytics, filtered by host `docs.apertis.ai`, path and status. Pages Functions metrics are per project and count only exceptions, so they cannot show these.

Before step 4, record the previous 7 days' share of 404 responses on HTML paths and of 5xx responses on `/api/ask`. Roll back if any of these holds:
- `/api/ask` 5xx responses exceed 5% of its requests over any hour, or reach twice the recorded share;
- 404 responses on HTML paths reach twice the recorded share over any 6 hours;
- any 5xx appears on an HTML path.

**Rollback.**
1. Pages: run "Rollback to this deployment" on `ae522f1d` in the dashboard, or call the API:
   ```
   POST /accounts/<id>/pages/projects/docs/deployments/ae522f1d-fcef-4eb6-9b12-20c230b95070/rollback
   ```
   In the rehearsal the switch took 6 to 10 seconds, with no rebuild.
2. Revert the merge on `main`. Without the revert, the next push to `main` deploys the candidate again.
   - The revert itself starts a new production Docusaurus build, which replaces the rolled-back deployment. When it is live, check that it serves a legacy `main.*.js` bundle and that the baseline paths answer as before (`route-fixtures.mjs snapshot` against `migration/nimbus/baseline/live-paths.txt`). Then record it in `legacy-rollback.json` as the new `currentProductionDeployment`.
   - A later release must first revert the revert. Merging the same branch again brings nothing back.
3. Keep `ASK_RETRIEVAL_SOURCE`, since the legacy handler ignores it. Retrieval needs nothing, because the legacy tables were never written.
4. Record the trigger, the timings and the evidence on #14.

Nothing is deleted during a rollback: deployments, artifacts, tables and variables all stay.

## After the release (separate approvals)

- **Production generation retrieval.** It needs four operations:
  - apply `supabase/migrations/20260929000000_docs_generations.sql` (additive) to the production project;
  - create and activate a production generation with the indexer;
  - set `ASK_GENERATION_ENVIRONMENT` and `ASK_GENERATION_READER_TOKEN`;
  - switch `ASK_RETRIEVAL_SOURCE` to `generation`.

  To roll back, switch `ASK_RETRIEVAL_SOURCE` back to `legacy`.
- Content follow-ups decided on #4: the FAQ Playground answer, and the Ask Docs error text.

## Rehearsal (2026-10-04, isolated project `apertis-docs-nimbus-isolated-testkey`)

| Step | Served | Ask Docs |
|---|---|---|
| R1 legacy: the pinned legacy build with the 7b6ef85 Functions; legacy tables rebuilt by `isolated-legacy-retrieval.sql` and filled by the 7b6ef85 indexer | legacy bundle | 200, cites `/authentication/api-keys` and `/getting-started/quick-start` |
| R2 candidate: the release build, `ASK_RETRIEVAL_SOURCE=legacy` | candidate buildId | 200, same citations plus `/help/faq` |
| R3 Pages rollback to R1 (API) | legacy bundle after 6 s | 200 |
| R4 Pages rollback to R2 (roll forward) | candidate buildId after 10 s | 200 |
| R5 new-client request (with `pageContext`) to the R1 deployment | — | 200 |
| R6 `ASK_RETRIEVAL_SOURCE=generation`, then generation 4 → 3 → 4 | candidate buildId | 200 on generation 4; on 3, one 500 (transient upstream) then 200 twice; 200 back on 4 |

**Gaps in the rehearsal.**
- The isolated legacy tables are a reconstruction, not a copy of production.
- In the isolated run of the 7b6ef85 indexer, one of the 70 files failed on a transient Jina 503.
- The production build path was proven separately. The `docs` project built the release branch as a preview, and that preview served the candidate buildId:
  - route fixtures passed 227 of 228. The one miss is the managed `robots.txt` that every `*.pages.dev` host serves, legacy included; `docs.apertis.ai/robots.txt` answers 404.
  - search scored 24/24.
- The real Turnstile widget on `docs.apertis.ai` can only be checked after the release, in a real browser (step 6).
