// The /changelog/ page and /changelog/rss.xml (openspec docs-live-catalog "Changelog page and feed"): the
// public Apertis release notes, newest first, validated once for every reader:
//   - scripts/nimbus/catalog-snapshot.mjs writes changelog.json, which the page renders at build time;
//   - functions/_nimbus/changelog.ts serves them live (without items) and the page swaps them in after load;
//   - functions/changelog/rss.xml.ts serves them live as RSS 2.0, edge-cached.
// Pure (no Node or Workers APIs): bundled into the build, both functions and the page's swap script, whose
// views below (noteView, monthBlocks) are the one source of the text the build and the swap both show.
import { displayDate } from '../shell/page-header.ts';
import { releaseNotes, type ReleaseNote } from '../home/feed.ts';
import { getJson } from './models.ts';

export const CHANGELOG_SOURCE = 'https://apertis.ai/api/changelog';
export const FEED_PATH = '/changelog/rss.xml';
export const FULL_NOTE = 'https://apertis.ai/changelog/';

export interface Note extends ReleaseNote {
  category: string;
  items: string[];
}

// What the developer-activation guard (scripts/check-developer-activation.mjs, openspec
// developer-activation-docs) forbids in anything this site publishes. The page publishes each note's title and
// description; some older descriptions state a fixed model count or link the legacy API-key route, and such a
// note keeps its title and its link to the full note, with its description left out. pageDescription applies
// wherever this site persists or serves page text: the committed snapshot (catalog-snapshot.mjs), the
// /_nimbus/changelog payload and noteView. The RSS feed reads live data and keeps the text as the source has it.
const ACTIVATION = [/apertis\.ai\/token\b/i, /apertis\.ai\/setting\?tab=apikeys\b/i, /[?&]utm_(?:source|medium|campaign|term|content)=/i, /\b\d{2,4}\+\s+(?:AI\s+)?models\b/i];

/** A note's description as the page publishes it: empty if it names what the activation guard forbids. */
export const pageDescription = (description: string): string => (ACTIVATION.some((re) => re.test(description)) ? '' : description);

/** The release notes, newest first with unique versions; throws on anything the page or feed could not show. */
export function changelogNotes(data: unknown): Note[] {
  const notes = releaseNotes(data).map((n, i): Note => {
    const { category, items = [] } = (data as Record<string, unknown>[])[i] as { category?: unknown; items?: unknown };
    if (typeof category !== 'string' || !/^[a-z0-9-]+$/.test(category)) throw new Error(`release notes: entry ${i} category ${String(category)} is not a tag`);
    if (!Array.isArray(items) || items.some((t) => typeof t !== 'string')) throw new Error(`release notes: entry ${i} items are not text`);
    return { ...n, category, items };
  });
  if (new Set(notes.map((n) => n.version)).size !== notes.length) throw new Error('release notes: repeated versions');
  return notes;
}

/** What the page shows of a note; the keys are the page's `data-f` fields (`href` is the full note on apertis.ai). */
export interface NoteView { href: string; version: string; 'version-label': string; date: string; datetime: string; category: string; 'category-label': string; title: string; description: string }

export function noteView(n: Omit<Note, 'items'>): NoteView {
  return {
    href: `${FULL_NOTE}${encodeURIComponent(n.version)}`, version: n.version, 'version-label': `v${n.version}`,
    date: displayDate(n.date), datetime: n.date, category: n.category, 'category-label': n.category.charAt(0).toUpperCase() + n.category.slice(1),
    title: n.title, description: pageDescription(n.description),
  };
}

/**
 * The notes by month, newest first: each month is a block with its own anchor (`YYYY-MM`), and the rail on wide
 * screens lists them. Notes are ordered by version, so a month could come up twice; only its first block is the anchor.
 */
export function monthBlocks<T extends { date: string }>(notes: T[]): { id: string; anchor: boolean; label: string; notes: T[] }[] {
  const months: { id: string; anchor: boolean; label: string; notes: T[] }[] = [];
  for (const n of notes) {
    const id = n.date.slice(0, 7);
    if (months.at(-1)?.id !== id) months.push({ id, anchor: !months.some((m) => m.id === id), label: new Date(`${id}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }), notes: [] });
    months.at(-1)!.notes.push(n);
  }
  return months;
}

export async function fetchChangelog(fetcher: typeof fetch): Promise<Note[]> {
  return changelogNotes((await getJson(fetcher, CHANGELOG_SOURCE)).data);
}

// XML 1.0 text: characters it cannot carry are dropped, markup characters escaped.
const xml = (s: string) => s.replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** RSS 2.0 of `notes` for the site at `origin`: one item per note, guid = version, linked to its anchor. */
export function rss(notes: Note[], origin: string): string {
  const page = `${origin}/changelog/`;
  const items = notes.map((n) => [
    '    <item>',
    `      <title>${xml(`v${n.version}: ${n.title}`)}</title>`,
    `      <link>${xml(`${page}#${encodeURIComponent(n.version)}`)}</link>`,
    `      <guid isPermaLink="false">${xml(n.version)}</guid>`,
    `      <pubDate>${new Date(`${n.date}T00:00:00Z`).toUTCString()}</pubDate>`,
    `      <category>${xml(n.category)}</category>`,
    `      <description>${xml([n.description, ...n.items].filter(Boolean).join('\n'))}</description>`,
    '    </item>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Apertis release notes</title>',
    `    <link>${xml(page)}</link>`,
    '    <description>What ships in Apertis: new models, features and fixes.</description>',
    '    <language>en</language>',
    `    <atom:link href="${xml(origin + FEED_PATH)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
