import { defineConfig } from 'astro/config';
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs';

// Static output only; `npm run preview` serves dist/ with the repo-root Pages Functions.
// React 19 and @astrojs/react are pinned in package.json but not registered: registering
// them emits an unreferenced ~190 KB renderer. Add `react()` with the first `client:*` island.
export default defineConfig({
  site: 'https://docs.apertis.ai',
  output: 'static',
  // Directory pages (`/api/` -> dist/api/index.html); Pages answers `/api` with 308 -> `/api/`.
  build: { format: 'directory' },
  integrations: [
    nimbus(
      defineNimbusConfig({
        site: 'https://docs.apertis.ai',
        title: 'Apertis Documentation',
        locale: 'en',
        github: null,
        // Search/Ask Docs is #9's client, opened through `apertis-docs:open`.
        search: false,
      }),
      // The inventory route is /sitemap.xml built from publish-eligible manifest entries,
      // not @astrojs/sitemap's sitemap-index.xml.
      { sitemap: false },
    ),
  ],
});
