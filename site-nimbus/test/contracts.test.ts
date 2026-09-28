import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateManifest } from '../src/contracts/validate-manifest.ts';
import { markdownPathFor, type ManifestV1 } from '../src/contracts/manifest.ts';
import { OPEN_EVENT, openAskDocs, openSearch, type OpenSurfaceDetail } from '../src/contracts/events.ts';
import { PAGE_META, pageContext } from '../src/contracts/page.ts';
import type { InventoryRoute } from '../src/contracts/navigation.ts';

const repo = path.resolve(import.meta.dirname, '../..');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
const inventory: InventoryRoute[] = readJson('migration/nimbus/route-inventory.json').routes;
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

test('the fixture manifest matches the inventory; its only gap is the unconverted /api/index.md', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../src/fixtures/manifest.json'), 'utf8'));
  assert.deepEqual(fixture.documents.map((d: { servedPath: string }) => d.servedPath), ['/', '/api/']);
  assert.deepEqual(check(fixture, {}), ['api:index: markdown /api/index.md missing from build output']);
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
  assert.deepEqual(PAGE_META, { id: 'apertis-docs:id', build: 'apertis-docs:build', markdown: 'apertis-docs:markdown' });
  assert.deepEqual(pageContext('Quick Start', { pathname: '/getting-started/quick-start/', search: '?a=1', hash: '#x' }), {
    title: 'Quick Start',
    href: '/getting-started/quick-start/?a=1#x',
  });
});
