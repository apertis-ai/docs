// Publication hygiene of the build output (openspec docs-routing-publication "No unintended public content").
//   npm run build && npm run test:dist
// ponytail: file allowlist = manifest HTML + 404 + assets referenced from that HTML; #7 extends it with .md/llms/sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { manifest } from '../src/manifest/manifest.ts';
import { searchDocuments } from '../src/search/index-build.ts';
import { validateManifest } from '../src/contracts/validate-manifest.ts';
import type { InventoryRoute } from '../src/contracts/navigation.ts';
import { mainTextSha256 } from '../converter/convert.ts';
import { RETIRED_TARGET, llmsFiles, publicationFiles } from '../converter/integration.ts';
import { readArticles } from '../converter/articles.ts';
import { MANIFEST_SITE } from '../src/contracts/manifest.ts';
import { decodeEntities } from '../src/contracts/validate-manifest.ts';
import { pageKey, parseFull, parseIndex } from '../src/agent/llms.ts';

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

// #9 search index (Pagefind, fetched lazily by the assistant client so no HTML references it). Only the
// files the client loads are allowed; the index content is checked against the manifest below.
const SEARCH_BUNDLE = /^pagefind\/(pagefind\.js|pagefind-worker\.js|pagefind-entry\.json|pagefind\.en_[0-9a-f]+\.pf_meta|wasm\.en\.pagefind|index\/en_[0-9a-f]+\.pf_index|fragment\/en_[0-9a-f]+\.pf_fragment)$/;
const SEARCH_FILES = files.filter((f) => SEARCH_BUNDLE.test(f));
const searchText = (f: string) => zlib.gunzipSync(fs.readFileSync(path.join(dist, f))).toString('utf8');
const fragments = () => SEARCH_FILES.filter((f) => f.startsWith('pagefind/fragment/'))
  .map((f) => JSON.parse(searchText(f).replace(/^pagefind_dcd/, '')) as { url: string; word_count: number; meta: { title?: string } });

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
  // #13: published inventory rows of kind `generated` with an HTML route (/search).
  const generated = inventory.routes.filter((r: InventoryRoute) => r.kind === 'generated' && r.eligibility.publish && r.live?.canonical)
    .map((r: InventoryRoute) => `${r.path.slice(1)}/index.html`);
  // The /blog/ index (openspec docs-routing-publication "Native articles", operator review 2026-10-03): served
  // with or without articles, never a manifest document.
  const html = [...pages, ...generated, 'blog/index.html', '404.html'];
  // Astro islands reference their component and renderer chunks from <astro-island> attributes.
  const referenced = html.flatMap((f) => [...read(f).matchAll(/(?:href|src|component-url|renderer-url|before-hydration-url)="\/([^"#?]+)"/g)].map((m) => m[1]));
  // Chunks a referenced script imports (static or dynamic, relative to its own directory) are referenced too,
  // and so is every root-absolute url() in a referenced stylesheet (the display font is not preloaded).
  for (let i = 0; i < referenced.length; i++) {
    if (!files.includes(referenced[i])) continue;
    if (referenced[i].endsWith('.css')) {
      for (const m of read(referenced[i]).matchAll(/url\(\s*["']?\/([^"')#?]+)/g)) if (!referenced.includes(m[1])) referenced.push(m[1]);
      continue;
    }
    if (!referenced[i].endsWith('.js')) continue;
    const dir = path.posix.dirname(referenced[i]);
    for (const m of read(referenced[i]).matchAll(/(?:from|import\()\s*["'`](\.\.?\/[^"'`]+)["'`]/g)) {
      const dep = path.posix.join(dir, m[1]);
      if (!referenced.includes(dep)) referenced.push(dep);
    }
  }
  // #7: clean Markdown artifacts at their manifest paths (agent-eligible entries only).
  const markdown = manifest.documents.flatMap((d) => (d.eligibility.agent && d.markdown ? [d.markdown.path.slice(1)] : []));
  // #13: root files derived from the manifest and inventory; their content is checked below.
  // docs-agent-access adds /llms.txt and /llms-full.txt (from the publish+agent entries), checked below too.
  const derived = ['sitemap.xml', '_redirects', 'llms.txt', 'llms-full.txt'];
  const allowed = new Set([...html, ...referenced, ...markdown, ...derived, ...FRAMEWORK_ASSETS, ...STATIC_ASSETS, ...SEARCH_FILES]);
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

test('the search index holds exactly the publish+search-eligible manifest entries, with content', () => {
  const eligible = manifest.documents.filter((d) => d.eligibility.publish && d.eligibility.search);
  const indexed = fragments();
  assert.deepEqual(indexed.map((f) => f.url).sort(), eligible.map((d) => d.servedPath).sort());
  for (const f of indexed) assert.ok(f.word_count > 0 && f.meta.title, `${f.url} indexed without content or title`);
  for (const f of ['pagefind/pagefind.js', 'pagefind/pagefind-entry.json', 'pagefind/wasm.en.pagefind']) assert.ok(files.includes(f), `missing ${f}`);
});

test('decompressed search index carries no internals, secret names or env values', () => {
  const values = envValues([root, path.dirname(root)]);
  const leaks = /sourceMappingURL|openspec|migration\/nimbus|scripts\/nimbus|functions\/api|"sourcePath"|"manifestVersion"|"contentSha256"/;
  const compressed = SEARCH_FILES.filter((f) => /\.pf_(fragment|index|meta)$/.test(f));
  assert.ok(compressed.length > 0);
  assert.deepEqual(compressed.filter((f) => {
    const body = searchText(f);
    return leaks.test(body) || INTERNAL_SECRET_NAMES.test(body) || values.some((v) => body.includes(v));
  }), []);
});

test('no simulated or canned Ask Docs answer path ships (baseline defect 6)', () => {
  const scripts = [
    ...files.filter((f) => f.endsWith('.js') && !f.startsWith('pagefind/')).map(read),
    ...files.filter((f) => f.endsWith('.html')).flatMap((f) => [...read(f).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])),
  ];
  assert.ok(scripts.some((s) => s.includes('apertis-docs:open')), 'the assistant client is not in the output');
  const canned = /Local preview response|isLocalPreview|location\.hostname|["'](localhost|127\.0\.0\.1|::1)["']/;
  assert.deepEqual(scripts.filter((s) => canned.test(s)).map((s) => s.match(canned)![0]), []);
  // The shipped client carries the real Turnstile sitekey, never Cloudflare's test keys (a preview build's choice).
  assert.ok(scripts.some((s) => s.includes('0x4AAAAAACS2SzpYBFytHb_E')), 'the real Turnstile sitekey is not in the output');
  assert.deepEqual(scripts.filter((s) => /[`"'][123]x0{20}AA[`"']/.test(s)).length, 0, 'a Turnstile test sitekey ships');
});

// ---- #7 conversion and publication manifest (run after `npm run build`) ----
const routes: InventoryRoute[] = inventory.routes;
const article = (html: string) => html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '';
const converted = manifest.documents.filter((d) => !d.id.startsWith('page:'));
// Post-cutover content edits, recorded against the frozen legacy link sets (migration/nimbus/content-changes.json).
type ContentChange = { commit: string; decision: string; links: { added?: string[]; removed?: string[] } };
const contentChanges: Record<string, ContentChange> = JSON.parse(fs.readFileSync(path.join(root, '../migration/nimbus/content-changes.json'), 'utf8')).documents;
const expectedLinks = (id: string, legacy: string[]) => {
  const c = contentChanges[id]?.links;
  return [...legacy.filter((h) => !c?.removed?.includes(h)), ...(c?.added ?? [])];
};

test('m2: the generated manifest validates against dist and is never published', () => {
  assert.deepEqual(validateManifest(manifest, { inventory: routes, outDir: dist }), []);
  assert.equal(manifest.documents.length, 79);
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
    const legacy = expectedLinks(d.id, row.live!.links).filter((h) => h.startsWith('/') && h !== '/' && !h.startsWith('/cdn-cgi/'));
    assert.deepEqual(hrefs.filter((h) => h.startsWith('/')).sort(), [...new Set(legacy)].sort(), d.id);
  }
});

test('m2: images resolve in dist, and no Docusaurus/MDX syntax survives into HTML or Markdown', () => {
  for (const d of converted) {
    const html = read(`${d.servedPath.slice(1)}index.html`);
    for (const [, src] of article(html).matchAll(/<img[^>]+src="\/([^"]+)"/g)) assert.ok(files.includes(src), `${d.id}: ${src}`);
    const md = read(d.markdown!.path.slice(1));
    const prose = md.replace(/^(?:> )?[ \t]*(`{3,}|~{3,})[\s\S]*?^(?:> )?[ \t]*\1[ \t]*$/gm, '').replace(/`[^`\n]+`/g, '');
    // Directives and JSX outside code (code may legitimately show `{{ ... }}` templates, as on continue).
    assert.doesNotMatch(article(html).replace(/<pre\b[\s\S]*?<\/pre>/g, '').replace(/<code>[^<]*<\/code>/g, '') + prose, /^:::|<Tabs|<TabItem|\{\{/m, d.id);
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

// ---- #9 assistant mount and search-index content ----
const publishedHtml = () => manifest.documents.filter((d) => d.eligibility.publish).map((d) => `${d.servedPath.slice(1)}index.html`);

test('m4: every published page mounts the assistant dialog exactly once', () => {
  for (const f of publishedHtml()) assert.equal(read(f).match(/\bid="apertis-assistant"/g)?.length ?? 0, 1, f);
});

// Shell chrome (#8) must stay out of the index. Skipped until a shell renders <nav>/<aside> outside <article>.
const outsideArticle = (html: string) => html.replace(/<article[\s\S]*?<\/article>/g, '').replace(/<dialog id="apertis-assistant"[\s\S]*?<\/dialog>/, '');
const hasShell = publishedHtml().some((f) => /<(nav|aside)\b/.test(outsideArticle(read(f))));
test('m4: search fragments carry no shell chrome (navbar/sidebar labels) beyond what the article says', { skip: hasShell ? false : 'no shell <nav>/<aside> outside <article> yet (#8)' }, () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  const byUrl = new Map(fragments().map((f) => [f.url, (f as unknown as { content: string }).content]));
  for (const d of searchDocuments(manifest.documents)) {
    const html = read(`${d.servedPath.slice(1)}index.html`);
    const article = text(html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '');
    // Every link label of the page chrome (navbar, sidebar, footer, TOC), wherever the shell puts it.
    const labels = [...new Set([...outsideArticle(html).matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
      .map((a) => text(a[1]).replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 2))];
    const content = byUrl.get(d.servedPath) ?? '';
    // Compare without whitespace: inline tags (e.g. <code> in a heading) become spaces in `text()` but not in Pagefind content.
    const squash = (s: string) => s.replace(/\s+/g, '');
    const extra = labels.filter((l) => count(squash(content), squash(l)) > count(squash(article), squash(l)));
    assert.deepEqual(extra, [], `${d.servedPath}: shell labels in the index`);
  }
});

// ---- #13 full corpus: sitemap, retired routes, publication channels ----
const retired = routes.filter((r) => (r.disposition as string) === 'retired');

test('m8: sitemap.xml lists exactly the canonical URLs of the published HTML routes', () => {
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = [
    ...manifest.documents.filter((d) => d.eligibility.publish).map((d) => d.canonicalUrl),
    ...routes.filter((r) => r.kind === 'generated' && r.eligibility.publish && r.live?.canonical).map((r) => r.live!.canonical!),
  ].sort();
  assert.deepEqual(locs, expected);
  assert.equal(locs.length, 80);
  assert.equal(read('sitemap.xml'), publicationFiles(manifest, routes, dist)['sitemap.xml']);
});

test('m8: retired routes are in no publication channel and every path they had answers 404', () => {
  assert.equal(retired.length, 23);
  for (const r of retired) {
    assert.equal(r.eligibility.publish || r.eligibility.search || r.eligibility.agent || r.eligibility.rag, false, r.path);
    assert.equal((r as InventoryRoute & { decision?: string }).decision, 'https://github.com/apertis-ai/docs/issues/4#issuecomment-5881882328', r.path);
    assert.equal(manifest.documents.some((d) => d.id === r.documentId), false, `${r.path} in the manifest`);
  }
  const rel = (p: string) => p.slice(1);
  // Nothing in dist serves a retired path, except what _redirects rewrites to RETIRED_TARGET (the 404 page).
  const rules = read('_redirects').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(' '));
  const rewritten = new Set(rules.map(([from]) => from));
  for (const [, to, status] of rules) assert.deepEqual([to, status], [RETIRED_TARGET, '200']);
  assert.equal(files.some((f) => f === rel(RETIRED_TARGET) || f.startsWith(`${rel(RETIRED_TARGET)}/`)), false);
  // The /blog/ index supersedes the retired legacy /blog row, and only it (docs-routing-publication "Native
  // articles"): blog/index.html is its one file; every other retired /blog/** path stays unserved.
  const index = (r: InventoryRoute, f: string) => r.path === '/blog' && f === 'blog/index.html';
  for (const r of retired) {
    const servedBy = [`${rel(r.path)}.html`, `${rel(r.path)}/index.html`, rel(r.path)].filter((f) => files.includes(f) && !index(r, f));
    if (servedBy.length) for (const from of [r.path, `${r.path}/`, `${r.path}.html`]) assert.ok(rewritten.has(from), `${from} is served by ${servedBy} and not rewritten`);
    assert.equal(files.some((f) => (f.startsWith(`${rel(r.path)}/`) && !index(r, f)) || f === `${rel(r.path)}.md`), false, `${r.path} emitted`);
  }
  assert.deepEqual([...rewritten].sort(), ['/404', '/404.html', '/404/']);
  const text = [read('sitemap.xml'), ...fragments().map((f) => f.url)].join('\n');
  for (const r of retired) assert.equal(text.includes(`https://docs.apertis.ai${r.path}<`) || fragments().some((f) => f.url.replace(/\/$/, '') === r.path), false, r.path);
  // docs-agent-access supersedes "no llms* outputs": they exist, and no retired path is in them.
  const agentKeys = new Set(parseIndex(read('llms.txt')).map((e) => pageKey(e.markdownUrl)));
  for (const r of retired) assert.equal(agentKeys.has(r.path), false, `${r.path} in llms.txt`);
});

test('every recorded post-cutover content change matches its built page', () => {
  for (const [id, c] of Object.entries(contentChanges)) {
    const d = converted.find((x) => x.id === id);
    assert.ok(d, `${id}: not a converted page`);
    assert.match(c.commit, /^[0-9a-f]{7,40}$/, `${id}: commit`);
    assert.ok(c.decision, `${id}: decision`);
    const hrefs = new Set([...article(read(`${d.servedPath.slice(1)}index.html`)).matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')));
    for (const h of c.links.added ?? []) assert.ok(hrefs.has(h), `${id}: added link ${h} is not on the page`);
    for (const h of c.links.removed ?? []) assert.ok(!hrefs.has(h), `${id}: removed link ${h} is still on the page`);
  }
});

test('/api/ Choosing an API format compares and links the three formats', () => {
  // docs-reader-features, "Choosing an API format": WHEN the reader opens /api/#choosing-an-api-format,
  // THEN a table compares the three formats and links the chat-completions, responses and messages pages.
  const body = article(read('api/index.html'));
  assert.ok(/<h2[^>]+id="choosing-an-api-format"/.test(body), 'missing heading id');
  const table = body.match(/<table>[\s\S]*?<\/table>/)?.[0];
  assert.ok(table, 'missing comparison table');
  const headers = [...table!.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(headers, ['', 'Chat Completions', 'Responses', 'Messages']);
  // Site convention (matched by every other converted page's internal links): no trailing slash,
  // even though the spec scenario text writes one.
  const hrefs = new Set([...body.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]));
  for (const h of ['/api/text-generation/chat-completions', '/api/text-generation/responses', '/api/text-generation/messages']) {
    assert.ok(hrefs.has(h), `missing link ${h}`);
  }
});

test('m8: every converted page keeps the legacy external links and images (content parity)', () => {
  const amp = (s: string) => s.replace(/&amp;/g, '&');
  // Legacy /assets/images/<name>-<32 hex>.<ext> and the candidate /assets/images/<name>-<16 hex>.<ext> are one image.
  const image = (src: string) => src.replace(/^\/assets\/images\/(.+)-[0-9a-f]{16,32}(\.[a-z]+)$/, '/assets/images/$1$2');
  let links = 0, images = 0;
  for (const d of converted) {
    const row = routes.find((r) => r.documentId === d.id)!;
    const body = article(read(`${d.servedPath.slice(1)}index.html`));
    const hrefs = new Set([...body.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => amp(m[1])));
    // Legacy extras outside the body: the "Edit this page" GitHub link and Cloudflare's email obfuscation.
    const external = expectedLinks(d.id, row.live!.links).filter((h) => !h.startsWith('/') && !h.startsWith('https://github.com/apertis-ai/docs/tree/main/'));
    assert.deepEqual(external.filter((h) => !hrefs.has(h)), [], `${d.id}: external links lost`);
    const srcs = new Set([...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => image(amp(m[1]))));
    assert.deepEqual(row.live!.images.map(image).filter((s) => !srcs.has(s)), [], `${d.id}: images lost`);
    links += external.length;
    images += row.live!.images.length;
  }
  assert.equal(converted.length, 78);
  assert.ok(links > 100 && images > 40, `${links} links, ${images} images compared`);
});

test('m8: every internal link in every converted page resolves to a built file (never a retired or missing route)', () => {
  const builtFile = (p: string) => [p, `${p.replace(/\/$/, '')}/index.html`, `${p.replace(/\/$/, '')}.html`]
    .some((f) => files.includes(f.replace(/^\//, '')));
  let n = 0;
  for (const d of converted) {
    const hrefs = [...article(read(`${d.servedPath.slice(1)}index.html`)).matchAll(/<a[^>]+href="(\/[^"#?]*)/g)].map((m) => m[1]);
    n += hrefs.length;
    assert.deepEqual(hrefs.filter((h) => !builtFile(h)), [], `${d.id}: unresolved internal links`);
  }
  assert.ok(n > 100, `${n} internal links checked`);
});

// ---- docs-agent-access: /llms.txt and /llms-full.txt ----
const agentDocs = manifest.documents.filter((d) => d.eligibility.publish && d.eligibility.agent);
const mdUrl = (d: (typeof manifest.documents)[number]) => `${MANIFEST_SITE}${d.markdown!.path}`;

test('llms.txt lists exactly the publish+agent Markdown artifacts, in sidebar sections, each with a description', () => {
  const body = read('llms.txt');
  const entries = parseIndex(body);
  assert.equal(body.split('\n').filter((l) => l.startsWith('- ')).length, entries.length, 'an entry line does not parse');
  assert.deepEqual(entries.map((e) => e.markdownUrl).sort(), agentDocs.map(mdUrl).sort());
  assert.equal(entries.length, 78);
  assert.equal(new Set(entries.map((e) => e.markdownUrl)).size, entries.length);
  for (const e of entries) assert.match(e.description, /\S/, e.markdownUrl);
  // page:index (publish, not agent) and every draft article are absent; retired rows are checked with m8 above.
  assert.equal(entries.some((e) => pageKey(e.markdownUrl) === '/'), false);
  for (const a of readArticles(root).filter((x) => x.draft)) assert.equal(entries.some((e) => e.markdownUrl.includes(`/blog/${a.slug}`)), false, a.slug);
  assert.deepEqual([...new Set(entries.map((e) => e.section))], ['Getting Started', 'Account & Access', 'Integrations', 'Configuration', 'Help & Security',
    'Resources', 'API Reference', 'Text Generation', 'Search', 'Vision & Images', 'Audio & Video', 'Embeddings & Rerank', 'SDKs & Libraries', 'Utilities', 'Other']);
  assert.equal(body, llmsFiles(manifest, routes, dist)['llms.txt']);
});

test('an llms.txt description is the page header description wherever the page shows one', () => {
  const byUrl = new Map(parseIndex(read('llms.txt')).map((e) => [e.markdownUrl, e.description]));
  let n = 0;
  for (const d of agentDocs) {
    const header = /<p class="doc-header__desc"[^>]*>([\s\S]*?)<\/p>/.exec(read(`${d.servedPath.slice(1)}index.html`))?.[1];
    if (header === undefined) continue;
    assert.equal(byUrl.get(mdUrl(d)), decodeEntities(header.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(), d.id);
    n++;
  }
  assert.ok(n > 50, `${n} header descriptions compared`);
});

test('llms-full.txt holds the bytes of every llms.txt artifact, in the same order, each under its Source line', () => {
  const byMd = new Map(agentDocs.map((d) => [mdUrl(d), d]));
  const order = parseIndex(read('llms.txt')).map((e) => byMd.get(e.markdownUrl)!);
  const full = parseFull(read('llms-full.txt'));
  assert.deepEqual(full.map((f) => f.url), order.map((d) => d.canonicalUrl));
  for (const [i, f] of full.entries()) assert.ok(Buffer.from(f.markdown).equals(fs.readFileSync(path.join(dist, order[i].markdown!.path))), order[i].id);
  assert.equal(read('llms-full.txt'), llmsFiles(manifest, routes, dist)['llms-full.txt']);
});
