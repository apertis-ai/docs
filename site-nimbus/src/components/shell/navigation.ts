// Sidebar navigation from the inventory `sidebar` fields (openspec docs-shell-interfaces "Preserved
// reader-facing shell", docs-routing-publication "Navigation hiding is not access control").
// Build-time only: pass the inventory and manifest in; never ship either to the client.
import type { ManifestDocument } from '../../contracts/manifest.ts';
import type { InventoryRoute, NavigationEntry, SidebarId } from '../../contracts/navigation.ts';
import { TITLE_SUFFIX } from '../../contracts/page.ts';

export type SidebarNode =
  | { kind: 'link'; entry: NavigationEntry }
  | { kind: 'category'; label: string; items: SidebarNode[] };

export interface Navigation {
  trees: Record<SidebarId, SidebarNode[]>;
  /** Every sidebar entry, in sidebar order. */
  entries: NavigationEntry[];
}

export interface PageNavigation {
  sidebar: SidebarId;
  tree: SidebarNode[];
  entry: NavigationEntry;
  trail: string[];
  prev: NavigationEntry | null;
  next: NavigationEntry | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ENTITIES[e]);

export function buildNavigation(inventory: InventoryRoute[], documents: ManifestDocument[]): Navigation {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const entries: NavigationEntry[] = inventory
    .filter((r) => r.sidebar && r.documentId && r.eligibility.publish)
    .sort((a, b) => a.sidebar!.order - b.sidebar!.order)
    .map((r) => {
      const doc = byId.get(r.documentId!);
      // ponytail: rows #7 has not converted yet fall back to the inventory's live title and served path,
      // so the PoC sidebar keeps the full legacy placement; drop the fallback once the manifest covers every row.
      const liveTitle = r.live?.title ? unescape(r.live.title.replace(TITLE_SUFFIX, '')) : r.path;
      return {
        id: r.documentId!,
        href: doc?.servedPath ?? r.live?.final?.path ?? r.live?.requested ?? r.path,
        label: r.sidebar!.label ?? doc?.title ?? liveTitle,
        sidebar: r.sidebar!,
      };
    });

  const trees: Record<SidebarId, SidebarNode[]> = { tutorialSidebar: [], apiSidebar: [] };
  for (const entry of entries) {
    let level = trees[entry.sidebar.sidebar];
    for (const label of entry.sidebar.trail) {
      let cat = level.find((n): n is Extract<SidebarNode, { kind: 'category' }> => n.kind === 'category' && n.label === label);
      if (!cat) level.push((cat = { kind: 'category', label, items: [] }));
      level = cat.items;
    }
    level.push({ kind: 'link', entry });
  }
  return { trees, entries };
}

/** The sidebar a document belongs to, or null for unlisted documents and standalone pages. */
export function pageNavigation(nav: Navigation, docId: string): PageNavigation | null {
  const entry = nav.entries.find((e) => e.id === docId);
  if (!entry) return null;
  const siblings = nav.entries.filter((e) => e.sidebar.sidebar === entry.sidebar.sidebar);
  const i = siblings.indexOf(entry);
  return {
    sidebar: entry.sidebar.sidebar,
    tree: nav.trees[entry.sidebar.sidebar],
    entry,
    trail: entry.sidebar.trail,
    prev: siblings[i - 1] ?? null,
    next: siblings[i + 1] ?? null,
  };
}

export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

/** "On this page": h2 entries with their h3s nested; an h3 before any h2 stands alone. */
export function tocTree(headings: TocHeading[]): { h: TocHeading; children: TocHeading[] }[] {
  const tree: { h: TocHeading; children: TocHeading[] }[] = [];
  for (const h of headings.filter((h) => h.depth === 2 || h.depth === 3)) {
    if (h.depth === 2 || !tree.length) tree.push({ h, children: [] });
    else tree[tree.length - 1].children.push(h);
  }
  return tree;
}
