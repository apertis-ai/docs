## 1. Baseline evidence

- [x] 1.1 Revalidate the base (`7b6ef85`), open PRs, issues #4–#14 and repository specs; record discrepancies with the planning snapshot.
- [x] 1.2 Build the legacy site in an isolated worktree and run the activation guard.
- [x] 1.3 Snapshot live routes, redirects, canonicals and anchors; compare with the local build.
- [x] 1.4 Record Pages deployment identity, build settings and secret names, and the legacy retrieval identity, read-only.
- [x] 1.5 Capture the visual baseline (desktop and mobile) on the Mac mini Chrome and record visually observed defects.

## 2. Frozen contracts

- [x] 2.1 Generate `route-inventory.json` and `route-fixtures.json`; fixtures pass against live and local legacy.
- [x] 2.2 Specify routing/publication, manifest v1, `/api/ask` wire and retrieval boundary, shell interfaces and acceptance.
- [x] 2.3 Commit search queries and the performance protocol before measuring; record the legacy search baseline.
- [x] 2.4 Record the legacy performance baseline in `budgets.json`.
- [x] 2.6 Repair the independent review's blocking findings (publish eligibility of redirected routes, private identifiers, byte accounting, harness DOM assumptions, PoC coverage limits).
- [x] 2.7 Before any push, rewrite this branch's history so no commit contains the removed private identifiers, and rebase dependent branches onto it.
- [ ] 2.8 Archive only after #9 ships the page-context refresh, so the `ask-docs-panel` delta does not describe unshipped behavior.
- [ ] 2.5 Validate the change with `openspec validate nimbus-migration-contracts --strict` and review the candidate.
