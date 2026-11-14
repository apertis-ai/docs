/// <reference types="@cloudflare/workers-types" />

// /blog/*: the articles the Apertis console publishes (site-nimbus/src/components/home/articles-feed.ts), shown
// beside the articles committed in the repository. The static response always comes first and a static page always
// wins: only an article-shaped path whose static response is 404 consults the API, and the listing pages only gain
// rows. In detail:
//   - /blog/<slug>/ answering 404 statically, for a slug the published list holds: the article, rendered into the
//     build's article template (/blog/_article/) with HTMLRewriter. /blog/<slug> redirects there first.
//   - /blog/, /blog/tags/, /blog/tags/<tag>/, /blog/categories/, /blog/categories/<slug>/ and /blog/authors/<slug>/:
//     the live rows (or tag and category chips) inserted in the static page's own markup, by date, any slug the
//     build already publishes skipped. A tag or category page only live articles have is rendered into the listing
//     template (/blog/_listing/).
//   - The two templates themselves answer 404.
// The API's origin is a constant; a request contributes only a path that passed the slug pattern, and the edge cache
// keys are the site's constant origin plus that slug. API answers are kept for ten minutes. Any upstream failure
// serves the static response unchanged, caches nothing and is logged as `blog-articles:`.
import {
  categoryLabel, chipHtml, countText, decodeText, escapeHtml, fetchArticle, fetchArticles, isSlug, liveArticle, liveRows,
  publishedDay, readingMinutes, renderBody, rowHtml, SLUG, tagItemHtml, type LiveArticle, type LiveRow,
} from '../../site-nimbus/src/components/home/articles-feed.ts';
import { fetchAuthors, type LiveAuthors } from '../../site-nimbus/src/components/home/authors-feed.ts';
import {
  ARTICLE_TEMPLATE_PATH, bylineParts, CATEGORIES_PATH, categoryPath, LISTING_TEMPLATE_PATH, TAGS_PATH, tagPath, titleId,
} from '../../site-nimbus/src/contracts/articles.ts';
import { MANIFEST_SITE } from '../../site-nimbus/src/contracts/manifest.ts';
import { BLOG_TITLE_SUFFIX, bylineAuthor, safeJsonLd } from '../../site-nimbus/src/contracts/page.ts';
import { displayDate } from '../../site-nimbus/src/components/shell/page-header.ts';

const TTL = 600;
const KEY = `${MANIFEST_SITE}/_nimbus/blog-articles`;
// The same key and shape functions/_nimbus/blog-authors.ts caches the authors under on the production host.
const AUTHORS_KEY = `${MANIFEST_SITE}/_nimbus/blog-authors`;
// Nothing is ever built here (`_` is in no slug): the static 404 page.
const MISSING_PATH = '/blog/_/';
const RESERVED = new Set(['tags', 'categories', 'authors']);

type Route =
  | { kind: 'article'; slug: string; slash: boolean }
  | { kind: 'index' | 'tags' | 'categories' }
  | { kind: 'tag' | 'category' | 'author'; slug: string }
  | { kind: 'template' }
  | { kind: 'other' };

/** What a /blog/ path is, by shape alone. */
export function route(pathname: string): Route {
  if (pathname === ARTICLE_TEMPLATE_PATH || pathname === LISTING_TEMPLATE_PATH) return { kind: 'template' };
  if (pathname === '/blog/') return { kind: 'index' };
  if (pathname === TAGS_PATH) return { kind: 'tags' };
  if (pathname === CATEGORIES_PATH) return { kind: 'categories' };
  const sub = /^\/blog\/(tags|categories|authors)\/([^/]+)\/$/.exec(pathname);
  if (sub) return isSlug(sub[2], sub[1] === 'authors' ? 96 : 40) ? { kind: ({ tags: 'tag', categories: 'category', authors: 'author' } as const)[sub[1] as 'tags'], slug: sub[2] } : { kind: 'other' };
  const article = /^\/blog\/([^/]+)(\/?)$/.exec(pathname);
  if (article && isSlug(article[1]) && !RESERVED.has(article[1])) return { kind: 'article', slug: article[1], slash: article[2] === '/' };
  return { kind: 'other' };
}

