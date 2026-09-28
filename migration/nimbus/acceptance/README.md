# Nimbus migration gates and PoC acceptance (issue #12)

This directory defines how the Nimbus candidate is proven. It holds:

- the PR gates;
- the isolated real-integration path;
- the activation guard;
- the gate mutants;
- the acceptance matrix;
- the paired performance gate.

The binding contract is
`openspec/changes/nimbus-migration-contracts/specs/nimbus-migration-acceptance/spec.md`. Frozen inputs
are in `migration/nimbus/` (`route-fixtures.json`, `search-queries.json`, `budgets.json`,
`fixtures/ask-wire.json`).

Nothing here deploys, pushes, writes a database or index, or needs a production credential. The only
path that touches real services is `nimbus-isolated.yml`. It runs only on explicit dispatch, and it
needs an approved GitHub Environment.

| File | What it is |
| --- | --- |
| `.github/workflows/nimbus-pr-gates.yml` | PR and push gates. Least-privileged and non-mutating. |
| `.github/workflows/nimbus-isolated.yml` | Real integration. `workflow_dispatch` only, environment `nimbus-isolated`. |
| `scripts/check-developer-activation.mjs` | Activation guard, covering the legacy roots and the candidate roots. |
| `scripts/nimbus/gate-mutants.mjs` | Injects each regression class and proves that its gate fails, then passes again after restore. |
| `scripts/nimbus/acceptance.mjs` | Runs `matrix.json` and writes one JSON record per entry. |
| `scripts/nimbus/paired-perf.mjs` | The `budgetRules` performance gate: paired legacy and candidate runs. |
| `scripts/nimbus/playwright-channel.mjs` | Playwright shim that chooses the browser channel without changing any caller. |
| `migration/nimbus/acceptance/matrix.json` | The PoC matrix: entries, evidence classes, steps. |
| `migration/nimbus/acceptance/new-client-old-server.test.ts` | The candidate wire client against the deployed legacy handler. |

`index-docs.yml`, the legacy indexing workflow, is unchanged. The `workflow-policy` entry fails if it
differs from `7b6ef85`.

## PR gates (`nimbus-pr-gates.yml`)

**Triggers.** The gates run on `pull_request`, and on `push` to `main` and `claude/nimbus-**`, when any
of these change:

- `site-nimbus/**`
- the legacy publication roots, which feed `sourceSha`: `docs/**`, `docs-api/**`, `src/**`, `blog/**`,
  `static/**`
- `functions/**`, `assistant/**`, `indexer/**`, `supabase/migrations/**`
- `migration/nimbus/**`, `scripts/**`
- the root `package*.json`
- the Docusaurus and sidebar configs
- the `nimbus-*.yml` workflows themselves

**Rules that apply to every job:**

- `permissions: contents: read`, and no secrets or environment.
- Every checkout uses `fetch-depth: 0`, because of the `sourceSha` rule from #7.
- A concurrency group per PR or ref, with `cancel-in-progress`.
- Each job builds what it checks and writes only inside its own runner.

