## 1. Contracts

- [x] 1.1 Strict-validate this change. In the same commit, amend `nimbus-migration-contracts` (the `llms*` sentence and Release Notes).

## 2. Agent access (packet A)

- [x] 2.1 `/llms.txt` and `/llms-full.txt` from the manifest, plus the inventory, route-fixture and dist allowlist rows; tests for the eligibility, description and artifact equality scenarios.
- [x] 2.2 `POST /mcp` with `search_docs` and `get_page`, served from the deployment's own `llms*`; the inventory runtime row; documented on the MCP server page.

## 3. API reference (packets B and C)

- [x] 3.1 Tab groups with the persisted choice, and SDK samples on the five pages; the sample syntax and catalog-ID check.
- [x] 3.2 Try it, loaded on demand; proven with a local stub and a fake-key 401 only.
- [x] 3.3 The "Choosing an API format" section on `/api/`.

## 4. Live catalog (packet E)

- [x] 4.1 `/models/` with a snapshot and `/_nimbus/catalog`, filtered as apertis.ai filters.
- [x] 4.2 `/changelog/` and `/changelog/rss.xml`, and the navbar's Release Notes repointed.

## 5. Shell extras (packet D)

- [x] 5.1 The "Edit this page" link and the print stylesheet.
- [x] 5.2 Page feedback on D1 (`FEEDBACK_DB`, operator 2026-10-05) with schema SQL in the repo; the production D1 and Pages binding are created by the lead before the merge (packet G).

## 6. Integration

- [x] 6.1 Merge the packets on one branch, regenerate the converter output once, and run the full gates (build, typecheck, tests, `test:dist`, `test:routes`, perf against the budgets); visual canary in the Mac mini Chrome.
- [x] 6.2 Push, open the PR and merge: each needs the operator's separate approval, after the #14 observation window closes at 2026-10-06 00:15Z.
