## ADDED Requirements

### Requirement: Canonical developer activation path
The active documentation SHALL guide a new developer through account creation, model access through a Coding Plan or PAYG balance, API-key creation, one successful API request, and verification of the matching Activity record.

#### Scenario: New developer follows Quick Start
- **WHEN** a visitor reads the Quick Start prerequisites and numbered setup steps
- **THEN** the documentation links the visitor to `/register`, `/subscribe` or `/setting?tab=credits`, `/setting?tab=keys`, and `/setting?tab=activity`
- **AND** it states that a successful response and matching Activity record complete the integration

### Requirement: Current account destinations
Active documentation and site navigation SHALL use current application destinations instead of legacy API-key routes.

#### Scenario: Visitor opens an API-key link
- **WHEN** a visitor follows an API-key action from active docs or site navigation
- **THEN** the destination is `https://apertis.ai/setting?tab=keys`
- **AND** the source does not link to `https://apertis.ai/token` or `tab=apikeys`

#### Scenario: Visitor starts from the documentation navbar
- **WHEN** a visitor wants to create an account
- **THEN** the navbar exposes a visible link to `https://apertis.ai/register`
- **AND** a separate login destination remains available

### Requirement: Attribution-safe owned-surface links
The documentation SHALL NOT add acquisition UTM parameters to links between Apertis-owned documentation and application surfaces while signup attribution uses last-touch overwrite.

#### Scenario: Paid visitor consults documentation before signup
- **WHEN** an Apertis-owned documentation page links back to account creation or settings
- **THEN** the link contains no `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, or `utm_content` parameter

### Requirement: Durable model catalog language
High-intent documentation SHALL treat the live model catalog and the visitor's key type as the source of truth instead of publishing a fixed catalog-size promise.

#### Scenario: Visitor evaluates model availability
- **WHEN** a visitor reads Quick Start, FAQ, installation, or SDK setup content
- **THEN** the documentation links to the live Models page or `GET /v1/models`
- **AND** it does not describe the catalog with a fixed numeric `N+ models` claim

### Requirement: Activation content drift guard
The repository SHALL provide a deterministic check that fails when active docs regress to legacy account destinations, owned-surface acquisition UTMs, or fixed model-count claims.

#### Scenario: Maintainer validates activation content
- **WHEN** the activation-content check runs on compliant source
- **THEN** it exits successfully and confirms the required Quick Start destinations

#### Scenario: Legacy content is introduced
- **WHEN** active source contains a forbidden legacy destination, acquisition UTM, or fixed model-count claim
- **THEN** the check exits non-zero and reports the offending file and pattern
