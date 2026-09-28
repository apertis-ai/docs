// Navigation data — derived from the `sidebar` fields of migration/nimbus/route-inventory.json,
// which is the route authority (openspec docs-routing-publication, docs-shell-interfaces).
import type { Eligibility } from './manifest.ts';

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

/** The inventory fields consumers rely on (the file carries more, e.g. `live` observations). */
export interface InventoryRoute {
  path: string;
  kind: string;
  documentId: string | null;
  sourcePath?: string | null;
  sidebar: SidebarPlacement | null;
  listed: boolean;
  disposition: string;
  eligibility: Eligibility;
  poc?: boolean;
}

/** A sidebar link as the shell renders it: `label` is `sidebar.label ?? manifest title`, `href` the servedPath. */
export interface NavigationEntry {
  id: string;
  href: string;
  label: string;
  sidebar: SidebarPlacement;
}
