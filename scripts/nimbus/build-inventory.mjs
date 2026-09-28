// Builds the frozen route inventory and route fixtures for the Docusaurus -> Nimbus migration (#5).
//
//   node scripts/nimbus/build-inventory.mjs migration/nimbus/baseline/live-snapshot.json <legacy build dir>
//   (the snapshot is `route-fixtures.mjs snapshot https://docs.apertis.ai migration/nimbus/baseline/live-paths.txt`)
//
// Inputs are the legacy source tree (docs/, docs-api/, src/pages/, blog/, sidebars), the legacy
// build output (routes and search-index.json) and a live snapshot taken with
// `route-fixtures.mjs snapshot`. Writes migration/nimbus/route-inventory.json and
// migration/nimbus/route-fixtures.json. Every discovered route receives a disposition.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import docsSidebars from '../../sidebars.js';
import apiSidebars from '../../sidebarsApi.js';

const [snapshotFile, buildDir] = process.argv.slice(2);
if (!snapshotFile || !buildDir) { console.error('usage: build-inventory.mjs <live-snapshot.json> <buildDir>'); process.exit(2); }
const OUT = new URL('../../migration/nimbus/', import.meta.url);
const SITE = 'https://docs.apertis.ai';
const POC = JSON.parse(fs.readFileSync(new URL('budgets.json', OUT), 'utf8')).protocol.pages.map((p) => (p.length > 1 ? p.replace(/\/$/, '') : p));
const live = new Map(JSON.parse(fs.readFileSync(snapshotFile, 'utf8')).map((r) => [r.path, r]));
const norm = (p) => (p.length > 1 ? p.replace(/\/$/, '') : p);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const frontmatter = (file) => {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  return Object.fromEntries((m?.[1] ?? '').split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].trim()]));
};

// Sidebar placement: sidebar id, category trail and global order within that sidebar.
const placement = new Map();
function place(plugin, sidebar, items, trail = [], counter = { n: 0 }) {
  for (const item of items) {
    if (typeof item === 'string') placement.set(`${plugin}:${item}`, { sidebar, trail, order: counter.n++ });
    else if (item.type === 'doc') placement.set(`${plugin}:${item.id}`, { sidebar, trail, order: counter.n++, label: item.label });
    else if (item.type === 'category') place(plugin, sidebar, item.items, [...trail, item.label], counter);
  }
}
for (const [id, items] of Object.entries(docsSidebars)) place('default', id, items);
for (const [id, items] of Object.entries(apiSidebars)) place('api', id, items);

