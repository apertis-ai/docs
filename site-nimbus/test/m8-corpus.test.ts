// #13 full corpus: decoded inventory titles, buildId inputs, retired routes and full navigation.
// Pure: needs no build output (post-build checks are the m8 cases in test/dist.check.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildHashOf, convertDocument, decodeEntities, readInventory } from '../converter/convert.ts';
import { RETIRED_TARGET, publicationFiles, shikiClassErrors, sortShikiCss } from '../converter/integration.ts';
import { buildNavigation, pageNavigation } from '../src/components/shell/navigation.ts';
import type { ManifestV1 } from '../src/contracts/manifest.ts';
import type { InventoryRoute, RouteInventory } from '../src/contracts/navigation.ts';
import { manifest } from '../src/manifest/manifest.ts';

const site = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(site, '..');
const inventory = readInventory(repoRoot);
const raw = (JSON.parse(fs.readFileSync(path.join(repoRoot, 'migration/nimbus/route-inventory.json'), 'utf8')) as RouteInventory).routes;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-m8-'));
const DECISION = 'https://github.com/apertis-ai/docs/issues/4#issuecomment-5881882328';

test('inventory titles are decoded once at the read, so the manifest title is text', () => {
  const at = (rows: InventoryRoute[]) => rows.find((r) => r.documentId === 'api:sdks/python-sdk/reasoning')!.live!.title;
  assert.equal(at(raw), 'Reasoning &amp; Extended Thinking | Apertis Documentation');
  assert.equal(at(inventory), 'Reasoning & Extended Thinking | Apertis Documentation');
  assert.equal(manifest.documents.find((d) => d.id === 'api:sdks/python-sdk/reasoning')!.title, 'Reasoning & Extended Thinking');
  assert.equal(manifest.documents.some((d) => /&(amp|lt|gt|quot|#\d+);/.test(d.title)), false);
  // Everything else is unchanged by the decode.
  assert.deepEqual(inventory.map((r) => ({ ...r, live: r.live && { ...r.live, title: null } })), raw.map((r) => ({ ...r, live: r.live && { ...r.live, title: null } })));
  const row = inventory.find((r) => r.documentId === 'api:sdks/python-sdk/reasoning')!;
  const ctx = { inventory, repoRoot };
  assert.equal(convertDocument('# Reasoning & Extended Thinking\n', row, ctx).title, 'Reasoning & Extended Thinking');
  assert.throws(() => convertDocument('# Reasoning &amp; Extended Thinking\n', row, ctx), /differs from inventory/);
  assert.throws(() => convertDocument('# Reasoning and Extended Thinking\n', row, ctx), /differs from inventory/);
});

test('entity decoding handles numeric and named references and refuses unknown names', () => {
  assert.equal(decodeEntities('A &amp; B &lt;c&gt; &quot;d&quot; &#39;e&#x27; f&nbsp;g'), 'A & B <c> "d" \'e\' f g');
  assert.throws(() => decodeEntities('&copy;'), /unknown HTML entity/);
});

test('buildId hashes build inputs only: README, .gitignore and tests never move it', () => {
  const repo = tmp();
  const put = (rel: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), body);
  };
  const inputs = ['site-nimbus/package.json', 'site-nimbus/package-lock.json', 'site-nimbus/tsconfig.json', 'site-nimbus/nimbus.json',
    'site-nimbus/converter/convert.ts', 'site-nimbus/converter/integration.ts', 'site-nimbus/src/pages/search.astro',
    'site-nimbus/src/components/shell/navigation.ts', 'site-nimbus/src/styles/shell.css', 'migration/nimbus/route-inventory.json'];
  const notInputs = ['site-nimbus/README.md', 'site-nimbus/.gitignore', 'site-nimbus/test/m8-corpus.test.ts', 'site-nimbus/test/dist.check.ts'];
  for (const rel of [...inputs, ...notInputs]) put(rel, `${rel}\n`);
  execFileSync('git', ['-C', repo, 'init', '-q']);
  execFileSync('git', ['-C', repo, 'add', '-A']);
  const siteRoot = path.join(repo, 'site-nimbus');
  const base = buildHashOf(siteRoot, repo);
  const edited = (rel: string) => { const old = fs.readFileSync(path.join(repo, rel)); put(rel, 'changed\n'); const h = buildHashOf(siteRoot, repo); fs.writeFileSync(path.join(repo, rel), old); return h; };
  for (const rel of notInputs) assert.equal(edited(rel), base, rel);
  for (const rel of inputs) assert.notEqual(edited(rel), base, rel);
  // A test-like name outside test/ is still an input.
  put('site-nimbus/src/test/x.ts', 'x\n');
  execFileSync('git', ['-C', repo, 'add', '-A']);
  assert.notEqual(buildHashOf(siteRoot, repo), base);
});

test('every placeholder row is retired by the recorded decision and nothing else changed disposition', () => {
  const retired = inventory.filter((r) => (r.disposition as string) === 'retired');
  assert.equal(retired.length, 23);
  assert.deepEqual(retired.map((r) => r.path).filter((p) => !/^\/(blog(\/|$)|test$|markdown-page$|404$)/.test(p)), []);
  for (const r of retired) {
    assert.equal((r as InventoryRoute & { decision?: string }).decision, DECISION, r.path);
    assert.deepEqual(r.eligibility, { publish: false, search: false, agent: false, rag: false }, r.path);
  }
  assert.equal(inventory.some((r) => r.disposition === 'preserve-pending-decision'), false);
  assert.equal(manifest.documents.some((d) => retired.some((r) => r.documentId === d.id)), false);
});

test('publication files: sitemap from published HTML routes; _redirects only for retired paths dist would serve', () => {
  const out = tmp();
  fs.writeFileSync(path.join(out, '404.html'), '<main>not found</main>');
  const m = { documents: [
    { canonicalUrl: 'https://docs.apertis.ai/b', eligibility: { publish: true } },
    { canonicalUrl: 'https://docs.apertis.ai/a?x=1&y=2', eligibility: { publish: true } },
    { canonicalUrl: 'https://docs.apertis.ai/hidden', eligibility: { publish: false } },
  ] } as unknown as ManifestV1;
  const rows = [
    { path: '/404', disposition: 'retired', kind: 'page', eligibility: { publish: false } },
    { path: '/blog', disposition: 'retired', kind: 'blog-generated', eligibility: { publish: false } },
    { path: '/search', disposition: 'preserve', kind: 'generated', eligibility: { publish: true }, live: { canonical: 'https://docs.apertis.ai/search' } },
  ] as unknown as InventoryRoute[];
  const files = publicationFiles(m, rows, out);
  assert.deepEqual([...files['sitemap.xml'].matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]),
    ['https://docs.apertis.ai/a?x=1&amp;y=2', 'https://docs.apertis.ai/b', 'https://docs.apertis.ai/search']);
  assert.deepEqual(files._redirects.split('\n').filter((l) => l && !l.startsWith('#')),
    [`/404 ${RETIRED_TARGET} 200`, `/404/ ${RETIRED_TARGET} 200`, `/404.html ${RETIRED_TARGET} 200`]);
  fs.mkdirSync(path.join(out, RETIRED_TARGET.slice(1)));
  fs.writeFileSync(path.join(out, RETIRED_TARGET.slice(1), 'index.html'), 'x');
  assert.throws(() => publicationFiles(m, rows, out), /must not exist/);
});

