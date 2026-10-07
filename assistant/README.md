# Ask Docs service

Framework-independent service behind `POST /api/ask`. `functions/api/ask.ts` is only the Cloudflare
Pages adapter. It exports `onRequestPost` and `onRequestOptions`, so `GET /api/ask` falls through to the
static 404. This directory is outside `functions/`, so none of these files becomes a public route.

The wire contract is `migration/nimbus/fixtures/ask-wire.json`. The binding spec is
`openspec/changes/nimbus-migration-contracts/specs/ask-docs-api/spec.md`.

| File | Contents |
|---|---|
| `service.ts` | `handleAsk(request, env, deps?)`, `handleOptions()`, `normalizePageContext()` and the limits |
| `retrieval.ts` | The retrieval interface: `Retrieval`, `RetrievalRow`, `RetrievalQuery`, `RetrievalEnv`, `createRetrieval(env, fetch?)`, `RetrievalConfigError` and `RetrievalError` |
| `test/` | Contract replay, compatibility, failure-path and retrieval tests, plus `harness.ts` |

## Test

Run this from the repository root, after `npm ci`. It needs Node 25 or later, which runs `.ts` by type
stripping. It also needs `git`, because the legacy sources are read from commit `bb057a7`.

```sh
node --test --test-timeout=10000 'assistant/test/*.test.ts'
```

The tests use no network. `harness.ts` replaces Turnstile, Jina, Supabase and Apertis with one fake
`fetch`, which throws on any other URL.

### Harness for #9: new client against the old server

`harness.ts` provides everything needed to exercise the deployed server without it:

- `loadLegacyHandler()` loads the deployed server (`functions/api/ask.ts` at `bb057a7`, deployment `2efbe4c4`).
- `loadLegacyClient()` loads the deployed client's real `handleSubmit` from `AskAITab.tsx`.
- `providers(script)` returns the doubles.

The legacy handler calls the global `fetch`, so run it inside `withGlobalFetch`:

```ts
const legacy = await loadLegacyHandler()
const p = providers({ apertis: { chunks: [UPSTREAM_OK] } })
const res = await withGlobalFetch(p.fetch, async () => {
  const r = await legacy.onRequestPost({ request, env: ENV })
  return new Response(await readAll(r), r) // consume the stream inside the stub
})
```

## Server configuration (names only, never values)

