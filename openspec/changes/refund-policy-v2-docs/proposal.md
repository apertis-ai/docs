## Why

The public billing and help pages describe refunds differently from the application's legal pages: they say refunds are handled case by case, give 5-7 or 5-10 business-day review times, and offer a self-service "Immediate" cancellation the product does not have. The founder removed the general three-day refund window (theQuert/stima-api#3629, refund-policy-v2), and the reviewed Refund Policy source now exists (theQuert/stima-api#3632). The public docs must state the same policy, through the existing Nimbus generator, and must not be published before the policy's dates are decided (apertis-ai/docs#39).

## What Changes

- Rewrite the refund, cancellation, automatic top-up, interruption and refund-request text on the PAYG, Subscription Plans, Payment Methods and FAQ pages as verbatim quotations of the reviewed refund-policy-v2 source, with a link to the undated current Refund Policy at `https://apertis.ai/refund`.
- Remove the self-service immediate cancellation option and the superseded review and processing times.
- Keep one `TODO(refund-policy-v2-date)` marker per page until the announcement, notice and effective dates are decided.
- Regenerate the Nimbus mirrors, manifest and page metadata with `npm run m2:regenerate`, and record the added links in `migration/nimbus/content-changes.json`.
- Add `scripts/nimbus/refund-policy-check.mjs` and run it from `scripts/nimbus/pages-build.sh`, so a build fails while a date marker, a superseded promise or a dated Refund Policy link remains.

## Capabilities

### New Capabilities
- `public-refund-docs`: The public billing and help pages state the current Refund Policy as the reviewed legal source states it, and cannot be built for publication while the policy's dates are undecided.

### Modified Capabilities

None.

## Impact

Affected surfaces are four legacy sources under `docs/`, their generated Nimbus render sources and Markdown artifacts, the manifest and page metadata, the content-change ledger, the Pages build script and a repository-local check. There are no API, database, billing, application, notification or deployment changes. Prices, quotas, minimum top-up, balance expiry, PAYG fallback and plan-change economics are unchanged.