test('the full sidebars render from the manifest: every sidebar row is converted, unlisted pages have none', () => {
  const nav = buildNavigation(inventory, manifest.documents);
  const rows = inventory.filter((r) => r.sidebar && r.eligibility.publish);
  assert.equal(nav.entries.length, rows.length);
  assert.equal(nav.converted.size, nav.entries.length, 'no sidebar row falls back to the inventory');
  for (const e of nav.entries) assert.equal(e.href, manifest.documents.find((d) => d.id === e.id)!.servedPath, e.id);
  assert.equal(pageNavigation(nav, 'default:help/ideas'), null);
  assert.ok(manifest.documents.some((d) => d.id === 'default:help/ideas' && d.eligibility.publish), 'unlisted but published');
  for (const id of ['tutorialSidebar', 'apiSidebar'] as const) {
    const flat = nav.entries.filter((e) => e.sidebar.sidebar === id);
    const first = pageNavigation(nav, flat[0].id)!, last = pageNavigation(nav, flat.at(-1)!.id)!;
    assert.equal(first.prev, null);
    assert.equal(last.next, null);
  }
});

test('a page using a Shiki class missing from _nimbus/shiki.css is reported (uncoloured code tokens)', () => {
  const out = tmp();
  fs.mkdirSync(path.join(out, '_nimbus'));
  fs.mkdirSync(path.join(out, 'a'));
  fs.writeFileSync(path.join(out, '_nimbus/shiki.css'), '.nb-shiki-aaa111{--shiki-light:#000}.nb-shiki-bbb222{--shiki-light:#111}\n');
  fs.writeFileSync(path.join(out, 'a/index.html'), '<pre><span class="nb-shiki-aaa111">x</span><span class="nb-shiki-bbb222">y</span></pre>');
  fs.writeFileSync(path.join(out, 'index.html'), '<main>no code</main>');
  assert.deepEqual(shikiClassErrors(out), []);
  fs.writeFileSync(path.join(out, 'a/index.html'), '<pre><span class="nb-shiki-aaa111">x</span><span class="nb-shiki-ccc333">z</span></pre>');
  assert.deepEqual(shikiClassErrors(out), ['dist: a/index.html uses nb-shiki-ccc333, not defined in _nimbus/shiki.css']);
  fs.rmSync(path.join(out, '_nimbus/shiki.css'));
  assert.equal(shikiClassErrors(out).length, 1);
});

test('_nimbus/shiki.css rules are sorted by class, so cold builds are byte-identical whatever the render order', () => {
  const out = tmp();
  fs.mkdirSync(path.join(out, '_nimbus'));
  const file = path.join(out, '_nimbus/shiki.css');
  const [a, b, c] = ['.nb-shiki-aa1{}', '.nb-shiki-bb2{--shiki-light:#000; overflow-x: auto;}', '.nb-shiki-cc3{--shiki-dark:#fff}'];
  fs.writeFileSync(file, `${c}${a}${b}\n`);
  sortShikiCss(out);
  assert.equal(fs.readFileSync(file, 'utf8'), `${a}${b}${c}\n`);
  fs.writeFileSync(file, `${b}${c}${a}\n`);
  sortShikiCss(out);
  assert.equal(fs.readFileSync(file, 'utf8'), `${a}${b}${c}\n`);
  // Anything but the flat one-rule-per-class form is left untouched.
  fs.writeFileSync(file, '@media (x) { .nb-shiki-bb2{} }\n');
  sortShikiCss(out);
  assert.equal(fs.readFileSync(file, 'utf8'), '@media (x) { .nb-shiki-bb2{} }\n');
});
