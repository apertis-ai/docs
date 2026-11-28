## ADDED Requirements

### Requirement: Current refund policy stated as the legal source states it
The public billing and help pages SHALL state refunds, cancellation, automatic top-up, service interruptions and refund requests using the text of the reviewed refund-policy-v2 legal source, without a general refund window.

#### Scenario: Reader asks whether an unused purchase can be refunded
- **WHEN** a reader opens the refund text on the PAYG, Subscription Plans, Payment Methods or FAQ page
- **THEN** the page states that top-ups, subscription payments and on-demand usage are non-refundable even when unused
- **AND** it states that the policy offers no general refund window
- **AND** it does not say refunds are handled case by case or within three days

#### Scenario: Reader has a ground the policy keeps
- **WHEN** a reader opens the refund text on the PAYG or Subscription Plans page
- **THEN** the page lists the legal-source grounds for a reviewed request: applicable law, a written agreement, an earlier policy version, a verified duplicate or incorrect charge, an unauthorized payment, a verified material service failure, and undelivered prepaid service ended without the customer's breach
- **AND** it states consumer rights under local law without stating which country's law applies to a transaction

#### Scenario: Reader cancels a subscription
- **WHEN** a reader follows the cancellation steps
- **THEN** the page states that cancellation stops the next renewal and the subscription stays active until the end of the paid period
- **AND** it does not offer a self-service immediate cancellation
- **AND** it states that turning off automatic top-up is separate from the subscription

### Requirement: Undated Refund Policy link
The refund text SHALL link the full Refund Policy at the undated current path `https://apertis.ai/refund` and SHALL NOT link a dated Refund Policy path.

#### Scenario: Reader opens the full policy
- **WHEN** a reader follows the Refund Policy link from any of the four pages
- **THEN** the link target is `https://apertis.ai/refund`

### Requirement: Generated carriers match the source
Every generated representation of the four pages SHALL carry the same refund text as its legacy source, produced only by the existing Nimbus generator.

#### Scenario: Maintainer regenerates the site
- **WHEN** `npm run m2:regenerate` runs twice on the committed head
- **THEN** the second run changes no tracked file
- **AND** the render sources, Markdown artifacts, built HTML, served Markdown and `llms-full.txt` contain the required refund statements

### Requirement: No publication before the policy dates are decided
The Pages build SHALL fail while any page carries a refund-policy date marker, a superseded refund promise or a dated Refund Policy link.

#### Scenario: Build with an undecided date
- **WHEN** `scripts/nimbus/pages-build.sh` runs on a checkout whose pages carry `TODO(refund-policy-v2-date)`
- **THEN** the build exits non-zero before producing `build/`

#### Scenario: Build with decided dates
- **WHEN** the same build runs on a checkout without any date marker, superseded promise or dated Refund Policy link
- **THEN** the refund-policy check passes and the build continues

#### Scenario: Archived notice
- **WHEN** the check runs
- **THEN** it does not scan the archived 2026-04-24 changelog notice and fails only if that notice was changed or removed

### Requirement: Stated applicability date
Each refund carrier SHALL state the decided applicability of this version: new manual purchases from the C5 date, and automatic renewals and automatic top-ups only after a separate email notice at least 30 days in advance, without an announcement date or an effective date for automatic charges.

#### Scenario: Reader checks which version applies
- **WHEN** a reader opens the refund text on any of the four pages
- **THEN** the page states that this version applies to new manual purchases made from October 12, 2026, when it is shown before payment
- **AND** it states that automatic renewals and automatic top-ups remain under the earlier version and are covered only after a separate email notice at least 30 days in advance
- **AND** it lists the Section 1 applicability statements of the legal source
