// The blog's live articles: what articles-feed.ts accepts from GET https://apertis.ai/api/blog/articles and
// /api/blog/articles/<slug>, and what functions/blog/[[path]].ts makes of it on the edge (run in workerd by
// test/blog-edge.ts, with stubbed static responses, API and cache). The static pages are trimmed copies of what
// the build emits (test/fixtures/blog-live/).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  LIST_SOURCE, articleSource, categoryLabel, decodeText, escapeHtml, fetchArticle, fetchArticles, liveArticle, liveRow, liveRows,
  readingMinutes, renderBody, rowHtml,
} from '../src/components/home/articles-feed.ts';
import { readingMinutes as converterMinutes } from '../converter/convert.ts';
import { LEGACY_BLOG_PATHS } from '../src/contracts/articles.ts';
import { edge, type Scenario, type Upstream } from './blog-edge.ts';

const fixture = (f: string) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures/blog-live', f), 'utf8');
const STATICS: Record<string, string> = {
  '404': fixture('404.html'),
  '/blog/': fixture('index.html'),
  '/blog/_article/': fixture('article-template.html'),
  '/blog/_listing/': fixture('listing-template.html'),
  '/blog/tags/': fixture('tags.html'),
  '/blog/tags/ci/': fixture('tag-ci.html'),
  '/blog/categories/': fixture('categories.html'),
  '/blog/categories/ci/': fixture('category-ci.html'),
  '/blog/authors/yu-ting-lee/': fixture('author.html'),
  '/blog/ci-moved-three-times/': fixture('article-static.html'),
};
const AUTHORS = 'https://apertis.ai/api/blog/authors';
const KEY = 'https://docs.apertis.ai/_nimbus/blog-articles';

const row = (over: Record<string, unknown> = {}) => ({
  slug: 'edge-notes', title: 'Edge notes', description: 'What the edge does.', author_slug: 'yu-ting-lee', category: 'ci',
  tags: ['ci', 'edge'], published_at: '2026-11-14T08:00:00Z', ...over,
});
const ok = (data: unknown) => ({ body: { success: true, data } });
const answer = (body: unknown, status = 200) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

// ---- articles-feed.ts: validation, rendering and escaping (pure) ----

