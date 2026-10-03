// Native articles, rendering level (openspec docs-routing-publication "Native articles"): the published
// fixtures are built for real, in a throwaway copy of the repository (APFS clones, its own git history),
// so the committed tree, its manifest and dist/ are never touched. The copy then runs the post-build
// checks (test/dist.check.ts) and the RAG indexer plan against its own dist.
// NIMBUS_ARTICLES_BUILD_KEEP=1 keeps the copy and prints its path (the canary serves it for review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const site = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(site, '..');
const SKIP = new Set(['.git', '.evidence', 'dist']);
// Copy-on-write where the platform has it: `cp -c` is APFS (macOS); GNU cp (CI) reflinks when it can.
const CP = process.platform === 'darwin' ? ['-c', '-R'] : ['-R', '--reflink=auto'];
/** Runs a command; a failure carries its output, which stdio 'pipe' would otherwise hide. */
function run(cmd: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv }) {
  try {
    return execFileSync(cmd, args, { ...opts, stdio: 'pipe', encoding: 'utf8' });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    throw new Error(`${path.basename(cmd)} ${args.join(' ')} failed:\n${(err.stderr ?? '').slice(-3000)}\n${(err.stdout ?? '').slice(-3000)}`);
  }
}

function cloneRepo(): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-articles-build-'));
  for (const entry of fs.readdirSync(repo).filter((e) => !SKIP.has(e))) execFileSync('cp', [...CP, path.join(repo, entry), dest]);
  for (const entry of fs.readdirSync(site).filter((e) => !SKIP.has(e) && e !== 'node_modules')) {
    fs.rmSync(path.join(dest, 'site-nimbus', entry), { recursive: true, force: true });
    execFileSync('cp', [...CP, path.join(site, entry), path.join(dest, 'site-nimbus')]);
  }
  fs.rmSync(path.join(dest, 'site-nimbus/dist'), { recursive: true, force: true });
  fs.cpSync(path.join(site, 'test/fixtures/articles/published/src/articles'), path.join(dest, 'site-nimbus/src/articles'), { recursive: true });
  const git = (...args: string[]) => execFileSync('git', ['-C', dest, '-c', 'user.name=fixture', '-c', 'user.email=fixture@invalid', ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'articles fixture build');
  return dest;
}

