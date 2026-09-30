// Native articles (openspec docs-routing-publication "Native articles"): Markdown written for this site,
// not converted from the legacy tree, so they have no route-inventory row and no `live` observation.
// Each file under ARTICLES_ROOT is `<slug>.md` with front matter (title, description, date, author,
// category, optional draft) and a plain Markdown body. A published article becomes the manifest entry
// `blog:<slug>` at /blog/<slug>/, eligible for HTML, search, the Markdown artifact and RAG; a draft
// becomes nothing at all (no entry, no output). The route inventory is never edited: a slug whose path
// or id any inventory row already names (the retired legacy blog, its tags, authors, archive and feeds)
// is refused, so a native article can never reopen a retired route.
import fs from 'node:fs';
import path from 'node:path';

import { MANIFEST_SITE } from '../src/contracts/manifest.ts';
import type { InventoryRoute } from '../src/contracts/navigation.ts';
import { ARTICLES_ROOT } from '../src/contracts/articles.ts';

export { ARTICLES_ROOT };

export interface Article {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD. */
  date: string;
  author: string;
  category: string;
  draft: boolean;
  /** Markdown body, front matter removed. */
  body: string;
  /** Repository-relative source file. */
  sourcePath: string;
}

export class ArticleError extends Error {}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED = ['title', 'description', 'date', 'author', 'category'] as const;

/** Front matter is flat `key: value` lines (values may be double-quoted); anything else is refused. */
function parse(file: string, text: string): Omit<Article, 'slug' | 'sourcePath'> {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new ArticleError(`${file}: front matter must open the file between --- lines`);
  const fields: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv) throw new ArticleError(`${file}: unsupported front matter line ${JSON.stringify(line)}`);
    const value = kv[2].startsWith('"') ? JSON.parse(kv[2]) as string : kv[2].trim();
    if (kv[1] in fields) throw new ArticleError(`${file}: duplicate ${kv[1]}`);
    fields[kv[1]] = value;
  }
  const unknown = Object.keys(fields).filter((k) => ![...REQUIRED, 'draft'].includes(k));
  if (unknown.length) throw new ArticleError(`${file}: unknown front matter ${unknown.join(', ')}`);
  for (const k of REQUIRED) if (!fields[k]) throw new ArticleError(`${file}: ${k} is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || Number.isNaN(Date.parse(fields.date))) throw new ArticleError(`${file}: date must be YYYY-MM-DD`);
  if (fields.draft !== undefined && !['true', 'false'].includes(fields.draft)) throw new ArticleError(`${file}: draft must be true or false`);
  const body = m[2].replace(/^\n+/, '');
  if (/^#\s/m.test(body)) throw new ArticleError(`${file}: the title is the front matter title; the body must not have an H1`);
  if (/^\s*(import|export)\s/m.test(body) || /<[A-Z]/.test(body)) throw new ArticleError(`${file}: articles are plain Markdown (no MDX)`);
  return { title: fields.title, description: fields.description, date: fields.date, author: fields.author, category: fields.category, draft: fields.draft === 'true', body };
}

/**
 * Every article under `<siteRoot>/<ARTICLES_ROOT>`, newest first (then by slug). A missing directory
 * means none. `sourcePath` is always the repository path (`site-nimbus/src/articles/<slug>.md`), so a
 * test that reads fixtures from another siteRoot gets the entries the real tree would.
 */
export function readArticles(siteRoot: string): Article[] {
  const dir = path.join(siteRoot, ARTICLES_ROOT);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().map((name) => {
    const file = path.join(dir, name);
    const rel = `site-nimbus/${ARTICLES_ROOT}/${name}`;
    if (!name.endsWith('.md') || !fs.statSync(file).isFile()) throw new ArticleError(`${rel}: only <slug>.md files belong in ${ARTICLES_ROOT}`);
    const slug = name.slice(0, -3);
    if (!SLUG.test(slug)) throw new ArticleError(`${rel}: slug must be lowercase words joined by hyphens`);
    return { slug, sourcePath: rel, ...parse(rel, fs.readFileSync(file, 'utf8')) };
  }).sort((a, b) => (a.date === b.date ? (a.slug < b.slug ? -1 : 1) : a.date < b.date ? 1 : -1));
}

export const articlePath = (slug: string) => `/blog/${slug}/`;

/** Refuses a slug whose path or id any inventory row names (published, retired or absent). */
export function assertNoInventoryCollision(articles: Article[], inventory: InventoryRoute[]) {
  const paths = new Set(inventory.flatMap((r) => [r.path, r.path.endsWith('/') ? r.path.slice(0, -1) : `${r.path}/`]));
  const ids = new Set(inventory.map((r) => r.documentId).filter(Boolean));
  for (const a of articles) {
    const p = articlePath(a.slug);
    if (paths.has(p) || paths.has(p.slice(0, -1)) || ids.has(`blog:${a.slug}`)) {
      throw new ArticleError(`${a.sourcePath}: /blog/${a.slug} is an inventory route (the retired legacy blog); choose another slug`);
    }
  }
}

/** The clean Markdown artifact: the title as H1, the description, then the body. */
export const articleMarkdown = (a: Article) => `# ${a.title}\n\n${a.description}\n\n${a.body.replace(/\n*$/, '\n')}`;

export const articleCanonical = (slug: string) => `${MANIFEST_SITE}${articlePath(slug)}`;
