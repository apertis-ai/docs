// #9 search index inputs: only publish+search-eligible manifest entries, read from their built pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import type { ManifestDocument } from '../src/contracts/manifest.ts';
import type { RouteInventory } from '../src/contracts/navigation.ts';
import { manifest } from '../src/manifest/manifest.ts';
import { buildSearchIndex, searchDocuments } from '../src/search/index-build.ts';

const doc = (servedPath: string, publish: boolean, search: boolean): ManifestDocument => ({
  id: `default:${servedPath}`, sourcePath: 'x.md', servedPath, canonicalUrl: `https://docs.apertis.ai${servedPath}`,
  title: servedPath, eligibility: { publish, search, agent: false, rag: false }, markdown: null, contentSha256: '0'.repeat(64),
});

function site(pages: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4-search-'));
  for (const [served, body] of Object.entries(pages)) {
    fs.mkdirSync(path.join(dir, served), { recursive: true });
    fs.writeFileSync(path.join(dir, served, 'index.html'), `<html><body><nav>Navbar chrome</nav>${body}</body></html>`);
  }
  return dir;
}

const indexedUrls = (dir: string) => fs.readdirSync(path.join(dir, 'pagefind/fragment')).map((f) =>
  JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'pagefind/fragment', f))).toString().replace(/^pagefind_dcd/, '')));

test('searchDocuments keeps only publish+search-eligible entries', () => {
  const docs = [doc('/a/', true, true), doc('/b/', true, false), doc('/c/', false, true)];
  assert.deepEqual(searchDocuments(docs).map((d) => d.servedPath), ['/a/']);
  // Against the route inventory (the eligibility authority), whatever the current manifest holds.
  const inventory: RouteInventory = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../migration/nimbus/route-inventory.json'), 'utf8'));
  const searchable = new Set(inventory.routes.filter((r) => r.eligibility.publish && r.eligibility.search).map((r) => r.documentId));
  const expected = manifest.documents.filter((d) => searchable.has(d.id)).map((d) => d.servedPath);
  assert.ok(expected.length > 0 && expected.length < manifest.documents.length, 'the manifest mixes searchable and unsearchable entries');
  assert.deepEqual(searchDocuments(manifest.documents).map((d) => d.servedPath), expected);
});

test('the index is built from the given entries only and indexes the article, not page chrome', async () => {
  const dir = site({
    '/a/': '<article><h1>Alpha</h1><p>createApertis and chat/completions</p></article>',
    '/b/': '<article><h1>Beta</h1><p>not searchable</p></article>',
  });
  await buildSearchIndex(dir, searchDocuments([doc('/a/', true, true), doc('/b/', true, false)]));
  const fragments = indexedUrls(dir);
  assert.deepEqual(fragments.map((f) => f.url), ['/a/']);
  assert.equal(fragments[0].meta.title, 'Alpha');
  assert.doesNotMatch(fragments[0].content, /Navbar chrome/);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'pagefind')).filter((f) => /ui|highlight|unknown/.test(f)), []);
});

test('a page without an indexable article fails the build instead of silently dropping out', async () => {
  const dir = site({ '/a/': '<main><p>no article</p></main>' });
  await assert.rejects(buildSearchIndex(dir, [doc('/a/', true, true)]), /default:\/a\/.*no <article>/);
  await assert.rejects(buildSearchIndex(dir, [doc('/missing/', true, true)]), /ENOENT/);
});