export interface Deps {
  fetch: typeof fetch;
  cache: Pick<Cache, 'match' | 'put'>;
  log: (...args: unknown[]) => void;
}

type Context = Pick<EventContext<{ ASSETS: Fetcher }, string, unknown>, 'request' | 'next' | 'env' | 'waitUntil'>;

interface Env {
  ASSETS: Fetcher;
  /** Local runs only: an API stub on the loopback interface (`http://127.0.0.1:<port>`); any other value is ignored. */
  BLOG_API_STUB_ORIGIN?: string;
}

const API_ORIGIN = /^https:\/\/apertis\.ai(?=\/)/;
const loopback = (v: unknown) => (typeof v === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/.test(v) ? v : null);

export const onRequest: PagesFunction<Env> = (context) => {
  const stub = loopback(context.env.BLOG_API_STUB_ORIGIN);
  const upstream = ((input: string, init?: RequestInit) => fetch(stub ? input.replace(API_ORIGIN, stub) : input, init)) as unknown as typeof fetch;
  return handler({ fetch: upstream, cache: caches.default, log: console.error })(context);
};

export function handler(deps: Deps) {
  return async (context: Context): Promise<Response> => {
    const { request, next, env } = context;
    const r = route(new URL(request.url).pathname);
    if (r.kind === 'template') return env.ASSETS.fetch(new Request(MANIFEST_SITE + MISSING_PATH));
    if ((request.method !== 'GET' && request.method !== 'HEAD') || r.kind === 'other') return next();
    // A listing page is rewritten from its full body: ask without the conditional headers, so the answer is never a bare 304.
    const listing = r.kind !== 'article';
    const res = await next(listing ? unconditional(request) : request);
    if (r.kind === 'article' ? res.status !== 404 : res.status !== 200 && !(res.status === 404 && (r.kind === 'tag' || r.kind === 'category'))) return res;
    const live = new Live(deps, context);
    try {
      if (r.kind === 'article') return await live.article(r.slug, r.slash, res);
      return await live.listing(r, res);
    } catch (e) {
      deps.log('blog-articles:', e instanceof Error ? e.message : e);
      return live.fallback ?? res;
    }
  };
}

function unconditional(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const h of ['if-none-match', 'if-modified-since', 'if-match', 'if-unmodified-since', 'if-range']) headers.delete(h);
  return new Request(request, { headers });
}

/** What a built listing page already shows: its article lists, its chips, its year sections and table of contents. */
interface Shown {
  lists: { year: string; rows: { slug: string; time: number }[] }[];
  chips: { slug: string; count: number }[];
  slugs: Set<string>;
  /** Category label by slug, as the committed articles name them. */
  labels: Map<string, string>;
}