test('a list row passes only with every field in shape; the list skips the rest and sorts newest first', () => {
  assert.deepEqual(liveRow(row()), { slug: 'edge-notes', title: 'Edge notes', description: 'What the edge does.', author: 'yu-ting-lee', category: 'ci', tags: ['ci', 'edge'], published: '2026-11-14T08:00:00Z' });
  for (const bad of [
    { slug: 'Edge' }, { slug: 'a--b' }, { slug: 'x'.repeat(97) }, { title: '' }, { title: 'x'.repeat(201) }, { title: 'two\nlines' },
    { description: 'x'.repeat(301) }, { description: 'a\u2028b' }, { category: 'c'.repeat(41) }, { category: 'A I' }, { author_slug: '../x' },
    { tags: 'ci' }, { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, { tags: ['"><script>alert(1)</script>'] }, { tags: ['x'.repeat(41)] },
    { published_at: '2026-11-14' }, { published_at: 'yesterday' }, { published_at: '2026-13-45T99:00:00Z' },
  ]) assert.equal(liveRow(row(bad)), null, JSON.stringify(bad));
  const rows = liveRows([row({ slug: 'old', published_at: '2026-01-02T00:00:00+08:00' }), row(), null, 'x', row({ slug: 'BAD' }), row()]);
  assert.deepEqual(rows.map((r) => r.slug), ['edge-notes', 'old']);
  for (const bad of [null, {}, 'x']) assert.throws(() => liveRows(bad), /expected a list/);
});

test('one article must be the slug asked for, with a Markdown body of at most 256 KiB', () => {
  const a = { ...row(), body_markdown: '# Hi' };
  assert.equal(liveArticle(a, 'edge-notes').markdown, '# Hi');
  assert.throws(() => liveArticle(a, 'other'), /unusable/);
  assert.throws(() => liveArticle({ ...a, body_markdown: 7 }, 'edge-notes'), /unusable body/);
  assert.throws(() => liveArticle({ ...a, body_markdown: 'é'.repeat(131073) }, 'edge-notes'), /unusable body/);
});

test('fetching: a 404 list is no live articles, a 404 article is null, anything else unusable throws', async () => {
  const seen: string[] = [];
  const spy = (async (url: string) => { seen.push(url); return new Response(JSON.stringify({ success: true, data: [row()] })); }) as unknown as typeof fetch;
  assert.deepEqual((await fetchArticles(spy)).map((r) => r.slug), ['edge-notes']);
  assert.deepEqual(seen, [LIST_SOURCE]);
  assert.deepEqual(await fetchArticles(answer({ success: false, message: 'Not Found' }, 404)), []);
  await assert.rejects(fetchArticles(answer('upstream exploded', 500)), /HTTP 500/);
  await assert.rejects(fetchArticles(answer('{not json')), SyntaxError);
  await assert.rejects(fetchArticles(answer({ success: false, message: 'nope' })), /nope/);
  await assert.rejects(fetchArticles(answer({ success: true, data: { rows: [] } })), /expected a list/);
  assert.equal(await fetchArticle(answer({ success: false }, 404), 'edge-notes'), null);
  assert.equal((await fetchArticle(answer({ success: true, data: { ...row(), body_markdown: 'x' } }), 'edge-notes'))?.slug, 'edge-notes');
  await assert.rejects(fetchArticle(answer({}), '../etc'), /not a slug/);
  assert.equal(articleSource('edge-notes'), 'https://apertis.ai/api/blog/articles/edge-notes');
});

test('the body is micromark with its defaults: raw HTML is text, an unsafe link points nowhere', () => {
  const out = renderBody('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1)) [ok](https://apertis.ai/) ![i](javascript:x)\n\n# Heading');
  assert.ok(out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!/<script|<img src=x|onerror=alert\(1\)>|javascript:/i.test(out), out);
  assert.ok(out.includes('<a>click</a>') && out.includes('<a href="https://apertis.ai/">ok</a>') && out.includes('<img src="" alt="i" />') && out.includes('<h1>Heading</h1>'), out);
});

test('the escaping helper and every row it builds keep markup inert', () => {
  assert.equal(escapeHtml(`"><script>alert('x')</script>&`), '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;');
  assert.equal(decodeText('R&amp;D &lt;b&gt; &#39;q&#39; &#x41;'), "R&D <b> 'q' A");
  const r = liveRow(row({ title: '"><script>alert(1)</script>', description: '"><img src=x onerror=alert(1)>' }))!;
  const li = rowHtml(r, '"><b>label', { describe: true, anchors: true });
  assert.ok(!/<script|<img|<b>/.test(li), li);
  assert.ok(li.includes('data-category="&quot;&gt;&lt;b&gt;label"') && li.includes('id="article-edge-notes"') && li.includes('<span class="article-row__time"></span>'), li);
});

test('category names: a committed article\'s name first, else short slugs upper-cased, else a capital and spaces', () => {
  const labels = new Map([['ci', 'CI'], ['ml-ops', 'MLOps']]);
  assert.equal(categoryLabel('ml-ops', labels), 'MLOps');
  assert.equal(categoryLabel('ocr', labels), 'OCR');
  assert.equal(categoryLabel('ai', new Map()), 'AI');
  assert.equal(categoryLabel('model-routing', labels), 'Model routing');
});

test('reading time is the converter\'s rule', () => {
  for (const md of ['', 'one two', `${'word '.repeat(450)}\n\n\`\`\`\n${'code '.repeat(900)}\n\`\`\``]) assert.equal(readingMinutes(md), converterMinutes(md), md.slice(0, 20));
});

test('the legacy blog paths the edge refuses are the route inventory\'s', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../migration/nimbus/route-inventory.json'), 'utf8')) as { routes: { path: string }[] };
  assert.deepEqual([...LEGACY_BLOG_PATHS].sort(), inventory.routes.map((r) => r.path.replace(/(.)\/$/, '$1')).filter((p) => p === '/blog' || p.startsWith('/blog/')).sort());
});

// ---- functions/blog/[[path]].ts on the edge ----

