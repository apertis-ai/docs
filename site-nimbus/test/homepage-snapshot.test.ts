// The homepage feed (openspec docs-shell-interfaces, homepage as revised on 2026-10-03): the committed copy is
// what feed.ts accepts, feed.ts rejects what the homepage could not render, and the edge function answers
// 502 without caching when an upstream fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { SNAPSHOT } from '../../scripts/nimbus/homepage-snapshot.mjs';
import { NEW_MODELS, SOURCES, fetchFeed, modelView, newModels, noteView, releaseNotes } from '../src/components/home/feed.ts';

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const record = (id: string, created: number, extra = {}) => ({ model_id: id, display_name: id.toUpperCase(), provider: 'OpenAI', category: 'chat', context_length: '1000000', created_at: created, is_enabled: true, is_deprecated: false, description: 'A model.', ...extra });
const catalog = (models: unknown[]) => ({ success: true, data: { models, pagination: { total: 382 }, aggregations: { providers: [{ name: 'OpenAI', count: 50 }] }, hidden_model_ids: [] } });

test('the committed copy is valid: newest-first release notes and the newest models, with counts', () => {
  assert.deepEqual(releaseNotes(snapshot.notes), snapshot.notes);
  assert.equal(snapshot.models.length, NEW_MODELS);
  for (let i = 1; i < snapshot.models.length; i++) assert.ok(snapshot.models[i].added <= snapshot.models[i - 1].added, 'newest first');
  assert.ok(snapshot.total >= snapshot.models.length && snapshot.providers > 8, `${snapshot.total} models, ${snapshot.providers} providers`);
});

test('release notes without a version, title or ISO date, or out of order, are rejected', () => {
  const ok = { version: '2.2.107', date: '2026-10-01', title: 'Models Added', description: 'Add GPT-6.1 Sol' };
  assert.deepEqual(releaseNotes([{ ...ok, items: ['x'] }]), [ok], 'extra fields are dropped');
  assert.throws(() => releaseNotes([]), /non-empty/);
  for (const bad of [{ ...ok, version: '' }, { ...ok, title: undefined }, { ...ok, date: 'Oct 1' }, { ...ok, description: 3 }]) {
    assert.throws(() => releaseNotes([bad]), /release notes/, JSON.stringify(bad));
  }
  assert.throws(() => releaseNotes([{ ...ok, date: '2026-09-01' }, ok]), /newest first/);
});

test('new models: newest first, skipping disabled, deprecated, :variant and incomplete records; too few is an error', () => {
  const t = 1790611200;
  const records = [
    record('old', t - 900), record('newest', t), record('off', t + 9, { is_enabled: false }), record('gone', t + 8, { is_deprecated: true }),
    record('newest:free', t + 7), record('nameless', t + 6, { display_name: '' }), record('undated', t + 5, { created_at: null }),
    record('stt', t - 100, { context_length: null, description: '' }),
  ];
  const models = newModels(records, 3);
  assert.deepEqual(models.map((m) => m.id), ['newest', 'stt', 'old']);
  assert.deepEqual(models[0], { id: 'newest', name: 'NEWEST', provider: 'OpenAI', category: 'chat', context: 1000000, added: '2026-09-28', description: 'A model.' });
  assert.equal(models[1].context, null);
  const long = newModels([record('long', t, { description: `${'word '.repeat(60)}end.` })], 1)[0].description;
  assert.ok(long.length <= 160 && long.endsWith('word…'), long);
  assert.throws(() => newModels(records, 4), /only 3 of 4/);
  assert.throws(() => newModels({}), /expected a list/);
  // A model apertis.ai hides (hidden_model_ids) never reaches the homepage.
  assert.deepEqual(newModels(records, 2, new Set(['newest'])).map((m) => m.id), ['stt', 'old']);
});

test('views: the text each row shows, with encoded links; an empty field stays empty so its element hides', () => {
  const v = modelView({ id: 'a b', name: 'A', provider: 'P', category: 'voice', context: null, added: '2026-10-01', description: '' });
  assert.deepEqual(v, { href: 'https://apertis.ai/models/a%20b', name: 'A', provider: 'P', added: 'Added Oct 1, 2026', category: 'Voice', context: '', description: '' });
  assert.equal(modelView({ ...snapshot.models[0], context: 262000 }).context, '262K context');
  assert.deepEqual(noteView({ version: '2.2.107', date: '2026-10-01', title: 'Models Added', description: '' }),
    { href: 'https://apertis.ai/changelog/2.2.107', datetime: '2026-10-01', date: 'Oct 1, 2026', description: 'Models Added', title: 'Models Added', version: 'v2.2.107' });
});

test('fetchFeed reads both public endpoints and fails on an HTTP error, success:false or missing counts', async () => {
  const notes = { success: true, data: snapshot.notes };
  const records = Array.from({ length: NEW_MODELS }, (_, i) => record(`m${i}`, 1790611200 - i));
  const fake = (by: Record<string, unknown>, status = 200) => (async (url: string) => new Response(JSON.stringify(by[url]), { status })) as typeof fetch;
  const feed = await fetchFeed(fake({ [SOURCES.notes]: notes, [SOURCES.models]: catalog(records) }));
  assert.deepEqual([feed.notes.length, feed.models.length, feed.total, feed.providers], [snapshot.notes.length, NEW_MODELS, 382, 1]);
  await assert.rejects(fetchFeed(fake({}, 503)), /HTTP 503/);
  await assert.rejects(fetchFeed(fake({ [SOURCES.notes]: { success: false, message: 'down' }, [SOURCES.models]: catalog(records) })), /down/);
  await assert.rejects(fetchFeed(fake({ [SOURCES.notes]: notes, [SOURCES.models]: { success: true, data: { models: records } } })), /no model or provider count/);
});
