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
Page actions SHALL offer Copy as Markdown, Copy content URL, View as Markdown, Ask Claude (`https://claude.ai/new?q=`), Ask ChatGPT (`https://chatgpt.com/?hints=search&prompt=`) and Open in Cursor (`https://cursor.com/link/prompt?text=`), with prompts `Load the contents of <url> into this chat's context so we can discuss it.`. Every action SHALL use the same deployment's absolute Markdown URL (`<origin><markdown path>`), never GitHub `main` or any other release. A failed Markdown fetch SHALL be reported to the reader instead of silently copying rendered text. The actions follow the Claude Docs page-actions pattern (operator, canary review on 2026-09-30): one bordered split button labelled Copy page (Copy as Markdown) with a menu chevron, at the right of the title row on wide screens and after the meta row on a phone; every menu item shows a title and a one-line description.

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

### Requirement: Shell alignment, header, footer and homepage
The operator decided on 2026-09-29 (recorded on #4) that the homepage, header and footer are redesigned. The goal is a layout that is uncrowded and aligned. The structure follows the operator's reference, the Claude Platform Docs homepage. Its structure is used, and, by operator decision in the canary review on 2026-09-30, its two-row header with section tabs; never its typefaces or marks.

**Alignment.** The header, the homepage sections and the footer SHALL share one content container, with a maximum width of about 1280 px and a fixed side gutter. Their left and right content edges SHALL coincide at every viewport width.

**Header.** The header SHALL have two rows, about 100 px in all, and a hairline bottom border (operator, canary review on 2026-09-30). The top row contains, from left to right:
- the logo and product name;
- a search trigger, centred, that shows the Cmd/Ctrl+K hint, on every page including the homepage (the operator moved the homepage search from the hero back to the header in the canary review on 2026-09-30, reversing the 2026-09-29 exception);
- the theme switch;
- Log in, as a quiet action;
- Create account, as the primary action.

The second row holds the navbar items from "Preserved reader-facing shell" as section tabs that start at the logo edge; the current one is underlined in ink.

At narrow widths the header SHALL be one row, and the tabs and account actions SHALL move into a sheet that is opened from a menu button.

**Homepage.** The homepage SHALL open with a centred hero on its own band, after the Claude Docs homepage (operator, canary review on 2026-09-30):
- a small eyebrow and a question as the heading, in the display face;
- six intent pills, each naming a reader's task and the published page that answers it;
- a line pointing to the Apertis console, and a "Browse all docs" link to the sections below.

The hero holds no search control; search is the header's. The first section below it holds the first request: a short lead, three neutral quick links (Quick start, API keys, API reference) and a code sample with tabs (cURL, Python, Node.js), taken from the Quick Start page.

Below the hero, sections follow one rhythm: a small eyebrow, a heading, a one-line description, then the content, with generous and consistent spacing between sections. The homepage feature cards and their destinations, including the external Playground card, remain reachable.

**Footer.** The footer SHALL have a brand column (logo, a short line and social links as labelled icons) and grouped link columns. Together they carry the footer link set from "Preserved reader-facing shell". Column headings use muted sentence case.

**Components.** Shell, homepage, search and Ask Docs controls SHALL be built from shadcn/ui components:
- style new-york, neutral base, CSS variables and lucide icons;
- vendored as source, and styled with Tailwind v4;
- every shadcn token maps to the one token file, so no shadcn token has an independent value;
- components that need no interaction SHALL render at build time without client JavaScript.

The surface open event, the keyboard contract, the search and Ask Docs behaviour, and the Ask Docs wire contract do not change.

#### Scenario: Aligned edges
- **WHEN** the homepage is rendered at 1440, 1024 and 390 px wide
- **THEN** the left content edge of the header, of every homepage section and of the footer is the same x position

#### Scenario: Restrained accent
- **WHEN** the homepage, a document page, the search dialog and Ask Docs are rendered in both themes
- **THEN** no button, chip, badge, input or surface is filled or outlined with the teal accent at rest

### Requirement: Reading layout and page header
The operator decided on 2026-09-29 (recorded on #4) that the candidate improves readability instead of copying the legacy look. The candidate keeps every element of "Preserved reader-facing shell" and Apertis branding: logo, the teal accent (restrained as in **Palette**), Inter for text, and system monospace. Page titles, article h2 and homepage headings SHALL use the Apertis brand face LINE Seed at weight 400, never synthesised bold (operator, canary review on 2026-09-30). It is taken from stima-api, licensed SIL OFL 1.1 with its licence committed beside it, and only the Regular Latin subset ships. The candidate SHALL NOT use another brand's typefaces or marks.

**Palette.** The operator revised the palette on 2026-09-29 (recorded on #4). The candidate SHALL use neutral surfaces (a near-white page with white cards and hairline borders in light; near-black in dark) with near-black ink. It SHALL have a matching dark palette, reachable only through the existing theme switch. The Apertis teal SHALL appear only in the logo, focus rings and link hover or active states. It SHALL NOT fill buttons, chips, badges, inputs or surfaces. Primary actions SHALL use an inverted neutral fill: dark on light, light on dark. Body text SHALL have a contrast ratio of at least 7:1 against its background. Muted text, labels and links SHALL have at least 4.5:1. Both rules apply in both themes.

**Measure.** Article prose SHALL NOT exceed about 70ch. Tables and code blocks MAY use the full content column.

**Page header.** Each document page SHALL open with a header block:
- a category tag, which is the sidebar category of the page;
- the title;
- a one-sentence description, taken from front-matter `description` when present, else the first paragraph;
- a meta row with the last-updated date and an estimated reading time;
- the page actions.

A full-width hairline SHALL separate the header block from the body. The date is the author date of the last legacy commit that touched the source file. The converter computes it deterministically from `sourceSha`, and the build never calls git.

**Mobile.** On mobile the title block SHALL come before the page actions and the "On this page" disclosure.

**Table of contents.** The table of contents SHALL show a reading-progress indicator. The indicator SHALL cause no layout shift, SHALL respect `prefers-reduced-motion`, and SHALL NOT scroll-jack.

#### Scenario: Reader opens a document on a phone
- **WHEN** `/getting-started/quick-start/` is opened at 390×844
- **THEN** the category tag, title, description and meta row are the first content below the header
- **AND** the page actions and the "On this page" disclosure follow them

#### Scenario: Contrast
- **WHEN** the theme tokens are checked in light and dark
- **THEN** body text is at least 7:1, and muted text and links are at least 4.5:1, against their backgrounds