let mf: Awaited<ReturnType<typeof edge>>;
before(async () => { mf = await edge(); });
after(async () => { await mf?.dispose(); });
const run = (s: Partial<Scenario> & { path: string }) => mf.run({ statics: STATICS, ...s });
const article = (over: Record<string, unknown> = {}) => ({ ...row(over), body_markdown: '## Why\n\nBecause the **edge** said so.' });
const liveUp = (list: unknown[], articles: Record<string, unknown> = {}, authors: unknown = [{ slug: 'yu-ting-lee', name: 'Yu-Ting Lee', title: 'CTO of Apertis' }]) => ({
  [LIST_SOURCE]: ok(list),
  ...Object.fromEntries(Object.entries(articles).map(([slug, a]) => [articleSource(slug), ok(a)])),
  [AUTHORS]: ok(authors),
});
const between = (html: string, a: string, b: string) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));

test('a published article the build does not have is rendered into the article template', async () => {
  const res = await run({ path: '/blog/edge-notes/?utm=x', upstream: liveUp([row()], { 'edge-notes': article() }) });
  assert.equal(res.status, 200);
  const h = res.body;
  assert.ok(h.includes('<title>Edge notes | Apertis</title>'));
  assert.ok(h.includes('<link rel="canonical" href="https://docs.apertis.ai/blog/edge-notes/">'));
  assert.ok(h.includes('<meta property="og:url" content="https://docs.apertis.ai/blog/edge-notes/">'));
  assert.ok(h.includes('<meta name="description" content="What the edge does.">'));
  assert.ok(h.includes('<meta property="article:tag" content="ci"><meta property="article:tag" content="edge">'));
  assert.ok(h.includes('<meta name="twitter:card" content="summary">') && !h.includes('og:image'), 'the default card');
  assert.ok(!h.includes('noindex') && !h.includes('_article') && !h.includes('Description') && !h.includes('>Body<'), 'a placeholder is left');
  assert.ok(h.includes('<a href="/blog/categories/ci/">CI</a>'), 'the category the committed article names');
  assert.ok(h.includes('<h1 id="edge-notes">Edge notes</h1>'));
  assert.ok(h.includes('<a href="/blog/authors/yu-ting-lee/">') && h.includes('data-author="yu-ting-lee" data-author-field="name">Yu-Ting Lee</span>') && h.includes('>YL</span>'));
  assert.ok(h.includes('<time datetime="2026-11-14">Nov 14, 2026</time>') && h.includes('<dd>1 min</dd>'));
  assert.ok(h.includes('<li><a class="tag" href="/blog/tags/ci/">#ci</a></li><li><a class="tag" href="/blog/tags/edge/">#edge</a></li>'));
  assert.ok(h.includes('<hr class="doc-header__rule"><h2>Why</h2>\n<p>Because the <strong>edge</strong> said so.</p></article>'));
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  assert.deepEqual([ld['@type'], ld.headline, ld.url, ld.datePublished, ld.author.name, ld.author.jobTitle], ['BlogPosting', 'Edge notes', 'https://docs.apertis.ai/blog/edge-notes/', '2026-11-14', 'Yu-Ting Lee', 'CTO of Apertis']);
  assert.equal(res.headers.etag, undefined);
  // Only the constant API origin is fetched, and the cache keys are the site's constant origin plus the slug.
  assert.deepEqual(res.calls, [LIST_SOURCE, articleSource('edge-notes'), AUTHORS]);
  assert.deepEqual(res.puts, [KEY, `${KEY}/edge-notes`, 'https://docs.apertis.ai/_nimbus/blog-authors']);
});

