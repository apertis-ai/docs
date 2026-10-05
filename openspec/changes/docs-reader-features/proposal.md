## Why

A competitor review on 2026-10-05 (Claude, OpenAI, Cursor and Supabase docs; synthesis kept with the session evidence) found the gaps that Apertis docs still has against them:
- no `llms.txt`;
- no language tabs for code samples;
- no Try it in the API reference;
- no docs MCP server;
- no in-docs model catalog with prices, and no changelog feed;
- no edit link;
- no print layout;
- no page feedback.

The operator asked on 2026-10-05 to close all of them except zh-TW localisation, and to do each one better than the competitors do. Specifically:
- `llms.txt` carries a description for every entry, where Supabase lists bare links and Cursor's file is malformed;
- the reader's language choice persists across pages;
- prices come from the live catalog, so they do not lag the product;
- there is one changelog with RSS and tags;
- Try it runs inside the reference page.

## What Changes

- `/llms.txt` and `/llms-full.txt`, derived only from agent-eligible manifest entries. This supersedes the migration-contract sentence "The candidate emits no `llms*` outputs at all", and the `/llms.txt` inventory row "absent-at-baseline", by operator instruction (2026-10-05).
- `POST /mcp`, a stateless MCP server over Streamable HTTP. It searches and reads the same agent-eligible content and needs no key. A section of the MCP server page documents how to connect to it.
- Code-sample tab groups. A reader's language choice persists site-wide. The API reference text-generation, embeddings and models pages gain samples for the OpenAI SDK (Python, JavaScript) and the Anthropic SDK.
- Try it for API reference requests. It calls `https://api.apertis.ai` from the reader's browser with a key the reader types in, which is never stored.
- A "Choosing an API format" section on `/api/`, comparing Chat Completions, Responses and Messages through the gateway.
- `/models/`, the live model catalog with prices and deprecation labels, and `/changelog/`, the release notes with category tags, with a live RSS feed at `/changelog/rss.xml`. The navbar's Release Notes item now points to `/changelog/`.
- An "Edit this page" link to the authoritative source file on GitHub.
- A print stylesheet.
- "Was this page helpful?" feedback. It ships only together with an operator-approved storage binding; without one, no widget is rendered.

## Non-goals

- zh-TW or any other localisation.
- Changing `/api/ask`, retrieval, or the indexer.
- Any production configuration, DNS, secret or database change made by this change. A storage binding for feedback is a separate, operator-approved step.
- Real-key API calls in tests.

## Capabilities

### New Capabilities
- `docs-agent-access`: `llms.txt`, `llms-full.txt` and the docs MCP endpoint.
- `docs-api-reference-ux`: code tabs, persisted language choice, SDK samples, Try it, and the API-format guidance.
- `docs-live-catalog`: `/models/`, `/changelog/` and `/changelog/rss.xml`.
- `docs-reader-shell-extras`: the edit link, the print stylesheet and page feedback.

### Modified Capabilities

None in `openspec/specs/`. In the unarchived `nimbus-migration-contracts` change, `docs-routing-publication` "Native articles" drops its no-`llms*` sentence, and `docs-shell-interfaces` "Preserved reader-facing shell" repoints Release Notes. Both are amended in the same commit as this change.

## Impact

- `site-nimbus/` (converter, components, pages, tests).
- Repo-root `functions/` (`mcp.ts`, `_nimbus/catalog.ts`, `changelog/rss.xml.ts`, and `_nimbus/feedback.ts` once storage is approved).
- `migration/nimbus/` (inventory rows for `/llms.txt`, `/llms-full.txt`, `/mcp`; route fixtures; content-change records).
- Content under `docs-api/`. Merging content under `docs-api/` triggers `.github/workflows/index-docs.yml` (Supabase re-index), so the merge needs the operator's separate approval.
