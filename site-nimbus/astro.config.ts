import { defineConfig } from 'astro/config';
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs';
import publication from './converter/integration.ts';

import { manifest } from './src/manifest/manifest.ts';
import { searchIndex } from './src/search/index-build.ts';

// Shiki stops tokenizing a line after `tokenizeTimeLimit` (500 ms by default), so on a loaded machine the
// same code block renders with different tokens and the build is no longer deterministic (#13). Astro
// exposes no option for it; Shiki passes the same options object to `preprocess` and then to the
// tokenizer, and 0 means no limit.
const noTokenizeTimeLimit = {
  name: 'apertis:no-tokenize-time-limit',
  preprocess(_code: string, options: { tokenizeTimeLimit?: number }) {
    options.tokenizeTimeLimit = 0;
  },
};

// Static output only; `npm run preview` serves dist/ with the repo-root Pages Functions.
// React 19 and @astrojs/react are pinned in package.json but not registered: registering
// them emits an unreferenced ~190 KB renderer. Add `react()` with the first `client:*` island.
export default defineConfig({
  site: 'https://docs.apertis.ai',
  output: 'static',
  // Legacy static/ files are inventory rows (kind static-asset) served at their original paths.
  publicDir: '../static',
  // Directory pages (`/api/` -> dist/api/index.html); Pages answers `/api` with 308 -> `/api/`.
  build: { format: 'directory' },
  // Legacy Docusaurus renders straight quotes; keep HTML text equal to the clean Markdown artifacts.
  markdown: { smartypants: false, shikiConfig: { transformers: [noTokenizeTimeLimit] } },
  integrations: [
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