test('stored values in title, description and body are inert in text and attribute positions', async () => {
  const evil = '"><script>alert(1)</script>';
  const a = { ...article({ title: evil, description: `${evil}<img src=x onerror=alert(1)>` }), body_markdown: '<script>alert(2)</script>\n\n<img src=x onerror=alert(3)>\n\n[go](javascript:alert(4))' };
  const res = await run({ path: '/blog/edge-notes/', upstream: liveUp([row({ title: evil })], { 'edge-notes': a }) });
  assert.equal(res.status, 200);
  const h = res.body;
  // Outside attribute values (a double-quoted value ends only at a quote, which setAttribute escapes) and the JSON-LD
  // block (checked below: no `<` can end it), no value is markup.
  const markup = h.replace(/<script type="application\/ld\+json">[^<]*<\/script>/, '').replace(/="[^"]*"/g, '=""');
  // (The template itself has no <img> and no other <script>: every one here would be a value's.)
  assert.ok(!/<script|<img|javascript:/i.test(markup), 'a value became markup');
  assert.ok(h.includes('<title>"&gt;&lt;script&gt;alert(1)&lt;/script&gt; | Apertis</title>'), 'title text');
  assert.ok(h.includes('<meta property="og:title" content="&quot;><script>alert(1)</script>">'), 'title attribute: the quote is escaped, the value stays one value');
  assert.ok(h.includes('<meta name="description" content="&quot;><script>alert(1)</script><img src=x onerror=alert(1)>">'), 'description attribute');
  assert.ok(h.includes('<p class="doc-header__desc">"&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</p>'), 'description text');
  assert.ok(/<h1 id="[^"<>]*">"&gt;&lt;script&gt;/.test(h), 'heading');
  assert.ok(h.includes('&lt;script&gt;alert(2)&lt;/script&gt;') && h.includes('&lt;img src=x onerror=alert(3)&gt;') && h.includes('<a>go</a>'), 'body');
  assert.ok(h.includes('"headline":"\\">\\u003cscript>alert(1)\\u003c/script>"'), 'JSON-LD');
  // A tag that is not a slug fails the row (and so the article): the static 404 stands.
  const tag = await run({ path: '/blog/edge-notes/', upstream: liveUp([row({ tags: [evil] })], { 'edge-notes': article({ tags: [evil] }) }) });
  assert.equal(tag.status, 404);
  assert.equal(tag.body, STATICS['404']);
});

test('a static article is served as built, and its slug is never asked of the API', async () => {
  const res = await run({ path: '/blog/ci-moved-three-times/', upstream: liveUp([row({ slug: 'ci-moved-three-times' })], { 'ci-moved-three-times': article({ slug: 'ci-moved-three-times' }) }) });
  assert.equal(res.status, 200);
  assert.equal(res.body, STATICS['/blog/ci-moved-three-times/']);
  assert.deepEqual([res.calls, res.puts], [[], []]);
  // Nor listed twice: the /blog/ index skips the live row of a slug the build publishes.
  const index = await run({ path: '/blog/', upstream: liveUp([row({ slug: 'ci-moved-three-times', title: 'Shadow' })]) });
  assert.equal(index.body, STATICS['/blog/']);
  assert.ok(!index.calls.includes(articleSource('ci-moved-three-times')));
});

test('an upstream 500, a malformed answer or a lost connection serves the static response byte for byte, uncached and logged', async () => {
  const failures: Record<string, Upstream>[] = [{ [LIST_SOURCE]: { status: 500, body: 'oops' } }, { [LIST_SOURCE]: { body: '{"success":true,"data":[' } }, {}];
  for (const upstream of failures) {
    for (const p of ['/blog/edge-notes/', '/blog/', '/blog/tags/ci/', '/blog/categories/ops/']) {
      const res = await run({ path: p, upstream });
      const expected = Object.hasOwn(STATICS, p) ? STATICS[p] : STATICS['404'];
      assert.equal(res.status, Object.hasOwn(STATICS, p) ? 200 : 404, p);
      assert.equal(res.body, expected, p);
      if (Object.hasOwn(STATICS, p)) assert.equal(res.headers.etag, '"static"', p);
      assert.deepEqual(res.puts, [], p);
      assert.ok(res.logs.some((l) => l.startsWith('blog-articles:')), `${p}: ${res.logs}`);
    }
  }
  // The article itself failing (500 or unusable) is the same.
  for (const bad of [{ status: 500, body: 'x' }, { body: { success: true, data: { ...article(), slug: 'other' } } }]) {
    const res = await run({ path: '/blog/edge-notes/', upstream: { [LIST_SOURCE]: ok([row()]), [articleSource('edge-notes')]: bad } });
    assert.deepEqual([res.status, res.body === STATICS['404']], [404, true]);
    assert.deepEqual(res.puts, [KEY]);
    assert.ok(res.logs.some((l) => l.startsWith('blog-articles:')));
  }
});

test('an unpublished slug is never fetched one by one, and an unpublished article (404) leaves the static 404', async () => {
  const unknown = await run({ path: '/blog/not-published/', upstream: liveUp([row()]) });
  assert.deepEqual([unknown.status, unknown.body === STATICS['404'], unknown.calls], [404, true, [LIST_SOURCE]]);
  const draft = await run({ path: '/blog/edge-notes/', upstream: { [LIST_SOURCE]: ok([row()]), [articleSource('edge-notes')]: { status: 404, body: { success: false } } } });
  assert.deepEqual([draft.status, draft.body === STATICS['404'], draft.puts, draft.logs], [404, true, [KEY], []]);
});

