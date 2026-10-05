// #7 phase 2, run by `astro build` (astro:build:done):
//   1. copy src/content/public/** (clean Markdown artifacts, bundled images) into dist verbatim;
//   2. set contentSha256 of every published entry without Markdown (page:index) from its built <main>
//      (under CI or M2_CHECK=1 a difference fails the build instead: the committed manifest is stale);
//   3. write sitemap.xml and the retired-route _redirects (publicationFiles), llms.txt and llms-full.txt (llmsFiles);
//      every build starts from a cleared content-layer cache, and a page that uses a Shiki class
//      missing from _nimbus/shiki.css fails the build (shikiClassErrors);
//   4. fail the build unless validateManifest(manifest, { inventory, outDir: dist }) returns [] and
//      nothing is emitted at /api/ask.
// No HTML embeds contentSha256 (test:dist checks), so step 2 never invalidates the pages just built:
// one build reaches the fixed point, and a rebuild leaves the manifest byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

import { llmsFull, llmsIndex, type LlmsPage } from '../src/agent/llms.ts';
import { leadSentence, topLevelParagraphs } from '../src/components/shell/page-header.ts';
import { buildNavigation } from '../src/components/shell/navigation.ts';
import { MANIFEST_SITE, type ManifestV1 } from '../src/contracts/manifest.ts';
import type { InventoryRoute, SidebarId } from '../src/contracts/navigation.ts';
import { decodeEntities, validateManifest } from '../src/contracts/validate-manifest.ts';
import { GENERATED_PUBLIC, REPO_ROOT, SITE_ROOT, assertStaticClean, mainTextSha256, readInventory, readRawInventory, writeManifest } from './convert.ts';

/**
 * `check` (on when CI is set or M2_CHECK=1): never rewrite the committed manifest; fail if the build
 * disagrees with it, so a stale manifest cannot pass unnoticed.
 */
export function finalize(outDir: string, siteRoot = SITE_ROOT, { check = false }: { check?: boolean } = {}): string[] {
  const log: string[] = [];
  if (check) assertStaticClean(REPO_ROOT);
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
  for (const [rel, body] of Object.entries({ ...publicationFiles(manifest, inventory, outDir), ...llmsFiles(manifest, inventory, outDir) })) {
    if (fs.existsSync(path.join(outDir, rel))) throw new Error(`m2: ${rel} is already emitted by the build; refusing to overwrite`);
    fs.writeFileSync(path.join(outDir, rel), body);
  }
  sortShikiCss(outDir);
  // Raw rows: the validator decodes the recorded titles itself, so nothing is decoded twice.
  const errors = validateManifest(manifest, { inventory: readRawInventory(REPO_ROOT), outDir });
  errors.push(...shikiClassErrors(outDir));
  for (const reserved of ['api/ask', 'api/ask/index.html', 'api/ask.html']) {
    if (fs.existsSync(path.join(outDir, reserved))) errors.push(`dist: ${reserved} shadows the reserved runtime path`);
  }
  if (errors.length) throw new Error(`m2: manifest validation failed:\n${errors.join('\n')}`);
  return log;
}

/**
 * Every `nb-shiki-*` class a built page uses must be defined in Nimbus's `_nimbus/shiki.css`, or its
 * code tokens render uncoloured. Nimbus writes only the classes highlighted during this build, so a
 * page rendered from Astro's content cache can reference classes the stylesheet lacks (#13 finding;
 * `publication()` clears that cache before every build).
 */
export function shikiClassErrors(outDir: string): string[] {
  const html = fs.readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.join(e.parentPath, e.name));
  const css = path.join(outDir, '_nimbus/shiki.css');
  const defined = new Set(fs.existsSync(css) ? [...fs.readFileSync(css, 'utf8').matchAll(/\.(nb-shiki-[a-z0-9]+)\{/g)].map((m) => m[1]) : []);
  const errors: string[] = [];
  for (const file of html) {
    const missing = [...new Set([...fs.readFileSync(file, 'utf8').matchAll(/\b(nb-shiki-[a-z0-9]+)\b/g)].map((m) => m[1]))].filter((c) => !defined.has(c));
    if (missing.length) errors.push(`dist: ${path.relative(outDir, file)} uses ${missing.join(', ')}, not defined in _nimbus/shiki.css`);
  }
  return errors;
}

/**
 * Nimbus writes `_nimbus/shiki.css` rules in the order Shiki registered them, which varies with
 * parallel rendering on a cold build. Each rule is one unique class, so sorting them by class name
 * changes no styling and makes the file byte-identical across builds.
 */
