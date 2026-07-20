## Context

The production application now uses `/register`, `/subscribe`, `/setting?tab=credits`, `/setting?tab=keys`, and `/setting?tab=activity` as the public developer activation path. The docs still use legacy `/token` and `tab=apikeys` links, and the Quick Start begins with an API call before confirming that the account has model access. Apertis attribution is last-touch when a supported UTM is present, so tagging links from an Apertis-owned docs subdomain can replace a prior paid source.

## Goals / Non-Goals

**Goals:**

- Make current account and activation destinations consistent across active docs.
- Let a new developer understand the complete path to one verified API response.
- Preserve earlier acquisition attribution when a visitor moves between Apertis-owned surfaces.
- Prevent the same route and catalog-language drift from recurring.

**Non-Goals:**

- Change application routing, signup attribution, billing, plan eligibility, or API behavior.
- Change Ads configuration or publish partner/outreach messages.
- Promise that a specific model is available to every key type.

## Decisions

1. **Use canonical app routes directly.** Active docs will link to the current settings tabs rather than relying on compatibility redirects. This keeps instructions aligned with the UI and removes an avoidable redirect from the activation path.
2. **Keep docs-to-app links untagged.** We will rely on normal referrer/session analytics rather than adding internal UTM parameters. This avoids overwriting an existing paid acquisition cookie under the current last-touch contract.
3. **Define activation as a successful response plus Activity evidence.** Signup and key creation are prerequisites, not the completion signal. The Quick Start will explicitly include model access and request verification.
4. **Use the live catalog as the source of truth.** Examples may use currently available IDs, but broad catalog claims will not use a fixed count and will disclose that availability can vary by key type.
5. **Add a source guard, not a runtime dependency.** A small Node check will scan active docs/config sources for forbidden legacy destinations, internal acquisition UTMs, and fixed model-count claims, while asserting that the Quick Start retains the required activation destinations.

## Risks / Trade-offs

- **Some users may still have bookmarked legacy routes** → Compatibility redirects remain application-owned; docs simply stop generating new legacy traffic.
- **Untagged docs referrals are less explicit in backend signup metadata** → Preserve paid attribution and use referrer/session analytics until a separate multi-touch contract is approved.
- **Model examples can still age** → Keep the examples minimal, link the live catalog, and avoid claiming universal availability.
- **A broad guard can flag historical/archive content** → Scope the guard to active documentation and site configuration only.

## Migration Plan

Deploy the static docs normally after build and local browser verification. Rollback is a revert of this docs-only commit; no data or runtime migration is involved.

## Open Questions

None for this slice. Multi-touch attribution for docs-assisted activation remains a separate product analytics decision.