| Job | Checks | Run it locally |
| --- | --- | --- |
| `legacy` | Root `npm ci`, `npm run build`, `npm run test:developer-activation` | the same commands at the root |
| `candidate` | `site-nimbus` clean `npm ci`, then `CI=1 npm run build` (fails on a stale manifest). Then no tracked file changed (conversion determinism), `typecheck`, `npm test` and `test:dist`. Then the activation guard again, now covering `dist/`. | the same commands in `site-nimbus/` |
| `preview` | Serves the build with the root Pages Function and no `.dev.vars`. Then `test:routes`, `route-fixtures.mjs check --scope poc`, `test:m3-browser` and `m4-e2e`. Then `measure.mjs search --scope poc`, which must report 14/14 with `keyboardFocus` true. | see [Local runs](#local-runs) |
| `assistant` | `node --test assistant/test/*.test.ts`. When `indexer/package.json` exists, it also runs the indexer tests (PGlite, no network) and the credential-free dry run. The dry run must plan every `rag`-eligible manifest entry for the manifest's `buildId`. If `indexer/` is absent, this part does not apply and does not fail. | `node --test --test-timeout=10000 'assistant/test/*.test.ts'`; `cd indexer && npm ci && node --test --test-timeout=120000 'test/*.test.ts'` |
| `gate-mutants` | `gate-mutants.mjs` (below). Afterwards the tree must be clean. | `node scripts/nimbus/gate-mutants.mjs --port <free port>` |
| `policy` | `acceptance.mjs --only workflow-policy` | same |

In CI the browser checks use Playwright's own Chromium: `PLAYWRIGHT_CHANNEL=bundled` through the
shim. Playwright `1.63.0` is installed into `$RUNNER_TEMP`, never into the repository.

## Isolated real integration (`nimbus-isolated.yml`)

This workflow is the only path that produces `isolated-real` evidence. It has not been run under #12.

**Preconditions.** An operator must set up all of the following:

- The GitHub Environment `nimbus-isolated`, with required reviewers and these secrets:
  - `NIMBUS_ISOLATED_DATABASE_URL`
  - `NIMBUS_ISOLATED_SUPABASE_URL`
  - `NIMBUS_ISOLATED_SUPABASE_SERVICE_KEY`
  - `NIMBUS_ISOLATED_JINA_API_KEY`
- An isolated Supabase project.
- An isolated, deployment-shaped preview, configured as in `indexer/README.md` "Operator contract"
  step 8. Its hostname must be allowed for Turnstile.

**Dispatch inputs:**

- `target_url`: https, not loopback, not production.
- `generation_environment`: never `production`.
- `apply_migration`: optional.
- `activate_generation`: optional.

**What the workflow does:**

1. Fails closed before anything else when the target or any secret is missing, or when `indexer/` is
   absent.
2. Builds the candidate.
3. Runs the #11 dry run, then creates a generation, then validates it (receipt and SQL state).
4. Optionally applies the migration and activates the generation, both in the isolated project only.
5. Runs `acceptance.mjs --only real-assistant,real-turnstile,real-indexing` against the target. That
   run:
   - asks one question through the real UI and the real Turnstile widget;
   - checks the streamed frames, `[DONE]` and the rendered citations;
   - requires every citation to resolve to a `rag`-eligible manifest page and to a document of the
     receipt's generation.
6. Uploads the receipts and records. They carry no keys or tokens.

Its concurrency group never cancels a running job, so a generation is never left half-created.

## Activation guard (`scripts/check-developer-activation.mjs`)

Every PR #3 root, rule and requirement is unchanged:

- the roots `docs`, `docs-api` and `src`;
- `docusaurus.config.js` and both sidebars;
- the four forbidden patterns;
- the Quick Start activation text;
- navbar register and login.

**What it now scans in addition, whenever `site-nimbus/` exists:**

- `site-nimbus/src/**` (`.astro`, `.ts`, `.tsx`, `.js`, `.jsx`, `.md`, `.mdx`, `.json`). This includes
  the generated content collection and the clean Markdown sources under `src/content/`.
- `astro.config.ts` and `nimbus.json`.
- When a build exists, `site-nimbus/dist/**` (`.md`, `.html`, `.txt`, `.xml`).
- The rendered navigation labels: inventory sidebar labels and trails, and manifest titles.

**What it now requires:**

- The Quick Start activation text in the converted render source and the clean Markdown, and in the
  built artifact when one exists.
- Create account and Log in in the candidate shell.
- When built, Create account and Log in in the `<header>` of every rendered page. Only `dist/404.html`
  is exempt: like the legacy 404 served at baseline, it renders no shell.

`gate-mutants.mjs --only activation` proves that an injected pattern in each root fails the guard with
the file named.

## Gate mutants (`scripts/nimbus/gate-mutants.mjs`)

Each mutant runs its gate three times:

1. on the pristine input, where it must pass;
2. with the regression injected, where it must fail with output that names the injection;
3. after restore, where it must pass again.

It prints `DETECTED` or `MISSED` for each mutant, and `--out` writes the result as JSON. This is
acceptance criterion 1.

| Class | Injection | Gate | Where |
| --- | --- | --- | --- |
| route | `/installation/roocode/index.html` removed | `route-fixtures.mjs check --scope poc` | temp copy of `dist`, served by `wrangler pages dev` on `--port` |
| anchor | `id="coding-model-ids"` renamed | same | same |
| exclusion | `help/ideas.md` (outside the PoC manifest), `api/ask/index.html`, or an openspec proposal written into `dist` | `test:dist` | in place, removed in `finally`, file listing verified |
| activation | one forbidden pattern per scanned root; removed activation text; removed navbar link | activation guard | hermetic temp copy |
| wire | `turnstileToken` renamed in the fixture's request body, or in the `bad-turnstile` case | `m4-wire` (client) or the assistant replay (server) | in place, restored and verified by hash |

The served mutants need `--port` to be free. Locally, stop your preview first. They never mutate a
tracked `site-nimbus` file or the inventory, because either change would move `buildId` and fail the
drift checks for the wrong reason.

## Acceptance matrix (`scripts/nimbus/acceptance.mjs`)

```sh
PLAYWRIGHT=<playwright/index.mjs or the shim> \
node scripts/nimbus/acceptance.mjs --sha <candidate> --preview http://127.0.0.1:<port> \
  --perf <paired-perf.json> --mutants <gate-mutants.json> --out records.jsonl --artifacts <dir>
```

**Refusals.** The harness refuses to run when `HEAD` is not `--sha` or when tracked files are modified.

**Identity checks.** The `candidate-identity` entry checks that the manifest, `dist` and the served
`buildId` all agree.

**Records.** Each entry in `matrix.json` becomes one JSON line with:

- `entry`, `status` (`PASS`, `FAIL` or `BLOCKED`), `evidenceClass` and `evidence`;
- `commands`: each with its exit code, test counts, the named tests, and the log file and its SHA-256;
- `candidateSha`, `buildId`, `sourceSha`, `distBuildId` and `servedBuildId`;
- artifact hashes: manifest, `dist` tree, fixtures, queries, budgets and wire fixture;
- `environment`: runner, platform, Node, browser channel, and the redacted preview origin.

Logs go to `--artifacts`. Records and logs are redacted: no environment secret values, no dotless or
`.local`/`.ts.net` hostnames, and no home or temp paths.

**PASS rule.** A `node --test` step passes only when:

- tests ran and none failed, was skipped or was cancelled;
- every named test pattern matches at least one passing test.

A skipped browser suite is therefore never a PASS. BLOCKED means the proof could not be taken in this
environment, and it is never counted as passed.

**The `isolated-real` entries** (`real-assistant`, `real-turnstile`, `real-indexing`) are BLOCKED
unless `NIMBUS_ISOLATED_URL` names a non-loopback isolated preview. `real-indexing` also needs
`--indexer-receipt`.

## Paired performance (`scripts/nimbus/paired-perf.mjs`)

```sh
PLAYWRIGHT=<...> node scripts/nimbus/paired-perf.mjs run --legacy <legacy origin> --candidate <candidate origin> --out perf.json [--page /p/ ...]
node scripts/nimbus/paired-perf.mjs gate perf.json [shard2.json ...] --out merged.json   # re-gates raw samples, no browser
```

**Sampling.** Every sample is one `measure.mjs perf <base> --runs 1 --page <p>` process, so the #5
measurement code is used unchanged. For each page, legacy and candidate alternate for 5 rounds, and the
site measured first flips every round. Both are served on the same machine in the same window.

**Gates:**

- Byte medians must be ≤ the recorded legacy median (zero tolerance).
- Timing medians must be ≤ max(paired legacy median × 1.10, paired legacy median + 50 ms).
- Candidate `keyboardFocus` must be 1 in every sample.
- `unreadableResponses` must be 0 in every sample.
- The paired legacy byte medians must equal the recorded baseline, which proves the legacy server is
  the baseline build.

**Output.** The result carries medians, the methodology, every raw sample with its 1-minute load
average, and the failures. The exit status is 0 only when every page and profile is within budget.

**Symmetric origins.** Measure the candidate through the same kind of origin as the legacy server. For
example, reach both through one hostname: the candidate preview listens on `0.0.0.0` for this.

## Local runs

```sh
# once: root and site-nimbus dependencies, and a candidate build
npm ci && (cd site-nimbus && npm ci && CI=1 npm run build)
# serve the candidate (the port is yours to choose)
(cd site-nimbus && npm run preview -- --port 8805 --ip 0.0.0.0)
export PLAYWRIGHT=<path>/playwright/index.mjs     # system Chrome, as recorded for the baseline
# or: PLAYWRIGHT=$PWD/scripts/nimbus/playwright-channel.mjs PLAYWRIGHT_MODULE=<path>/playwright/index.mjs PLAYWRIGHT_CHANNEL=bundled
node scripts/nimbus/acceptance.mjs --sha "$(git rev-parse HEAD)" --preview http://127.0.0.1:8805 --perf perf.json --mutants mutants.json
```

- The m3 and m4 suites need a `localhost` or `127.0.0.1` preview origin, because the Clipboard API
  needs a secure context.
- `npm test` skips them when `PREVIEW_URL` or `PLAYWRIGHT` is unset. The acceptance matrix runs them
  explicitly and treats a skip as not passed.

## Evidence classes

These are from the spec:

- `contract`: fixtures, stubs, mocked services.
- `local-build`: the candidate served locally by `wrangler pages dev`.
- `isolated-real`: an authorized isolated environment with real services.
- `production-observation`: read-only observation of production.

Each matrix entry carries exactly one class. Contract or local-build results never close an
`isolated-real` entry, and a missing `isolated-real` proof is BLOCKED. The spec's GO rule therefore
yields NO-GO until the isolated run passes.

## Reuse by #13 (full corpus) and #14 (release)

**#13:**

- Run the same gates. `route-fixtures.mjs check` without `--scope poc` covers every inventory route,
  and `pocCoverageLimits` goes away.
- Run `measure.mjs search` without `--scope poc` (24 queries).
- Extend `paired-perf.mjs run --page` over #13's page set. The byte budgets need recorded baselines for
  those pages first.
- Widen `matrix.json` entries by adding steps, never by removing named tests.
- The guard already scans whatever `site-nimbus/src` and `dist` contain.

**#14:**

- Dispatch `nimbus-isolated.yml` against the staging deployment.
- Rehearse rollback with the receipts it uploads (`previous_generation_id`).
- Run `acceptance.mjs` against the release candidate SHA.

The PR gates stay as they are. Production indexing and release remain outside every workflow here
until M9 authorization.