async function shown(html: string): Promise<Shown> {
  const s: Shown = { lists: [], chips: [], slugs: new Set(), labels: new Map() };
  let row: { slug: string; time: number } = { slug: '', time: NaN };
  let year = '';
  let label: { slug: string; text: string } | null = null;
  let chip: { slug: string; count: number; text: string } | null = null;
  await new HTMLRewriter()
    .on('section.author-page__year > h2', { element(e) { year = (e.getAttribute('id') ?? '').replace(/^year-/, ''); } })
    .on('ol.article-list', { element() { s.lists.push({ year, rows: [] }); } })
    .on('ol.article-list > li', { element() { row = { slug: '', time: NaN }; s.lists.at(-1)!.rows.push(row); } })
    .on('ol.article-list > li time.article-row__date', { element(e) { row.time = Date.parse(e.getAttribute('datetime') ?? ''); } })
    .on('ol.article-list > li a.article-row__link', {
      element(e) {
        row.slug = /^\/blog\/([a-z0-9-]+)\/$/.exec(e.getAttribute('href') ?? '')?.[1] ?? '';
        if (row.slug) s.slugs.add(row.slug);
      },
    })
    .on('ol.article-list > li a.article-row__category', {
      element(e) {
        const slug = /^\/blog\/categories\/([a-z0-9-]+)\/$/.exec(e.getAttribute('href') ?? '')?.[1];
        label = slug ? { slug, text: '' } : null;
        e.onEndTag(() => { if (label && !s.labels.has(label.slug)) s.labels.set(label.slug, decodeText(label.text).trim()); label = null; });
      },
      text(t) { if (label) label.text += t.text; },
    })
    .on('ul.tag-list--index > li > a.tag', {
      element(e) {
        const slug = /^\/blog\/(?:tags|categories)\/([a-z0-9-]+)\/$/.exec(e.getAttribute('href') ?? '')?.[1] ?? '';
        chip = { slug, count: 0, text: '' };
        s.chips.push(chip);
      },
    })
    .on('ul.tag-list--index > li > a.tag > span.tag__count', { text(t) { if (chip) { chip.text += t.text; chip.count = Number(chip.text) || 0; } } })
    .transform(new Response(html))
    .arrayBuffer();
  return s;
}

/** For each static row index, the live rows that go before it (newest first, a tie keeps the static row first); the rest go last. */
function plan<T extends { published: string }>(staticTimes: number[], rows: T[]): { before: Map<number, T[]>; after: T[] } {
  const before = new Map<number, T[]>();
  const after: T[] = [];
  for (const r of rows) {
    const t = Date.parse(r.published);
    const k = staticTimes.findIndex((s) => !(s >= t));
    if (k < 0) after.push(r);
    else before.set(k, [...(before.get(k) ?? []), r]);
  }
  return { before, after };
}

const html = { html: true } as const;

class Live {
  /** A body already read from the static response: the fallback is that body again, byte for byte. */
  fallback: Response | null = null;
  constructor(private deps: Deps, private context: Context) {}

