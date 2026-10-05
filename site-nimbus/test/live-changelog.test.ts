// The changelog page's data and feed (openspec docs-live-catalog "Changelog page and feed"): the committed copy
// is what changelog.ts accepts, and /changelog/rss.xml parses as RSS 2.0 with the notes newest first, each with
// a unique guid; an upstream failure answers 503 with Retry-After and is not cached. With PREVIEW_URL set, the
// served feed is checked too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sax from 'sax';

import { CHANGELOG_SNAPSHOT } from '../../scripts/nimbus/catalog-snapshot.mjs';
import { CHANGELOG_SOURCE, changelogNotes, rss, type Note } from '../src/components/catalog/changelog.ts';

const snapshot = JSON.parse(fs.readFileSync(CHANGELOG_SNAPSHOT, 'utf8'));
const note = (version: string, date: string, extra = {}) => ({ version, date, title: 'Models Added', description: 'Add a model', category: 'feature', items: ['A model'], content: '## A model', pinned: false, ...extra });

/** A strict XML parse of an RSS 2.0 document: its items' child texts and the guid attributes. */
function parseRss(text: string) {
  const parser = sax.parser(true);
  const items: Record<string, string>[] = [];
  const path: string[] = [];
  let root = '', version = '', item: Record<string, string> | null = null;
  parser.onopentag = (t) => {
    path.push(t.name);
    if (path.length === 1) [root, version] = [t.name, String(t.attributes.version)];
    if (t.name === 'item') item = {};
    if (t.name === 'guid' && item) item.isPermaLink = String(t.attributes.isPermaLink);
  };
  parser.ontext = (s) => { if (item && path.length === 4) item[path[3]] = (item[path[3]] ?? '') + s; };
  parser.onclosetag = (name) => { path.pop(); if (name === 'item') { items.push(item!); item = null; } };
  parser.write(text).close();
  return { root, version, path: path.join('/'), items };
}

test('the committed copy is valid: newest first, unique versions, a category tag on every note', () => {
  assert.deepEqual(changelogNotes(snapshot), snapshot);
  assert.ok(snapshot.length > 10);
  for (const n of snapshot) assert.deepEqual(Object.keys(n).sort(), ['abridged', 'category', 'content', 'date', 'description', 'items', 'title', 'version']);
});

test('release notes without a category tag, with non-text items or a repeated version are rejected', () => {
  assert.deepEqual(changelogNotes([note('2.0.2', '2026-10-01'), note('2.0.1', '2026-09-01', { items: undefined, content: undefined })]).map((n) => [n.version, n.items, n.content]),
    [['2.0.2', ['A model'], '## A model'], ['2.0.1', [], '']]);
  assert.throws(() => changelogNotes([note('1', '2026-10-01', { category: '' })]), /category/);
  assert.throws(() => changelogNotes([note('1', '2026-10-01', { category: '<b>' })]), /category/);
  assert.throws(() => changelogNotes([note('1', '2026-10-01', { items: [1] })]), /items/);
  assert.throws(() => changelogNotes([note('1', '2026-10-01'), note('1', '2026-09-01')]), /repeated/);
});

test('the feed parses as RSS 2.0: notes newest first, unique guids, links to the anchors, all text escaped', () => {
  const notes = changelogNotes([
    note('2.2.0', '2026-10-01', { title: 'Fix <script> & "quotes" ]]> \u0007', category: 'fix', items: ['a < b', 'c & d'] }),
    note('2.1.0', '2026-09-01'),
  ]);
  const feed = parseRss(rss(notes, 'https://docs.example'));
  assert.deepEqual([feed.root, feed.version, feed.path], ['rss', '2.0', '']);
  assert.deepEqual(feed.items.map((i) => i.guid), ['2.2.0', '2.1.0']);
  assert.deepEqual(feed.items[0], {
    title: 'v2.2.0: Fix <script> & "quotes" ]]> ', link: 'https://docs.example/changelog/#2.2.0', guid: '2.2.0', isPermaLink: 'false',
    pubDate: 'Thu, 01 Oct 2026 00:00:00 GMT', category: 'fix', description: 'Add a model\na < b\nc & d',
  });
  const real = parseRss(rss(snapshot as Note[], 'https://docs.apertis.ai'));
  assert.equal(real.items.length, snapshot.length);
  assert.equal(new Set(real.items.map((i) => i.guid)).size, real.items.length);
  assert.deepEqual(real.items.map((i) => i.guid), snapshot.map((n: Note) => n.version));
});

