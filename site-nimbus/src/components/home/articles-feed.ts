// The blog's live articles: the rows the Apertis console publishes, read at the edge by functions/blog/[[path]].ts
// and shown beside the articles committed in src/articles. Two routes, one validator each:
//   - GET LIST_SOURCE: every published article, newest first, without its body (the listing pages);
//   - GET articleSource(slug): one published article with its Markdown body (its own page), 404 when unpublished.
// Every value is validated again here, whatever the API promises: a row that fails is skipped (the list) or the
// answer is refused (one article). The Markdown body is rendered with micromark's defaults only, so raw HTML is
// escaped and unsafe link protocols are dropped; every other value is text, and the markup helpers below escape
// it. Pure (no Node or Workers APIs), so the function bundles it and the tests run it as is.
import { micromark } from 'micromark';
import { categoryPath, LEGACY_BLOG_PATHS, tagPath } from '../../contracts/articles.ts';
import { displayDate } from '../shell/page-header.ts';

export const LIST_SOURCE = 'https://apertis.ai/api/blog/articles';
export const articleSource = (slug: string) => `${LIST_SOURCE}/${slug}`;

/** A slug, category or tag: lowercase words joined by single hyphens. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX = { slug: 96, author: 96, category: 40, tag: 40, tags: 10, title: 200, description: 300, body: 256 * 1024, rows: 500 } as const;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;
// One line of text: no line breaks and no other control characters.
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;

export const isSlug = (v: unknown, max: number = MAX.slug): v is string => typeof v === 'string' && v.length <= max && SLUG.test(v);
const line = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max && !CONTROL.test(v) ? v.trim() : null);

export interface LiveRow {
  slug: string;
  title: string;
  description: string;
  /** The author's slug (authors-feed.ts keys the live authors by it). */
  author: string;
  /** The category as a slug; categoryLabel() names it. */
  category: string;
  tags: string[];
  /** RFC 3339, as published. */
  published: string;
}
export interface LiveArticle extends LiveRow {
  /** Markdown, at most 256 KiB. */
  markdown: string;
}

/** One list row, or null when any field is unusable. */
export function liveRow(v: unknown): LiveRow | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  const title = line(a.title, MAX.title);
  const description = line(a.description ?? '', MAX.description);
  if (!isSlug(a.slug) || !title || description === null || !isSlug(a.author_slug, MAX.author) || !isSlug(a.category, MAX.category)) return null;
  if (!Array.isArray(a.tags) || a.tags.length > MAX.tags || !a.tags.every((t) => isSlug(t, MAX.tag))) return null;
  if (typeof a.published_at !== 'string' || !RFC3339.test(a.published_at) || Number.isNaN(Date.parse(a.published_at))) return null;
  return { slug: a.slug, title, description, author: a.author_slug, category: a.category, tags: [...new Set(a.tags as string[])], published: a.published_at };
}

/** The published rows, newest first; throws on anything that is not the endpoint's list. An unusable or repeated row is skipped. */
export function liveRows(data: unknown): LiveRow[] {
  if (!Array.isArray(data)) throw new Error('blog articles: expected a list');
  const rows = new Map<string, LiveRow>();
  for (const v of data.slice(0, MAX.rows)) {
    const r = liveRow(v);
    if (r && !rows.has(r.slug)) rows.set(r.slug, r);
  }
  return [...rows.values()].sort(newestFirst);
}

/** One published article; throws when it is unusable or is not the slug asked for. */
export function liveArticle(data: unknown, slug: string): LiveArticle {
  const r = liveRow(data);
  if (!r || r.slug !== slug) throw new Error(`blog article ${slug}: unusable`);
  const markdown = (data as { body_markdown?: unknown }).body_markdown;
  if (typeof markdown !== 'string' || new TextEncoder().encode(markdown).length > MAX.body) throw new Error(`blog article ${slug}: unusable body`);
  return { ...r, markdown };
}

const legacy = new Set(LEGACY_BLOG_PATHS);
/**
 * Whether a live row would bring back a path of the retired legacy blog: its page, a tag page or its author's page (the
 * rule converter/articles.ts applies to committed articles). Such a row is shown nowhere.
 */
export const revivesLegacyPath = (r: LiveRow) =>
  [`/blog/${r.slug}`, ...r.tags.map((t) => tagPath(t).slice(0, -1)), `/blog/authors/${r.author}`].some((p) => legacy.has(p));

const time = (iso: string) => Date.parse(iso);
const newestFirst = (a: LiveRow, b: LiveRow) => time(b.published) - time(a.published) || (a.slug < b.slug ? -1 : 1);

