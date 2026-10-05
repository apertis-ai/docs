// Native articles, converter level (openspec docs-routing-publication "Native articles"): published
// fixtures become eligible manifest entries with a clean Markdown artifact, a draft becomes nothing,
// a slug that names a retired legacy route is refused, and the committed tree (no articles) is unchanged.
// Fixtures under test/fixtures/articles/<set>/src/articles stand in for site-nimbus/src/articles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ArticleError, readArticles } from '../converter/articles.ts';
import { convert, readInventory } from '../converter/convert.ts';
import { publicationFiles } from '../converter/integration.ts';
import { isNativeArticle } from '../src/contracts/articles.ts';
import { validateManifest } from '../src/contracts/validate-manifest.ts';

const site = path.resolve(import.meta.dirname, '..');
const fixtures = path.join(import.meta.dirname, 'fixtures/articles');
const inventory = readInventory();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-articles-'));

test('published articles become blog:<slug> entries eligible everywhere, with a clean Markdown artifact; a draft becomes nothing', () => {
  const out = tmp();
  const m = convert({ outRoot: out, siteRoot: path.join(fixtures, 'published') });
  const native = m.documents.filter(isNativeArticle);
  assert.deepEqual(native.map((d) => [d.id, d.servedPath, d.canonicalUrl, d.sourcePath]), [
    ['blog:routing-requests-across-providers', '/blog/routing-requests-across-providers/', 'https://docs.apertis.ai/blog/routing-requests-across-providers/', 'site-nimbus/src/articles/routing-requests-across-providers.md'],
    ['blog:choosing-a-plan', '/blog/choosing-a-plan/', 'https://docs.apertis.ai/blog/choosing-a-plan/', 'site-nimbus/src/articles/choosing-a-plan.md'],
  ]);
  for (const d of native) assert.deepEqual(d.eligibility, { publish: true, search: true, agent: true, rag: true });
  // The legacy corpus is untouched: 79 documents before the articles.
  assert.equal(m.documents.length - native.length, 79);
  const md = fs.readFileSync(path.join(out, 'src/content/public/blog/choosing-a-plan/index.md'), 'utf8');
  assert.equal(md, '# Choosing a plan\n\nA fixture article: subscription or pay-as-you-go, compared on one page.\n\nThis fixture stands in for a real article in tests only.\n\n## Subscription\n\nFixed quota per request.\n');
  const meta = JSON.parse(fs.readFileSync(path.join(out, 'src/content/docs/page-meta.json'), 'utf8'));
  assert.deepEqual(meta['blog:choosing-a-plan'], { updated: '2026-09-20', readingMinutes: 1 });
  // The draft: no entry, no artifact, no page meta, no trace of its text anywhere in the output.
  assert.ok(!m.documents.some((d) => d.id === 'blog:unfinished-draft'));
  const all = fs.readdirSync(out, { recursive: true }).map(String);
  assert.ok(!all.some((f) => f.includes('unfinished-draft')), all.filter((f) => f.includes('blog')).join(', '));
  for (const f of all.filter((x) => fs.statSync(path.join(out, x)).isFile())) {
    assert.ok(!fs.readFileSync(path.join(out, f), 'utf8').includes('DRAFT-FIXTURE-MARKER'), f);
  }
  // The manifest validates against the unchanged inventory once the artifacts are where the build puts them.
  const dist = tmp();
  fs.cpSync(path.join(out, 'src/content/public'), dist, { recursive: true });
  assert.deepEqual(validateManifest(m, { inventory, outDir: dist }), []);
});

test('a slug that names a retired legacy blog route is refused', () => {
  assert.throws(() => convert({ outRoot: tmp(), siteRoot: path.join(fixtures, 'collide') }),
    (e: unknown) => e instanceof ArticleError && /\/blog\/welcome is an inventory route/.test(e.message));
});

