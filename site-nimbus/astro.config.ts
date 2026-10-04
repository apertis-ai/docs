import { defineConfig } from 'astro/config';
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import publication from './converter/integration.ts';

import { manifest } from './src/manifest/manifest.ts';
import { searchIndex } from './src/search/index-build.ts';
import { noTokenizeTimeLimit } from './src/lib/shiki.ts';

// Static output only; `npm run preview` serves dist/ with the repo-root Pages Functions.
// React renders the vendored shadcn/ui components: at build time only, unless an island asks for
// `client:*` (search/Ask Docs, the navigation sheet, page actions, the hero code tabs, the mobile TOC).
export default defineConfig({
  site: 'https://docs.apertis.ai',
  output: 'static',
  // Legacy static/ files are inventory rows (kind static-asset) served at their original paths.
  publicDir: '../static',
  // Directory pages (`/api/` -> dist/api/index.html); Pages answers `/api` with 308 -> `/api/`.
  build: { format: 'directory' },
  // Legacy Docusaurus renders straight quotes; keep HTML text equal to the clean Markdown artifacts.
  markdown: { smartypants: false, shikiConfig: { transformers: [noTokenizeTimeLimit] } },
  vite: { plugins: [tailwindcss()] },
  integrations: [
    react(),
    nimbus(
      defineNimbusConfig({
        site: 'https://docs.apertis.ai',
        title: 'Apertis Documentation',
        locale: 'en',
        github: null,
        // Search/Ask Docs is #9's client, opened through `apertis-docs:open`. Nimbus's own Pagefind
        // run crawls all of dist/, so the index is built from the manifest by searchIndex() below.
        search: false,
      }),
      // The inventory route is /sitemap.xml built from publish-eligible manifest entries,
      // not @astrojs/sitemap's sitemap-index.xml.
      { sitemap: false },
    ),
    // #7: publishes Markdown artifacts and finalizes/validates the manifest after the build.
    publication(),
    // After the pages exist: Pagefind index of the publish+search-eligible manifest entries (#9).
    searchIndex(manifest.documents),
  ],
});
