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
