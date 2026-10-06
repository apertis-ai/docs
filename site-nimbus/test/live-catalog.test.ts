// The live model catalog (openspec docs-live-catalog "Model catalog page"): the committed copy is what
// models.ts accepts, a model apertis.ai excludes never appears, prices read as apertis.ai writes them, and the
// edge function answers 502 without caching when the catalog fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { MODELS_SNAPSHOT } from '../../scripts/nimbus/catalog-snapshot.mjs';
import { CATALOG_SOURCE, catalogPage, fetchCatalog, formatTokenPrice, modelView, priceOf, visibleModels } from '../src/components/catalog/models.ts';

const snapshot = JSON.parse(fs.readFileSync(MODELS_SNAPSHOT, 'utf8'));
const row = (id: string, extra = {}) => ({ model_id: id, display_name: id.toUpperCase(), provider: 'OpenAI', category: 'chat', charge_type: 'Pay As You Go', input_price: 0.002, output_price: 0.01, context_length: 1000000, is_enabled: true, is_deprecated: false, badge: null, ...extra });
const page = (models: unknown[], offset: number, total: number, extra = {}) => ({
  success: true,
  data: { models, pagination: { total, limit: 2, offset, has_more: offset + models.length < total }, data_version: '127', hidden_model_ids: ['secret-model'], ...extra },
});

test('the committed copy is valid: unique ids, every field the table shows', () => {
  assert.ok(snapshot.models.length > 100, `${snapshot.models.length} models`);
  assert.equal(new Set(snapshot.models.map((m: { id: string }) => m.id)).size, snapshot.models.length);
  assert.deepEqual(Object.keys(snapshot).sort(), ['models', 'version']);
  for (const m of snapshot.models) assert.deepEqual(Object.keys(m).sort(), ['category', 'charge', 'context', 'id', 'name', 'price', 'provider']);
});

test('apertis.ai exclusions: hidden, disabled, deprecated, badged unavailable and id-less rows are dropped', () => {
  const rows = [
    row('kept'), row('secret-model'), row('off', { is_enabled: false }), row('old', { is_deprecated: true }),
    row('gone', { badge: 'Unavailable' }), row(''), null, row(' padded\u0007 '), row('kept-new', { badge: 'new' }),
  ];
  assert.deepEqual(visibleModels(rows, new Set(['secret-model', 'padded'])).map((m) => m.id), ['kept', 'kept-new']);
  assert.deepEqual(visibleModels([row('x', { display_name: '', provider: '', category: '', charge_type: '', context_length: null })], new Set()),
    [{ id: 'x', name: 'x', provider: 'Unknown', category: 'chat', context: null, charge: 'Pay As You Go', price: { kind: 'token', input: '$2.00', output: '$10.00' } }]);
});

test('prices: the 1M-token unit, per request from the price table, free and usage-based as apertis.ai shows them', () => {
  assert.deepEqual(priceOf(row('sol')), { kind: 'token', input: '$2.00', output: '$10.00' });
  assert.deepEqual(priceOf(row('embed', { input_price: 0.00002, output_price: 0 })), { kind: 'token', input: '$0.02', output: null });
  assert.deepEqual(priceOf(row('tiny', { input_price: 0.000005, output_price: 0.0000015 })), { kind: 'token', input: '$0.005', output: '$0.0015' });
  assert.deepEqual(priceOf(row('img', { charge_type: 'Pay Per Request', input_price: 0, output_price: 0, price_table: [{ spec: 'Standard', price: 0 }, { spec: 'Default', price: 0.04 }] })), { kind: 'request', price: '$0.04' });
  assert.deepEqual(priceOf(row('veo', { charge_type: 'Pay Per Request', price_table: [{ spec: 'Original Ratio', price: 1.26 }, { spec: 'default', price: 5.6 }] })), { kind: 'request', price: '$5.60' });
  for (const free of [row('a:free'), row('b', { charge_type: 'free' }), row('c', { category: ' Free ' })]) assert.deepEqual(priceOf(free), { kind: 'free' });
  assert.deepEqual(priceOf(row('stt', { category: 'voice', input_price: 0, output_price: 0 })), { kind: 'usage' });
  assert.equal(formatTokenPrice(1.5, '1M'), '$1,500.00');
  const v = (p: object) => modelView({ id: 'a b', name: 'A', provider: 'P', category: 'voice', context: null, charge: 'Pay As You Go', price: p as never });
  assert.deepEqual([v({ kind: 'token', input: '$2.00', output: null }).input, v({ kind: 'token', input: '$2.00', output: null }).output], ['$2.00 / 1M', '—']);
  assert.deepEqual([v({ kind: 'request', price: '$0.04' }).input, v({ kind: 'usage' }).input, v({ kind: 'free' }).output], ['$0.04 / request', 'Usage-based', '$0 / 1M']);
  assert.equal(v({ kind: 'free' }).href, 'https://apertis.ai/models/a%20b');
});

