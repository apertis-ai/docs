// The /models/ page's data (openspec docs-live-catalog "Model catalog page"): every page of the public model
// catalog, filtered exactly as apertis.ai filters it before rendering, and priced as apertis.ai prices it.
// The rules are apertis.ai's, mirrored here:
//   - catalog.ts validateCatalogPage (511-584): a page is used only if it is complete and consistent;
//   - catalog.ts normalizeApiModel (293-306) and normalizeApiModelsResponse (479-497): a row without an id,
//     disabled, deprecated, badged "unavailable" or listed in hidden_model_ids is never shown;
//   - shared.ts isCatalogModelFreeIdentity (258-268), ModelsCatalog.tsx getModelPricing (1028-1068) and
//     detail.ts formatTokenPrice (173-191): the prices at the default 1M-token unit.
// One module for every reader, like home/feed.ts: scripts/nimbus/catalog-snapshot.mjs writes models.json (the
// build's copy), functions/_nimbus/catalog.ts serves the same shape live, and the page's swap script refills
// its rows from modelView. Only the fields the page renders leave this module; the hidden list never does.
// Pure (no Node or Workers APIs).
import { contextLabel } from '../home/feed.ts';

export const CATALOG_SOURCE = 'https://api.apertis.ai/api/v2/models/';
const PAGE_SIZE = 100;

export type Price =
  | { kind: 'free' }
  | { kind: 'request'; price: string }
  | { kind: 'usage' }
  | { kind: 'token'; input: string | null; output: string | null };
export interface CatalogModel { id: string; name: string; provider: string; category: string; context: number | null; charge: string; price: Price }
export interface Catalog { version: string; models: CatalogModel[] }

/** GET a public Apertis JSON endpoint and return its body; throws on an HTTP error or `success: false`. */
export async function getJson(fetcher: typeof fetch, url: string): Promise<{ success?: unknown; message?: string; data?: any }> {
  const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': 'apertis-docs-catalog' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.json() as { success?: unknown; message?: string; data?: unknown };
  if (body.success === false) throw new Error(`${url}: ${body.message || 'not successful'}`);
  return body;
}

