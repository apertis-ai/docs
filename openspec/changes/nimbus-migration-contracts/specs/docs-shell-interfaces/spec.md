## ADDED Requirements

### Requirement: Surface open event
Search and Ask Docs SHALL be opened through one browser event: `window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search' | 'ask', query?: string } }))`. The shell (#8) dispatches it from the navbar search control, the homepage hero search button and any other trigger; the search/Ask Docs client (#9) is the only listener. No component SHALL intercept another component's DOM (such as `.navbar__search-input`) to open a surface.

#### Scenario: Homepage hero search
- **WHEN** the reader activates the homepage hero search button
- **THEN** the shell dispatches `apertis-docs:open` with `surface: 'search'` and the search dialog opens

### Requirement: Keyboard contract
Exactly one handler SHALL bind Cmd/Ctrl+K (owned by #9); it toggles the search dialog and leaves keyboard focus in the search input. The search dialog SHALL be a `<dialog>` element or carry `role="dialog"`, and only one search dialog exists at a time. It SHALL contain focus while open, select the first result whenever results change, move the selection with ArrowUp/ArrowDown, open the selected result with Enter, close on Escape and backdrop click, and return focus to the element that opened it. The Ask Docs panel SHALL stay non-blocking on desktop, close on Escape except while focus is in its composer textarea, submit on Enter and insert a newline on Shift+Enter. The page behind the open search dialog SHALL NOT scroll, and a query typed before the search index is ready SHALL produce results once it is ready instead of a persistent empty state. At baseline Cmd/Ctrl+K opens the dialog but leaves focus on `<body>` because the plugin's own navbar shortcut competes, typed spaces scroll the page behind the dialog, and an early query stays at "No results found"; the candidate SHALL NOT reproduce these defects.

#### Scenario: Keyboard-only search
- **WHEN** a reader presses Cmd/Ctrl+K and types a query
- **THEN** the characters appear in the search input without a pointer action

### Requirement: Page metadata and context
Every published page SHALL expose `<meta name="apertis-docs:id">`, `<meta name="apertis-docs:build">` and, for `agent`-eligible pages, `<meta name="apertis-docs:markdown" content="<markdown path>">`. Ask Docs page context SHALL be `{ title, href }` with `title` equal to the manifest title (the page `<title>` without the ` | Apertis Documentation` suffix) and `href` as `location.pathname + location.search + location.hash`, recomputed whenever the panel opens and on every navigation while it is open. The conversation persists for the browser session as today; whether the panel stays open across a full page load is an implementation choice, but when it is open its context is the current page.

#### Scenario: Navigate with the panel open
- **WHEN** the reader follows a source link while Ask Docs stays open
- **THEN** the context chip and the next request's `pageContext` name the new page

### Requirement: Same-release Markdown actions
Page actions SHALL offer Copy as Markdown, Copy content URL, View as Markdown, Ask Claude (`https://claude.ai/new?q=`), Ask ChatGPT (`https://chatgpt.com/?hints=search&prompt=`) and Open in Cursor (`https://cursor.com/link/prompt?text=`), with prompts `Load the contents of <url> into this chat's context so we can discuss it.`. Every action SHALL use the same deployment's absolute Markdown URL (`<origin><markdown path>`), never GitHub `main` or any other release. A failed Markdown fetch SHALL be reported to the reader instead of silently copying rendered text.

#### Scenario: Preview deployment
- **WHEN** a reader on a preview deployment chooses Copy as Markdown
- **THEN** the copied bytes equal that deployment's `.md` artifact, whose hash matches its manifest entry

### Requirement: Preserved reader-facing shell
The candidate SHALL keep: the Docs and API sidebars with the category labels, nesting, order and item labels recorded in the inventory `sidebar` fields; navbar items Docs (`/intro`), API Reference (`/api`), Release Notes (`https://apertis.ai/changelog`), Log in (`https://apertis.ai/login`) and Create account (`https://apertis.ai/register`); the sidebar Console link (`https://apertis.ai/setting?tab=keys`); the footer link set; the homepage feature cards including the external Playground card (`https://playground.apertis.ai`, new tab, `noopener noreferrer`); English content and Apertis branding; light default theme with a user switch and no automatic `prefers-color-scheme` selection; code block copy buttons; Ask Docs as a right-docked panel on desktop and a bottom sheet at ≤ 640 px; the sidebar as a drawer at ≤ 996 px; horizontally scrollable wide tables on mobile. Theme selection SHALL NOT be coupled to component logic beyond styling.

#### Scenario: Activation destinations
- **WHEN** `npm run test:developer-activation` (adapted by #12 to candidate roots and `.astro` files) runs
- **THEN** the PR #3 invariants pass for the candidate sources

### Requirement: Visible Ask Docs failures
When a question cannot be sent (Turnstile failure or expiry, network error) or the server answers an error, Ask Docs SHALL show a visible message in the panel. At baseline a Turnstile domain failure silently disables sending.

#### Scenario: Unauthorized hostname
- **WHEN** the Turnstile widget reports an error
- **THEN** the panel tells the reader that the question cannot be sent

### Requirement: No simulated answers in shipped clients
A production client bundle SHALL NOT contain a simulated or canned Ask Docs answer path. Contract tests MAY stub the server; such runs are labeled contract evidence.

#### Scenario: Local development host
- **WHEN** the candidate runs on localhost without a backend
- **THEN** Ask Docs shows the server's error or configuration response instead of a fabricated answer