  private async cached<T>(key: string, load: () => Promise<T>, parse: (v: unknown) => T, store: (v: T) => unknown): Promise<T> {
    const hit = await this.deps.cache.match(new Request(key));
    if (hit) {
      try { return parse(await hit.json()); } catch { /* an unreadable entry is a miss */ }
    }
    const value = await load();
    const res = new Response(JSON.stringify(store(value)), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${TTL}` } });
    this.context.waitUntil(this.deps.cache.put(new Request(key), res));
    return value;
  }

  rows() {
    return this.cached(KEY, () => fetchArticles(this.deps.fetch), liveRows, (rows) => rows.map(toApi));
  }

  /** The published article, or null (unpublished since the list was read: the static 404 stands, and nothing is cached). */
  async one(slug: string): Promise<LiveArticle | null> {
    const key = `${KEY}/${slug}`;
    const hit = await this.deps.cache.match(new Request(key));
    if (hit) {
      try { return liveArticle(await hit.json(), slug); } catch { /* a miss */ }
    }
    const a = await fetchArticle(this.deps.fetch, slug);
    if (a) this.context.waitUntil(this.deps.cache.put(new Request(key), new Response(JSON.stringify({ ...toApi(a), body_markdown: a.markdown }), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${TTL}` } })));
    return a;
  }

  /** The live authors; an author the list lacks, or a failure to read it, leaves the byline on the author's slug. */
  async authors(): Promise<LiveAuthors> {
    try {
      return await this.cached(AUTHORS_KEY, () => fetchAuthors(this.deps.fetch), authorMap, (a) => a);
    } catch (e) {
      this.deps.log('blog-articles: authors:', e instanceof Error ? e.message : e);
      return {};
    }
  }

  /** The /blog/ index as built: which articles the repository publishes, and their category names. */
  async site(text?: string): Promise<Shown> {
    if (text !== undefined) return shown(text);
    const res = await this.context.env.ASSETS.fetch(new Request(`${MANIFEST_SITE}/blog/`));
    if (!res.ok) throw new Error(`/blog/: HTTP ${res.status}`);
    return shown(await res.text());
  }

  async template(path: string): Promise<Response> {
    const res = await this.context.env.ASSETS.fetch(new Request(MANIFEST_SITE + path));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res;
  }

  async article(slug: string, slash: boolean, res: Response): Promise<Response> {
    const row = (await this.rows()).find((x) => x.slug === slug);
    if (!row) return res;
    if (!slash) return new Response(null, { status: 308, headers: { location: `/blog/${slug}/` } });
    const site = await this.site();
    if (site.slugs.has(slug)) return res;
    const a = await this.one(slug);
    if (!a) return res;
    const authors = await this.authors();
    return renderArticle(await this.template(ARTICLE_TEMPLATE_PATH), a, categoryLabel(a.category, site.labels), authors);
  }

  async listing(r: Exclude<Route, { kind: 'article' | 'template' | 'other' }>, res: Response): Promise<Response> {
    const all = await this.rows();
    if (res.status === 404) {
      // A tag or category page only live articles have.
      const site = await this.site();
      const rows = all.filter((x) => !site.slugs.has(x.slug) && ('slug' in r && (r.kind === 'tag' ? x.tags.includes(r.slug) : x.category === r.slug)));
      if (!rows.length) return res;
      return renderListing(await this.template(LISTING_TEMPLATE_PATH), r as { kind: 'tag' | 'category'; slug: string }, rows, site.labels);
    }
    const text = await res.text();
    this.fallback = new Response(text, res);
    const page = await shown(text);
    const site = r.kind === 'index' ? page : await this.site();
    const fresh = all.filter((x) => !site.slugs.has(x.slug) && !page.slugs.has(x.slug));
    const rows = fresh.filter((x) => r.kind === 'tag' ? x.tags.includes(r.slug) : r.kind === 'category' ? x.category === r.slug : r.kind === 'author' ? x.author === r.slug : true);
    if (!rows.length) return this.fallback;
    const out = r.kind === 'tags' || r.kind === 'categories' ? chips(r.kind, page, rows, site.labels) : r.kind === 'author' ? author(page, rows, site.labels) : list(r.kind, page, rows, site.labels);
    if (!out) return this.fallback;
    const headers = new Headers(res.headers);
    headers.delete('etag');
    headers.delete('content-length');
    return out.transform(new Response(text, { status: 200, headers }));
  }
}

const toApi = (r: LiveRow) => ({ slug: r.slug, title: r.title, description: r.description, author_slug: r.author, category: r.category, tags: r.tags, published_at: r.published });

/** The authors as /_nimbus/blog-authors serves them (a map by slug), validated again. */
function authorMap(v: unknown): LiveAuthors {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('blog authors: expected a map');
  const out: LiveAuthors = {};
  for (const [slug, a] of Object.entries(v as Record<string, { name?: unknown; title?: unknown; avatar?: unknown }>)) {
    if (!SLUG.test(slug) || !a || typeof a.name !== 'string' || !a.name.trim()) continue;
    out[slug] = { name: a.name.trim(), title: typeof a.title === 'string' ? a.title.trim() : '', avatar: typeof a.avatar === 'string' ? a.avatar : '' };
  }
  return out;
}

const setText = (value: string) => ({ element(e: Element) { e.setInnerContent(value); } });
const setAttr = (name: string, value: string) => ({ element(e: Element) { e.setAttribute(name, value); } });
const remove = { element(e: Element) { e.remove(); } };

