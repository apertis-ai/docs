## 1. Contracts

- [ ] 1.1 Strict-validate this change. In the same commit, amend `nimbus-migration-contracts` (the `llms*` sentence and Release Notes).

## 2. Agent access (packet A)

- [ ] 2.1 `/llms.txt` and `/llms-full.txt` from the manifest, plus the inventory, route-fixture and dist allowlist rows; tests for the eligibility, description and artifact equality scenarios.
- [ ] 2.2 `POST /mcp` with `search_docs` and `get_page`, served from the deployment's own `llms*`; the inventory runtime row; documented on the MCP server page.

## 3. API reference (packets B and C)

- [ ] 3.1 Tab groups with the persisted choice, and SDK samples on the five pages; the sample syntax and catalog-ID check.
- [ ] 3.2 Try it, loaded on demand; proven with a local stub and a fake-key 401 only.
- [ ] 3.3 The "Choosing an API format" section on `/api/`.

## 4. Live catalog (packet E)

- [ ] 4.1 `/models/` with a snapshot and `/_nimbus/catalog`, filtered as apertis.ai filters.
- [ ] 4.2 `/changelog/` and `/changelog/rss.xml`, and the navbar's Release Notes repointed.

## 5. Shell extras (packet D)

- [ ] 5.1 The "Edit this page" link and the print stylesheet.
- [ ] 5.2 Page feedback: blocked until the operator approves a storage binding.

## 6. Integration

- [ ] 6.1 Merge the packets on one branch, regenerate the converter output once, and run the full gates (build, typecheck, tests, `test:dist`, `test:routes`, perf against the budgets); visual canary in the Mac mini Chrome.
- [ ] 6.2 Push, open the PR and merge: each needs the operator's separate approval, after the #14 observation window closes at 2026-10-06 00:15Z.
