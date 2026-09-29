# site-nimbus — Nimbus candidate (M1 foundation, issue #6)

This is an isolated Astro/Nimbus candidate for docs.apertis.ai. The production site is still the
Docusaurus build at the repository root: `npm run build` produces `build/`, and Cloudflare Pages
project `docs` deploys it. Nothing in this directory changes that build, the root package or
lockfile, `functions/`, or `.github/`. Pages does not build this package.

## Commands

Run these in `site-nimbus/`. They require Node >= 22.18 and npm (lockfile v3).

| Command | What it does |
| --- | --- |
| `npm ci` | Clean install from the committed `package-lock.json` |
| `npm run dev` | `astro dev` |
| `npm run build` | Static build into `site-nimbus/dist/` |
| `npm run typecheck` | `astro check` (covers `.astro`, `src/**/*.ts` and `test/**/*.ts`) |
| `npm test` | Contract unit tests (`node --test`, native TypeScript type stripping) |
| `npm run preview` | Serves `dist/` Pages-style with the repo-root `functions/` (see below) |
| `PREVIEW_URL=<origin> npm run test:routes` | M1 routing proof against a running preview |
| `npm run test:dist` | Publication hygiene of `dist/` (run after `build`): file allowlist, no maps or raw MDX, no values from any root or `site-nimbus` `.env*`/`.dev.vars*` (except `*.example`), no internal secret names |

`preview` changes to the repository root and runs the pinned
`wrangler pages dev site-nimbus/dist --compatibility-date=2024-01-01`. That makes `POST /api/ask`
the real `functions/api/ask.ts` route, served on the same harness as the legacy `pages:dev`.

- The function imports `@supabase/supabase-js` from the root `node_modules`, so run the root
  `npm ci` first.
- Pass the port through with `npm run preview -- --port 8795 --ip 127.0.0.1`.
- `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` stops a local `.env` from being bound as Worker
  secrets. Only an explicit root `.dev.vars` provides them.
- `WRANGLER_SEND_METRICS=false` keeps wrangler from reporting usage.
- Local state goes to `site-nimbus/.wrangler/state`. Wrangler still writes bundling scratch to the
  root `.wrangler/tmp`.

Telemetry: the `dev`, `build` and `typecheck` scripts set `ASTRO_TELEMETRY_DISABLED=1`. No script
deploys, logs in or needs Cloudflare credentials.

## Pinned versions and upstream evidence

All versions are exact (no ranges), and `package-lock.json` is committed. The Nimbus, Astro, React
and wrangler pins are the ones upstream tested together at the same commit.

