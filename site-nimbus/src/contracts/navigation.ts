// Route inventory and navigation data — the types of migration/nimbus/route-inventory.json, which is
// the route authority (openspec docs-routing-publication, docs-shell-interfaces). One definition only.
import type { Eligibility } from './manifest.ts';

export const INVENTORY_KINDS = [
  'doc', 'page', 'blog-post', 'blog-generated', 'feed', 'generated', 'static', 'static-asset', 'runtime', 'absent',
] as const;
export type InventoryKind = (typeof INVENTORY_KINDS)[number];

/** Kinds that have a manifest entry; every other kind is governed by its inventory row alone. */
export const MANIFEST_KINDS = ['doc', 'page', 'blog-post'] as const satisfies readonly InventoryKind[];

export const INVENTORY_DISPOSITIONS = [
  'preserve', 'preserve-pending-decision', 'absent-at-baseline', 'reserved-runtime', 'legacy-implementation-artifact',
] as const;
export type InventoryDisposition = (typeof INVENTORY_DISPOSITIONS)[number];

export type SidebarId = 'tutorialSidebar' | 'apiSidebar';

/** One inventory `sidebar` field. Unlisted documents have `sidebar: null` and stay published. */
export interface SidebarPlacement {
  sidebar: SidebarId;
  /** Category labels from the sidebar root down to the item's parent; `[]` at top level. */
  trail: string[];
  /** Position within its sidebar (global order across the flattened tree). */
  order: number;
  /** Sidebar label when it differs from the document title. */
  label?: string;
}

/** What the live legacy site served for the row (recorded at #5); `null` for rows not probed live. */
export interface LiveObservation {
  requested: string;
  status: number;
  location: string | null;
  /** Same-origin redirect target and its status. */
  final: { path: string; status: number } | null;
  /** The slash-toggled request (`/x` <-> `/x/`); `null` for `/`. */
  slashVariant: { path: string; status: number; location: string | null } | null;
  /** Absolute canonical as rendered; manifest `canonicalUrl` must equal it. */
  canonical: string | null;
  /** Full `<title>`, normally `<manifest title> | Apertis Documentation`. */
  title: string | null;
  headingIds: string[];
  links: string[];
  images: string[];
  articleSha256: string | null;
}

export interface InventoryRoute {
  path: string;
  kind: InventoryKind;
  /** `default:…`, `api:…`, `page:…`, `blog:…`, `generated:…`, `runtime:…`; `null` for absent/static rows. */
  documentId: string | null;
  sourcePath?: string | null;
  sidebar: SidebarPlacement | null;
  listed: boolean;
  disposition: InventoryDisposition;
  note?: string;
  eligibility: Eligibility;
  /** Legacy (Docusaurus) search and retrieval behavior, for delta reporting. */
  legacy: { search: boolean; rag: boolean };
  poc: boolean;
  /** Present in the legacy build output. */
  built: boolean;
  live: LiveObservation | null;
}

/** The whole migration/nimbus/route-inventory.json file. */
export interface RouteInventory {
  baseSha: string;
  site: string;
  liveSnapshotSha256: string;
  routes: InventoryRoute[];
}

/** A sidebar link as the shell renders it: `label` is `sidebar.label ?? manifest title`, `href` the servedPath. */
export interface NavigationEntry {
  id: string;
  href: string;
  label: string;
  sidebar: SidebarPlacement;
}
