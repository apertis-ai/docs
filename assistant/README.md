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
stripping. It also needs `git`, because the legacy sources are read from commit `7b6ef85`.

```sh
node --test --test-timeout=10000 'assistant/test/*.test.ts'
```

The tests use no network. `harness.ts` replaces Turnstile, Jina, Supabase and Apertis with one fake
`fetch`, which throws on any other URL.

### Harness for #9: new client against the old server

`harness.ts` provides everything needed to exercise the deployed server without it:

- `loadLegacyHandler()` loads the deployed server (`functions/api/ask.ts` at `7b6ef85`, deployment `2efbe4c4`).
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
| `ASK_RETRIEVAL_SOURCE` | **New.** Selects the retrieval source. The only accepted value today is `legacy`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Required when `ASK_RETRIEVAL_SOURCE=legacy` |

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

- **`legacy`** calls the existing three-argument `search_docs(query_embedding, match_count 5, similarity_threshold 0.3)` through `@supabase/supabase-js`, exactly as `7b6ef85` does.
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

`npx wrangler pages functions build --outdir <tmp> --output-routes-path <tmp>/_routes.json` shows that
`/api/ask` is the only function route.

The Turnstile secret above is Cloudflare's documented always-fail test secret, so the flow stops at 403
before any paid call. Do not use the always-pass secret here: the next hop is the real Jina URL.

Real isolated-service evidence needs operator-provisioned isolated bindings. Until then it is BLOCKED.
Mocked and local runs are contract evidence only.
