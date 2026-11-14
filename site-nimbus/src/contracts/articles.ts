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
