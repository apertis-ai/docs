// Publication hygiene of the build output (openspec docs-routing-publication "No unintended public content").
//   npm run build && npm run test:dist
// ponytail: file allowlist = manifest HTML + 404 + assets referenced from that HTML; #7 extends it with .md/llms/sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { manifest } from '../src/manifest/manifest.ts';
import { validateManifest } from '../src/contracts/validate-manifest.ts';
import type { InventoryRoute } from '../src/contracts/navigation.ts';
import { mainTextSha256 } from '../converter/convert.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.relative(dist, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
const read = (f: string) => fs.readFileSync(path.join(dist, f), 'utf8');

// Nimbus writes this stylesheet unconditionally (writeShikiStyleSheet); code blocks reference it from #7 on.
const FRAMEWORK_ASSETS = ['_nimbus/shiki.css'];
// Legacy static/ files keep their paths (publicDir) and are governed by their inventory rows.
const inventory = JSON.parse(fs.readFileSync(path.join(root, '../migration/nimbus/route-inventory.json'), 'utf8'));
const STATIC_ASSETS: string[] = inventory.routes
  .filter((r: { kind: string; disposition: string }) => r.kind === 'static-asset' && r.disposition === 'preserve')
  .map((r: { path: string }) => r.path.slice(1));

const INTERNAL_SECRET_NAMES = /CLOUDFLARE_API_TOKEN|SUPABASE_|TURNSTILE_SECRET|JINA_API_KEY/;
const ENV_FILE = /^(\.env|\.dev\.vars)(\..+)?$/;

