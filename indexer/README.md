# Documentation indexer (#11)

Builds an isolated retrieval **generation** from the #7 publication manifest. It replaces nothing yet:
`scripts/index-docs.ts`, `.github/workflows/index-docs.yml`, the legacy tables and both `search_docs`
overloads stay exactly as they are until M7/M9 decide the transition.

| File | Contents |
|---|---|
| `index.ts` | CLI, the Jina embedder and the PostgREST client |
| `indexer.ts` | `plan()` (read and validate, no writes) and `run()` (write one generation) |
| `chunker.ts` | Fence-aware heading chunker with citation anchors |
| `../supabase/migrations/20260929000000_docs_generations.sql` | Additive schema, functions and grants |
| `../supabase/migrations/rollback/20260929000000_docs_generations.down.sql` | Its rollback |
| `test/` | Local proof against a PGlite replica of the production schema |

## What it reads

- Only `site-nimbus/src/manifest/manifest.json`, and the clean Markdown artifact at each `markdown.path` inside a built `site-nimbus/dist`.
- Only entries with `eligibility.rag === true` are indexed. The others are listed as `excluded` in the receipt.
- Each artifact's SHA-256 must equal `markdown.sha256`. Any mismatch fails the whole plan.
- The identity is the manifest `id`. `title` comes from the manifest, and `url_path` is the pathname of `canonicalUrl` (`/api/` keeps its slash).
- Nothing is derived from file paths. `.mdx` sources are covered, because #7 emits them as clean Markdown.
- These are all hard failures:
  - a duplicate `id` or `canonicalUrl`;
  - a missing, empty or out-of-tree artifact;
  - the reserved `/api/ask`;
  - a chunk anchor that is not a heading id of the built page.

## Chunking

- Same shape as the legacy indexer:
  - H2/H3 sections;
  - paragraphs packed up to 1500 characters;
  - a `Title > Heading` prefix.
- Fenced code is opaque. `#` lines inside a fence are not headings, and a fence is never split or dropped. A fence longer than the limit becomes a chunk of its own.
- Every chunk records its citation anchor:
  - the section's heading id, computed like the page (github-slugger with dedupe);
  - for text before the first section, the page's H1 id.
- `plan()` checks every anchor against the ids in the built HTML page.
- `CHUNKER_VERSION` (`m6-chunker-1`) is part of the embedding-cache identity.

## Generations (the migration)

| Object | Purpose |
|---|---|
| `docs_generations` | One row per attempt: `(environment, build_id)`, `building → ready`, or `failed`. Rows are never deleted. |
| `docs_generation_documents` | The plan, one row per rag-eligible document (`pending → complete`), with expected chunk count and hashes |
| `docs_generation_chunks` | `vector(1024)` chunks with `content_sha256` and `anchor` |
| `docs_generation_slots` | Per environment: the reader-secret hash, the active generation and the previous one |
| `docs_generation_begin/put_document/finish/fail`, `docs_embedding_cache_lookup` | Indexer functions (`service_role` only) |
| `docs_generation_activate`, `docs_generation_set_reader` | Operator functions. Only the owner (`postgres`) can run them; no API role can. |
| `search_docs_generation(query_embedding, match_count, similarity_threshold, target_environment, reader_token)` | The only reader: `anon`, `authenticated` and `service_role` may execute it |

### Guards

- **One live run per build.** A partial unique index allows only one `building` or `ready` generation per `(environment, build_id)`. A second concurrent run is refused.
- **Leases.** Every write needs the run's token and an unexpired lease (15 minutes, renewed by each document).
  - A killed run's generation blocks retries until its lease expires.
  - After that, the next run marks it `failed` and starts a new generation.
  - The killed run can never write again.
- **Atomic documents.** `put_document` writes all of a document's chunks and marks it `complete` in one transaction.
  - It first checks the planned count, the per-chunk hashes and the dimensions.
  - A failure leaves no partial chunks and no advanced state.
- **Validated readiness.** `finish` re-validates every document, every count and every hash, then sets `ready`. Otherwise it raises and changes nothing.
- **Embedding reuse.** Embeddings are reused only from `complete` documents with an equal `content_sha256`, `chunker_version` and embedding identity (model, task and dimensions). A failed run's completed documents count; its pending ones never do.
- **Privileges.** Supabase default grants are explicitly revoked on the new tables, including TRUNCATE, and on the new functions (EXECUTE from PUBLIC).
  - `anon` and `authenticated` get nothing except `search_docs_generation`.
  - `service_role` may only SELECT the tables and run the indexer functions.
- **Reads.** `search_docs_generation` is the only read path.
  - It serves the active `ready` generation of the environment whose reader secret matches.
  - A null secret, a secret shorter than 32 characters, an unknown environment or a wrong secret raises `42501`. The length check runs before hashing.
  - `match_count` must be at least 1 and is capped at 20; `similarity_threshold` must lie in [-1, 1]. Anything else raises `22023`.
  - `docs_generation_set_reader` refuses the SHA-256 of the empty string.
  - A missing active generation raises `P0002`.
  - An active generation that is not ready, or belongs to another environment, raises `P0003`.
  - The similarity semantics are those of the legacy three-argument `search_docs`. It is an exact scan over one generation, with no HNSW (see the `ponytail:` note in the migration).
- **PostgREST ambiguity.** The reader has its own name, so the legacy `search_docs` overload set is unchanged.

## CLI

```sh
node indexer/index.ts --environment <env> [--dry-run] [--manifest <file>] [--dist <dir>] [--receipt <file>]
```

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | A valid plan (dry run), or a `ready` generation. This includes a re-run of an already-ready build, which is a no-op with `alreadyReady: true`. |
| `1` | Any invalid plan, failed or incomplete document, or failed validation, or cancellation (SIGINT/SIGTERM) |
| `2` | Usage error or missing configuration |

