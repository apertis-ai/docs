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
| `legacy` | Root `npm ci`, `npm run build:legacy` (Docusaurus; the root `npm run build` builds the candidate since the release branch), `npm run test:developer-activation` | the same commands at the root |
| `candidate` | `site-nimbus` clean `npm ci`, then `CI=1 npm run build` (fails on a stale manifest). Then no tracked file changed (conversion determinism), `typecheck`, `npm test` and `test:dist`. Then the activation guard again, now covering `dist/`. | the same commands in `site-nimbus/` |
| `preview` | Serves the build with the root Pages Function and no `.dev.vars`. Then `test:routes`, `route-fixtures.mjs check --scope poc` and then without `--scope` (all 228 rows), `test:m3-browser` and `m4-e2e`. Then `measure.mjs search --scope poc`, which must report 14/14 with `keyboardFocus` true. | see [Local runs](#local-runs) |
| `assistant` | `node --test assistant/test/*.test.ts`, then `new-client-old-server.test.ts` (the candidate wire client against the deployed legacy handler). When `indexer/package.json` exists, it also runs the indexer tests (PGlite, no network) and the credential-free dry run. The dry run must plan every `rag`-eligible manifest entry for the manifest's `buildId`. If `indexer/` is absent, this part does not apply and does not fail. | `node --test --test-timeout=10000 'assistant/test/*.test.ts'`; `node --test migration/nimbus/acceptance/new-client-old-server.test.ts`; `cd indexer && npm ci && node --test --test-timeout=120000 'test/*.test.ts'` |
| `gate-mutants` | `gate-mutants.mjs` (below). Afterwards the tree must be clean. | `node scripts/nimbus/gate-mutants.mjs --port <free port>` |
| `policy` | `acceptance.mjs --only workflow-policy` | same |

In CI the browser checks use Playwright's own full Chromium in new headless mode: `PLAYWRIGHT_CHANNEL=chromium`
through the shim. The headless shell (`bundled`) cannot synthesize touch scrolling, and the mobile scroll-lock
check proves that with a control step. Playwright `1.63.0` is installed into `$RUNNER_TEMP`, never into the repository.

## Isolated real integration (`nimbus-isolated.yml`)

This workflow is the only CI path that produces `isolated-real` evidence. It has not been dispatched yet:
it can only run from a protected branch. The same harness run by the lead against the isolated
previews is recorded on #12.

**Two previews (operator decision on #12, options b + c).** A real Turnstile widget never issues a token
to an automated browser, headless or headed, so one preview cannot prove both halves:

- The **real-key preview** (`target_url`) carries the real sitekey and secret. `real-turnstile` is
  judged there without a browser token. It passes only when:
  - the page renders the widget with a non-test sitekey;
  - `/api/ask` without a token answers 400 `Missing Turnstile token`;
  - a forged token answers 403 `Turnstile verification failed`, carrying siteverify's
    `invalid-input-response` code.
- The **always-pass preview** (`always_pass_target_url`) serves the same build and reads the same
  generation environment. It uses Cloudflare's always-pass test secret
  (`1x0000000000000000000000000000000AA`).
  - The harness renders the real widget script with the always-pass test sitekey
    (`1x00000000000000000000AA`). It does this through an init script, because the candidate hard-codes
    the production sitekey.
  - `real-assistant` and `real-indexing` then drive the real handler, Jina, the isolated Supabase
    generation and the Apertis completion end to end.
  - There the dummy token is required, which labels the path instead of hiding it.

The only fact left to a person is that a real widget token validates. It was observed once in a real
browser and recorded on #12 as `manual-real-browser` evidence. It is not a matrix entry.

**Preconditions.** An operator must set up all of the following:

- The GitHub Environment `nimbus-isolated`, with required reviewers. It must restrict deployment
  branches to protected branches, so no unreviewed branch can reach its secrets. It holds:
  - the secrets `NIMBUS_ISOLATED_DATABASE_URL`, `NIMBUS_ISOLATED_SUPABASE_URL`,
    `NIMBUS_ISOLATED_SUPABASE_SERVICE_KEY` and `NIMBUS_ISOLATED_JINA_API_KEY`;
  - the non-secret variables `NIMBUS_ISOLATED_HOST` (the one allowed target host) and
    `NIMBUS_PRODUCTION_PROJECT_REF` (the production Supabase project ref, which is denied).
- An isolated Supabase project.
- Two isolated, deployment-shaped previews of the same build, both configured as in
  `indexer/README.md` "Operator contract" step 8:
  - the real-key preview, whose hostname must be allowed for the real sitekey, with the real secret;
  - the always-pass preview, whose `TURNSTILE_SECRET_KEY` is Cloudflare's always-pass test secret.
    Every other binding is the same as the real-key preview's.
  - The non-secret variable `NIMBUS_ISOLATED_ALWAYS_PASS_HOST` names the always-pass preview's host.

**Dispatch inputs:**

- `target_url`: https; its host must equal `NIMBUS_ISOLATED_HOST`.
- `always_pass_target_url`: https; its host must equal `NIMBUS_ISOLATED_ALWAYS_PASS_HOST`, and it must
  differ from `target_url`'s host.
- `generation_environment`: never `production`.
- `preview_generation_environment`: the preview's `ASK_GENERATION_ENVIRONMENT` binding, confirmed by
  the operator. It must equal `generation_environment`, and both are recorded.
- `apply_migration`: optional.
- `activate_generation` (default true), or `generation_already_active` as an explicit confirmation.
  One of the two is required.

**What the workflow does:**

Every step runs under `bash -euo pipefail`.

1. Checks out, then fails closed before anything else (`scripts/nimbus/isolated-preflight.mjs`) when:
   - the target, a secret or a variable is missing;
   - a target host is not exactly its allowlisted host (a trailing dot is ignored), or the two targets
     are the same host;
   - the target is a production host from `legacy-rollback.json` (`docs.apertis.ai`,
     `docs.stima.tech`, `docs-2r1.pages.dev` and its deployment subdomains), an `apertis.ai` host,
     `0.0.0.0` or loopback;
   - `DATABASE_URL` and `SUPABASE_URL` are not the same Supabase project, or that project is
     `NIMBUS_PRODUCTION_PROJECT_REF`;
   - the generation environments differ, or neither activation nor the confirmation is given;
   - `indexer/` is absent.
2. Builds the candidate.
3. Runs the #11 dry run, then creates a generation, then validates it (receipt and SQL state).
4. Optionally applies the migration. Activates the generation in the isolated project unless the
   operator confirmed it is already active.
5. Runs `acceptance.mjs --only real-assistant,real-turnstile,real-indexing` against the target
   (judged by `scripts/nimbus/real-evidence.mjs`). Each entry PASSes only when:
   - the entry's preview serves the candidate's `buildId` in its `apertis-docs:build` meta (else FAIL);
   - the two generation environments are stated and equal;
   - `docs_generation_slots`, read after the probe, names the receipt's generation as active (a
     mismatch is FAIL; unreadable is BLOCKED);
   - for `real-turnstile` (real-key preview): the enforcement facts above;
   - for the answer (always-pass preview): the probe used the always-pass test sitekey, sent the dummy
     token, and `/api/ask` answered 200;
   - for the answer: frames stream to `[DONE]`, and every citation is a `rag`-eligible manifest page
     and a document of the receipt's generation.
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

It prints `DETECTED` or `MISSED` for each mutant, and `--out` writes the result as JSON with the HEAD
commit and manifest `buildId` it ran against; the acceptance `gate-mutants` entry fails when either
differs from the candidate. This is acceptance criterion 1.

| Class | Injection | Gate | Where |
| --- | --- | --- | --- |
| route | `/installation/roocode/index.html` removed | `route-fixtures.mjs check --scope poc` | temp copy of `dist`, served by `wrangler pages dev` on `--port` |
| anchor | `id="coding-model-ids"` renamed | same | same |
| exclusion | `help/ideas.md` (outside the PoC manifest), `api/ask/index.html`, or an openspec proposal written into `dist` | `test:dist` | in place, removed in `finally`, file listing verified |
| activation | one forbidden pattern per scanned root; removed activation text; removed navbar link | activation guard | hermetic temp copy |
| wire | `turnstileToken` renamed in the fixture's request body, or in the `bad-turnstile` case | `m4-wire` (client) or the assistant replay (server) | in place, restored and verified by hash |
| policy | default shell without pipefail/errexit, unpinned action, `pull_request_target`, write permission, a dropped path filter, environment, preflight or fail-closed variable, README without the protected-branch rule | `workflow-policy.mjs` | temp copy of the workflows and README |
| preflight | target host not allowlisted, production or `pages.dev` production host, `0.0.0.0`, allowlist unset, database/Supabase URL in different projects, production project, production ref unset, environment mismatch, no activation or confirmation, http | `isolated-preflight.mjs` | synthetic, secret-free environment |
| real | preview serving another or no buildId, another/none/unreadable active generation, preview environment mismatch, citation outside the generation, Turnstile test sitekey, dummy token, unobserved sitekey, unready generation | `real-evidence.mjs` | synthetic facts |
| perfgate | missing page, profile or run, no samples, candidate build mismatch or unrecorded, legacy server change, extra page, byte and timing exceedance | `paired-perf.mjs gate` | synthetic samples at the recorded baseline |

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
unless `NIMBUS_ISOLATED_URL` names a non-loopback isolated preview and `--indexer-receipt` names the
generation it serves. Every `real-*` record carries that `generationId`, and every cited page must be a
document of that generation.

## Paired performance (`scripts/nimbus/paired-perf.mjs`)

```sh
PLAYWRIGHT=<...> PAKO=<pako/index.js> node scripts/nimbus/paired-perf.mjs run --legacy <legacy origin> --candidate <candidate origin> --build-id <candidate buildId> --out perf.json [--page /p/ ...]
node scripts/nimbus/paired-perf.mjs gate perf.json [shard2.json ...] --build-id <candidate buildId> --out merged.json   # re-gates raw samples, no browser
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
- The samples must cover exactly `budgets.protocol.pages`, both profiles and 5 runs per side. Empty or
  partial sample sets fail.
- Before every sample, each side's `/` is read: the candidate's `apertis-docs:build` meta must equal
  `--build-id` in every candidate sample (acceptance passes the manifest's), and the legacy samples
  must all serve one main bundle.

**Output.** The result carries medians, the methodology, every raw sample with its 1-minute load
average, and the failures. The exit status is 0 only when every page and profile is within budget.

**Symmetric origins.** Measure the candidate through the same kind of origin as the legacy server. For
example, reach both through one hostname: the candidate preview listens on `0.0.0.0` for this.

## Paired performance in CI (`.github/workflows/nimbus-paired-perf.yml`)

The full published page set takes about 5.5 hours on one machine: every page is 5 alternating rounds per
side and two profiles, and the mobile profile downloads every response at 200 KB/s. The workflow splits
the page set, not the protocol, across 12 GitHub-hosted runners:

- `legacy` downloads the recorded legacy build from the `nimbus-legacy-baseline` release and refuses it
  unless its sha256 equals `migration/nimbus/legacy-baseline.sha256`. It is not rebuilt: webpack module
  ids and the search index order depend on the build machine, so a Linux rebuild of `baseSha` differs
  from the recorded baseline (about 1 KB of JS, 2 KB of search payload). `candidate` builds the
  checked-out commit.
- Each `shard` runner serves both builds itself (legacy on 8791, the candidate with the root Pages
  Function on 8806) and runs `paired-perf.mjs run` for pages `i, i + 12, ...` with system Google Chrome.
  Legacy and candidate are therefore still paired on one machine in one window, and no shard shares a
  CPU with another. A page whose run produces no valid samples is retried up to 3 times; a page with
  none after that fails the shard.
- Byte metrics are gzip level 9 sizes computed with pako 2.1.0 (`PAKO`, installed outside the
  repository like Playwright). `node:zlib` depends on how Node was built: the recorded baseline came from
  Homebrew Node, which links macOS libz 1.2.12, while the official binaries (CI) bundle Chromium zlib
  1.3.1, and the legacy CSS gzips to 25,887 and 25,892 bytes respectively. pako reproduces the macOS libz
  sizes byte for byte (447 legacy and candidate assets, 0 differences), so the recorded baseline holds
  on any platform.
- `gate` re-gates every raw sample with `paired-perf.mjs gate --set full`, then the PoC pages out of the
  same samples with `--set poc`, and uploads `paired-perf-first-run`.
- **One re-measure for timing (operator decision on #4, 2026-10-02).** Timing on shared GitHub-hosted
  runners varies between runs of the same build (desktop `/installation/bolt_diy/` LCP: candidate
  median 248 ms in one run, 364 ms in the next, limit 358). When every failure of the first run is a
  timing exceedance (`lcp`, `tbt`, `searchOpenMs`) on at most 7 pages
  (`scripts/nimbus/paired-perf-remeasure.mjs`), `remeasure` measures those pages again in full (5
  alternating rounds, both profiles) on a fresh runner. `verdict` then gates the re-measured samples in
  place of the first ones. A second exceedance fails. Bytes, legacy identity, coverage and invalid
  samples are never re-measured. Both runs stay in the artifacts (`paired-perf-first-run`,
  `perf-remeasure`); `verdict` uploads `paired-perf-result` and names the re-measured pages.
- `scripts/nimbus/paired-perf-ci.sh` is one runner's work (serve both sites, measure the given pages),
  shared by `shard` and `remeasure`.

It runs on pull requests that touch the candidate, the Pages Function, the budgets or the two perf scripts,
and on `workflow_dispatch` once the workflow is on the default branch. It uses no secrets. The legacy
byte medians must still equal the recorded baseline, so a legacy build that differs from the baseline
fails the gate rather than shifting it.

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

**#13:** three matrix entries widen the PoC gates over the full corpus, added rather than replacing any
PoC entry:

- `route-fixtures-full-corpus` runs `route-fixtures.mjs check` without `--scope poc`: every inventory
  route (228/228), and `pocCoverageLimits` does not apply outside the PoC scope.
- `search-relevance-full-corpus` runs `measure.mjs search` without `--scope poc` (all 24 queries,
  `search-queries.json`). Ranking over the wider corpus is a separate repair (#9); this entry may FAIL
  until that lands, and it is reported, not silently accepted.
- `performance-budgets-full-corpus` runs `paired-perf.mjs gate --set full` over `budgets.json`
  `fullCorpus.pages`. `fullCorpus.baseline` is `null` until the legacy full-corpus byte baseline is
  recorded; until then this entry is BLOCKED (no `--perf-full` supplied to `acceptance.mjs`) or FAIL
  (supplied but every page fails "no recorded byte baseline"), never PASS.
- The guard already scans whatever `site-nimbus/src` and `dist` contain.
- `acceptance.mjs` takes `--perf-full <result.json> ...` alongside `--perf` to gate this entry.

**#14:**

- Dispatch `nimbus-isolated.yml` against the staging deployment.
- Rehearse rollback with the receipts it uploads (`previous_generation_id`).
- Run `acceptance.mjs` against the release candidate SHA.

The PR gates stay as they are. Production indexing and release remain outside every workflow here
until M9 authorization.