/** Values (>= 8 chars) from every `.env*` / `.dev.vars*` file in `dirs`, except `*.example`. */
function envValues(dirs: string[]): string[] {
  return dirs.flatMap((dir) => fs.readdirSync(dir)
    .filter((name) => ENV_FILE.test(name) && !name.endsWith('.example') && fs.statSync(path.join(dir, name)).isFile())
    .flatMap((name) => [...fs.readFileSync(path.join(dir, name), 'utf8')
      .matchAll(/^[ \t]*(?:export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*(.*?)[ \t]*$/gm)]
      .map((m) => m[1].replace(/^(["'])(.*)\1$/, '$2'))
      .filter((v) => v.length >= 8)));
}

test('every output file derives from a publishable manifest entry or is referenced by one', () => {
  const pages = manifest.documents.filter((d) => d.eligibility.publish).map((d) => `${d.servedPath.slice(1)}index.html`);
  const html = [...pages, '404.html'];
  const referenced = html.flatMap((f) => [...read(f).matchAll(/(?:href|src)="\/([^"#?]+)"/g)].map((m) => m[1]));
  // #7: clean Markdown artifacts at their manifest paths (agent-eligible entries only).
  const markdown = manifest.documents.flatMap((d) => (d.eligibility.agent && d.markdown ? [d.markdown.path.slice(1)] : []));
  const allowed = new Set([...html, ...referenced, ...markdown, ...FRAMEWORK_ASSETS, ...STATIC_ASSETS]);
  for (const f of STATIC_ASSETS) assert.ok(files.includes(f), `missing static asset ${f}`);
  assert.deepEqual(files.filter((f) => !allowed.has(f)), []);
  for (const f of html) assert.ok(files.includes(f), `missing ${f}`);
});

test('no source maps, raw MDX, planning material or manifest internals', () => {
  assert.deepEqual(files.filter((f) => /\.(map|mdx)$/.test(f)), []);
  const leaks = /sourceMappingURL|openspec|migration\/nimbus|scripts\/nimbus|functions\/api|"sourcePath"|"manifestVersion"|"contentSha256"/;
  assert.deepEqual(files.filter((f) => leaks.test(read(f))), []);
});

test('env value scanning covers every .env*/.dev.vars* file, quotes and export prefixes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-env-'));
  fs.writeFileSync(path.join(dir, '.env.local'), 'export TOKEN_A="aaaaaaaa11"\n# comment\nSHORT=abc\n');
  fs.writeFileSync(path.join(dir, '.dev.vars.preview'), "KEY_B='bbbbbbbb22'\nKEY_C = cccccccc33\n");
  fs.writeFileSync(path.join(dir, '.dev.vars.example'), 'KEY_D=dddddddd44\n');
  fs.writeFileSync(path.join(dir, 'env.txt'), 'KEY_E=eeeeeeee55\n');
  assert.deepEqual(envValues([dir]).sort(), ['aaaaaaaa11', 'bbbbbbbb22', 'cccccccc33']);
});

test('no environment secret values or internal secret names appear in the output', () => {
  const values = envValues([root, path.dirname(root)]);
  // Public docs legitimately name APERTIS_API_KEY; only internal backend names are blocked by name.
  const leaked = files.filter((f) => {
    const body = read(f);
    return values.some((v) => body.includes(v)) || INTERNAL_SECRET_NAMES.test(body);
  });
  // Report file names only, never the values.
  assert.deepEqual(leaked, []);
});

// ---- #7 conversion and publication manifest (run after `npm run build`) ----
const routes: InventoryRoute[] = inventory.routes;
const article = (html: string) => html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '';
const converted = manifest.documents.filter((d) => !d.id.startsWith('page:'));

test('m2: the generated manifest validates against dist and is never published', () => {
  assert.deepEqual(validateManifest(manifest, { inventory: routes, outDir: dist }), []);
  assert.equal(manifest.documents.length, 12);
  // Content, not file names: Astro may name a CSS chunk after src/manifest/manifest.ts.
  const keys = ['manifestVersion', 'sourceSha', 'sourcePath', 'servedPath', 'canonicalUrl', 'contentSha256'].map((k) => `"${k}"`);
  const values = manifest.documents.flatMap((d) => [d.contentSha256, JSON.stringify(d.sourcePath)]);
  assert.deepEqual(files.filter((f) => { const body = read(f); return [...keys, ...values].some((v) => body.includes(v)); }), []);
});

test('m2: entries without Markdown hash their built <main> text, and no page embeds that hash', () => {
  for (const d of manifest.documents.filter((x) => x.markdown === null)) {
    assert.equal(d.contentSha256, mainTextSha256(read(`${d.servedPath.slice(1)}index.html`)), d.id);
    assert.deepEqual(files.filter((f) => read(f).includes(d.contentSha256)), [], d.id);
  }
});

test('m2: nothing is emitted at the reserved /api/ask', () => {
  assert.deepEqual(files.filter((f) => /^api\/ask(\/|\.|$)/.test(f)), []);
});

test('m2: every converted page keeps its inventory heading ids, and every fragment link target exists', () => {
  const ids = new Map(manifest.documents.map((d) => [d.id, new Set([...read(`${d.servedPath.slice(1)}index.html`).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))]));
  const byPath = new Map(routes.filter((r) => r.documentId).map((r) => [r.path, r.documentId]));
  for (const d of converted) {
    const row = routes.find((r) => r.documentId === d.id)!;
    assert.deepEqual(row.live!.headingIds.filter((id) => !ids.get(d.id)!.has(id)), [], d.id);
    for (const [, target, frag] of article(read(`${d.servedPath.slice(1)}index.html`)).matchAll(/<a[^>]+href="([^"#]*)#([^"]+)"/g)) {
      const id = target ? byPath.get(target.replace(/(.)\/$/, '$1')) : d.id;
      if (id && ids.has(id)) assert.ok(ids.get(id)!.has(frag), `${d.id} links to ${target}#${frag}`);
    }
  }
});

test('m2: article links are root-absolute and equal the legacy internal link set', () => {
  for (const d of converted) {
    const row = routes.find((r) => r.documentId === d.id)!;
    const hrefs = [...new Set([...article(read(`${d.servedPath.slice(1)}index.html`)).matchAll(/<a[^>]+href="([^"#][^"]*)"/g)].map((m) => m[1]))];
    assert.deepEqual(hrefs.filter((h) => !/^(\/|[a-z][a-z0-9+.-]*:)/i.test(h)), [], `${d.id}: relative hrefs`);
    // Legacy extras: the breadcrumb home link, the GitHub edit link and Cloudflare's mailto obfuscation.
    const legacy = row.live!.links.filter((h) => h.startsWith('/') && h !== '/' && !h.startsWith('/cdn-cgi/'));
    assert.deepEqual(hrefs.filter((h) => h.startsWith('/')).sort(), [...new Set(legacy)].sort(), d.id);
  }
});

test('m2: images resolve in dist, and no Docusaurus/MDX syntax survives into HTML or Markdown', () => {
  for (const d of converted) {
    const html = read(`${d.servedPath.slice(1)}index.html`);
    for (const [, src] of article(html).matchAll(/<img[^>]+src="\/([^"]+)"/g)) assert.ok(files.includes(src), `${d.id}: ${src}`);
    const md = read(d.markdown!.path.slice(1));
    assert.doesNotMatch(article(html) + md, /^:::|<Tabs|<TabItem|\{\{/m, d.id);
    const prose = md.replace(/^(?:> )?[ \t]*(`{3,}|~{3,})[\s\S]*?^(?:> )?[ \t]*\1[ \t]*$/gm, '').replace(/`[^`\n]+`/g, '');
    assert.doesNotMatch(prose, /^(import|export)\s|<[A-Za-z]/m, d.id);
    for (const [, src] of md.matchAll(/!\[[^\]]*\]\(\/([^)\s]+)\)/g)) assert.ok(files.includes(src), `${d.id}.md: ${src}`);
    const targets = [...prose.matchAll(/\]\(([^)\s]*)/g)].map((m) => m[1]);
    assert.deepEqual(targets.filter((t) => !/^(\/|#|[a-z][a-z0-9+.-]*:)/i.test(t)), [], `${d.id}.md: relative links`);
  }
});

test('m2: HTML and clean Markdown carry the same code blocks for every converted page', () => {
  const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  for (const d of converted) {
    const html = article(read(`${d.servedPath.slice(1)}index.html`));
    const htmlCode = [...html.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)]
      .map((m) => decode(m[1].replace(/<\/span><span class="line">/g, '\n').replace(/<[^>]+>/g, '')).trimEnd());
    const mdCode = [...read(d.markdown!.path.slice(1)).matchAll(/^((?:> )?)([ \t]*)(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1[ \t]*\3[ \t]*$/gm)]
      .map((m) => m[4].split('\n').map((l) => l.slice(m[1].length).slice(m[2].length)).join('\n').trimEnd());
    assert.deepEqual(htmlCode, mdCode, d.id);
  }
});
