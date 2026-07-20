## Why

The documentation still sends developers through legacy account routes and treats obtaining a key as sufficient setup, which adds friction before the first successful request and can leave users without an eligible plan or PAYG balance. The highest-intent docs should lead visitors through the current account, access, key, request, and Activity-verification path without overwriting an earlier acquisition source.

## What Changes

- Replace active documentation links to legacy API-key settings with the current `/setting?tab=keys` destination.
- Make the Quick Start sequence require account creation, a Coding Plan or PAYG balance, API-key creation, a successful request, and Activity verification.
- Add a visible documentation-site account-creation CTA while retaining a separate login path.
- Remove remaining fixed model-count claims from high-intent docs and point readers to the live catalog.
- Remove internal documentation UTMs that would overwrite an existing last-touch acquisition cookie.
- Add a deterministic guard for canonical activation links and durable catalog language.

## Capabilities

### New Capabilities
- `developer-activation-docs`: Defines the canonical, attribution-safe path from documentation visit to a verified first API response.

### Modified Capabilities

None.

## Impact

Affected surfaces are the Docusaurus navbar and homepage, Quick Start and account/API-key documentation, active integration and SDK guides, and a repository-local content guard. There are no API, database, billing, Ads, production-account, or deployment changes.
