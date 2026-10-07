## Context

`docs/billing/*.md` and `docs/help/faq.md` are the single authoring source. `site-nimbus/converter/convert.ts` turns them into the Nimbus render sources and Markdown artifacts, and the build derives the HTML, the served `.md`, Pagefind and `llms-full.txt` (also read by `/mcp`). A merge to `main` publishes through Cloudflare Pages and re-indexes Ask Docs from the legacy sources. The inventory, with the 32 public carriers and the current versus archived split, is `docs-internal/audits/refund-policy-v2.md`.

The reviewed legal source is theQuert/stima-api `web/next/lib/legal/candidates/refund/refund-policy-v2.en.ts` at `ae6a66c3ac6c9ad57a513eb50060581f6fc8e224` (EN Markdown sha256 `6c436066924c35e4deea784058fb2f2bf3290f9032187dc62f552ab599113bfd`). Its dates are not decided yet (gate C5 of theQuert/stima-api#3629).

## Goals / Non-Goals

**Goals:**

- One policy text: the docs quote the legal source instead of paraphrasing it.
- Every generated carrier matches its source, through the existing generator only.
- The docs cannot be built for publication while the v2 dates are undecided.

**Non-Goals:**

- Choosing dates, publishing, notifying customers or changing which policy applies to a transaction.
- Changing prices, quotas, balance expiry, minimum top-up, PAYG fallback or plan-change rules, including the existing upgrade description (recorded as an out-of-scope finding).
- Japanese docs: the docs site is English only.

## Decisions

1. **Quote, do not summarize.** Each policy statement is a verbatim sentence of the legal source; the docs only add headings, section references, the request address line and the link. A summary would be a second interpretation of a money-related promise.
2. **Link the undated current path.** `https://apertis.ai/refund` serves whatever version is in force; dated paths are archives. The check refuses a dated `/refund/` link.
3. **Fail closed in the Pages build.** `pages-build.sh` runs the check before installing dependencies, so a branch carrying the date marker cannot produce a deployment. `main` is unaffected because it does not carry the marker.
4. **Pin the legal source.** The check embeds the quoted sentences and the source hashes. With `--legal-fixture` it verifies the stima-api normalized-text fixture hash and that every quoted sentence is text of that fixture.
5. **Archive is not current.** The 2026-04-24 changelog notice and the cutover snapshot are historical and are never scanned; the check only asserts the archived notice is unchanged.

## Risks / Trade-offs

- **The branch cannot build until C5** → Intended: the date marker is the publication guard. C5 replaces the marker with the decided dates.
- **Quoted text drifts from a later legal revision** → The pinned hashes and `--legal-fixture` comparison fail when the source changes; the docs are then re-aligned.
- **A generated `updated` date reflects the commit date** → `page-meta.json` is derived by the generator from git history; it is not a policy date.

## Migration Plan

Merge only after C5 provides the dates and the parent authorizes publication. Rollback is a revert followed by `npm run m2:regenerate`; the previous Pages deployment keeps serving while a build fails.