| Binding | Used for |
|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile siteverify |
| `JINA_API_KEY` | Query embedding with `jina-embeddings-v4`, 1024 dimensions, `retrieval.query` |
| `APERTIS_API_KEY`, `APERTIS_BASE_URL`, `APERTIS_MODEL` | Streamed chat completion |
| `ASK_RETRIEVAL_SOURCE` | **New.** Selects the retrieval source: `legacy` or `generation` (#11, see below). Any other value fails closed. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Required for both sources |
| `ASK_GENERATION_ENVIRONMENT`, `ASK_GENERATION_READER_TOKEN` | Required when `ASK_RETRIEVAL_SOURCE=generation` |

If any required binding is missing, every POST answers `500 {"error":"Server configuration error"}`.
The same happens when `ASK_RETRIEVAL_SOURCE` is missing or has an unknown value. This check runs before
validation and before any provider call. There is no default and no fallback.

> **Release prerequisite:** production today has only the seven legacy secrets. `ASK_RETRIEVAL_SOURCE=legacy`
> must be added to the production environment **before** this adapter is merged to `main`. Otherwise
> Ask Docs answers 500 in production.

### Retrieval

The source is chosen only from server environment configuration. `createRetrieval(env, fetch?)` never
receives the request, so no body field, header, cookie or query parameter can choose the source.
`test/retrieval.test.ts` checks this.

- **`legacy`** calls the existing three-argument `search_docs(query_embedding, match_count 5, similarity_threshold 0.3)` through `@supabase/supabase-js`, exactly as `bb057a7` does.
  - `SUPABASE_URL` decides which project is read.
  - An isolated preview or staging environment must point `SUPABASE_URL` at isolated data.
- **#11 seam:** `retrieval.ts` has a marked `switch` case where a generation-aware adapter plugs in.
  - It builds a `Retrieval` from its own server-side bindings.
  - It throws `RetrievalConfigError` when those bindings are missing.
  - It never falls back to `legacy`.

## Limits and known limitations

- **Request body:** at most 64 KiB (`413 {"error":"Request body too large"}`).
- **Question:** 1 to 2000 characters.
- **`sessionId`:** a string of 1 to 128 characters.
- **`pageContext`:** normalized to a 120-character title and a 240-character href. The object is dropped
  unless the href starts with `/` and not `//`. It is untrusted text only; it is never fetched and never
  proves that a page may be cited.
- **Timeouts:**

  | Call | Timeout |
  |---|---|
  | Turnstile | 10 s |
  | Jina | 15 s |
  | Retrieval | 15 s |
  | Apertis, including the whole relayed stream | 120 s |

  Client cancellation aborts the in-flight provider call and cancels the upstream stream.
- **Stream termination:** `data: [DONE]` is sent exactly once, and only when the upstream sent `[DONE]`.
  - Content after `[DONE]` is dropped, and the upstream is cancelled.
  - These all end the stream the same way: an upstream error, an in-band `error` frame, a timeout, or
    an upstream EOF without `[DONE]` (possibly a truncated answer).
  - Each sends one `data: {"error":"Upstream stream interrupted","traceId":…}` frame with no `content`
    key, then closes without `[DONE]`.
  - Legacy clients keep the partial answer.
- **Session counter, a known limitation and not abuse protection:** at most 20 questions per `sessionId`,
  counted in an in-memory `Map` that is local to one isolate.
  - The counter resets on cold start and is not shared between isolates.
  - The client chooses the `sessionId`, so a new id resets the count.
  - The `Map` is unbounded for the life of the isolate.
  - Abuse protection relies on Turnstile and this counter only. Any stronger protection is an operator
    control (a Cloudflare rate-limiting rule) or separately approved work.

## Local Pages integration

Real providers are not called. `.dev.vars` holds fake placeholders only. It is untracked; delete it
afterwards.

```sh
npm ci && npm run build
printf '%s\n' TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA JINA_API_KEY=fake-jina \
  APERTIS_API_KEY=fake-apertis APERTIS_BASE_URL=https://apertis.invalid/v1 APERTIS_MODEL=fake-model \
  SUPABASE_URL=https://supabase.invalid SUPABASE_ANON_KEY=fake-anon ASK_RETRIEVAL_SOURCE=legacy > .dev.vars
npx wrangler pages dev build --compatibility-date=2026-01-05 --port 8847 --inspector-port 9847 --ip 127.0.0.1 &
assistant/pages-probe.sh http://127.0.0.1:8847 configured
# stop the server, drop ASK_RETRIEVAL_SOURCE from .dev.vars, restart, then:
assistant/pages-probe.sh http://127.0.0.1:8847 unconfigured
rm .dev.vars
```

`pages-probe.sh` exits non-zero on any mismatch. In `configured` mode it checks:

- every 400 body recorded in `ask-wire.json`, plus a `null` body
- the 413 body cap
- the 403 Turnstile failure, which uses the always-fail test secret
- `GET /api/ask` returns the static 404
- `OPTIONS /api/ask` returns the CORS preflight
- `/api/` and `/api/text-generation/chat-completions/` are still served as static HTML

In `unconfigured` mode it checks the fail-closed `500 Server configuration error` instead of the 400s.

## Ask Docs in the local preview (real answers)

`npm run preview:ask` (site-nimbus) serves the built candidate like `npm run preview`, with the Ask Docs
bindings read from the file `ASK_ENV_FILE` names. `wrangler pages dev` does not bind an `--env-file` itself:
it loads the file into its own environment, so the script starts wrangler with an empty environment (`env -i`,
only `PATH` and `HOME`) and binds that environment (`CLOUDFLARE_INCLUDE_PROCESS_ENV`). A `.dev.vars` in the
repository root takes precedence over all of this; remove it first. The file holds KEY=VALUE lines
(`JINA_API_KEY`, `APERTIS_API_KEY`, `APERTIS_BASE_URL` ending in `/v1`, `APERTIS_MODEL`,
`ASK_RETRIEVAL_SOURCE`, and that source's retrieval bindings, such as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ASK_GENERATION_ENVIRONMENT` and
`ASK_GENERATION_READER_TOKEN`). Point it at isolated (non-production) bindings; questions call the real
model and embedding providers. It must be a regular file (wrangler reads it twice, so a pipe or process
substitution hangs); keep it outside the repository with mode 600. To reach the preview from another
machine (a tailnet host), add `-- --ip 0.0.0.0 --port 8811`.

Turnstile: build with `npm run build:ask` first. It names Cloudflare's always-pass test sitekey in
`PUBLIC_TURNSTILE_SITEKEY` (`turnstileSiteKey`, `site-nimbus/src/components/assistant/wire.ts`), because local
hosts are not on the real sitekey's domain list; `preview:ask` binds the matching always-pass test secret. Every
other build (CI, deployments) ships the real sitekey, and `npm run test:dist` fails on a build that carries a
test sitekey, so run `npm run build` again before it.

`npx wrangler pages functions build --outdir <tmp> --output-routes-path <tmp>/_routes.json` shows that
`/api/ask` and `/_nimbus/home-feed` (the homepage's live models and release notes,
`functions/_nimbus/home-feed.ts`) are the only function routes.

The Turnstile secret above is Cloudflare's documented always-fail test secret, so the flow stops at 403
before any paid call. Do not use the always-pass secret here: the next hop is the real Jina URL.

Real isolated-service evidence needs operator-provisioned isolated bindings. Until then it is BLOCKED.
Mocked and local runs are contract evidence only.

## #11

**`ASK_RETRIEVAL_SOURCE=generation`** serves the active `ready` generation of one environment through
`search_docs_generation`. The adapter is `retrieval-generation.ts`. The schema and the operator contract are
in `indexer/README.md`.

| Binding | Used for |
|---|---|
| `ASK_GENERATION_ENVIRONMENT` | The environment whose active generation is served, for example `preview`. It must match `^[a-z][a-z0-9-]{0,31}$`. |
| `ASK_GENERATION_READER_TOKEN` | That environment's reader secret, at least 32 characters. The database stores only its SHA-256. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | The project that holds the generations. The anon key alone cannot read any generation. |

- **Configuration.** A missing or invalid binding throws `RetrievalConfigError` when the retrieval is created. The handler then answers the usual `500 {"error":"Server configuration error"}` before any provider call.
- **Selection.** The database resolves the active generation itself. No request field, header, cookie or query parameter reaches the call, and there is no generation-id argument at all.
- **Refusals.** These all throw `RetrievalError` with the database code:
  - a null or short secret (under 32 characters), an unknown environment or a wrong secret (`42501`), checked in the database too;
  - a `match_count` below 1 or a `similarity_threshold` outside [-1, 1] (`22023`); `match_count` is capped at 20;
  - no active generation (`P0002`);
  - an active generation that is not ready or belongs to another environment (`P0003`).

  Rows from another environment or from more than one generation throw `FOREIGN_GENERATION`. None of these falls back to `legacy`.
- **Result rows.** Rows keep the `{title, url_path, content, similarity}` shape, the 0.3 threshold and the 5 matches. `url_path` is the pathname of the document's manifest `canonicalUrl` in that release, so `service.ts` is unchanged.
- **Tests.** `test/retrieval-generation.test.ts` covers the adapter and the handler path. `indexer/test/retrieval.test.ts` drives the same `createRetrieval` against the local replica as `anon`.
