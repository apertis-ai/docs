## ADDED Requirements

### Requirement: Legacy wire contract is preserved
`POST /api/ask` SHALL keep the request fields `question` (1–2000 characters), `sessionId`, `turnstileToken` and optional `pageContext {title, href}`, the `pageContext` normalization (title whitespace-collapsed, trimmed and cut to 120 characters; href trimmed and cut to 240 characters; the object dropped when either field is not a string, the title is empty, or the href does not start with `/` or starts with `//`), every status code, the JSON `{ "error": string }` shape and SSE framing recorded in `migration/nimbus/fixtures/ask-wire.json`, and the exact `error` strings of the 400, 403 and 429 responses. Responses for upstream and server failures (500) MAY be sanitized to `{ "error": string, "traceId"?: string }`; raw provider bodies, Supabase messages and secrets SHALL NOT reach the browser. SSE frames are `data: {"content":"…"}` frames carrying non-empty deltas, terminated by `data: [DONE]`, with citations as Markdown links inside the text. The existing Turnstile → Jina (`jina-embeddings-v4`, 1024 dimensions, `retrieval.query`) → Supabase → Apertis streamed completion stack is kept.

#### Scenario: Contract fixture replay
- **WHEN** the candidate handler receives each request in `ask-wire.json` with test doubles for Turnstile, Jina, Supabase and Apertis
- **THEN** it returns the recorded status, content type and frames, the recorded 400/403/429 bodies, and a sanitized 500 body

### Requirement: Independent client and server deployment
A new server SHALL keep every legacy request field, status code, 400/403/429 body and frame and MAY add response headers and SSE frames that carry no `content` key. A new client SHALL work against the legacy server (deployment `2efbe4c4`) and SHALL treat any additional frame or header as optional. Neither half SHALL require a simultaneous release.

#### Scenario: New client, old server
- **WHEN** the candidate client posts to a server running the legacy handler
- **THEN** the answer streams, citations render as source links, and 400/403/429/500 bodies are shown as in the legacy client

#### Scenario: Old client, new server
- **WHEN** the legacy client posts to the candidate handler
- **THEN** it renders the streamed answer unchanged and ignores any added frame

### Requirement: Server-side retrieval boundary
The handler SHALL obtain chunks through one narrow server-side retrieval interface defined by #10 that returns `{title, url_path, content, similarity}` rows, where `url_path` is the pathname of the document's manifest `canonicalUrl` (a same-origin relative path such as `/getting-started/quick-start` or `/api/`, never an absolute URL), for a query embedding, `matchCount` (5) and `similarityThreshold` (0.3). The retrieval source (legacy tables or a specific ready generation, #11) SHALL be selected only from server environment configuration; no request field, header, cookie or query parameter SHALL influence it. Missing or unrecognized configuration SHALL fail closed with a server configuration error. The legacy mode SHALL call the existing three-argument `search_docs` exactly as the legacy handler does.

#### Scenario: Browser asks for another generation
- **WHEN** a request carries any extra field naming a generation, environment or index
- **THEN** the field is ignored and the configured source answers

#### Scenario: Preview without isolated retrieval
- **WHEN** a preview or staging deployment has no isolated retrieval configuration
- **THEN** `/api/ask` returns a configuration error and never reads production retrieval data

### Requirement: Rate limiting limitation is explicit
The per-isolate in-memory counter keyed by the client-supplied `sessionId` (20 questions) SHALL be treated as a known limitation, not as distributed abuse protection. Changing it is outside the migration unless separately accepted.

#### Scenario: Acceptance report
- **WHEN** #10 or #12 reports assistant readiness
- **THEN** the report states that abuse protection relies on Turnstile and the per-isolate counter only

### Requirement: Real assistant evidence
Real assistant evidence SHALL come from a non-localhost hostname with isolated bindings and an isolated retrieval target, and SHALL show the Turnstile token verification, the Jina embedding call, the retrieval result, the streamed frames and the rendered citation for one request. Because a real Turnstile widget never issues a token to an automated browser, the two halves MAY be proven on two isolated previews of the same build that read the same generation. Turnstile enforcement is proven on the preview with the real keys: the real sitekey is served, a request without a token is rejected with 400, and a forged token is rejected with 403 through Cloudflare siteverify. The answer is proven on a preview whose only difference is Cloudflare's always-pass test secret; there the test sitekey and the dummy token SHALL be recorded as such. Browser runs on `localhost`, `127.0.0.1` or `::1` with the legacy client never call `/api/ask` and SHALL NOT count. Mocked or fixture-replay results are contract evidence only. Production Ask Docs answers SHALL NOT be used as the parity oracle, because production retrieval serves stale pre-PR #3 content (`legacy-index-writes-fail` in `legacy-rollback.json`).

#### Scenario: Isolated environment unavailable
- **WHEN** no operator-provisioned isolated bindings exist
- **THEN** the real-assistant gate is reported BLOCKED, never PASSED

#### Scenario: Turnstile and answer proven on two previews
- **WHEN** the answer probe runs on the always-pass preview and the enforcement probe on the real-key preview
- **THEN** the answer entries PASS only with the always-pass test sitekey and the dummy token recorded, and the Turnstile entry PASSes only with a non-test sitekey served, 400 without a token and 403 with siteverify's `invalid-input-response` for a forged token