**Receipt (JSON)**

- `buildId`, `sourceSha`, `manifestSha256`, `environment`, `chunkerVersion`, `embedding`
- `generationId` and `generationState`
- `documents`: counts per state (`planned`, `pending`, `complete`, `failed`, `excluded`)
- `chunks`: `planned`, `written`, `embedded`, `reused`
- `items`: per document, the `id`, `urlPath`, `contentSha256`, chunk count, `chunksSha256` and state
- `excluded`, `error`

It never contains keys or tokens.

**Bounds**

| Setting | Value |
|---|---|
| Embedding batch | 32 texts (at most 64) |
| Jina timeout | 30 s per request |
| Jina attempts | 3, on 429, 5xx or network errors only, with backoff |
| Jina response | Count and 1024 dimensions checked |
| PostgREST | 60 s per call, no retries |
| Lease | 15 min |

## Operator contract (M7/M9)

Every step runs in an **isolated** Supabase project first. Nothing here activates production. Nothing
deletes or garbage-collects a generation.

| Step | What | Secrets (names only) |
|---|---|---|
| 1. Apply the migration | `psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/20260929000000_docs_generations.sql` | `DATABASE_URL` (owner connection of the isolated project) |
| 2. Build | `cd site-nimbus && npm ci && CI=1 npm run build` | none |
| 3. Dry run | `node indexer/index.ts --environment preview --dry-run --receipt dry.json` must exit `0` | none |
| 4. Create a generation | `node indexer/index.ts --environment preview --receipt receipt.json`. Keep the receipt: it is the generation's evidence. | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JINA_API_KEY` |
| 5. Validate | See the checks below the table | `DATABASE_URL` |
| 6. Reader secret | See the steps below the table | `DATABASE_URL` and the new Pages secret `ASK_GENERATION_READER_TOKEN` |
| 7. Activate | `select * from docs_generation_activate('preview', <generationId>);` It returns `previous_generation_id`; record it. | `DATABASE_URL` |
| 8. Serve | Set the Pages bindings `ASK_RETRIEVAL_SOURCE=generation`, `ASK_GENERATION_ENVIRONMENT=preview`, `ASK_GENERATION_READER_TOKEN`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` for that deployment only | Pages environment secrets |
| Roll back | See the list below the table | as for the step |

**Step 5, validate**

- The exit code is `0`.
- The receipt has `generationState: "ready"`, `documents.failed: 0` and `documents.pending: 0`.
- `documents.complete` equals the dry run's `planned`.
- `chunks.written` equals `chunks.planned`.
- `buildId` and `sourceSha` equal the manifest's.
- In SQL: `select state, expected_documents, expected_chunks from docs_generations where id = <generationId>;`

**Step 6, reader secret**

1. Generate a secret of 32 characters or more, for example `openssl rand -hex 32`.
2. Store it only as the Pages secret.
3. Compute its hash in the same shell. The `:?` check runs before the pipe, so an unset or empty variable stops with an error instead of hashing empty input (inside the pipe it would still print the empty digest); `cut` keeps only the hex:
   `: "${ASK_GENERATION_READER_TOKEN:?}" && printf %s "$ASK_GENERATION_READER_TOKEN" | shasum -a 256 | cut -d' ' -f1`
4. Register the hash: `select docs_generation_set_reader('preview', '<64-hex hash>');`. The database refuses the hash of the empty string.

**Roll back**

- **To the previous generation:** `select * from docs_generation_activate('preview', <previous_generation_id>);`
- **To legacy retrieval:** set `ASK_RETRIEVAL_SOURCE=legacy`.
- **The schema:** `psql ... --single-transaction -f supabase/migrations/rollback/20260929000000_docs_generations.down.sql`. It refuses while any generation or slot exists.

**Untouched in production**

- The tables `documents` and `document_chunks`.
- Both `search_docs` overloads, together with their grants and RLS.
- `scripts/index-docs.ts`.
- `.github/workflows/index-docs.yml` and its trigger.
- Unrelated tables in the shared project. The migration creates only `docs_generation*` objects.

**Pre-existing, unchanged**

- `anon` and `authenticated` still hold TRUNCATE on the legacy tables. It comes from the Supabase default grants, and RLS does not cover TRUNCATE.
- A two-argument positional call to `search_docs` is ambiguous between the two overloads.

## Test

Before running:

- Run `npm ci` at the repository root. `test/retrieval.test.ts` drives `assistant/retrieval.ts`.
- Run `cd site-nimbus && npm ci && npm run build`. The dry run reads the real `dist`.
- Use Node 25 or later.

```sh
cd indexer && npm ci && node --test --test-timeout=120000 'test/*.test.ts'
```

No network and no remote database are used.

- **Replica.** `test/replica.sql` is the production schema from the read-only capture:
  - the legacy tables, RLS, policies and both overloads;
  - Supabase's `anon`, `authenticated` and `service_role` roles;
  - the Supabase default privileges.
- **Engine.** It runs in PGlite 0.5.8 (PostgreSQL 18.3) with pgvector 0.8.1 (`@electric-sql/pglite-pgvector`). Production is PostgreSQL 17 with pgvector 0.8.0.
- **Calls.** Indexer calls run as `SET LOCAL ROLE service_role` in one transaction per call, like PostgREST. Reader calls run as `anon`.
- **Embeddings.** Embeddings come from a deterministic fake behind the same interface.

Limits of this proof:

- PGlite has one connection, so concurrent runs are interleaved, not parallel. The unique index behind the guard is proven separately by direct inserts.
- A real Jina run and any real Supabase run are **BLOCKED**: they need operator-provisioned isolated bindings.