export function sortShikiCss(outDir: string): void {
  const file = path.join(outDir, '_nimbus/shiki.css');
  if (!fs.existsSync(file)) return;
  const css = fs.readFileSync(file, 'utf8');
  const rules = [...css.matchAll(/\.(nb-shiki-[a-z0-9]+)\{[^{}]*\}/g)];
  if (!rules.length || rules.map((m) => m[0]).join('') !== css.trimEnd()) return; // not the one-line form Nimbus writes: leave it untouched
  fs.writeFileSync(file, `${rules.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map((m) => m[0]).join('')}\n`);
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
 *   One supersession (operator, 2026-09-30): once a native article is published, the blog index at
 *   `/blog/` lists the native articles, so the retired legacy `/blog` row no longer rewrites it. Every
 *   other retired `/blog/**` path stays 404; native slugs can never name one (converter/articles.ts).
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
  // The /blog/ index (served with or without articles since the operator review of 2026-10-03) supersedes
  // the retired legacy /blog row, and only it: every other retired /blog/** path keeps answering 404.
  const rules = inventory.filter((r) => r.disposition === 'retired' && served(r.path) && r.path !== '/blog')
    .flatMap((r) => [r.path, `${r.path}/`, `${r.path}.html`].map((from) => `${from} ${RETIRED_TARGET} 200`));
  if (served(RETIRED_TARGET)) throw new Error(`m2: ${RETIRED_TARGET} must not exist in dist`);
  if (rules.length) files._redirects = `# Retired routes (decision on #4) answer 404: rewritten to a path nothing serves.\n${rules.join('\n')}\n`;
  return files;
}

/** `llms.txt` and `llms-full.txt` (openspec docs-agent-access), from the built pages and artifacts in `outDir`. */
export function llmsFiles(manifest: ManifestV1, inventory: InventoryRoute[], outDir: string): Record<string, string> {
  const pages = llmsPages(manifest, inventory, outDir);
  return { 'llms.txt': llmsIndex(pages), 'llms-full.txt': llmsFull(pages) };
}

/** H2 of a sidebar's top-level items (only api:index today), named as the navbar names the sidebar. */
const SIDEBAR_SECTIONS: Record<SidebarId, string> = { tutorialSidebar: 'Docs', apiSidebar: 'API Reference' };

/**
 * The `/llms.txt` entries: every publish+agent manifest document (native articles included when the manifest
 * marks them so), grouped under its top-level sidebar category in sidebar order (Docs, then API Reference),
 * then `Other` for unlisted documents. The description is the built page header's, as plain text; a page
 * whose header has none (its body opens with code or a heading) takes the first body paragraph whose first
 * sentence the header rule would accept (leadSentence). A page with neither fails the build: give its
 * source a front-matter `description`.
 */
export function llmsPages(manifest: ManifestV1, inventory: InventoryRoute[], outDir: string): LlmsPage[] {
  const placed = new Map(buildNavigation(inventory, manifest.documents).entries.map((e) => [e.id, e]));
  const sidebars = Object.keys(SIDEBAR_SECTIONS);
  const rank = (id: string) => { const e = placed.get(id); return e ? [sidebars.indexOf(e.sidebar.sidebar), e.sidebar.order] : [sidebars.length, 0]; };
  return manifest.documents.filter((d) => d.eligibility.publish && d.eligibility.agent)
    .map((d) => ({ d, r: rank(d.id) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1])
    .map(({ d }) => {
      if (!d.markdown) throw new Error(`m2: ${d.id} is agent-eligible without a Markdown artifact`);
      const html = fs.readFileSync(path.join(outDir, `.${d.servedPath}index.html`), 'utf8');
      const rule = html.indexOf('<hr class="doc-header__rule">');
      if (rule < 0) throw new Error(`m2: ${d.servedPath}index.html has no page header rule (src/layouts/DocLayout.astro)`);
      const body = html.slice(rule, html.lastIndexOf('</article>'));
      const lead = /<p class="doc-header__desc"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1]
        ?? topLevelParagraphs(body).map(([, , s, e]) => leadSentence(body.slice(s, e))).find(Boolean);
      if (!lead) throw new Error(`m2: ${d.id} has no description for llms.txt; give ${d.sourcePath} a front-matter description`);
      const e = placed.get(d.id);
      return {
        title: d.title,
        url: d.canonicalUrl,
        markdownUrl: `${MANIFEST_SITE}${d.markdown.path}`,
        description: decodeEntities(lead.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
        section: e ? e.sidebar.trail[0] ?? SIDEBAR_SECTIONS[e.sidebar.sidebar] : 'Other',
        markdown: fs.readFileSync(path.join(outDir, d.markdown.path), 'utf8'),
      };
    });
}

export default function publication(): AstroIntegration {
  return {
    name: 'apertis-m2-publication',
    hooks: {
      // A cold content layer for every build: cached entries skip Shiki, so their token classes
      // would be missing from _nimbus/shiki.css (shikiClassErrors) and the build would differ
      // between a fresh clone and a warm checkout.
      'astro:config:setup': ({ command, config, logger }) => {
        if (command !== 'build') return;
        fs.rmSync(new URL('data-store.json', config.cacheDir), { force: true });
        logger.info('content layer cache cleared for a deterministic build');
      },
      'astro:build:done': ({ dir, logger }) => {
        const check = Boolean(process.env.CI) || process.env.M2_CHECK === '1';
        for (const line of finalize(fileURLToPath(dir), SITE_ROOT, { check })) logger.info(line);
        logger.info('manifest finalized and validated');
      },
    },
  };
}