| Package | Version | License | Node | Evidence |
| --- | --- | --- | --- | --- |
| `@cloudflare/nimbus-docs` | 0.15.0 | MIT | >=22.12.0 | tag [`@cloudflare/nimbus-docs@0.15.0`](https://github.com/cloudflare/nimbus/releases/tag/%40cloudflare/nimbus-docs%400.15.0) → commit [`4bec97a`](https://github.com/cloudflare/nimbus/commit/4bec97adc397a58cc9462bbe3645ee6ce15aebcd); npm integrity `sha512-tDdjGShx9yo6…` |
| `astro` | 7.3.1 | MIT | >=22.12.0 | Nimbus peer `>=7.2.6 <8.0.0`; pinned by the `create-nimbus-docs@0.7.7` template and upstream [`pnpm-lock.yaml` @ 4bec97a](https://github.com/cloudflare/nimbus/blob/4bec97adc397a58cc9462bbe3645ee6ce15aebcd/pnpm-lock.yaml) |
| `react`, `react-dom` | 19.2.7 | MIT | — | Nimbus optional peer `>=19.0.0`; upstream lock @ 4bec97a |
| `@astrojs/react` | 6.0.1 | MIT | >=22.12.0 | upstream lock @ 4bec97a (7.0.0 exists but is untested upstream) |
| `@types/react` / `@types/react-dom` | 19.2.17 / 19.2.3 | MIT | — | required peers of `@astrojs/react` 6.0.1; upstream lock |
| `@astrojs/check` / `@astrojs/language-server` | 0.9.8 / 2.16.13 | MIT | — | template 0.7.7 pins; upstream lock |
| `typescript` | 5.9.3 | Apache-2.0 | — | upstream lock |
| `wrangler` | 4.95.0 | MIT OR Apache-2.0 | >=22.0.0 | upstream lock @ 4bec97a |

Transitive packages resolved by the lockfile include `vite` 8.3.1, `@astrojs/mdx` 8.0.2 and
`@astrojs/sitemap` 3.7.2.

- Direct and transitive licenses are permissive (MIT, ISC, Apache-2.0, BSD, MPL-2.0, and others),
  with one exception: the optional `@img/sharp-libvips-*` binaries are LGPL-3.0-or-later. They are
  build-time image tooling and never ship in `dist/`.
- The upstream scaffold command, for reference only and not run as a recipe:
  `npx @cloudflare/create-nimbus-docs@0.7.7 <dir> --deploy other --content empty --yes --skip-install --package-manager npm --no-git`
  (templates tag [`templates-v0.7.7`](https://github.com/cloudflare/nimbus/tree/templates-v0.7.7)).
- Nimbus is pre-1.0. Read its changelog before any upgrade.
- `nimbus.json` records the reviewed upgrade baseline (`lastReviewedNimbusVersion`); the
  integration refuses to build without it.

### Integration choices

- `output: 'static'`, `build.format: 'directory'`. Pages answers `/api` with `308 → /api/`, and
  `dist/404.html` makes unknown paths a real 404 instead of the SPA fallback.
- `nimbus(..., { sitemap: false })` and `search: false`. The inventory's sitemap is `/sitemap.xml`,
  built from the manifest (#7). Search belongs to #9.
- React is pinned but not registered. Registering `@astrojs/react` emits an unreferenced ~190 KB
  renderer, so add `react()` in `astro.config.ts` with the first `client:*` island.
- Nimbus always writes `dist/_nimbus/shiki.css`, which `test:dist` allows explicitly.

## Shared contracts (single definitions — do not redefine elsewhere)

| File | Exports |
| --- | --- |
| `src/contracts/manifest.ts` | `ManifestV1`, `ManifestDocument`, `Eligibility`, `MarkdownArtifact`, `ELIGIBILITY_KEYS`, `MANIFEST_SITE`, `MANIFEST_PATH`, `RESERVED_RUNTIME_PATH`, `markdownPathFor()` |
| `src/contracts/page.ts` | `PAGE_META` (`apertis-docs:id` / `:build` / `:markdown`), `TITLE_SUFFIX` (` \| Apertis Documentation`), `PageContext`, `pageContext()` |
| `src/contracts/events.ts` | `OPEN_EVENT` (`apertis-docs:open`), `OpenSurfaceDetail`, `openSearch(query?)`, `openAskDocs()`, `WindowEventMap` augmentation |
| `src/contracts/navigation.ts` | `RouteInventory` (the whole inventory file), `InventoryRoute`, `LiveObservation`, `InventoryKind` / `INVENTORY_KINDS`, `MANIFEST_KINDS` (`doc`, `page`, `blog-post`), `InventoryDisposition` / `INVENTORY_DISPOSITIONS`, `SidebarId`, `SidebarPlacement`, `NavigationEntry` |
| `src/contracts/validate-manifest.ts` | `validateManifest(manifest, { inventory, outDir })`. Node only; never import it from client code. It returns errors and never throws |

### Manifest location

The manifest has one location: `MANIFEST_PATH` = `src/manifest/manifest.json`, relative to
`site-nimbus/`. Its only loader is `src/manifest/manifest.ts`, which exports `manifest` and
`documentAt(servedPath)`.

- Until #7 writes the generated manifest there, the file is the M1 fixture: the `/` and `/api/`
  entries from `migration/nimbus/fixtures/manifest-v1.example.json`, with placeholder hashes and a
  synthetic `buildId`.
- It is a build-time input and is never published unfiltered.

### What `validateManifest` checks

- `id`, `servedPath` and `canonicalUrl` are each unique.
- Every entry comes from an inventory row of kind `doc`, `page` or `blog-post`, and its eligibility
  equals that row.
- `canonicalUrl` equals the row's `live.canonical`.
- `title` equals the row's `live.title` with `TITLE_SUFFIX` removed.
- No entry maps to `/api/ask`.
- `markdown.path` follows the `<canonical>.md` rule, and the file exists in the build output with
  the recorded hash.

The fixture has one known gap. `api:index` is `agent`-eligible, so the `/api/` page advertises
`apertis-docs:markdown=/api/index.md`, but M1 emits no Markdown. `validateManifest` reports exactly
that one missing artifact until #7 generates it.

### Rules for the next packets

- **Heads:** `src/components/DocumentHead.astro` renders only the document identity: `<title>`
  (manifest title + `TITLE_SUFFIX`), canonical and the `apertis-docs:*` metas. The page or layout
  head owns charset and viewport.
  - Do not use Nimbus's `NimbusHead` alongside it. `NimbusHead` emits its own canonical from
    `Astro.url.pathname`, which keeps the trailing slash and contradicts the inventory's no-slash
    canonicals. It also emits a `<link rel="sitemap" href="/sitemap-index.xml">`, which this site
    does not publish.
- **API route:** `src/pages/api/index.astro` is an M1 fixture shell. #7 replaces it when it mounts
  the content collection routes; keep `/api/ask` unshadowed.
- **Markdown paths:** Nimbus's built-in Markdown route (`src/pages/[...slug]/index.md.ts` in the
  scaffold, `markdownRoute()`) serves `/<slug>/index.md`. That differs from the manifest rule
  `<canonical path>.md` (for example `/getting-started/quick-start.md`, with `/index.md` only for
  slash canonicals). #7 must emit the manifest paths.
- **Routing check:** `test:routes` asserts that `POST /api/ask` returns
  `500 {"error":"Server configuration error"}`. That holds only while no root `.dev.vars` exists.
  With secrets present (#10/#12), assert on the function's 400 validation errors instead.
- **Duplicate definitions:** outside `site-nimbus/`, `functions/api/ask.ts` and
  `src/components/UnifiedSearchModal/assistantUtils.ts` still declare their own legacy
  `PageContext`. #9 and #10 should import `src/contracts/page.ts` instead.

## Shell, navigation and page actions (#8)

### Structure

| File | Role |
| --- | --- |
| `src/layouts/BaseLayout.astro` | `<html>`/`<head>` (charset, viewport, `DocumentHead`, favicon, theme bootstrap, Google Fonts as legacy), navbar, mobile drawer, footer, Ask Docs trigger, the one `<AssistantRoot />`, the one client entry |
| `src/layouts/DocLayout.astro` | Props unchanged (`doc`, `buildId`, `headings?`). Adds sidebar, breadcrumbs (mobile), page actions, `<article class="docs-content">` holding only the body, prev/next and the TOC |
| `src/pages/index.astro` | Landing page ported from `src/pages/index.js` + `index.module.css` (`page:index`); uses `BaseLayout` and has no `<article>`, as at baseline |
| `src/components/shell/navigation.ts` | `buildNavigation(inventory, documents)` / `pageNavigation(nav, docId)`: the two sidebars from the inventory `sidebar` fields; build-time only |
| `src/components/shell/page-actions.ts` | `markdownUrl(origin, metaPath)` (same-origin `.md` only) and the AI-tool URLs |
| `src/components/shell/*.astro` | `Navbar`, `Sidebar` + recursive `SidebarTree`, `Toc`, `PageActions`, `Footer` |
| `src/components/shell/shell.client.ts` | Triggers, theme switch, drawer, page actions, TOC highlight, Nimbus code-copy and heading anchors |
| `src/styles/shell.css`, `src/styles/landing.css` | Semantic port of `src/css/custom.css` and the landing CSS module |

- **Triggers.** The navbar search box, the homepage hero search and the floating Ask Docs button call `openSearch()` / `openAskDocs()` from `src/contracts/events.ts`. The shell binds no keyboard shortcut and reads no other component's DOM.
- **Theme.** `data-theme` on `<html>`, light by default, stored under the legacy `theme` localStorage key, never taken from `prefers-color-scheme`. Only CSS reads it.
- **Page actions.** Rendered only when the manifest entry has `markdown`. The client reads `<meta name="apertis-docs:markdown">` and builds `location.origin + path`. Copy as Markdown fetches that URL. A failed fetch or blocked clipboard shows a message and copies nothing, with no fallback to rendered text. The actions are hidden without JavaScript.
- **Code, admonitions, tables.**
  - DocLayout links `/_nimbus/shiki.css`; Nimbus emits Shiki tokens as `--shiki-light` / `--shiki-dark` variables, and `shell.css` maps them per theme. `figure` margins are zeroed, so code spans the full content width.
  - `aside.admonition.admonition-<type>` uses the legacy Infima colours: note = secondary (blue), tip = success, info, warning and caution = warning, danger. There are no icons, because #7 emits none.
  - Tables are `display: block; width: fit-content; max-width: 100%; overflow-x: auto`. They size like the legacy auto layout and scroll inside their own box at every width.
  - At 1440 px on chat-completions, legacy also wraps the `X-Timeout` cell onto two lines: column widths 104/69/617, against 102/67/621 here.
- **TOC.** The highlight is the legacy Docusaurus `useTOCHighlight` rule: the first h2/h3 at or below the navbar is active if it sits in the top half of the viewport, otherwise the heading before it; past the last heading, the last one.
  - As in legacy `custom.css`, the desktop TOC shows an h2's h3 list only while that h2 or one of its h3s is active. That is why legacy chat-completions shows three items at the top of the page, while `/api/` shows Quick Links' h3s.
  - The mobile "On this page" list shows every h2 and h3.
- **Mobile (≤ 996 px).** The navbar collapses to menu + brand. The drawer is a modal `<dialog>`, which provides focus containment, Escape and focus return; Nimbus `lockScroll` locks the page. Tables in `.docs-content` scroll inside their own box. The Ask Docs button becomes icon-only at ≤ 640 px.

### Nimbus parts used

- **Used:** `@cloudflare/nimbus-docs/client` only.
  - `makeDisclosure`: the page-actions menu
  - `lockScroll` / `unlockScroll`: the drawer
  - `codeCopy`: copy buttons on Shiki `pre.astro-code`
  - `headingAnchors`: `#` links on `.docs-content` h2 to h4
- **Not used:**
  - `NimbusHead`, per the #6 rule.
  - The runtime sidebar/TOC helpers. They derive navigation from content collections, while the inventory is the navigation authority here.
  - `Icon`, which needs Iconify sets that are not installed; icons are inline SVG.
- No React island, so `astro.config.ts` is unchanged.

### Deviations from legacy

- **Logo link** goes to `/`, not `https://docs.apertis.ai`, so previews stay on their own deployment.
- **Mobile drawer** shows the current sidebar, then the main links (Docs, API Reference, Release Notes, Log in, Create account). There is no Docusaurus "Back to main menu" sub-panel. Level-1 categories are headings, not collapsible.
- **Nested categories** such as AI Coding Assistants and Python SDK are native `<details open>`. There are no per-category `className`s and no NEW badges; the inventory has neither.
- **AI-tool icons** are generic inline SVGs, not the Claude/OpenAI/Cursor brand marks from `@lobehub/icons`.
- **Copy as Markdown** no longer falls back to rendered text (baseline defect 5 and the #8 spec). The URL is this deployment's `.md`, never `raw.githubusercontent.com/.../main`.
- **Ask Docs trigger** is the shell's floating button, as in the baseline screenshots. #9 must not render its own trigger. It cannot hide while the panel is open, because the shell does not listen to `apertis-docs:open`.
- **Mobile search trigger:** none, as at legacy. The navbar search is hidden at ≤ 996 px; the hero search remains on `/`.
- **Prism light and dark themes** are not ported. Code colours come from #7's Shiki output and `_nimbus/shiki.css`.

### How #7's pages plug in

- **Render call.** Render `<DocLayout doc={documentAt(servedPath)} buildId={manifest.buildId} headings={headings}>` with the body in the slot. `headings` come from Astro `render()`: depth 2 and 3 feed the TOC. Heading `id`s must be the inventory `headingIds`.
- **H1 placement.** Put the H1 as the first child of the body. On desktop the page actions sit to its right, outside `<article>`, so fixture link and hash checks see only the body.
- **Sidebar.** Entries come from `src/manifest/manifest.json`: label is `sidebar.label ?? title`, href is `servedPath`.
  - Until a row has a manifest entry, the sidebar falls back to the inventory's live title and served path. This is PoC-only; remove it once the manifest covers every row.
  - Documents with `sidebar: null` (for example `/help/ideas`) render with no sidebar and no entry, but stay published.
- **Prev/next** link only to sidebar neighbours that have a manifest entry, so they never lead to a PoC 404.
- **Known PoC 404 links.** The sidebar keeps the full legacy placement, so these 66 fallback entries 404 until #7 converts them:
  - tutorialSidebar (29): `/intro/`, `/installation/models/`, `/principles/`, `/usage/`, `/authentication/organizations/`, `/billing/quota-management/`, `/billing/payg/`, `/billing/payment-methods/`, `/billing/rate-limits/`, `/installation/opencode/`, `/installation/crush/`, `/installation/goose/`, `/installation/cline/`, `/installation/cursor/`, `/installation/continue/`, `/installation/kilo-code/`, `/installation/kilo-cli/`, `/installation/chatbox/`, `/installation/translate/`, `/installation/bolt_diy/`, `/installation/connection/`, `/installation/scripts/`, `/security/best-practices/`, `/help/faq/`, `/help/troubleshooting/`, `/help/error-codes/`, `/help/migration-guides/`, `/opensource/`, `/stimachat/`
  - apiSidebar (37): `/api/text-generation/structured-output/`, `/api/text-generation/prompt-cache/`, `/api/text-generation/context-compression/`, `/api/search/web-search/`, `/api/vision/read-image/`, `/api/vision/image-generation/`, `/api/vision/dalle/`, `/api/vision/images-api/`, `/api/audio-video/audio/`, `/api/audio-video/video/`, `/api/embeddings/guide/`, `/api/embeddings/embeddings-api/`, `/api/embeddings/rerank/`, `/api/sdks/agent-sdk/`, `/api/sdks/python-sdk/` and its 13 pages, `/api/sdks/langchain/`, `/api/sdks/llamaindex/`, `/api/sdks/litellm/`, `/api/sdks/mcp-server/`, `/api/sdks/cli/`, `/api/utilities/models/`, `/api/utilities/recommend/`, `/api/utilities/fallback-models/`, `/api/utilities/billing-credits/`
  - Shell links outside the sidebar: the navbar and drawer "Docs" (`/intro`), and the landing cards `/intro` and `/installation/models` (308 → the same 404).
- **Markdown actions** appear automatically when `doc.markdown` is set and read `doc.markdown.path` on the same origin.

### Checks

- `npm test` includes `test/m3-shell.test.ts`: navigation from the inventory and the same-origin Markdown URL rules.
- `PREVIEW_URL=http://127.0.0.1:<port> PLAYWRIGHT=<path to playwright/index.mjs> npm run test:m3-browser` checks, with system Chrome:
  - the /api/ sidebar against the inventory
  - theme default and persistence
  - the 390×844 drawer: focus, Escape, backdrop, scroll lock, no horizontal overflow
  - `apertis-docs:open` surfaces, and no Cmd/Ctrl+K in the shell
  - Copy/View/URL actions on the same-origin `.md`: a forced 404 and a network abort are reported with nothing copied, and the real artifact is copied byte-exact, with a hash equal to the manifest's
  - on #7's real pages:
    - the drawer's scroll lock holds under wheel and touch
    - code tokens are coloured in both themes and full width
    - admonition styles for every type in both themes
    - wide tables scroll inside the content column, with legacy column sizes
    - the legacy TOC rule
    - exactly one H1, and TOC links equal to the h2/h3 ids
    - prev/next only to converted pages
  - no-JS navigation
  - no GitHub raw requests
- Use a localhost origin, because the Clipboard API needs a secure context. `npm test` skips the browser test when either variable is unset.

## #7 — PoC conversion and publication manifest

### Usage

Run this in `site-nimbus/`:

```sh
npm run m2:regenerate   # = node converter/convert.ts (phase 1) && npm run build (phase 2 in astro:build:done)
```

Commit what it changes. Generated files are never edited by hand. A test regenerates them and fails
on any drift.

**Every committed change to a `site-nimbus` input needs a regenerated manifest.** `buildId` hashes
every tracked file under `site-nimbus/`, so this applies to the converter, contracts, routes,
layouts, config, tests, the README and the lockfile. It also applies to the route inventory.

- Run `npm run m2:regenerate` and commit `src/manifest/manifest.json` together with the change.
- Otherwise the drift test (`test/m2-convert.test.ts`) fails.
- If the change alters `/`, a build under `CI` or `M2_CHECK=1` also fails.

| Path | What it is |
| --- | --- |
| `converter/convert.ts` | Phase 1: converter, `sourceSha`/`buildId`, manifest writer, `mainTextSha256()` |
| `converter/integration.ts` | Phase 2 (Astro integration registered in `astro.config.ts`) |
| `src/content/docs/<servedPath>index.md` | Render sources: the Nimbus `docs` collection (`src/content.config.ts`) |
| `src/content/public/**` | Clean Markdown artifacts at `markdown.path`, plus bundled images; copied verbatim into `dist/` |
| `src/manifest/manifest.json` | Manifest v1 for the 12 PoC documents |
| `src/pages/[...slug].astro` | One route for every converted document, rendered in `DocLayout` with `headings`. It replaces the `/api/` fixture shell |

Phase 1 wipes its output directories before each run. That way a deleted or renamed source leaves
nothing stale behind.

### Supported constructs

These are the constructs the 11 PoC sources actually use.

- **Front matter:** only the keys `title`, `description`, `sidebar_label` and `sidebar_position`.
  - `title` and `description` go into the render source.
  - Sidebar keys are dropped, because navigation comes from the inventory `sidebar`.
  - The title (front matter, else the body H1) must equal the inventory title.
  - Only one H1 is allowed. When the body has none, the title is added as the H1.
- **Docusaurus admonitions:** `:::note|tip|info|warning|caution|danger [title]` at column 0.
  - HTML gets `<aside class="admonition admonition-<type>">` with a `.admonition-title`.
  - Clean Markdown gets a blockquote, `> **Tip: title**`.
  - Both forms are followed by a blank line, so a paragraph right after `:::` stays outside the
    admonition.
- **Links:** an internal link must resolve to an inventory route, else conversion fails.
  - `./x.md` / `../x.mdx` resolve through the inventory `sourcePath`.
  - Extensionless relative links resolve against the canonical path, as Docusaurus does.
  - Output is root-absolute and keeps any `?query`/`#fragment`.
  - External and `mailto:` links pass through unchanged.
- **Images:**
  - Absolute `/img/...` must exist in legacy `static/` and stays at that path.
  - Relative images (such as `../static/img/roocode_1.png`) are bundled to `/assets/images/<name>-<16 hex sha256>.<ext>`.
- **The MDX heading icon:** `# <img src=… width=… style={{…}} /> Title`.
  - HTML keeps it as a plain `<img alt="">` with CSS converted from the JSX style.
  - Clean Markdown drops the decorative icon, leaving `# Title`.
- **Code:** fenced code bytes are preserved (CRLF becomes LF). The info string may only be a
  language.

These fail with `file:line: construct` and stop the conversion:

- imports/exports
- JSX or inline HTML, including `<Tabs>`/`<TabItem>` and HTML comments
- links split across lines (an unmatched `](`)
- admonition titles with Markdown other than code spans
- `{…}` expressions
- `{#id}` heading ids
- fence meta (`title=`, `npm2yarn`)
- indented, nested or unclosed admonitions
- unclosed fences
- reference-style links
- unknown front-matter keys

The PoC set uses none of these. #13 adds support for each one as the full corpus needs it.

HTML is rendered by Nimbus's Sätteri pipeline:

- Its heading ids match every inventory `live.headingIds` value on all 11 pages.
- `markdown.smartypants: false` keeps legacy straight quotes. Astro flags this option as
  deprecated (see gaps).

### Two-phase manifest

1. **Phase 1 (`convert.ts`)** writes every manifest field.
   - `contentSha256` equals `markdown.sha256` for agent-eligible entries.
   - Entries without Markdown (`page:index`) carry forward their previous hash, or zeros when
     there is none.
2. **Phase 2 (`astro:build:done`)** does the rest of the work after the build:
   - copies `src/content/public/**` into `dist/`, refusing to overwrite anything;
   - sets each markdown-less entry's `contentSha256` to the SHA-256 of its built `<main>` text,
     with whitespace collapsed and trimmed;
   - writes the manifest atomically, and only when the hash changed;
   - under `CI` or `M2_CHECK=1`, fails instead of rewriting, because the committed manifest is
     stale (`npm test` builds this way and never modifies tracked files);
   - fails the build unless `validateManifest(manifest, { inventory, outDir })` returns `[]` and
     nothing exists at `/api/ask`.

No HTML output contains `contentSha256` (`test:dist` asserts this). So phase 2 never invalidates
the pages it hashes: one build reaches the fixed point, and a rebuild is byte-identical
(`test/m2-rebuild.test.ts`).

After #8 changes `/`, run `npm run m2:regenerate` and commit the updated manifest.

Rows that are not publish-eligible are still converted, so their constructs are checked, but they
get no render source and no artifact. Their `contentSha256` is the hash of the clean Markdown, since
they have neither HTML nor an artifact. A row that is agent-eligible but not publish-eligible fails.

The full manifest is a build input only. It is never copied to `dist/`.

### sourceSha and buildId

- **`sourceSha`** is `git log -1 --format=%H -- docs docs-api src/pages blog static`: the last commit
  touching the legacy publication roots.
  - It is reproducible from any full clone.
  - It does not change when the candidate, the converter or sibling packets commit, so the
    committed manifest can name it. `HEAD` would always be one commit stale.
  - Conversion refuses a shallow clone and uncommitted changes under those roots. CI must check out
    with `fetch-depth: 0`.
  - It assumes docs changes land as merge commits. If a docs change is squash- or rebase-merged,
    `main` gets a new commit, so the committed manifest's `sourceSha` goes stale. The drift test
    then fails on `main` until someone runs `npm run m2:regenerate` and commits the result.
- **`buildId`** is `<sourceSha>.<first 12 hex of SHA-256>` over the build inputs:
  - the working-tree bytes of every file `git ls-files` tracks under `site-nimbus/`;
  - `migration/nimbus/route-inventory.json`.
  - Generated output (`src/content/**`, `src/manifest/manifest.json`) is excluded. Untracked files
    (such as `.DS_Store` or `.evidence/`) never count.
  - Paths are repository-relative, sorted, and each hashed as `path\0bytes\0`.

### Extending to the full corpus (#13)

1. Widen the row filter in `convert()` (marked `ponytail:`) from `r.poc` to every preserved
   `doc`/`page`/`blog-post` row.
2. Add each construct the corpus actually uses to `convertDocument()`, with a test, instead of
   loosening the loud failures.
3. Standalone pages (`page:*`) and blog posts keep their own routes. Markdown-less entries are
   already hashed by phase 2.
4. Replace the `/`-only `live.links` parity with full-corpus link and anchor checks. Out-of-PoC
   targets are then in the set, so `pocCoverageLimits` goes away.

## Search and Ask Docs (#9)

### Search engine and index

- **Engine:** Pagefind `1.5.2`, pinned exactly as a devDependency. That is the version in the
  upstream Nimbus lock @ `4bec97a`, and it is MIT licensed.
- **Why not Nimbus's own search:** the Nimbus `search` option stays `false`. Its built-in run
  executes `pagefind --site dist` and crawls every HTML file in `dist/`.
- **Build step:** `src/search/index-build.ts` runs the Pagefind Node API from an
  `astro:build:done` integration (`searchIndex(manifest.documents)` in `astro.config.ts`).
- **Index inputs:**
  - Only manifest entries with `eligibility.publish && eligibility.search` are indexed.
  - Each entry's built page is read from `dist/<servedPath>index.html` and indexed under
    `url: servedPath`.
  - Nothing is crawled, so ineligible pages (the homepage, 404) never enter the index.
  - The index grows with #7's manifest with no code change.
- **Indexed region:** the page's `<article>` (`rootSelector`), whose first `<h1>` is the result
  title.
  - The build fails if an eligible page is missing or has no `<article>` with an `<h1>`.
  - **Interface for #8:** DocLayout must keep the document body, including its `<h1>`, inside
    `<article>`, and keep the shell chrome outside it.
  - The assistant dialog carries `data-pagefind-ignore="all"`.
- **Output:** `dist/pagefind/`, with the prebuilt Pagefind UIs and the unused-language wasm
  removed.
  - `test:dist` allows exactly the files the client loads.
  - It checks that the decompressed fragments hold exactly the eligible `servedPath`s, each with
    content and a title, and no internals, secret names or env values.
- **Lazy loading:** nothing under `/pagefind/` loads before the dialog first opens. The client then
  runs `import('/pagefind/pagefind.js')`, which loads a worker, the wasm and index chunks.
- **Query tokenization (`src/search/query.ts`):** Pagefind indexes a path or URL such as
  `https://api.apertis.ai/v1/chat/completions` as one compound word. A partial path like
  `chat/completions` then matches it neither literally nor by prefix.
  - Every query that contains separator punctuation (anything except letters, digits, whitespace,
    `_` and `-`) is also searched with that punctuation as word breaks. For example,
    `chat/completions` is also searched as `chat completions`.
  - Literal matches keep their rank, and part matches follow without duplicates.
  - The rule is general: it applies the same way to every query and page. There is no query list,
    no per-page keyword and no index change. Queries without such punctuation (`ANTHROPIC_BASE_URL`,
    `createApertis`, `ai-sdk-provider`, `base url`) run exactly as before.
  - Proved by `test/m4-query.test.ts`. `test/m4-e2e.test.ts` reproduces the real failure on a
    synthetic index: the target shows the path only inside a URL in code, while another page has the
    literal token.
- **Ranking:** Pagefind's defaults, not tuned to `search-queries.json`.
- **Chrome in the index:** Pagefind already skips `<nav>`. `test:dist` checks that no other link
  label outside `<article>` reaches the index. The check is skipped until #8's shell exists.
- **Measured result** (`measure.mjs search --scope poc` on the PoC corpus, candidate served locally,
  merged with the integration branch at 337f6ae):
  - Before the tokenization change: 13/14. `chat/completions` returned only
    `/getting-started/quick-start`.
  - After it: 14/14, with `keyboardFocus: true`. `chat/completions` ranks the target second, after
    `/getting-started/quick-start`.
  - The other 13 queries have the same rank as before (1, or 2 for `/v1/messages` and `base url`).
  - The legacy baseline is 7/14.
  - #12 owns the gate.

### Dialog and keyboard contract (`src/components/assistant/`)

`AssistantRoot.astro` renders one `<dialog id="apertis-assistant">` that hosts both surfaces, and
`assistant.ts` drives it.

- **Only listener:** it is the only listener for `apertis-docs:open` (on `window`, with
  `{surface, query?}`).
- **Only Cmd/Ctrl+K owner:** the shortcut toggles Search, and switches to Search from Ask Docs.
- **Search** opens as a modal (`showModal()`):
  - Focus lands in the combobox input.
  - The page behind it does not scroll (`html.aa-scroll-lock`).
  - Focus is contained by the modal dialog.
  - The first result is selected whenever results change.
  - ArrowUp/ArrowDown move the selection, clamped at the ends.
  - Enter opens the selected result.
  - Escape and a backdrop click close it, and focus returns to the opener.
- **Ask Docs** is a non-modal panel (`show()`), docked right on desktop and a bottom sheet at
  ≤ 640 px.
  - Escape closes it, except while focus is in the composer.
  - Enter sends; Shift+Enter inserts a newline.
  - The open state and the conversation persist for the browser session (`sessionStorage`), so the
    panel reopens on the next page with that page's context.
- The inactive surface is `hidden`.
- The shell's triggers (navbar, hero, floating Ask button) belong to #8 and only dispatch the
  event.

### Ask Docs wire client (`wire.ts`)

- **Request:** `POST /api/ask` (same origin) with exactly `{question, sessionId, turnstileToken,
  pageContext?}`.
  - `sessionId` comes from `sessionStorage.askai_session_id`. On plain-HTTP hosts it falls back to
    `crypto.getRandomValues`.
  - If site storage is blocked, the session and conversation are kept in memory for the page.
    Search and Ask Docs still work.
  - `pageContext` is `{title, href}`. It is read at send time from `document.title` without
    `TITLE_SUFFIX` and from the current location, using the contract's `pageContext()`.
- **Streaming:** `data: {"content"}` frames render incrementally. `data: [DONE]` ends the answer.
  EOF without `[DONE]` is shown as interrupted. Frames without `content` are ignored.
  - **Closing mid-stream:** closing the panel aborts the request (`AbortController`) and keeps the
    turn as interrupted.
  - **Saving:** the question is saved when sent. The partial answer is saved on `pagehide` and when
    the turn ends. A turn that was still streaming is stored as interrupted.
- **Errors:**
  - 429 shows the legacy fixed message.
  - Any other non-2xx shows `Ask Docs could not answer (HTTP <status>): <error>[: <details>]`.
  - Network failures are shown in the panel.
- **Citations:** internal Markdown links render as links and source pills.
  - Internal means root-relative and same-origin.
  - `//host`, backslash forms such as `/\host`, and schemes are rejected (`isInternalHref`).
- **Turnstile:**
  - It uses the legacy site key `0x4AAAAAACS2SzpYBFytHb_E`. That key is hardcoded in the legacy
    `AskAITab.tsx` and recorded in `ask-wire.json`; it is not in `docusaurus.config.js`
    `customFields`.
  - The script (`render=explicit`) loads only when Ask Docs first opens.
  - The token is one-shot and the widget is reset after each send.
  - These all show a visible message and keep Send disabled: `error-callback`, script load
    failure, no response within 30 s, and challenge timeout.
  - `expired-callback` disables Send and re-verifies.
  - A script load failure is retried the next time Ask Docs opens.
  - All of these paths are covered by `test/m4-e2e.test.ts` with the stub; the 30 s path uses
    Playwright's clock.
- **Search errors:** a failed search or result load shows a visible error.
  - Pagefind itself reports a failed index chunk as no results. It logs the failure to the console
    but does not reject.
- **No canned answers:** there is no simulated answer or hostname branch in the client.

### Baseline defects fixed and their checks

| Defect | Fix | Check |
| --- | --- | --- |
| 3: Cmd/Ctrl+K leaves focus on `<body>` | single keydown owner focuses the input | e2e "Cmd/Ctrl+K opens search…"; `measure.mjs search` reports `keyboardFocus: true` |
| 4: stale page context | context read at send time | e2e "page context is read fresh after navigating…" (`/` → `/api/` → `/api/#overview`) |
| 6: canned localhost answer | none in the client | `test:dist` "no simulated or canned Ask Docs answer path ships" |
| 9: page scrolls behind search | scroll lock while Search is open | e2e wheel and PageDown with a tall page, open vs closed |
| 10: early query stays empty | queries await the index, and the latest one wins | e2e holds `pagefind.js` until after typing |
| 11: silent Turnstile failure | visible panel message | e2e Turnstile `110200` and offline |

### Browser proof

Run it against a running preview. Playwright is not a dependency; point `PLAYWRIGHT` at its
`index.mjs`, as for `scripts/nimbus/measure.mjs`.

```sh
PREVIEW_URL=http://127.0.0.1:8803 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/m4-e2e.test.ts
```

- Without both variables the suite is skipped and says so. `npm test` stays hermetic.
- **Contract evidence:** the `/api/ask` and Turnstile stubs.
- **Local-build evidence:** the one case without `.dev.vars` that reaches the real function and
  shows its `500 Server configuration error`.
- The suite fails on any request that leaves the preview origin, other than the stubbed Turnstile
  script.
- Real-assistant and real-Turnstile evidence need an isolated environment and an allowed
  Turnstile hostname. Both are BLOCKED.