/** A live article in the build's article template: every value as text or an attribute, the body as micromark renders it. */
export function renderArticle(template: Response, a: LiveArticle, label: string, authors: LiveAuthors): Response {
  const url = `${MANIFEST_SITE}/blog/${a.slug}/`;
  const live = Object.hasOwn(authors, a.author) ? authors[a.author] : null;
  const name = live?.name ?? a.author;
  const byline = live?.title ? `${name}, ${live.title}` : name;
  const person = bylineAuthor(byline);
  const day = publishedDay(a);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    url,
    mainEntityOfPage: url,
    ...(a.description ? { description: a.description } : {}),
    datePublished: day,
    author: 'jobTitle' in person ? { ...person, url: `${MANIFEST_SITE}/blog/authors/${a.author}/` } : person,
    ...(a.tags.length ? { keywords: a.tags.join(', ') } : {}),
    dateModified: day,
    publisher: { '@type': 'Organization', name: 'Apertis', url: 'https://apertis.ai' },
  };
  const description = a.description ? (e: Element) => e.setAttribute('content', a.description) : (e: Element) => e.remove();
  // Everything that can fail is computed here, before the response streams.
  const body = renderBody(a.markdown);
  const minutes = `${readingMinutes(a.markdown)} min`;
  const initials = bylineParts(name).initials;
  const tags = a.tags.map(tagItemHtml).join('');
  const tagMetas = a.tags.map((t) => `<meta property="article:tag" content="${escapeHtml(t)}">`).join('');
  const json = safeJsonLd(ld);
  const headers = new Headers(template.headers);
  headers.delete('etag');
  headers.delete('content-length');
  return new HTMLRewriter()
    .on('meta[name="robots"]', remove)
    .on('title', setText(a.title + BLOG_TITLE_SUFFIX))
    .on('link[rel="canonical"]', setAttr('href', url))
    .on('meta[property="og:url"]', setAttr('content', url))
    .on('meta[property="og:title"]', setAttr('content', a.title))
    .on('meta[name="twitter:title"]', setAttr('content', a.title))
    .on('meta[name="description"]', { element: description })
    .on('meta[property="og:description"]', { element: description })
    .on('meta[name="twitter:description"]', { element: description })
    .on('meta[name="author"]', setAttr('content', name))
    .on('meta[property="article:published_time"]', setAttr('content', day))
    .on('meta[property="article:tag"]', { element(e) { e.replace(tagMetas, html); } })
    .on('script[type="application/ld+json"]', { element(e) { e.setInnerContent(json, html); } })
    .on('meta[name="apertis-docs:id"]', setAttr('content', `blog:${a.slug}`))
    .on('p.doc-header__tag > a', { element(e) { e.setAttribute('href', categoryPath(a.category)); e.setInnerContent(label); } })
    .on('header.doc-header > h1', { element(e) { e.setAttribute('id', titleId(a.title)); e.setInnerContent(a.title); } })
    .on('p.doc-header__desc', { element(e) { if (a.description) e.setInnerContent(a.description); else e.remove(); } })
    .on('dd.byline-author > a', setAttr('href', `/blog/authors/${a.author}/`))
    .on('dd.byline-author .avatar', { element(e) { e.setAttribute('data-author', a.author); e.setInnerContent(initials); } })
    .on('dd.byline-author [data-author-field="name"]', { element(e) { e.setAttribute('data-author', a.author); e.setInnerContent(name); } })
    .on('dl.doc-meta time', { element(e) { e.setAttribute('datetime', day); e.setInnerContent(displayDate(day)); } })
    .on('dl.doc-meta > div:nth-child(3) > dd', setText(minutes))
    .on('ul.tag-list', { element(e) { if (!a.tags.length) e.remove(); } })
    .on('ul.tag-list > li', { element(e) { e.replace(tags, html); } })
    .on('p[data-live-body]', { element(e) { e.replace(body, html); } })
    .transform(new Response(template.body, { status: 200, headers }));
}

