// The homepage's committed live data (openspec docs-shell-interfaces, homepage as revised on 2026-10-02): the
// snapshots are what scripts/nimbus/homepage-snapshot.mjs accepts, and its checks reject what the homepage
// could not render or should not feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { FEATURED, MODELS, RELEASE_NOTES, featuredModel, releaseNotes } from '../../scripts/nimbus/homepage-snapshot.mjs';

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('the committed snapshots are valid: newest-first release notes, and the featured models in FEATURED order', () => {
  const notes = read(RELEASE_NOTES.file);
  assert.equal(notes.source, RELEASE_NOTES.source);
  assert.deepEqual(releaseNotes(notes.notes), notes.notes);
  const models = read(MODELS.file);
  assert.equal(models.source, MODELS.source);
  assert.ok(Number.isInteger(models.total) && models.total >= models.models.length, `total ${models.total}`);
  assert.deepEqual(models.models.map((m: { id: string }) => m.id), FEATURED.map((f) => f.id));
  for (const [i, m] of models.models.entries()) {
    const record = { model_id: m.id, display_name: m.name, provider: m.provider, context_length: String(m.context), is_enabled: true };
    assert.deepEqual(featuredModel(FEATURED[i], record), m, m.id);
  }
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

test('a featured model that is missing, disabled, deprecated or incomplete is rejected', () => {
  const pick = { id: 'gpt-6.1-sol', line: 'A line.', tags: ['Coding'] };
  const record = { model_id: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', provider: 'OpenAI', context_length: '1000000', is_enabled: true, is_deprecated: false };
  assert.deepEqual(featuredModel(pick, record), { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', provider: 'OpenAI', context: 1000000, line: 'A line.', tags: ['Coding'] });
  assert.throws(() => featuredModel(pick, undefined), /not in the catalog/);
  assert.throws(() => featuredModel(pick, { ...record, model_id: 'gpt-6-sol' }), /not in the catalog/);
  assert.throws(() => featuredModel(pick, { ...record, is_enabled: false }), /disabled or deprecated/);
  assert.throws(() => featuredModel(pick, { ...record, is_deprecated: true }), /disabled or deprecated/);
  assert.throws(() => featuredModel(pick, { ...record, context_length: '0' }), /context length/);
  assert.throws(() => featuredModel({ ...pick, tags: [] }, record), /line and tags/);
});