test('the edge cache answers for ten minutes; its keys never carry the request\'s host or query', async () => {
  const first = await run({ path: '/blog/edge-notes/?a=1', headers: { 'x-forwarded-host': 'evil.example' }, upstream: liveUp([row()], { 'edge-notes': article() }) });
  assert.deepEqual(first.puts, [KEY, `${KEY}/edge-notes`, 'https://docs.apertis.ai/_nimbus/blog-authors']);
  const cache = { [KEY]: JSON.stringify([{ ...row(), title: 'Cached title' }]), [`${KEY}/edge-notes`]: JSON.stringify({ ...article(), title: 'Cached title' }), 'https://docs.apertis.ai/_nimbus/blog-authors': '{}' };
  const hit = await run({ path: '/blog/edge-notes/', cache });
  assert.deepEqual([hit.status, hit.calls, hit.puts], [200, [], []]);
  assert.ok(hit.body.includes('<title>Cached title | Apertis</title>'));
});

test('a missing live author leaves the byline on the slug; an authors failure does not lose the article', async () => {
  const res = await run({ path: '/blog/edge-notes/', upstream: { ...liveUp([row({ author_slug: 'guest-writer' })], { 'edge-notes': article({ author_slug: 'guest-writer' }) }), [AUTHORS]: { status: 503, body: 'x' } } });
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('data-author="guest-writer" data-author-field="name">guest-writer</span>'));
  assert.ok(res.logs.some((l) => l.startsWith('blog-articles: authors:')));
});

test('/blog/<slug> redirects to the article\'s page; the templates themselves answer 404', async () => {
  const res = await run({ path: '/blog/edge-notes', upstream: liveUp([row()]) });
  assert.deepEqual([res.status, res.headers.location], [308, '/blog/edge-notes/']);
  for (const p of ['/blog/_article/', '/blog/_listing/']) {
    const t = await run({ path: p, upstream: liveUp([row()]) });
    assert.deepEqual([t.status, t.body === STATICS['404'], t.calls], [404, true, []], p);
  }
});

test('the /blog/ index lists live rows among the static ones by date, in the row markup', async () => {
  const res = await run({ path: '/blog/', upstream: liveUp([row(), row({ slug: 'older', title: 'Older', category: 'model-routing', published_at: '2026-10-01T00:00:00Z' })]) });
  assert.equal(res.status, 200);
  const list = between(res.body, '<ol class="article-list">', '</ol>');
  assert.deepEqual([...list.matchAll(/href="\/blog\/([a-z0-9-]+)\/"/g)].map((m) => m[1]), ['edge-notes', 'ci-moved-three-times', 'older']);
  assert.ok(list.includes(rowHtml(liveRow(row())!, 'CI', { describe: true })));
  assert.ok(list.includes('<a class="article-row__category" href="/blog/categories/model-routing/">Model routing</a>'));
  assert.equal(res.headers.etag, undefined);
  assert.deepEqual(res.calls, [LIST_SOURCE]);
});

