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
