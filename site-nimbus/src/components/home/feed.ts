// The homepage's live data (openspec docs-shell-interfaces, homepage as revised on 2026-10-03): the newest
// release notes of the public Apertis changelog and the models most recently added to the public catalog,
// with the catalog's model and provider counts. One module for every reader of that data, so they agree on
// what is valid:
//   - scripts/nimbus/homepage-snapshot.mjs writes home-feed.json, the build's copy (the build never calls
//     the network, and the page renders from it first);
//   - functions/_nimbus/home-feed.ts serves the same shape at /_nimbus/home-feed, edge-cached, and the
//     homepage swaps it in after load, so the page is current without a rebuild.
// Pure (no Node or Workers APIs): bundled into both, and the views below into the page's swap script.
import { displayDate } from '../shell/page-header.ts';

export const SOURCES = {
  notes: 'https://apertis.ai/api/changelog?view=homepage',
  models: 'https://apertis.ai/api/v2/models/?sort=newest',
} as const;
export const NEW_MODELS = 6;

export interface ReleaseNote { version: string; date: string; title: string; description: string }
export interface NewModel { id: string; name: string; provider: string; category: string; context: number | null; added: string; description: string }
export interface HomeFeed { notes: ReleaseNote[]; models: NewModel[]; total: number; providers: number }

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
// The card shows two lines; a longer description is cut at a word, which also bounds the feed's size (the
// homepage dataGzip budget decision on #4).
const DESCRIPTION = 160;
const clip = (s: string) => (s.length <= DESCRIPTION ? s : `${s.slice(0, s.lastIndexOf(' ', DESCRIPTION - 1) > 0 ? s.lastIndexOf(' ', DESCRIPTION - 1) : DESCRIPTION - 1).replace(/[\s,.;:]+$/, '')}…`);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The release notes the homepage shows, newest first; throws on anything it could not render. */
export function releaseNotes(data: unknown): ReleaseNote[] {
  if (!Array.isArray(data) || !data.length) throw new Error('release notes: expected a non-empty list');
  const notes = data.map((e, i) => {
    const note = { version: e?.version, date: e?.date, title: e?.title, description: e?.description ?? '' };
    for (const k of ['version', 'date', 'title'] as const) if (!text(note[k])) throw new Error(`release notes: entry ${i} has no ${k}`);
    if (!DATE.test(note.date)) throw new Error(`release notes: entry ${i} date ${note.date} is not YYYY-MM-DD`);
    if (typeof note.description !== 'string') throw new Error(`release notes: entry ${i} description is not text`);
    return note as ReleaseNote;
  });
  for (let i = 1; i < notes.length; i++) if (notes[i].date > notes[i - 1].date) throw new Error('release notes: not newest first');
  return notes;
}

/**
 * The `count` most recently added models: enabled, not deprecated, not in the catalog's `hidden_model_ids`
 * (apertis.ai never shows those; docs-live-catalog), and not a `:variant` of another model (such as `:free`);
 * a record without an id, name, provider, category or added time is skipped, not shown.
 */
export function newModels(records: unknown, count = NEW_MODELS, hidden: ReadonlySet<string> = new Set()): NewModel[] {
  if (!Array.isArray(records)) throw new Error('new models: expected a list');
  const models = records
    .filter((r) => r && r.is_enabled !== false && !r.is_deprecated && text(r.model_id) && !hidden.has(r.model_id) && !r.model_id.includes(':')
      && text(r.display_name) && text(r.provider) && text(r.category) && Number.isFinite(r.created_at) && r.created_at > 0)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, count)
    .map((r): NewModel => {
      const context = Number(r.context_length);
      return {
        id: r.model_id, name: r.display_name, provider: r.provider, category: r.category,
        context: context > 0 ? context : null,
        added: new Date(r.created_at * 1000).toISOString().slice(0, 10),
        description: text(r.description) ? clip(r.description.trim()) : '',
      };
    });
  if (models.length < count) throw new Error(`new models: only ${models.length} of ${count} usable records`);
  return models;
}

/** The whole feed from the two public endpoints; throws if either is unusable. */
export async function fetchFeed(fetcher: typeof fetch): Promise<HomeFeed> {
  const json = async (url: string) => {
    const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': 'apertis-docs-home-feed' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const body = await res.json() as { success?: boolean; message?: string; data?: unknown };
    if (body.success === false) throw new Error(`${url}: ${body.message || 'not successful'}`);
    return body.data as Record<string, unknown> & { models?: unknown; pagination?: { total?: number }; aggregations?: { providers?: unknown[] } };
  };
  const [notes, catalog] = await Promise.all([json(SOURCES.notes), json(SOURCES.models)]);
  const total = Number(catalog?.pagination?.total);
  const providers = catalog?.aggregations?.providers?.length ?? 0;
  if (!(total > 0) || !(providers > 0)) throw new Error(`${SOURCES.models}: no model or provider count`);
  const hidden = catalog?.hidden_model_ids;
  if (!Array.isArray(hidden)) throw new Error(`${SOURCES.models}: no hidden_model_ids`);
  return { notes: releaseNotes(notes), models: newModels(catalog.models, NEW_MODELS, new Set(hidden)), total, providers };
}

/** "1M", "262K": a context window for a model card. */
export const contextLabel = (tokens: number) => (tokens >= 1e6 ? `${+(tokens / 1e6).toFixed(1)}M` : `${Math.round(tokens / 1e3)}K`);

// What each homepage row shows, keyed by the `data-f` fields of its markup: the build renders the rows from
// these views and the swap script refills cloned rows from them, so both always show the same text. An empty
// field hides its element; `href` and `datetime` set those attributes.
export type View = Record<string, string>;
export const modelView = (m: NewModel): View => ({
  href: `https://apertis.ai/models/${encodeURIComponent(m.id)}`, name: m.name, provider: m.provider,
  added: `Added ${displayDate(m.added)}`, category: m.category.charAt(0).toUpperCase() + m.category.slice(1), context: m.context ? `${contextLabel(m.context)} context` : '',
  description: m.description,
});
export const noteView = (n: ReleaseNote): View => ({
  href: `https://apertis.ai/changelog/${encodeURIComponent(n.version)}`, datetime: n.date, date: displayDate(n.date),
  description: n.description || n.title, title: n.title, version: `v${n.version}`,
});
