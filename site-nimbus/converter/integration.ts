// #7 phase 2, run by `astro build` (astro:build:done):
//   1. copy src/content/public/** (clean Markdown artifacts, bundled images) into dist verbatim;
//   2. set contentSha256 of every published entry without Markdown (page:index) from its built <main>
//      (under CI or M2_CHECK=1 a difference fails the build instead: the committed manifest is stale);
//   3. write sitemap.xml and the retired-route _redirects (publicationFiles);
//   4. fail the build unless validateManifest(manifest, { inventory, outDir: dist }) returns [] and
//      nothing is emitted at /api/ask.
// No HTML embeds contentSha256 (test:dist checks), so step 2 never invalidates the pages just built:
// one build reaches the fixed point, and a rebuild leaves the manifest byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

import type { ManifestV1 } from '../src/contracts/manifest.ts';
import type { InventoryRoute } from '../src/contracts/navigation.ts';
import { validateManifest } from '../src/contracts/validate-manifest.ts';
import { GENERATED_PUBLIC, REPO_ROOT, SITE_ROOT, mainTextSha256, readInventory, writeManifest } from './convert.ts';

/**
 * `check` (on when CI is set or M2_CHECK=1): never rewrite the committed manifest; fail if the build
 * disagrees with it, so a stale manifest cannot pass unnoticed.
 */
export function finalize(outDir: string, siteRoot = SITE_ROOT, { check = false }: { check?: boolean } = {}): string[] {
  const log: string[] = [];
  const pub = path.join(siteRoot, GENERATED_PUBLIC);
  for (const e of fs.readdirSync(pub, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
    const rel = path.relative(pub, path.join(e.parentPath, e.name));
    const dest = path.join(outDir, rel);
    if (fs.existsSync(dest)) throw new Error(`m2: ${rel} is already emitted by the build; refusing to overwrite`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(pub, rel), dest);
  }

  const manifestFile = path.join(siteRoot, 'src/manifest/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ManifestV1;
  let changed = false;
  for (const d of manifest.documents.filter((x) => x.markdown === null && x.eligibility.publish)) {
    const hash = mainTextSha256(fs.readFileSync(path.join(outDir, `.${d.servedPath}index.html`), 'utf8'));
    if (hash !== d.contentSha256) {
      log.push(`${d.id}: contentSha256 ${d.contentSha256.slice(0, 12)} -> ${hash.slice(0, 12)}`);
      d.contentSha256 = hash;
      changed = true;
    }
  }
  if (changed && check) {
    throw new Error(`m2: committed manifest not regenerated (${log.join('; ')}); run npm run m2:regenerate and commit src/manifest/manifest.json`);
  }
  if (changed) writeManifest(siteRoot, manifest);

  const inventory = readInventory(REPO_ROOT);
  for (const [rel, body] of Object.entries(publicationFiles(manifest, inventory, outDir))) {
    if (fs.existsSync(path.join(outDir, rel))) throw new Error(`m2: ${rel} is already emitted by the build; refusing to overwrite`);
    fs.writeFileSync(path.join(outDir, rel), body);
  }
  const errors = validateManifest(manifest, { inventory, outDir });
  for (const reserved of ['api/ask', 'api/ask/index.html', 'api/ask.html']) {
    if (fs.existsSync(path.join(outDir, reserved))) errors.push(`dist: ${reserved} shadows the reserved runtime path`);
  }
  if (errors.length) throw new Error(`m2: manifest validation failed:\n${errors.join('\n')}`);
  return log;
}

/** Rewrite target for retired routes: a path nothing in dist serves, so Pages answers its 404. */
export const RETIRED_TARGET = '/__retired';

/**
 * Root files derived from the manifest and the inventory (#13):
 * - `sitemap.xml` (inventory `generated:/sitemap.xml`): the canonical URL of every published HTML
 *   route, i.e. publish-eligible manifest entries plus published `generated` rows (`/search`).
 * - `_redirects`: retired rows (decision on #4) must answer 404. A retired path that a dist file
 *   would still serve (only `/404`, by `404.html`) is rewritten to RETIRED_TARGET, which answers the
 *   normal 404 page with status 404. Cloudflare Pages `_redirects` has no 404/410 status of its own.
 */
export function publicationFiles(manifest: ManifestV1, inventory: InventoryRoute[], outDir: string): Record<string, string> {
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = [
    ...manifest.documents.filter((d) => d.eligibility.publish).map((d) => d.canonicalUrl),
    ...inventory.filter((r) => r.kind === 'generated' && r.eligibility.publish && r.live?.canonical).map((r) => r.live!.canonical!),
  ].sort();
  const files: Record<string, string> = {
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xml(u)}</loc></url>\n`).join('')}</urlset>\n`,
  };
  const served = (p: string) => [`${p}.html`, `${p}/index.html`, p].some((f) => fs.existsSync(path.join(outDir, f)) && fs.statSync(path.join(outDir, f)).isFile());
  // `retired` is not yet in INVENTORY_DISPOSITIONS (src/contracts, lead-owned): compared as a string until it is.
  const rules = inventory.filter((r) => (r.disposition as string) === 'retired' && served(r.path))
    .flatMap((r) => [r.path, `${r.path}/`, `${r.path}.html`].map((from) => `${from} ${RETIRED_TARGET} 200`));
  if (served(RETIRED_TARGET)) throw new Error(`m2: ${RETIRED_TARGET} must not exist in dist`);
  if (rules.length) files._redirects = `# Retired routes (decision on #4) answer 404: rewritten to a path nothing serves.\n${rules.join('\n')}\n`;
  return files;
}

export default function publication(): AstroIntegration {
  return {
    name: 'apertis-m2-publication',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const check = Boolean(process.env.CI) || process.env.M2_CHECK === '1';
        for (const line of finalize(fileURLToPath(dir), SITE_ROOT, { check })) logger.info(line);
        logger.info('manifest finalized and validated');
      },
    },
  };
}