test('malformed articles fail loudly: front matter, slug, H1 in the body, MDX', () => {
  const bad = (name: string, text: string, expect: RegExp) => {
    const root = tmp();
    fs.mkdirSync(path.join(root, 'src/articles'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/articles', name), text);
    assert.throws(() => readArticles(root), (e: unknown) => e instanceof ArticleError && expect.test(e.message), name);
  };
  const fm = (extra = '', body = 'Body.\n') => `---\ntitle: T\ndescription: D\ndate: 2026-09-28\nauthor: A\ncategory: C\n${extra}---\n${body}`;
  bad('a.md', 'no front matter\n', /front matter must open the file/);
  bad('a.md', fm('tags: x\n'), /unknown front matter tags/);
  bad('a.md', fm().replace('author: A\n', ''), /author is required/);
  bad('a.md', fm().replace('2026-09-28', '28/09/2026'), /date must be YYYY-MM-DD/);
  bad('a.md', fm('draft: maybe\n'), /draft must be true or false/);
  bad('Bad_Slug.md', fm(), /slug must be lowercase/);
  bad('a.md', fm('', '# Title again\n'), /must not have an H1/);
  bad('a.md', fm('', 'import X from "y";\n'), /no MDX/);
  bad('a.md', fm('related: getting-started\n'), /related must be root-absolute served paths/);
});

test('related docs must be published documentation pages: an unknown path or another article is refused', () => {
  const site = (related: string) => {
    const root = tmp();
    fs.mkdirSync(path.join(root, 'src/articles'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/articles/a.md'), `---\ntitle: T\ndescription: D\ndate: 2026-09-28\nauthor: A\ncategory: C\nrelated: ${related}\n---\nBody.\n`);
    return root;
  };
  assert.throws(() => convert({ outRoot: tmp(), siteRoot: site('/no-such-page/') }),
    (e: unknown) => e instanceof ArticleError && /related \/no-such-page\/ is not a published documentation page/.test(e.message));
  assert.throws(() => convert({ outRoot: tmp(), siteRoot: site('/blog/a/') }),
    (e: unknown) => e instanceof ArticleError && /related \/blog\/a\/ is not a published documentation page/.test(e.message));
  assert.ok(convert({ outRoot: tmp(), siteRoot: site('/getting-started/quick-start/') }).documents.some((d) => d.id === 'blog:a'));
});

test('with no articles (the committed tree) nothing changes: 79 documents, no blog output', () => {
  assert.equal(fs.existsSync(path.join(site, 'src/articles')), false, 'no article is committed yet');
  const out = tmp();
  const m = convert({ outRoot: out });
  assert.equal(m.documents.length, 79);
  assert.equal(m.documents.filter(isNativeArticle).length, 0);
  assert.equal(fs.existsSync(path.join(out, 'src/content/public/blog')), false);
});

test('/blog/ is never rewritten to 404, with or without articles (the index says the first articles are on their way); every other retired /blog path stays 404', () => {
  const dist = tmp();
  fs.mkdirSync(path.join(dist, 'blog/welcome'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'blog/index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(dist, 'blog/welcome/index.html'), '<!doctype html>');
  const legacy = convert({ outRoot: tmp() });
  const without = publicationFiles(legacy, inventory, dist)._redirects ?? '';
  assert.doesNotMatch(without, /^\/blog\/? /m, 'the /blog/ index is served without articles too');
  assert.match(without, /^\/blog\/welcome\/ \/__retired 200$/m, 'a retired legacy post stays 404');
  assert.doesNotMatch(publicationFiles(legacy, inventory, dist)['sitemap.xml'], /\/blog\//, 'the empty index is not in the sitemap');
  const withArticles = convert({ outRoot: tmp(), siteRoot: path.join(fixtures, 'published') });
  const files = publicationFiles(withArticles, inventory, dist);
  assert.doesNotMatch(files._redirects ?? '', /^\/blog\/? /m);
  assert.match(files['sitemap.xml'], /<loc>https:\/\/docs\.apertis\.ai\/blog\/choosing-a-plan\/<\/loc>/);
  assert.doesNotMatch(files['sitemap.xml'], /unfinished-draft/);
});
