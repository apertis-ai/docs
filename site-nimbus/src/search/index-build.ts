// Local search index (#9): Pagefind over the publish+search-eligible manifest entries only.
// Each entry's built page is read from dist/<servedPath>index.html; nothing is crawled from the
// filesystem, so ineligible pages (the homepage, 404, drafts) can never enter the index.
// Node-only (build time). The client loads the bundle lazily from /pagefind/pagefind.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';

import type { ManifestDocument } from '../contracts/manifest.ts';

export const SEARCH_DIR = 'pagefind';
/** The indexed region of every page. DocLayout keeps the document body in `<article>`. */
export const SEARCH_ROOT = 'article';
// Pagefind also writes its prebuilt UIs and an unused-language wasm; the client loads none of them.
const UNUSED = /^(pagefind-(ui|modular-ui|component-ui|highlight)\.(js|css)|wasm\.unknown\.pagefind)$/;

export function searchDocuments(docs: ManifestDocument[]): ManifestDocument[] {
  return docs.filter((d) => d.eligibility.publish && d.eligibility.search);
}

/** Writes `<distDir>/pagefind/` for `docs`; throws when a page is missing or has no indexable article. */
export async function buildSearchIndex(distDir: string, docs: ManifestDocument[]): Promise<number> {
  try {
    const { index, errors } = await pagefind.createIndex({ rootSelector: SEARCH_ROOT, forceLanguage: 'en' });
    if (!index) throw new Error(`pagefind: ${errors.join('; ')}`);
    for (const doc of docs) {
      const content = fs.readFileSync(path.join(distDir, doc.servedPath, 'index.html'), 'utf8');
      const { errors: fileErrors, file } = await index.addHTMLFile({ url: doc.servedPath, content });
      if (fileErrors.length || !file.meta.title) {
        throw new Error(`search index: ${doc.id} (${doc.servedPath}) has no <${SEARCH_ROOT}> with an <h1> ${fileErrors.join('; ')}`);
      }
    }
    const outputPath = path.join(distDir, SEARCH_DIR);
    const written = await index.writeFiles({ outputPath });
    if (written.errors.length) throw new Error(`pagefind: ${written.errors.join('; ')}`);
    for (const name of fs.readdirSync(outputPath)) if (UNUSED.test(name)) fs.rmSync(path.join(outputPath, name));
    return docs.length;
  } finally {
    await pagefind.close();
  }
}

/** Astro integration: builds the index after every static build. */
export function searchIndex(documents: ManifestDocument[]): AstroIntegration {
  return {
    name: 'apertis-search-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const count = await buildSearchIndex(fileURLToPath(dir), searchDocuments(documents));
        logger.info(`search index: ${count} documents`);
      },
    },
  };
}