/** A tag or category page only live articles have, in the listing template. */
export function renderListing(template: Response, r: { kind: 'tag' | 'category'; slug: string }, rows: LiveRow[], labels: ReadonlyMap<string, string>): Response {
  const tag = r.kind === 'tag';
  const name = tag ? `#${r.slug}` : categoryLabel(r.slug, labels);
  const path = tag ? tagPath(r.slug) : categoryPath(r.slug);
  const url = MANIFEST_SITE + path;
  const title = name + BLOG_TITLE_SUFFIX;
  const description = tag ? `Articles tagged #${r.slug} on the Apertis blog.` : `${name} articles on the Apertis blog.`;
  const headers = new Headers(template.headers);
  headers.delete('etag');
  headers.delete('content-length');
  return new HTMLRewriter()
    .on('meta[name="robots"]', remove)
    .on('title', setText(title))
    .on('link[rel="canonical"]', setAttr('href', url))
    .on('meta[property="og:url"]', setAttr('content', url))
    .on('meta[property="og:title"]', setAttr('content', title))
    .on('meta[name="twitter:title"]', setAttr('content', title))
    .on('meta[name="description"]', setAttr('content', description))
    .on('meta[property="og:description"]', setAttr('content', description))
    .on('meta[name="twitter:description"]', setAttr('content', description))
    .on('meta[name="apertis-docs:id"]', setAttr('content', tag ? `page:blog-tag:${r.slug}` : `page:blog-category:${path}`))
    .on('p.blog-index__crumb > a:nth-of-type(2)', { element(e) { e.setAttribute('href', tag ? TAGS_PATH : CATEGORIES_PATH); e.setInnerContent(tag ? 'Tags' : 'Categories'); } })
    .on('.blog-index__intro > h1', setText(name))
    .on('.blog-index__intro > p:not([class])', setText(countText(rows.length)))
    .on('ol.article-list', { element(e) { e.setInnerContent(rows.map((x) => rowHtml(x, categoryLabel(x.category, labels), { describe: true })).join(''), html); } })
    .transform(new Response(template.body, { status: 200, headers }));
}

/** The /blog/ index, a tag page or a category page: the live rows merged into the page's one list by date, and its count. */
function list(kind: 'index' | 'tag' | 'category', page: Shown, rows: LiveRow[], labels: ReadonlyMap<string, string>): HTMLRewriter | null {
  const target = page.lists[0];
  if (!target) return null;
  const p = plan(target.rows.map((x) => x.time), rows);
  const row = (x: LiveRow) => rowHtml(x, categoryLabel(x.category, labels), { describe: true });
  let k = 0;
  let first = true;
  const rw = new HTMLRewriter()
    .on('ol.article-list', {
      element(e) {
        if (!first) return;
        first = false;
        e.onEndTag((end) => { if (p.after.length) end.before(p.after.map(row).join(''), html); });
      },
    })
    .on('ol.article-list > li', { element(e) { const at = p.before.get(k++); if (at) e.before(at.map(row).join(''), html); } });
  if (kind !== 'index') rw.on('.blog-index__intro > p:not([class])', setText(countText(target.rows.length + rows.length)));
  return rw;
}

