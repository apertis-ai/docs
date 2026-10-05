// The /changelog/ page and /changelog/rss.xml (openspec docs-live-catalog "Changelog page and feed"): the
// public Apertis release notes, newest first, validated once for every reader:
//   - scripts/nimbus/catalog-snapshot.mjs writes changelog.json, which the page renders at build time;
//   - functions/changelog/rss.xml.ts serves them live as RSS 2.0, edge-cached.
// Pure (no Node or Workers APIs). The Markdown `content` is rendered only at build time (the page).
import { releaseNotes, type ReleaseNote } from '../home/feed.ts';
import { getJson } from './models.ts';

export const CHANGELOG_SOURCE = 'https://apertis.ai/api/changelog';
export const FEED_PATH = '/changelog/rss.xml';

export interface Note extends ReleaseNote {
  category: string;
  items: string[];
  content: string;
  /** The body was left out: it names a legacy API-key route or a fixed model count (see ACTIVATION below). */
  abridged: boolean;
}

// What the developer-activation guard (scripts/check-developer-activation.mjs, openspec
// developer-activation-docs) forbids in anything this site publishes. Older release notes say "470+ models"
// or link apertis.ai/token; such a note keeps its title, description and items, and its body is replaced
// by a link to the original on apertis.ai rather than rewritten.
const ACTIVATION = [/apertis\.ai\/token\b/i, /apertis\.ai\/setting\?tab=apikeys\b/i, /[?&]utm_(?:source|medium|campaign|term|content)=/i, /\b\d{2,4}\+\s+(?:AI\s+)?models\b/i];
export const ORIGINAL_NOTES = 'https://apertis.ai/changelog';

/** The release notes, newest first with unique versions; throws on anything the page or feed could not show. */
export function changelogNotes(data: unknown): Note[] {
  const notes = releaseNotes(data).map((n, i): Note => {
    const e = (data as Record<string, unknown>[])[i];
    const { category, items = [], content = '' } = e as { category?: unknown; items?: unknown; content?: unknown };
    if (typeof category !== 'string' || !/^[a-z0-9-]+$/.test(category)) throw new Error(`release notes: entry ${i} category ${String(category)} is not a tag`);
    if (!Array.isArray(items) || items.some((t) => typeof t !== 'string')) throw new Error(`release notes: entry ${i} items are not text`);
    if (typeof content !== 'string') throw new Error(`release notes: entry ${i} content is not text`);
    const abridged = (e as { abridged?: unknown }).abridged === true || ACTIVATION.some((re) => re.test(content));
    return { ...n, category, items, content: abridged ? '' : content, abridged };
  });
  if (new Set(notes.map((n) => n.version)).size !== notes.length) throw new Error('release notes: repeated versions');
  return notes;
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