test('a catalog page is used only when complete and consistent', () => {
  assert.equal(catalogPage(page([row('a'), row('b')], 0, 3), 0).more, true);
  assert.throws(() => catalogPage({ success: false }, 0), /not a catalog page/);
  assert.throws(() => catalogPage(page([row('a')], 0, 3), 0), /incomplete/);
  assert.throws(() => catalogPage(page([row('a'), row('a')], 0, 3), 0), /repeated/);
  assert.throws(() => catalogPage(page([row('c')], 2, 3), 2, { total: 3, version: '126' }), /changed while paging/);
  assert.throws(() => catalogPage(page([row('a'), row('b')], 0, 3, { hidden_model_ids: undefined }), 0), /hidden_model_ids/);
});

const pages = (by: Record<number, unknown>, status = 200) => (async (url: string) => {
  const offset = Number(new URL(url).searchParams.get('offset'));
  assert.ok(url.startsWith(CATALOG_SOURCE));
  return new Response(JSON.stringify(by[offset]), { status });
}) as typeof fetch;

test('fetchCatalog reads every page and applies hidden ids from all of them', async () => {
  const p1 = page([row('a'), row('secret-model')], 0, 3);
  const p2 = page([row('late-hidden')], 2, 3, { hidden_model_ids: ['late-hidden'] });
  const catalog = await fetchCatalog(pages({ 0: p1, 2: p2 }));
  assert.deepEqual(catalog.models.map((m) => m.id), ['a']);
  assert.equal(catalog.version, '127');
  assert.ok(!JSON.stringify(catalog).includes('secret-model') && !JSON.stringify(catalog).includes('late-hidden'));
  await assert.rejects(fetchCatalog(pages({}, 503)), /HTTP 503/);
});

test('GET /_nimbus/catalog: edge-cached for ten minutes; an upstream failure answers 502 and is not cached', async () => {
  // A computed specifier: typecheck must not follow it into the Workers types, which replace the DOM's.
  const { onRequestGet } = await import(new URL('../../functions/_nimbus/catalog.ts', import.meta.url).href);
  const put: string[] = [];
  (globalThis as any).caches = { default: { match: async () => undefined, put: async (k: Request) => { put.push(k.url); } } };
  const real = globalThis.fetch;
  const call = () => onRequestGet({ request: new Request('https://docs.example/_nimbus/catalog?x=1'), waitUntil: (p: Promise<unknown>) => p } as never);
  try {
    globalThis.fetch = pages({ 0: page([row('a'), row('b')], 0, 2) });
    const ok = await call();
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'public, max-age=600');
    assert.deepEqual((await ok.json()).models.map((m: { id: string }) => m.id), ['a', 'b']);
    assert.deepEqual(put, ['https://docs.example/_nimbus/catalog']);
    globalThis.fetch = pages({}, 500);
    const bad = await call();
    assert.equal(bad.status, 502);
    assert.equal(bad.headers.get('cache-control'), 'no-store');
    assert.equal(put.length, 1);
  } finally {
    globalThis.fetch = real;
  }
});