// catalog.ts normalizeDisplayString: control and replacement characters dropped, whitespace collapsed.
const UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￼�]/g;
const clean = (v: unknown) => (typeof v === 'string' ? v.replace(UNSAFE, '').replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fold = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** detail.ts formatTokenPrice: an API price is USD per 1K tokens; the 1M unit multiplies it by 1000. */
export function formatTokenPrice(value: number, unit: '1K' | '1M' = '1M'): string {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  const v = unit === '1M' ? value * 1000 : value;
  if (v >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 8 })}`;
}

/** ModelsCatalog.tsx getModelPricing, from the raw row (the free check reads the raw identity, as the API does). */
export function priceOf(row: Record<string, any>): Price {
  const charge = clean(row.charge_type || row.charge) || 'Pay As You Go';
  if (fold(row.category) === 'free' || fold(row.model_id || row.id).endsWith(':free') || fold(row.charge_type || row.charge) === 'free') return { kind: 'free' };
  const table = Array.isArray(row.price_table || row.priceTable) ? (row.price_table || row.priceTable) as Record<string, unknown>[] : [];
  const request = table.find((t) => clean(t?.spec) === 'default' && num(t?.price) > 0) ?? table.find((t) => num(t?.price) > 0);
  if (charge === 'Pay Per Request' && request) return { kind: 'request', price: formatTokenPrice(num(request.price), '1K') };
  const input = num(row.input_price), output = num(row.output_price);
  if (!(input > 0) && !(output > 0)) return { kind: 'usage' };
  return { kind: 'token', input: input > 0 ? formatTokenPrice(input) : null, output: output > 0 ? formatTokenPrice(output) : null };
}

/** The rows apertis.ai renders, projected to what /models/ shows (catalog.ts 293-306, 479-497). */
export function visibleModels(rows: unknown[], hidden: Set<string>): CatalogModel[] {
  return rows.flatMap((raw): CatalogModel[] => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, any>;
    const id = clean(row.model_id || row.id);
    if (!id || row.is_enabled === false || row.is_deprecated === true || fold(row.badge) === 'unavailable') return [];
    if (hidden.has(id) || hidden.has(row.model_id)) return [];
    const context = num(row.context_length);
    return [{
      id, name: clean(row.display_name || row.name) || id, provider: clean(row.provider || row.company) || 'Unknown',
      category: clean(row.category) || 'chat', context: context > 0 ? context : null,
      charge: clean(row.charge_type || row.charge) || 'Pay As You Go', price: priceOf(row),
    }];
  });
}

/** One catalog page, checked as catalog.ts validateCatalogPage checks it; throws on anything inconsistent. */
export function catalogPage(body: { success?: unknown; data?: any }, offset: number, first?: { total: number; version: string }) {
  const { models, pagination: p, data_version: version, hidden_model_ids: hidden } = body?.data ?? {};
  const at = `models page at ${offset}`;
  if (body?.success !== true || !Array.isArray(models) || !p) throw new Error(`${at}: not a catalog page`);
  if (![p.total, p.limit, p.offset].every(Number.isSafeInteger) || p.total < 0 || p.limit <= 0 || p.offset !== offset) throw new Error(`${at}: bad pagination`);
  if (typeof p.has_more !== 'boolean' || typeof version !== 'string' || !version) throw new Error(`${at}: no has_more or data_version`);
  if (first && (p.total !== first.total || version !== first.version)) throw new Error(`${at}: the catalog changed while paging`);
  if (offset > p.total || models.length !== Math.min(p.limit, p.total - offset) || p.has_more !== offset + models.length < p.total) throw new Error(`${at}: incomplete page`);
  const ids = models.map((m) => String(m?.model_id || ''));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error(`${at}: missing or repeated model ids`);
  if (!Array.isArray(hidden)) throw new Error(`${at}: no hidden_model_ids`);
  return { models: models as unknown[], hidden: hidden.filter((h): h is string => typeof h === 'string' && h !== ''), total: p.total as number, version, more: p.has_more as boolean };
}

/** Every page of the public catalog, as apertis.ai would render it; throws if any page is unusable. */
export async function fetchCatalog(fetcher: typeof fetch): Promise<Catalog> {
  const rows: unknown[] = [];
  const hidden = new Set<string>();
  let first: { total: number; version: string } | undefined;
  // The next offset is the rows so far (catalogPage guarantees a page with more after it is not empty).
  for (let offset = 0; ; offset = rows.length) {
    const page = catalogPage(await getJson(fetcher, `${CATALOG_SOURCE}?limit=${PAGE_SIZE}&offset=${offset}&sort=newest&order=desc`), offset, first);
    first ??= page;
    rows.push(...page.models);
    for (const h of page.hidden) hidden.add(h);
    if (!page.more) break;
  }
  const models = visibleModels(rows, hidden);
  if (!models.length) throw new Error('models: nothing to show');
  if (new Set(models.map((m) => m.id)).size !== models.length) throw new Error('models: repeated model ids across pages');
  return { version: first!.version, models };
}

// What each table row shows, keyed by the `data-f` fields of its markup (as home/feed.ts views): the build
// renders the rows from these views and the swap script refills cloned rows from them. `href` sets the link,
// `search`, `provider-key` and `category-key` the row's filter attributes.
export type View = Record<string, string>;
const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
export function modelView(m: CatalogModel): View {
  const p = m.price;
  const [input, output] = p.kind === 'free' ? ['$0 / 1M', '$0 / 1M']
    : p.kind === 'request' ? [`${p.price} / request`, '']
      : p.kind === 'usage' ? ['Usage-based', '']
        : [p.input ? `${p.input} / 1M` : '—', p.output ? `${p.output} / 1M` : '—'];
  return {
    href: `https://apertis.ai/models/${encodeURIComponent(m.id)}`, name: m.name, id: m.id, provider: m.provider,
    category: categoryLabel(m.category), context: m.context ? contextLabel(m.context) : '—', charge: m.charge, input, output,
    search: `${m.name} ${m.id} ${m.provider} ${m.category}`.toLowerCase(), 'provider-key': m.provider, 'category-key': m.category,
  };
}