test('published articles render at /blog/<slug>/ with a /blog/ index, reach Markdown, sitemap, search and RAG; the homepage and footer link them; the draft is nowhere', { timeout: 900_000 }, async () => {
  const dest = cloneRepo();
  const fsite = path.join(dest, 'site-nimbus');
  const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', CI: '', M2_CHECK: '0' };
  run(process.execPath, ['converter/convert.ts'], { cwd: fsite, env });
  run(path.join(fsite, 'node_modules/.bin/astro'), ['build'], { cwd: fsite, env });
  const dist = path.join(fsite, 'dist');
  const html = (p: string) => fs.readFileSync(path.join(dist, p), 'utf8');

  // The index: newest first, both published articles, never the draft.
  const index = html('blog/index.html');
  assert.ok(index.indexOf('Routing requests across providers') < index.indexOf('Choosing a plan') && index.indexOf('Choosing a plan') > 0);
  assert.match(index, /<link rel="canonical" href="https:\/\/docs\.apertis\.ai\/blog\/">/);

  // An article: the page header of a document, with the article's front matter.
  const page = html('blog/choosing-a-plan/index.html');
  assert.match(page, /<h1 id="choosing-a-plan">Choosing a plan<\/h1>/);
  assert.match(page, /class="doc-header__tag"[^>]*>Guides</);
  assert.match(page, /<dt>Author<\/dt><dd>Apertis team<\/dd>/);
  assert.match(page, /<dt>Published<\/dt><dd><time datetime="2026-09-20">Sep 20, 2026<\/time>/);
  assert.match(page, /<meta name="apertis-docs:markdown" content="\/blog\/choosing-a-plan\/index\.md">/);
  assert.match(page, /<h2 id="subscription">/);
  assert.equal(fs.readFileSync(path.join(dist, 'blog/choosing-a-plan/index.md'), 'utf8').split('\n')[0], '# Choosing a plan');

  // The homepage "From the blog" column lists the articles instead of saying they are on their way.
  const home = html('index.html');
  assert.match(home, /<h3>From the blog<\/h3>[\s\S]*?href="\/blog\/routing-requests-across-providers\/"[\s\S]*?>All articles</);
  assert.doesNotMatch(home, /are on their way/);
  assert.match(home, /href="\/blog\/routing-requests-across-providers\/"/);
  for (const p of ['index.html', 'blog/choosing-a-plan/index.html']) assert.match(html(p), /<a href="\/blog\/">Blog<\/a>/, p);

  // Docs link back to the articles that name them as related (Claude's "Next steps"); the draft never.
  const quick = html('getting-started/quick-start/index.html');
  assert.match(quick, /<section class="related-articles"[^>]*data-pagefind-ignore="all"[^>]*>[\s\S]*<a href="\/blog\/choosing-a-plan\/">Choosing a plan<\/a>/);
  assert.doesNotMatch(quick, /unfinished-draft|Unfinished draft/);
  assert.match(html('billing/subscription-plans/index.html'), /<a href="\/blog\/choosing-a-plan\/">Choosing a plan<\/a>/);
  assert.doesNotMatch(html('api/index.html'), /related-articles/);

  // Two categories: the index offers a category filter; every row carries its category.
  assert.match(index, /<div class="article-filter" role="group" aria-label="Filter articles by category">/);
  for (const c of ['All', 'Engineering', 'Guides']) assert.match(index, new RegExp(`<button type="button"[^>]*>${c}</button>`));
  assert.match(index, /<li data-category="Guides">/);
  // The filter works in a browser (its inline script is self-contained, so the page HTML alone runs it).
  if (process.env.PLAYWRIGHT) {
    const { chromium } = await import(process.env.PLAYWRIGHT);
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
      const page = await browser.newPage();
      await page.setContent(index, { waitUntil: 'domcontentloaded' });
      await page.click('.article-filter button[data-category="Engineering"]');
      const state = await page.evaluate(() => ({
        pressed: [...document.querySelectorAll('.article-filter button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`),
        shown: [...document.querySelectorAll('.article-list li')].filter((li) => !(li as HTMLElement).hidden).map((li) => (li as HTMLElement).dataset.category),
      }));
      assert.deepEqual(state, { pressed: ['All:false', 'Engineering:true', 'Guides:false'], shown: ['Engineering'] });
      await page.click('.article-filter button[data-category=""]');
      assert.equal(await page.locator('.article-list li:not([hidden])').count(), 2);
    } finally {
      await browser.close();
    }
  } else console.log('# category filter click check skipped: PLAYWRIGHT is not set');
  // The homepage list stays unfiltered.
  assert.doesNotMatch(home, /article-filter/);

  // Sitemap, redirects: /blog/ is live; the legacy posts are still not served.
  const sitemap = html('sitemap.xml');
  for (const slug of ['routing-requests-across-providers', 'choosing-a-plan']) assert.match(sitemap, new RegExp(`/blog/${slug}/</loc>`));
  const redirects = fs.existsSync(path.join(dist, '_redirects')) ? html('_redirects') : '';
  assert.doesNotMatch(redirects, /^\/blog\/? /m);
  for (const legacy of ['welcome', 'first-blog-post', 'tags', 'authors']) assert.equal(fs.existsSync(path.join(dist, 'blog', legacy)), false, legacy);

  // The draft appears nowhere in dist, compressed search fragments included (dist.check decompresses them).
  const files = fs.readdirSync(dist, { recursive: true }).map(String);
  assert.ok(!files.some((f) => f.includes('unfinished-draft')));
  for (const f of files.filter((x) => /\.(html|md|xml|json|txt)$/.test(x))) assert.ok(!html(f).includes('DRAFT-FIXTURE-MARKER'), f);

  // The copy's own post-build checks (search index = eligible entries, exclusions, secrets) pass on its dist.
  run(process.execPath, ['--test', 'test/dist.check.ts'], { cwd: fsite, env });

  // RAG: the indexer plans both articles against the built pages, anchors included.
  const { plan } = await import(path.join(dest, 'indexer/indexer.ts'));
  const p = plan(path.join(fsite, 'src/manifest/manifest.json'), dist);
  const articles = p.documents.filter((d: { id: string }) => d.id.startsWith('blog:'));
  assert.deepEqual(articles.map((d: { id: string }) => d.id).sort(), ['blog:choosing-a-plan', 'blog:routing-requests-across-providers']);
  assert.ok(articles.every((d: { chunks: unknown[] }) => d.chunks.length > 0));

  if (process.env.NIMBUS_ARTICLES_BUILD_KEEP === '1') console.log(`# articles fixture build kept at ${fsite}`);
  else fs.rmSync(dest, { recursive: true, force: true });
});
