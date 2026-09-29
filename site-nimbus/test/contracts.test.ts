import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateManifest } from '../src/contracts/validate-manifest.ts';
import { MANIFEST_PATH, markdownPathFor, type ManifestV1 } from '../src/contracts/manifest.ts';
import { OPEN_EVENT, openAskDocs, openSearch, type OpenSurfaceDetail } from '../src/contracts/events.ts';
import { PAGE_META, TITLE_SUFFIX, pageContext } from '../src/contracts/page.ts';
import {
  INVENTORY_DISPOSITIONS,
  INVENTORY_KINDS,
  type InventoryRoute,
  type LiveObservation,
  type RouteInventory,
} from '../src/contracts/navigation.ts';
import { manifest as loadedManifest } from '../src/manifest/manifest.ts';

const repo = path.resolve(import.meta.dirname, '../..');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
const inventoryFile: RouteInventory = readJson('migration/nimbus/route-inventory.json');
const inventory: InventoryRoute[] = inventoryFile.routes;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// A tiny build output with one real Markdown artifact.
const md = '# API Reference\n';
function outDir(files: Record<string, string> = { 'api/index.md': md }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-manifest-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

function validManifest(): ManifestV1 {
  const sourceSha = '7b6ef85abaaef50de5c8d277629b07a39c9c3065';
  return {
    manifestVersion: 1,
    site: 'https://docs.apertis.ai',
    sourceSha,
    buildId: `${sourceSha}.0123456789ab`,
    documents: [
      {
        id: 'page:index', sourcePath: 'src/pages/index.js', servedPath: '/', canonicalUrl: 'https://docs.apertis.ai/',
        title: 'Home', eligibility: { publish: true, search: false, agent: false, rag: false },
        markdown: null, contentSha256: sha256('home'),
      },
      {
        id: 'api:index', sourcePath: 'docs-api/index.md', servedPath: '/api/', canonicalUrl: 'https://docs.apertis.ai/api/',
        title: 'API Reference', eligibility: { publish: true, search: true, agent: true, rag: true },
        markdown: { path: '/api/index.md', sha256: sha256(md) }, contentSha256: sha256(md),
      },
    ],
  };
}

const check = (m: unknown, files?: Record<string, string>) => validateManifest(m, { inventory, outDir: outDir(files) });

test('a valid manifest has no errors', () => {
  assert.deepEqual(check(validManifest()), []);
});

test('id, servedPath and canonicalUrl must each be unique', () => {
  for (const field of ['id', 'servedPath', 'canonicalUrl'] as const) {
    const m = validManifest();
    m.documents.push({ ...m.documents[0], [field]: m.documents[1][field] } as never);
    assert.ok(check(m).some((e) => e.includes(`duplicate ${field}`)), field);
  }
});

test('markdown artifacts must exist with the recorded hash', () => {
  assert.ok(check(validManifest(), {}).some((e) => e.includes('/api/index.md') && e.includes('missing')));
  assert.ok(check(validManifest(), { 'api/index.md': 'tampered' }).some((e) => e.includes('sha256')));
});

test('no entry may map to the reserved /api/ask path', () => {
  for (const servedPath of ['/api/ask', '/api/ask/']) {
    const m = validManifest();
    m.documents[1] = { ...m.documents[1], servedPath };
    assert.ok(check(m).some((e) => e.includes('/api/ask')), servedPath);
  }
  const m = validManifest();
  m.documents[1] = { ...m.documents[1], canonicalUrl: 'https://docs.apertis.ai/api/ask' };
  assert.ok(check(m).some((e) => e.includes('/api/ask')));
});

test('eligibility must equal the inventory row', () => {
  const m = validManifest();
  m.documents[1] = { ...m.documents[1], eligibility: { ...m.documents[1].eligibility, rag: false } };
  assert.ok(check(m).some((e) => e.includes('api:index') && e.includes('eligibility')));
  const unknown = validManifest();
  unknown.documents[0] = { ...unknown.documents[0], id: 'page:nope' };
  assert.ok(check(unknown).some((e) => e.includes('page:nope') && e.includes('inventory')));
});

test('top-level identity fields are checked', () => {
  const m = validManifest();
  m.buildId = 'not-a-build-id';
  assert.ok(check(m).some((e) => e.includes('buildId')));
  assert.ok(check({ ...validManifest(), manifestVersion: 2 }).some((e) => e.includes('manifestVersion')));
});

test('markdown path follows the canonical path rule', () => {
  assert.equal(markdownPathFor('https://docs.apertis.ai/getting-started/quick-start'), '/getting-started/quick-start.md');
  assert.equal(markdownPathFor('https://docs.apertis.ai/api/'), '/api/index.md');
  assert.equal(markdownPathFor('https://docs.apertis.ai/api/sdks/python-sdk/'), '/api/sdks/python-sdk/index.md');
  const m = validManifest();
  m.documents[1] = { ...m.documents[1], markdown: { path: '/api.md', sha256: sha256(md) } };
  assert.ok(check(m, { 'api.md': md }).some((e) => e.includes('markdown.path')));
});

test('the #5 example manifest only fails on the Markdown files it does not ship', () => {
  const errors = check(readJson('migration/nimbus/fixtures/manifest-v1.example.json'), {});
  assert.ok(errors.length > 0 && errors.every((e) => e.includes('missing')), errors.join('\n'));
});

test('the manifest loader reads the one canonical manifest location', () => {
  assert.equal(MANIFEST_PATH, 'src/manifest/manifest.json');
  const onDisk = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', MANIFEST_PATH), 'utf8'));
  assert.deepEqual(loadedManifest, onDisk);
});

test('the committed manifest covers exactly the PoC set and matches the inventory apart from build output', () => {
  const poc: string[] = readJson('migration/nimbus/route-fixtures.json').pocRoutes;
  const served = loadedManifest.documents.map((d) => d.servedPath).sort();
  assert.deepEqual(served, poc.map((p) => (p === '/' ? p : `${p}/`)).sort());
  // Without a build output, the only violations are the Markdown artifacts (full check: dist.check.ts).
  const expected = loadedManifest.documents
    .filter((d) => d.markdown)
    .map((d) => `${d.id}: markdown ${d.markdown!.path} missing from build output`);
  assert.deepEqual(check(loadedManifest, {}).sort(), expected.sort());
});

test('openSearch/openAskDocs dispatch the one apertis-docs:open event', () => {
  const target = new EventTarget();
  const seen: OpenSurfaceDetail[] = [];
  target.addEventListener(OPEN_EVENT, (e) => seen.push((e as CustomEvent<OpenSurfaceDetail>).detail));
  Object.assign(globalThis, { window: target });
  try {
    openSearch('api key');
    openSearch();
    openAskDocs();
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
  assert.equal(OPEN_EVENT, 'apertis-docs:open');
  assert.deepEqual(seen, [{ surface: 'search', query: 'api key' }, { surface: 'search' }, { surface: 'ask' }]);
});

test('page metadata names and page context', () => {
  assert.equal(TITLE_SUFFIX, ' | Apertis Documentation');
  assert.deepEqual(PAGE_META, { id: 'apertis-docs:id', build: 'apertis-docs:build', markdown: 'apertis-docs:markdown' });
  assert.deepEqual(pageContext('Quick Start', { pathname: '/getting-started/quick-start/', search: '?a=1', hash: '#x' }), {
    title: 'Quick Start',
    href: '/getting-started/quick-start/?a=1#x',
  });
});

test('the inventory file matches the RouteInventory contract', () => {
  // Compile-time completeness: adding or dropping a LiveObservation field breaks this literal.
  const liveKeys: Record<keyof LiveObservation, true> = {
    requested: true, status: true, location: true, final: true, slashVariant: true, canonical: true,
    title: true, headingIds: true, links: true, images: true, articleSha256: true,
  };
  assert.deepEqual(Object.keys(inventoryFile).sort(), ['baseSha', 'liveSnapshotSha256', 'routes', 'site']);
  for (const r of inventory) {
    assert.ok((INVENTORY_KINDS as readonly string[]).includes(r.kind), `${r.path}: kind ${r.kind}`);
    assert.ok((INVENTORY_DISPOSITIONS as readonly string[]).includes(r.disposition), `${r.path}: ${r.disposition}`);
    if (r.live) assert.deepEqual(Object.keys(r.live).sort(), Object.keys(liveKeys).sort(), r.path);
  }
  assert.ok(inventory.some((r) => r.live === null));
});

test('entries must come from doc, page or blog-post rows', () => {
  const m = validManifest();
  const blog = inventory.find((r) => r.documentId === 'generated:/blog')!;
  m.documents[0] = { ...m.documents[0], id: 'generated:/blog', eligibility: blog.eligibility };
  assert.ok(check(m).some((e) => e.includes('generated:/blog') && e.includes('kind blog-generated')));
});

test('canonicalUrl and title must equal the inventory live observation', () => {
  const m = validManifest();
  m.documents[1] = { ...m.documents[1], canonicalUrl: 'https://docs.apertis.ai/api/overview' };
  assert.ok(check(m).some((e) => e.includes('api:index') && e.includes('canonicalUrl')));
  const t = validManifest();
  t.documents[1] = { ...t.documents[1], title: 'API Reference | Apertis Documentation' };
  assert.ok(check(t).some((e) => e.includes('api:index') && e.includes('title')));
});

test('malformed manifests are reported, never thrown', () => {
  const bad: unknown[] = [
    null, 42, [], {},
    { ...validManifest(), sourceSha: '(.*', buildId: '(.*.0123456789ab' },
    { ...validManifest(), documents: [null, 5, 'x', {}] },
    { ...validManifest(), documents: [{ ...validManifest().documents[0], canonicalUrl: 'not a url' }] },
    { ...validManifest(), documents: [{ ...validManifest().documents[1], markdown: { path: 5, sha256: null }, canonicalUrl: 7, eligibility: null }] },
  ];
  for (const m of bad) {
    let errors: string[] = [];
    assert.doesNotThrow(() => { errors = check(m); }, JSON.stringify(m));
    assert.ok(errors.length > 0, JSON.stringify(m));
  }
  assert.ok(check({ ...validManifest(), sourceSha: '(.*', buildId: '(.*.0123456789ab' }).some((e) => e.includes('sourceSha')));
});
