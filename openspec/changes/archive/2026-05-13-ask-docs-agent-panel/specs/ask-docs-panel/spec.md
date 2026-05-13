# ask-docs-panel Specification

## ADDED Requirements

### Requirement: Non-blocking Desktop Panel
The documentation site SHALL open Ask Docs as a non-blocking docked panel on desktop viewports.

#### Scenario: User opens Ask Docs from the floating launcher
- WHEN the user activates the Ask Docs launcher on a desktop viewport
- THEN the page content SHALL remain visible and scrollable
- AND Ask Docs SHALL appear as a right-side panel instead of a centered modal overlay

### Requirement: Mobile Bottom Sheet
The documentation site SHALL render Ask Docs as a bottom sheet on mobile viewports.

#### Scenario: User opens Ask Docs on mobile
- WHEN the viewport is narrow
- THEN Ask Docs SHALL anchor to the bottom of the viewport
- AND the composer SHALL remain reachable without overlapping panel controls

### Requirement: Current Page Context
Ask Docs SHALL expose the current documentation page as user-visible context.

#### Scenario: Panel opens while reading a docs page
- WHEN Ask Docs opens
- THEN the panel SHALL show a context chip based on the current page title
- AND submitted questions SHALL include the current page URL and title in the client request payload

### Requirement: Source Visibility
Ask Docs SHALL make cited documentation sources scannable outside the generated prose.

#### Scenario: Assistant response contains markdown links
- WHEN an assistant answer includes markdown links to documentation pages
- THEN the UI SHALL show the linked pages as source pills or source rows associated with that answer

### Requirement: Session Persistence
Ask Docs SHALL preserve the current conversation during page navigation in the same browser session.

#### Scenario: User navigates after asking a question
- WHEN the user opens Ask Docs again in the same browser session
- THEN prior messages SHALL remain available until the user clears the conversation

### Requirement: Answer Actions
Ask Docs SHALL provide lightweight actions for completed assistant answers.

#### Scenario: Assistant answer finishes streaming
- WHEN an assistant answer is visible and not loading
- THEN the UI SHALL provide copy, helpful, and not helpful actions

## NON-GOALS
- The change SHALL NOT modify backend retrieval or model behavior.
- The change SHALL NOT add file attachments.
- The change SHALL NOT add an admin analytics dashboard.
