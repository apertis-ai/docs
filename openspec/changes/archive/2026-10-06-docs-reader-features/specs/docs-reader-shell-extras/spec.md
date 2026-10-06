## ADDED Requirements

### Requirement: Edit this page
Every document page's meta row SHALL have an "Edit this page" link to `https://github.com/apertis-ai/docs/edit/main/<sourcePath>`. For legacy documents, `sourcePath` is the manifest's authoritative legacy source; for native articles, it is `site-nimbus/src/articles/<slug>.md`. The link SHALL never point at generated files under `site-nimbus/src/content/`. It opens in a new tab and does not change the article's own link set.

#### Scenario: Edit a converted doc
- **WHEN** the reader clicks "Edit this page" on `/getting-started/quick-start/`
- **THEN** it opens `https://github.com/apertis-ai/docs/edit/main/docs/getting-started/quick-start.md` (the manifest `sourcePath`)

### Requirement: Print layout
When printed, a document page SHALL show only the page header and the article:
- the navbar, sidebar, table of contents, page actions, Try it, feedback, Ask Docs and footer are hidden;
- code wraps instead of being clipped;
- every tab panel is printed with its label;
- link URLs of external links follow the link text.

Print uses the light palette.

#### Scenario: Print preview
- **WHEN** `/api/text-generation/chat-completions/` is printed
- **THEN** the output shows the title, the meta row and the full article, including every tab sample, and no site chrome

### Requirement: Page feedback
Document pages SHALL end with "Was this page helpful?", offering Yes and No and an optional comment of at most 1000 characters. The answer is sent with `POST /_nimbus/feedback` as `{path, helpful, comment?}` and stored in the D1 database bound as `FEEDBACK_DB` (operator decision 2026-10-05: D1), as one row of `path`, `helpful`, `comment` and `created_at`. `path` SHALL be the served path of a page the deployment's `/sitemap.xml` lists (the published documents and `/search/`); anything else is rejected with 400. The function reads that sitemap through the static assets rather than bundling the manifest. The reader then sees a confirmation, or a visible error if the request fails. No identifier, cookie or IP address is stored.

Without the binding, the endpoint answers 503. Feedback that cannot be stored SHALL NOT be reported as sent. The production binding SHALL be in place before the deployment that first renders the widget.

#### Scenario: Reader answers
- **WHEN** the reader clicks No and submits a comment
- **THEN** one record with the path, `false` and the comment is stored, and the widget shows a confirmation

#### Scenario: Storage unavailable
- **WHEN** the endpoint cannot write
- **THEN** it answers 503, and the widget shows that the feedback was not sent