test('tag, category and author pages gain their live rows and count; a new year gets its own section', async () => {
  const up = liveUp([row(), row({ slug: 'last-year', title: 'Last year', tags: ['ci'], published_at: '2025-06-01T00:00:00Z' }), row({ slug: 'other-tag', tags: ['ops'], category: 'ops', author_slug: 'someone' })]);
  const tag = await run({ path: '/blog/tags/ci/', upstream: up });
  assert.ok(tag.body.includes('<p>3 articles</p>'));
  assert.deepEqual([...between(tag.body, '<ol', '</ol>').matchAll(/article-row__link" href="\/blog\/([a-z0-9-]+)\//g)].map((m) => m[1]), ['edge-notes', 'ci-moved-three-times', 'last-year']);
  const cat = await run({ path: '/blog/categories/ci/', upstream: up });
  assert.ok(cat.body.includes('<p>3 articles</p>') && !cat.body.includes('other-tag'));
  const author = await run({ path: '/blog/authors/yu-ting-lee/', upstream: up });
  const h = author.body;
  assert.ok(h.includes('<p class="author-page__count">3 articles</p>'));
  assert.ok(h.includes('<li data-category="CI" id="article-edge-notes">') && !h.includes('other-tag'));
  assert.ok(h.includes('</ol></section><section class="author-page__year" aria-labelledby="year-2025"><h2 id="year-2025">2025</h2><ol class="article-list"><li data-category="CI" id="article-last-year">'));
  assert.ok(h.includes('<ul><li><a href="#article-edge-notes">Edge notes</a></li><li><a href="#article-ci-moved-three-times">'));
  assert.ok(h.includes('</ul></li><li><a href="#year-2025">2025</a><ul><li><a href="#article-last-year">Last year</a></li></ul></li></ul>'));
});

test('the tags and categories indexes gain chips in order and counts', async () => {
  const up = liveUp([row({ tags: ['ci', 'agents', 'zeta'] }), row({ slug: 'two', category: 'ml-ops', tags: ['ci'] })]);
  const tags = await run({ path: '/blog/tags/', upstream: up });
  const chips = [...tags.body.matchAll(/href="\/blog\/tags\/([a-z0-9-]+)\/">#[a-z0-9-]+<span class="tag__count">(\d+)</g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(chips, ['agents=1', 'ci=3', 'cost=1', 'infrastructure=1', 'zeta=1']);
  const cats = await run({ path: '/blog/categories/', upstream: up });
  assert.ok(cats.body.includes('<li><a class="tag" href="/blog/categories/ci/">CI<span class="tag__count">2</span></a></li><li><a class="tag" href="/blog/categories/ml-ops/">Ml ops<span class="tag__count">1</span></a></li>'));
});

test('a tag or category page only live articles have is rendered into the listing template', async () => {
  const up = liveUp([row({ category: 'ocr', tags: ['vision'] })]);
  const cat = await run({ path: '/blog/categories/ocr/', upstream: up });
  assert.equal(cat.status, 200);
  assert.ok(cat.body.includes('<title>OCR | Apertis</title>') && cat.body.includes('<link rel="canonical" href="https://docs.apertis.ai/blog/categories/ocr/">'));
  assert.ok(cat.body.includes('<h1>OCR</h1><p>1 article</p>') && cat.body.includes('<a href="/blog/categories/">Categories</a>') && cat.body.includes('id="main"'));
  assert.ok(cat.body.includes('href="/blog/edge-notes/"') && !cat.body.includes('noindex') && !cat.body.includes('_listing'));
  const tag = await run({ path: '/blog/tags/vision/', upstream: up });
  assert.ok(tag.body.includes('<title>#vision | Apertis</title>') && tag.body.includes('<h1>#vision</h1>') && tag.body.includes('<a href="/blog/tags/">Tags</a>'));
  const none = await run({ path: '/blog/tags/nothing/', upstream: up });
  assert.deepEqual([none.status, none.body === STATICS['404']], [404, true]);
});

test('a live article that would bring back a retired legacy blog path is shown nowhere', async () => {
  const up = liveUp([row({ slug: 'welcome' }), row({ slug: 'tagged', tags: ['hello'] }), row({ slug: 'by-legacy', author_slug: 'yangshun' })]);
  for (const p of ['/blog/welcome/', '/blog/tagged/', '/blog/by-legacy/', '/blog/tags/hello/']) {
    const res = await run({ path: p, upstream: up });
    assert.deepEqual([res.status, res.body === STATICS['404'], res.calls], [404, true, [LIST_SOURCE]], p);
  }
  for (const p of ['/blog/', '/blog/tags/', '/blog/categories/ci/']) assert.equal((await run({ path: p, upstream: up })).body, STATICS[p], p);
});

test('other methods and other paths are the static response', async () => {
  const post = await run({ path: '/blog/edge-notes/', method: 'POST', upstream: liveUp([row()], { 'edge-notes': article() }) });
  assert.deepEqual([post.status, post.calls], [404, []]);
  for (const p of ['/blog/Edge-Notes/', '/blog/edge_notes/', '/blog/a/b/c/', '/blog/tags', '/blog/ci-moved-three-times/index.md']) {
    const res = await run({ path: p, upstream: liveUp([row()]) });
    assert.deepEqual(res.calls, [], p);
  }
});