/** A hung upstream throws after this long and takes the caller's fallback path. */
export const FETCH_TIMEOUT_MS = 3000;

/** The endpoint's `data`, or null when it answers 404; any other failure throws. */
async function read(fetcher: typeof fetch, url: string): Promise<unknown> {
  const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': 'apertis-docs-blog-articles' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.json() as { success?: boolean; message?: string; data?: unknown };
  if (!body || body.success !== true) throw new Error(`${url}: ${body?.message || 'not successful'}`);
  return body.data ?? (() => { throw new Error(`${url}: no data`); })();
}

/** The published rows. An API without the route (404, before it is deployed) has no live articles. */
export async function fetchArticles(fetcher: typeof fetch): Promise<LiveRow[]> {
  const data = await read(fetcher, LIST_SOURCE);
  return data === null ? [] : liveRows(data);
}

/** The published article, or null when the API answers 404 (a draft or an unknown slug). Any other failure throws. */
export async function fetchArticle(fetcher: typeof fetch, slug: string): Promise<LiveArticle | null> {
  if (!isSlug(slug)) throw new Error('blog article: not a slug');
  const data = await read(fetcher, articleSource(slug));
  return data === null ? null : liveArticle(data, slug);
}

/**
 * The article body as HTML: micromark with its defaults (raw HTML escaped, `javascript:` and other unsafe
 * destinations emptied). A link whose destination was emptied and has no title loses the attribute, so it points nowhere; with a title
 * (`[a](javascript:x "t")`) it stays `<a href="" title="t">`, which points nowhere harmful.
 */
export const renderBody = (markdown: string) => micromark(markdown).replace(/<a href="">/g, '<a>');

/** converter/convert.ts readingMinutes(): words outside fenced code blocks, at 200 per minute, rounded up (at least 1). */
export function readingMinutes(markdown: string): number {
  const prose = markdown.replace(/^(?:> )?[ \t]*(`{3,}|~{3,})[\s\S]*?^(?:> )?[ \t]*\1[ \t]*$/gm, '');
  return Math.max(1, Math.ceil(prose.split(/\s+/).filter(Boolean).length / 200));
}

/** The text of HTML text or an attribute value as a page carries it (the entities the build writes decoded). */
export const decodeText = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (_, e: string) => {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  if (e[0] !== '#') return named[e.toLowerCase()];
  const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
});

/** Text or an attribute value made inert in HTML. */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * A category's display name: the one a committed article with the same category slug shows (`labels`, by slug),
 * else three letters or fewer upper-cased (`ci` -> `CI`), else the first letter upper-cased and hyphens as spaces.
 */
export function categoryLabel(slug: string, labels: ReadonlyMap<string, string>): string {
  const known = labels.get(slug);
  if (known) return known;
  return slug.length <= 3 ? slug.toUpperCase() : slug[0].toUpperCase() + slug.slice(1).replace(/-/g, ' ');
}

/** The date a row or a page shows: the published day as written (YYYY-MM-DD). */
export const publishedDay = (r: LiveRow) => r.published.slice(0, 10);

/**
 * One row of ArticleList.astro for a live article, every value escaped. The reading time needs the body, which
 * the list does not carry, so its cell stays empty.
 */
export function rowHtml(r: LiveRow, label: string, opts: { describe?: boolean; anchors?: boolean } = {}): string {
  const e = escapeHtml;
  return `<li data-category="${e(label)}"${opts.anchors ? ` id="article-${e(r.slug)}"` : ''}><div class="article-row">`
    + `<time class="article-row__date" datetime="${e(publishedDay(r))}">${e(displayDate(r.published))}</time>`
    + `<span class="article-row__title"><a class="article-row__link" href="/blog/${e(r.slug)}/">${e(r.title)}</a>`
    + `<a class="article-row__category" href="${e(categoryPath(r.category))}">${e(label)}</a>`
    + `${opts.describe ? `<span class="article-row__desc">${e(r.description)}</span>` : ''}</span>`
    + `<span class="article-row__time"></span></div></li>`;
}

/** A tag chip of the tags index (or a category chip of the categories index), as the page renders it. */
export const chipHtml = (href: string, text: string, count: number) =>
  `<li><a class="tag" href="${escapeHtml(href)}">${escapeHtml(text)}<span class="tag__count">${count}</span></a></li>`;

/** An article's tag list item, as DocLayout renders it. */
export const tagItemHtml = (tag: string) => `<li><a class="tag" href="${escapeHtml(tagPath(tag))}">#${escapeHtml(tag)}</a></li>`;

/** `n article(s)`, as the listing pages count. */
export const countText = (n: number) => `${n} ${n === 1 ? 'article' : 'articles'}`;
