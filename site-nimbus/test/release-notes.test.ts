// The homepage "Latest" release notes (openspec docs-shell-interfaces, homepage as revised on 2026-10-02):
// the committed snapshot is what scripts/nimbus/release-notes-snapshot.mjs accepts, and the check rejects
// what the homepage could not render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { FILE, SOURCE, releaseNotes } from '../../scripts/nimbus/release-notes-snapshot.mjs';

test('the committed snapshot is a valid, newest-first release-notes list from the public changelog', () => {
  const snapshot = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.equal(snapshot.source, SOURCE);
  assert.deepEqual(releaseNotes(snapshot.notes), snapshot.notes);
});

test('entries without a version, title or ISO date, or out of order, are rejected', () => {
  const ok = { version: '2.2.107', date: '2026-10-01', title: 'Models Added', description: 'Add GPT-6.1 Sol' };
  assert.deepEqual(releaseNotes([{ ...ok, items: ['x'] }]), [ok], 'extra fields are dropped');
  assert.throws(() => releaseNotes([]), /non-empty/);
  for (const bad of [{ ...ok, version: '' }, { ...ok, title: undefined }, { ...ok, date: 'Oct 1' }, { ...ok, description: 3 }]) {
    assert.throws(() => releaseNotes([bad]), /release notes/, JSON.stringify(bad));
  }
  assert.throws(() => releaseNotes([{ ...ok, date: '2026-09-01' }, ok]), /newest first/);
});
