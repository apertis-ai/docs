// Page metadata and Ask Docs page context (openspec docs-shell-interfaces, docs-publication-manifest).

/** `<meta name>` values every published page carries; `markdown` only on agent-eligible pages. */
export const PAGE_META = {
  id: 'apertis-docs:id',
  build: 'apertis-docs:build',
  markdown: 'apertis-docs:markdown',
} as const;

/** Site suffix of every `<title>`: `<manifest title> | Apertis Documentation`. */
export const TITLE_SUFFIX = ' | Apertis Documentation';

/** Ask Docs page context: `title` is the manifest title (the `<title>` without TITLE_SUFFIX), `href` from the current location. */
export interface PageContext {
  title: string;
  href: string;
}

type LocationParts = Pick<Location, 'pathname' | 'search' | 'hash'>;

/** Recompute on panel open and on every navigation while it is open. */
export function pageContext(title: string, loc: LocationParts = location): PageContext {
  return { title, href: loc.pathname + loc.search + loc.hash };
}

/**
 * The URL a page is indexed under: the served form. Pages are directory pages (`/api/sdks/cli/` is the
 * 200; `/api/sdks/cli` answers 308 to it), so canonical, og:url, JSON-LD url and sitemap `<loc>` all use
 * the trailing-slash form. The manifest keeps the legacy no-slash canonicalUrl (it must equal the inventory's
 * live observation); only the emitted URLs are normalised here.
 */
export function servedUrl(url: string): string {
  const u = new URL(url);
  if (!u.pathname.endsWith('/') && !/\.[A-Za-z0-9]+$/.test(u.pathname)) u.pathname += '/';
  return u.toString();
}

/** JSON for an inline `<script type="application/ld+json">`: `<` and line separators escaped, so no value can end the script. */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export interface SeoProps {
  /** Front-matter description only; absent -> no description tags. */
  description?: string | null;
  /** Real last-modified date (converter page-meta, from git). */
  updated?: string;
  /** Emit TechArticle (+ BreadcrumbList) JSON-LD: documentation pages only. */
  article?: boolean;
  /** Breadcrumb names from Home to the page; only the last has a URL of its own. */
  trail?: string[];
}
