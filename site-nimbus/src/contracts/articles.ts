// Native articles (openspec docs-routing-publication "Native articles"): where they live and how their
// manifest entries are told apart from the converted legacy corpus. A native entry is identified by its
// source path, so the manifest v1 shape (and every reader of it) is unchanged.
import type { ManifestDocument } from './manifest.ts';

/** Article sources, relative to `site-nimbus/`. */
export const ARTICLES_ROOT = 'src/articles';

export const isNativeArticle = (d: Partial<Pick<ManifestDocument, 'sourcePath'>>) => d.sourcePath?.startsWith(`site-nimbus/${ARTICLES_ROOT}/`) === true;

/**
 * The id of an article's H1, which the page renders from the front matter title (the body has none).
 * github-slugger's rule, as the indexer's chunker applies it to the artifact's `# title`, so the
 * citation for text before the first section lands on the title.
 */
export const titleId = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');

/**
 * An article's `related` front matter: the documentation pages it follows on from, as comma-separated
 * root-absolute served paths. Each of those pages lists the article under "Related articles".
 */
export const parseRelated = (raw: unknown) => (typeof raw === 'string' ? raw.split(',').map((p) => p.trim()).filter(Boolean) : []);

/** An article's `tags` front matter: comma-separated lowercase slugs. Each tag has a page at tagPath(). */
export const parseTags = parseRelated;
export const TAGS_PATH = '/blog/tags/';
export const tagPath = (tag: string) => `${TAGS_PATH}${tag}/`;

/** An article's `category` front matter is a label ("CI"); its page is at categoryPath(), by the label as a slug. */
export const categorySlug = (category: string) => category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const CATEGORIES_PATH = '/blog/categories/';
export const categoryPath = (category: string) => `${CATEGORIES_PATH}${categorySlug(category)}/`;

/**
 * An article's byline is "Name, role" (or a bare name). Every author has a page listing their articles,
 * at /blog/authors/<the name as a slug>/; `initials` stand in for an avatar the author has not supplied.
 */
export function bylineParts(byline: string) {
  const [name, role = ''] = byline.split(/,\s*/, 2);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2)).toUpperCase();
  return { name, role, slug, initials, path: `/blog/authors/${slug}/` };
}

/**
 * The two pages the edge renders live articles into (functions/blog/[[path]].ts): an article page and a tag or
 * category page, built from the same layouts with placeholder values. Never documents of their own: noindex,
 * outside the manifest, the sitemap and the search index, and the function answers 404 when either is asked for.
 * The leading underscore keeps them out of every slug (no article, tag or category can be named so).
 */
export const ARTICLE_TEMPLATE_PATH = '/blog/_article/';
export const LISTING_TEMPLATE_PATH = '/blog/_listing/';

/**
 * Every route inventory path under /blog (the retired legacy blog), without the trailing slash. The converter refuses a
 * committed article whose page, tag page or author page is one of them (converter/articles.ts); the edge refuses a live
 * article the same way (functions/blog/[[path]].ts), from this copy, so the function need not bundle the inventory.
 * test/blog-articles.test.ts keeps it equal to the inventory.
 */
export const LEGACY_BLOG_PATHS: readonly string[] = [
  '/blog', '/blog/archive', '/blog/atom.css', '/blog/atom.xml', '/blog/atom.xsl', '/blog/authors', '/blog/authors/all-sebastien-lorber-articles',
  '/blog/authors/yangshun', '/blog/first-blog-post', '/blog/long-blog-post', '/blog/mdx-blog-post', '/blog/rss.css', '/blog/rss.xml', '/blog/rss.xsl',
  '/blog/tags', '/blog/tags/docusaurus', '/blog/tags/facebook', '/blog/tags/hello', '/blog/tags/hola', '/blog/welcome',
];