const legacySearch = new Set(JSON.parse(fs.readFileSync(path.join(buildDir, 'search-index.json'), 'utf8'))
  .flatMap((part) => part.documents.map((d) => norm(d.u.replace(/#.*/, '')))));

const rows = [];
// Documentation plugins: docs/ at the site root, docs-api/ under /api.
for (const [plugin, dir, prefix] of [['default', 'docs', ''], ['api', 'docs-api', '/api']]) {
  for (const file of walk(dir).filter((f) => /\.mdx?$/.test(f)).sort()) {
    const id = path.relative(dir, file).replace(/\.mdx?$/, '');
    const fm = frontmatter(file);
    if (fm.slug || fm.id || fm.draft === 'true' || fm.unlisted === 'true') throw new Error(`${file}: slug/id/draft/unlisted front matter needs an explicit rule`);
    const route = norm(prefix + '/' + id.replace(/(^|\/)index$/, ''));
    const place = placement.get(`${plugin}:${id}`) ?? null;
    rows.push({
      path: route, kind: 'doc', documentId: `${plugin}:${id}`, sourcePath: file,
      sidebar: place, listed: Boolean(place),
      disposition: 'preserve',
      eligibility: { publish: true, search: true, agent: true, rag: true },
      legacy: { search: legacySearch.has(route), rag: file.endsWith('.md') },
    });
  }
}
// Standalone pages under src/pages.
const PAGE_NOTES = {
  'src/pages/index.js': ['preserve', 'Homepage (hero, search trigger, feature cards incl. external Playground).'],
  'src/pages/test.js': ['preserve-pending-decision', 'Template placeholder ("測試頁面"); publicly routable. Retire only by recorded decision.'],
  'src/pages/markdown-page.md': ['preserve-pending-decision', 'Unmodified create-docusaurus example page; publicly routable. Retire only by recorded decision.'],
  'src/pages/404.js': ['preserve-pending-decision', 'Route /404 is a client-side locale redirect to non-existent /en/... paths (baseline defect). Distinct from the not-found response served for unknown paths.'],
};
for (const [file, [disposition, note]] of Object.entries(PAGE_NOTES)) {
  const name = path.basename(file).replace(/\.(js|md)$/, '');
  const route = name === 'index' ? '/' : '/' + name;
  rows.push({
    path: route, kind: 'page', documentId: `page:${name}`, sourcePath: file, sidebar: null, listed: false, disposition, note,
    eligibility: { publish: true, search: legacySearch.has(route), agent: false, rag: false },
    legacy: { search: legacySearch.has(route), rag: false },
  });
}
// Everything else the build or the live site exposes (blog, generated and static routes).
const known = new Set(rows.map((r) => r.path));
for (const [p, snap] of live) {
  const route = norm(p);
  if (known.has(route)) continue;
  known.add(route);
  let row;
  if (route.startsWith('/blog')) {
    const post = ['first-blog-post', 'long-blog-post', 'mdx-blog-post', 'welcome'].find((s) => route === `/blog/${s}`);
    const kind = route.endsWith('.xml') ? 'feed' : post ? 'blog-post' : 'blog-generated';
    row = { path: route, kind, documentId: post ? `blog:${post}` : `generated:${route}`, sourcePath: post ? fs.readdirSync('blog').map((f) => `blog/${f}`).find((f) => f.includes(post === 'welcome' ? 'welcome' : post.replace(/-blog-post$/, ''))) ?? null : null,
      disposition: 'preserve-pending-decision', note: 'create-docusaurus template blog content (authors yangshun, sebastien-lorber) is live. Retire only by recorded decision.' };
  } else if (route === '/search') {
    row = { path: route, kind: 'generated', documentId: 'generated:/search', disposition: 'preserve', note: 'Search results page (explicitSearchResultPath). Candidate keeps a working /search?q= page or a one-hop redirect to its search UI.' };
  } else if (route === '/sitemap.xml') {
    row = { path: route, kind: 'static', documentId: 'generated:/sitemap.xml', disposition: 'preserve', note: 'Lists no-slash URLs of every published HTML route. Candidate sitemap lists exactly the publish-eligible routes.' };
  } else if (route === '/search-index.json') {
    row = { path: route, kind: 'static', documentId: 'generated:/search-index.json', disposition: 'legacy-implementation-artifact', note: 'Internal index of @easyops-cn/docusaurus-search-local; no reader-facing contract. May be absent from the candidate.' };
  } else if (route === '/api/ask') {
    row = { path: route, kind: 'runtime', documentId: 'runtime:/api/ask', disposition: 'reserved-runtime', note: 'POST handled by functions/api/ask.ts; GET returns the 404 page. No document may be emitted at this path.' };
  } else if (snap.status === 404) {
    row = { path: route, kind: 'absent', documentId: null, disposition: 'absent-at-baseline', note: 'Returns 404 at baseline. May only be introduced under the publication contract.' };
  } else throw new Error(`unclassified live route ${route}`);
  rows.push({ sidebar: null, listed: false, eligibility: { publish: (snap.final?.status ?? snap.status) === 200, search: legacySearch.has(route), agent: false, rag: false }, legacy: { search: legacySearch.has(route), rag: false }, ...row });
}
// Static files: everything copied from static/ keeps its path; feed stylesheets follow the blog.
for (const file of walk('static').sort()) {
  const route = '/' + path.relative('static', file);
  if (known.has(route)) continue;
  known.add(route);
  rows.push({ path: route, kind: 'static-asset', documentId: null, sourcePath: file, sidebar: null, listed: false, disposition: 'preserve',
    eligibility: { publish: true, search: false, agent: false, rag: false }, legacy: { search: false, rag: false } });
}
for (const f of ['atom.css', 'atom.xsl', 'rss.css', 'rss.xsl']) {
  rows.push({ path: `/blog/${f}`, kind: 'feed', documentId: `generated:/blog/${f}`, sourcePath: null, sidebar: null, listed: false, disposition: 'preserve-pending-decision',
    note: 'Feed stylesheet generated with the template blog feeds.', eligibility: { publish: true, search: false, agent: false, rag: false }, legacy: { search: false, rag: false } });
  known.add(`/blog/${f}`);
}

// Attach observed live facts and check the build agrees on the route set.
const built = new Set(walk(buildDir).filter((f) => f.endsWith('.html')).map((f) => norm('/' + path.relative(buildDir, f).replace(/(^|\/)index\.html$/, '').replace(/\.html$/, ''))));
for (const r of rows) {
  const snap = live.get(r.path) ?? live.get(r.path + '/');
  r.poc = POC.includes(r.path);
  r.built = built.has(r.path);
  r.live = snap ? {
    requested: snap.path, status: snap.status, location: snap.location ?? null, final: snap.final ?? null,
    slashVariant: snap.slashVariant ?? null, canonical: snap.canonical ?? null, title: snap.title ?? null,
    headingIds: snap.headingIds ?? [], links: snap.links ?? [], images: snap.images ?? [], articleSha256: snap.articleSha256 ?? null,
  } : null;
  if (r.eligibility.publish && !r.live && !['static-asset', 'feed'].includes(r.kind)) throw new Error(`${r.path}: published route missing from live snapshot`);
}
const missing = [...built].filter((p) => !rows.some((r) => r.path === p) && p !== '/404.html' && p !== '/404');
const builtFiles = walk(buildDir).map((f) => '/' + path.relative(buildDir, f)).filter((f) => !f.endsWith('.html') && !f.startsWith('/assets/'));
missing.push(...builtFiles.filter((f) => !rows.some((r) => r.path === f)));
if (missing.length) throw new Error(`built but unclassified: ${missing.join(', ')}`);
for (const r of rows) if (!r.built && builtFiles.includes(r.path)) r.built = true;
rows.sort((a, b) => a.path.localeCompare(b.path));

// Critical anchors: every heading id on PoC pages plus every internal #fragment link target.
const fragmentTargets = new Map();
for (const r of rows) for (const href of r.live?.links ?? []) {
  const m = href.match(/^(\/[^#]*)#(.+)$/);
  if (m) (fragmentTargets.get(norm(m[1])) ?? fragmentTargets.set(norm(m[1]), new Set()).get(norm(m[1]))).add(m[2]);
}
for (const file of walk('docs').concat(walk('docs-api')).filter((f) => /\.mdx?$/.test(f))) {
  const route = rows.find((r) => r.sourcePath === file)?.path;
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/\]\(#([^)]+)\)/g)) (fragmentTargets.get(route) ?? fragmentTargets.set(route, new Set()).get(route)).add(m[1]);
}

const fixtures = [];
for (const r of rows) {
  if (!r.live) continue;
  const scope = r.poc ? 'poc' : 'full';
  const f = { path: r.live.requested, scope, status: r.live.status };
  if (r.live.location) f.location = new URL(r.live.location, SITE + r.live.requested).pathname;
  fixtures.push(f);
  if (r.live.final) {
    const anchors = [...new Set([...r.live.headingIds, ...(fragmentTargets.get(r.path) ?? [])])];
    fixtures.push({ path: r.live.final.path, scope, status: r.live.final.status, canonical: r.live.canonical, ...(anchors.length ? { anchors } : {}) });
  } else if (r.live.status === 200 && r.live.canonical) {
    const anchors = [...new Set([...r.live.headingIds, ...(fragmentTargets.get(r.path) ?? [])])];
    Object.assign(f, { canonical: r.live.canonical }, anchors.length ? { anchors } : {});
    if (r.live.slashVariant) fixtures.push({ path: r.live.slashVariant.path, scope, status: r.live.slashVariant.status, ...(r.live.slashVariant.location ? { location: new URL(r.live.slashVariant.location, SITE).pathname } : {}) });
  }
}
for (const r of rows) if (['static-asset', 'feed'].includes(r.kind) && !r.live) fixtures.push({ path: r.path, scope: 'full', status: 200 });
for (const f of fixtures) if (POC.includes(norm(f.path)) && f.status === 200 && f.canonical) f.pocLinks = true;
for (const f of fixtures) if (f.scope === 'full' && (POC.includes(norm(f.path)) || f.path === '/api/ask')) f.scope = 'poc';
// Runtime and not-found semantics every candidate must keep.
fixtures.push(
  { path: '/does-not-exist', scope: 'poc', status: 404 },
  { path: '/api/does-not-exist', scope: 'poc', status: 404 },
);

const digest = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inventory = { baseSha: '7b6ef85abaaef50de5c8d277629b07a39c9c3065', site: SITE, liveSnapshotSha256: digest([...live.values()]), routes: rows };
fs.writeFileSync(new URL('route-inventory.json', OUT), JSON.stringify(inventory, null, 2) + '\n');
// PoC coverage limits: internal link targets on PoC pages that are outside the PoC set.
const pocCoverageLimits = [...new Set(rows.filter((r) => r.poc).flatMap((r) => r.live.links)
  .filter((h) => h.startsWith('/') && !h.startsWith('/cdn-cgi/')).map((h) => norm(h.replace(/[?#].*$/, ''))).filter((p) => !POC.includes(p)))].sort();
fs.writeFileSync(new URL('route-fixtures.json', OUT), JSON.stringify({ baseSha: inventory.baseSha, inventorySha256: digest(rows), pocRoutes: POC, pocCoverageLimits, routes: fixtures }, null, 2) + '\n');
const count = (k) => Object.entries(rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] ?? 0) + 1), a), {})).map(([a, b]) => `${a}=${b}`).join(' ');
console.log(`routes=${rows.length} (${count('kind')}) | ${count('disposition')} | poc=${rows.filter((r) => r.poc).length} | fixtures=${fixtures.length}`);
