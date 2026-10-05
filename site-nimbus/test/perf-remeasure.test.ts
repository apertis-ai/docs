// The CI paired-perf re-measure rule (operator decision on #4, 2026-10-02; scripts/nimbus/paired-perf-remeasure.mjs):
// only timing exceedances, on at most 7 pages, are re-measured once; every other failure is final.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PAGES, remeasurable } from '../../scripts/nimbus/paired-perf-remeasure.mjs';

const timingMiss = (page: string) => ({ gate: { page, profile: 'desktop', metric: 'lcp', rule: 'timing', pass: false }, failure: `desktop ${page} lcp: candidate median 364 > ...` });
const run = (misses: ReturnType<typeof timingMiss>[], extra: string[] = []) => ({
  gates: [{ page: '/', profile: 'mobile', metric: 'jsGzip', rule: 'bytes', pass: true }, ...misses.map((m) => m.gate)],
  failures: [...misses.map((m) => m.failure), ...extra],
});

test('a timing exceedance is re-measured: its pages, once each, across the full and PoC gates', () => {
  const miss = timingMiss('/installation/bolt_diy/');
  assert.deepEqual(remeasurable([run([miss]), run([])]), { pages: ['/installation/bolt_diy/'] });
  // The same page failing in both gates (a PoC page) is one page.
  assert.deepEqual(remeasurable([run([timingMiss('/api/')]), run([timingMiss('/api/')])]), { pages: ['/api/'] });
});

test('any other failure is final: bytes, legacy identity, coverage or invalid samples, even beside a timing miss', () => {
  const bytes = { gates: [{ page: '/', profile: 'mobile', metric: 'jsGzip', rule: 'bytes', pass: false }], failures: ['mobile / jsGzip: candidate median 1 > recorded legacy median 0'] };
  assert.ok('reason' in remeasurable([bytes, run([])]));
  for (const other of ['mobile / jsGzip: paired legacy median 202529 != recorded baseline 201597 (legacy server is not the baseline build)',
    'mobile /api/: 4 legacy and 5 candidate samples, protocol requires 5 each', 'mobile / legacy run 2: invalid sample, unreadableResponses 1']) {
    assert.ok('reason' in remeasurable([run([timingMiss('/')], [other]), run([])]), other);
  }
});

test(`more than ${MAX_PAGES} pages exceeding timing, or nothing failing, is not a re-measure`, () => {
  const many = Array.from({ length: MAX_PAGES + 1 }, (_, i) => timingMiss(`/p${i}/`));
  assert.match((remeasurable([run(many), run([])]) as { reason: string }).reason, /more than 7 is final/);
  assert.equal(remeasurable([run(Array.from({ length: MAX_PAGES }, (_, i) => timingMiss(`/p${i}/`))), run([])]).hasOwnProperty('pages'), true);
  assert.deepEqual(remeasurable([run([]), run([])]), { reason: 'nothing to re-measure' });
});