test('GET /changelog/rss.xml: edge-cached for ten minutes; an upstream failure answers 503 with Retry-After, not cached', async () => {
  // A computed specifier: typecheck must not follow it into the Workers types, which replace the DOM's.
  const { onRequestGet } = await import(new URL('../../functions/changelog/rss.xml.ts', import.meta.url).href);
  const put: string[] = [];
  (globalThis as any).caches = { default: { match: async () => undefined, put: async (k: Request) => { put.push(k.url); } } };
  const real = globalThis.fetch;
  const call = () => onRequestGet({ request: new Request('https://docs.example/changelog/rss.xml?utm=x'), waitUntil: (p: Promise<unknown>) => p } as never);
  try {
    globalThis.fetch = (async (url: string) => { assert.equal(url, CHANGELOG_SOURCE); return Response.json({ success: true, data: [note('2.2.0', '2026-10-01')] }); }) as typeof fetch;
    const ok = await call();
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'public, max-age=600');
    assert.match(ok.headers.get('content-type') ?? '', /^application\/rss\+xml/);
    assert.deepEqual(parseRss(await ok.text()).items.map((i) => i.link), ['https://docs.example/changelog/#2.2.0']);
    assert.deepEqual(put, ['https://docs.example/changelog/rss.xml']);
    globalThis.fetch = (async () => new Response('down', { status: 500 })) as typeof fetch;
    const bad = await call();
    assert.equal(bad.status, 503);
    assert.equal(bad.headers.get('retry-after'), '600');
    assert.equal(bad.headers.get('cache-control'), 'no-store');
    assert.equal(put.length, 1);
  } finally {
    globalThis.fetch = real;
  }
});

test('the served /changelog/rss.xml parses as RSS 2.0, newest first, with unique guids', { skip: process.env.PREVIEW_URL ? false : 'set PREVIEW_URL' }, async () => {
  const res = await fetch(`${process.env.PREVIEW_URL!.replace(/\/$/, '')}/changelog/rss.xml`);
  assert.equal(res.status, 200);
  const feed = parseRss(await res.text());
  assert.deepEqual([feed.root, feed.version], ['rss', '2.0']);
  assert.ok(feed.items.length > 10);
  assert.equal(new Set(feed.items.map((i) => i.guid)).size, feed.items.length);
  const dates = feed.items.map((i) => Date.parse(i.pubDate));
  for (let i = 1; i < dates.length; i++) assert.ok(dates[i] <= dates[i - 1], `item ${i} is newer than item ${i - 1}`);
  for (const i of feed.items) assert.ok(i.link.endsWith(`/changelog/#${i.guid}`) && i.category && i.isPermaLink === 'false', i.guid);
});

test('a note whose body names a legacy key route or a fixed model count keeps its summary and drops the body', () => {
  const [a, b, c] = changelogNotes([
    note('2.0.3', '2026-10-02', { content: 'Now 470+ AI models.' }),
    note('2.0.2', '2026-10-01', { content: 'Create a key at https://apertis.ai/token' }),
    note('2.0.1', '2026-09-01'),
  ]);
  assert.deepEqual([a.abridged, a.content, a.title, a.items], [true, '', 'Models Added', ['A model']]);
  assert.deepEqual([b.abridged, b.content], [true, '']);
  assert.deepEqual([c.abridged, c.content], [false, '## A model']);
  // Re-validating the snapshot keeps the flag although the body is gone.
  assert.equal(changelogNotes([a, b, c])[0].abridged, true);
});
