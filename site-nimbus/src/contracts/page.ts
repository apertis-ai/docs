// Page metadata and Ask Docs page context (openspec docs-shell-interfaces, docs-publication-manifest).

/** `<meta name>` values every published page carries; `markdown` only on agent-eligible pages. */
export const PAGE_META = {
  id: 'apertis-docs:id',
  build: 'apertis-docs:build',
  markdown: 'apertis-docs:markdown',
} as const;

/** Ask Docs page context: `title` from the manifest entry, `href` from the current location. */
export interface PageContext {
  title: string;
  href: string;
}

type LocationParts = Pick<Location, 'pathname' | 'search' | 'hash'>;

/** Recompute on panel open and on every navigation while it is open. */
export function pageContext(title: string, loc: LocationParts = location): PageContext {
  return { title, href: loc.pathname + loc.search + loc.hash };
}
