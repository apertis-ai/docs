// Publication manifest v1 — the single definition (openspec docs-publication-manifest).
// #7 produces it; HTML metadata, Markdown actions, search, llms, sitemap and the
// indexer read it. Never re-derive identity, canonical URL or eligibility from paths.

/** Explicit publication eligibility; must equal the route-inventory row. */
export interface Eligibility {
  /** An HTML route exists. */
  publish: boolean;
  /** In the local search index. */
  search: boolean;
  /** Clean Markdown artifact and llms outputs. */
  agent: boolean;
  /** Included in the retrieval generation. */
  rag: boolean;
}

export const ELIGIBILITY_KEYS = ['publish', 'search', 'agent', 'rag'] as const satisfies readonly (keyof Eligibility)[];

export interface MarkdownArtifact {
  /** `markdownPathFor(canonicalUrl)`, e.g. `/getting-started/quick-start.md`, `/api/index.md`. */
  path: string;
  /** SHA-256 (hex) of the artifact bytes. */
  sha256: string;
}

export interface ManifestDocument {
  /** Plugin-qualified legacy id from route-inventory.json: `default:…`, `api:…`, `page:…`, `blog:…`. */
  id: string;
  /** Repository-relative legacy source path. */
  sourcePath: string;
  /** Path that answers 200, e.g. `/getting-started/quick-start/`. */
  servedPath: string;
  /** Absolute canonical exactly as recorded in the inventory. */
  canonicalUrl: string;
  /** Title as rendered in `<title>` before the site suffix. */
  title: string;
  eligibility: Eligibility;
  /** Present exactly when `eligibility.agent`, else null. */
  markdown: MarkdownArtifact | null;
  /** Equals `markdown.sha256`, or for HTML-only entries the hash of the normalized article text. */
  contentSha256: string;
}

export interface ManifestV1 {
  manifestVersion: 1;
  site: 'https://docs.apertis.ai';
  /** 40-hex commit of the legacy content the candidate was generated from. */
  sourceSha: string;
  /** `<sourceSha>.<first 12 hex of SHA-256 over the candidate lockfile and converter sources>`. */
  buildId: string;
  documents: ManifestDocument[];
}

export const MANIFEST_SITE = 'https://docs.apertis.ai';
/** The one manifest location, relative to `site-nimbus/`. #7 writes it; `src/manifest/manifest.ts` is its only loader. */
export const MANIFEST_PATH = 'src/manifest/manifest.json';
export const RESERVED_RUNTIME_PATH = '/api/ask';

/** `<canonical path>.md`, or `<canonical path>index.md` for slash-canonical documents. */
export function markdownPathFor(canonicalUrl: string): string {
  const p = new URL(canonicalUrl).pathname;
  return p.endsWith('/') ? `${p}index.md` : `${p}.md`;
}