/** An author's page: each live row in its year's list (a new year gets its own section and table of contents entry), and the count. */
function author(page: Shown, rows: LiveRow[], labels: ReadonlyMap<string, string>): HTMLRewriter {
  const years = page.lists.map((l) => l.year);
  const byYear = new Map<string, LiveRow[]>();
  for (const x of rows) byYear.set(x.published.slice(0, 4), [...(byYear.get(x.published.slice(0, 4)) ?? []), x]);
  const plans = page.lists.map((l) => plan(l.rows.map((x) => x.time), byYear.get(l.year) ?? []));
  // Years no section has yet, newest first; each goes before the first section of an older year, or last.
  const added = [...byYear.keys()].filter((y) => !years.includes(y)).sort().reverse();
  const beforeSection = (i: number) => added.filter((y) => y > years[i] && (i === 0 || y < years[i - 1]));
  const last = added.filter((y) => !years.length || y < years[years.length - 1]);
  const row = (x: LiveRow) => rowHtml(x, categoryLabel(x.category, labels), { describe: true, anchors: true });
  const toc = (x: LiveRow) => `<li><a href="#article-${escapeHtml(x.slug)}">${escapeHtml(x.title)}</a></li>`;
  const section = (y: string) => `<section class="author-page__year" aria-labelledby="year-${escapeHtml(y)}"><h2 id="year-${escapeHtml(y)}">${escapeHtml(y)}</h2><ol class="article-list">${byYear.get(y)!.map(row).join('')}</ol></section>`;
  const tocYear = (y: string) => `<li><a href="#year-${escapeHtml(y)}">${escapeHtml(y)}</a><ul>${byYear.get(y)!.map(toc).join('')}</ul></li>`;
  let s = -1, k = 0, ty = -1, tk = 0;
  return new HTMLRewriter()
    .on('p.author-page__count', setText(countText(page.lists.reduce((n, l) => n + l.rows.length, 0) + rows.length)))
    .on('div.author-page > section.author-page__year', {
      element(e) {
        s++;
        k = 0;
        const ys = beforeSection(s);
        if (ys.length) e.before(ys.map(section).join(''), html);
      },
    })
    .on('div.author-page', { element(e) { e.onEndTag((end) => { if (last.length) end.before(last.map(section).join(''), html); }); } })
    .on('section.author-page__year > ol.article-list', { element(e) { const p = plans[s]; e.onEndTag((end) => { if (p?.after.length) end.before(p.after.map(row).join(''), html); }); } })
    .on('section.author-page__year > ol.article-list > li', { element(e) { const at = plans[s]?.before.get(k++); if (at) e.before(at.map(row).join(''), html); } })
    .on('aside.doc-page__toc > ul.toc', { element(e) { e.onEndTag((end) => { if (last.length) end.before(last.map(tocYear).join(''), html); }); } })
    .on('aside.doc-page__toc > ul.toc > li', {
      element(e) {
        ty++;
        tk = 0;
        const ys = beforeSection(ty);
        if (ys.length) e.before(ys.map(tocYear).join(''), html);
      },
    })
    .on('aside.doc-page__toc > ul.toc > li > ul', { element(e) { const p = plans[ty]; e.onEndTag((end) => { if (p?.after.length) end.before(p.after.map(toc).join(''), html); }); } })
    .on('aside.doc-page__toc > ul.toc > li > ul > li', { element(e) { const at = plans[ty]?.before.get(tk++); if (at) e.before(at.map(toc).join(''), html); } });
}

/** The tags index or the categories index: a new chip in its sorted place, an existing one's count raised. */
function chips(kind: 'tags' | 'categories', page: Shown, rows: LiveRow[], labels: ReadonlyMap<string, string>): HTMLRewriter | null {
  if (!page.chips.length) return null;
  const counts = new Map<string, number>();
  for (const x of rows) for (const s of kind === 'tags' ? x.tags : [x.category]) counts.set(s, (counts.get(s) ?? 0) + 1);
  const known = page.chips.map((c) => c.slug);
  const fresh = [...counts.keys()].filter((s) => !known.includes(s)).sort();
  const chip = (s: string) => kind === 'tags' ? chipHtml(tagPath(s), `#${s}`, counts.get(s)!) : chipHtml(categoryPath(s), categoryLabel(s, labels), counts.get(s)!);
  let i = -1;
  return new HTMLRewriter()
    .on('ul.tag-list--index', { element(e) { e.onEndTag((end) => { const rest = fresh.filter((s) => s > known[known.length - 1]); if (rest.length) end.before(rest.map(chip).join(''), html); }); } })
    .on('ul.tag-list--index > li', {
      element(e) {
        i++;
        const ins = fresh.filter((s) => s < known[i] && (i === 0 || s > known[i - 1]));
        if (ins.length) e.before(ins.map(chip).join(''), html);
      },
    })
    .on('ul.tag-list--index > li > a.tag > span.tag__count', {
      element(e) {
        const c = page.chips[i];
        if (c && counts.has(c.slug)) e.setInnerContent(String(c.count + counts.get(c.slug)!));
      },
    });
}
