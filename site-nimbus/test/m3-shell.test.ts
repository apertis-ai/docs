// #8 shell logic: sidebar navigation from the inventory `sidebar` fields and same-release page-action URLs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildNavigation, pageNavigation, type SidebarNode } from '../src/components/shell/navigation.ts';
import { aiToolUrls, markdownUrl, promptFor } from '../src/components/shell/page-actions.ts';
import type { ManifestDocument } from '../src/contracts/manifest.ts';
import type { RouteInventory } from '../src/contracts/navigation.ts';
import { manifest } from '../src/manifest/manifest.ts';

const repo = path.resolve(import.meta.dirname, '../..');
const inventory: RouteInventory = JSON.parse(fs.readFileSync(path.join(repo, 'migration/nimbus/route-inventory.json'), 'utf8'));
const example = JSON.parse(fs.readFileSync(path.join(repo, 'migration/nimbus/fixtures/manifest-v1.example.json'), 'utf8'));
const nav = buildNavigation(inventory.routes, manifest.documents);

const labels = (nodes: SidebarNode[]): unknown[] =>
  nodes.map((n) => (n.kind === 'link' ? n.entry.label : { [n.label]: labels(n.items) }));

test('the API sidebar keeps the inventory placement: Overview first, categories in order, Python SDK nested', () => {
  const api = nav.trees.apiSidebar;
  assert.equal(api[0].kind, 'link');
  assert.deepEqual(api[0].kind === 'link' && [api[0].entry.label, api[0].entry.href], ['Overview', '/api/']);
  assert.deepEqual(
    api.filter((n) => n.kind === 'category').map((n) => n.kind === 'category' && n.label),
    ['Text Generation', 'Search', 'Vision & Images', 'Audio & Video', 'Embeddings & Rerank', 'SDKs & Libraries', 'Utilities'],
  );
  const sdks = api.find((n) => n.kind === 'category' && n.label === 'SDKs & Libraries');
  assert.ok(sdks?.kind === 'category');
  assert.deepEqual(labels(sdks.items).slice(0, 3), ['@apertis/ai-sdk-provider', '@apertis/agent', {
    'Python SDK': ['Overview', 'Chat Completions', 'Streaming', 'Tool Calling', 'Embeddings', 'Vision (Images)', 'Audio',
      'Video', 'Web Search', 'Reasoning & Extended Thinking', 'Messages API', 'Responses API', 'Rerank', 'Async Patterns'],
  }]);
  const textGen = api.find((n) => n.kind === 'category' && n.label === 'Text Generation');
  assert.ok(textGen?.kind === 'category');
  assert.deepEqual(labels(textGen.items), ['Chat Completion', 'Responses API', 'Messages API (Native Anthropic)',
    'Streaming Output', 'Structured Output', 'Prompt Cache', 'Context Compression']);
});

test('every sidebar row appears exactly once, in inventory order, and the two sidebars stay separate', () => {
  for (const id of ['tutorialSidebar', 'apiSidebar'] as const) {
    const rows = inventory.routes.filter((r) => r.sidebar?.sidebar === id).sort((a, b) => a.sidebar!.order - b.sidebar!.order);
    const flat = (nodes: SidebarNode[]): string[] => nodes.flatMap((n) => (n.kind === 'link' ? [n.entry.id] : flat(n.items)));
    assert.deepEqual(flat(nav.trees[id]), rows.map((r) => r.documentId));
  }
  assert.deepEqual(labels(nav.trees.tutorialSidebar).map((n) => typeof n === 'string' ? n : Object.keys(n as object)[0]),
    ['Getting Started', 'Account & Access', 'Integrations', 'Configuration', 'Help & Security', 'Resources']);
});

test('labels come from sidebar.label, then the manifest title; hrefs are manifest servedPaths', () => {
  const docs: ManifestDocument[] = example.documents;
  const n = buildNavigation(inventory.routes, docs);
  const quick = n.entries.find((e) => e.id === 'default:getting-started/quick-start');
  assert.deepEqual([quick?.label, quick?.href], ['Quick Start', '/getting-started/quick-start/']);
  // A manifest title wins over the inventory title for rows without a sidebar label.
  const renamed = docs.map((d) => (d.id === 'default:getting-started/quick-start' ? { ...d, title: 'Quick Start (manifest)' } : d));
  assert.equal(buildNavigation(inventory.routes, renamed).entries.find((e) => e.id === quick?.id)?.label, 'Quick Start (manifest)');
  // Rows not yet in the manifest (PoC) fall back to the inventory's live title and served path.
  const sdk = n.entries.find((e) => e.id === 'api:text-generation/structured-output');
  assert.deepEqual([sdk?.label, sdk?.href], ['Structured Output', '/api/text-generation/structured-output/']);
});

test('an unlisted published document gets no sidebar entry and no sidebar, and does not throw', () => {
  const n = buildNavigation(inventory.routes, example.documents);
  assert.equal(n.entries.some((e) => e.id === 'default:help/ideas'), false);
  assert.equal(pageNavigation(n, 'default:help/ideas'), null);
  assert.equal(pageNavigation(n, 'page:index'), null);
});

test('page navigation gives the active sidebar, trail, and prev/next within that sidebar', () => {
  const api = pageNavigation(nav, 'api:index');
  assert.equal(api?.sidebar, 'apiSidebar');
  assert.deepEqual(api?.trail, []);
  assert.equal(api?.prev, null);
  assert.equal(api?.next?.label, 'Chat Completion');
  const quick = pageNavigation(buildNavigation(inventory.routes, example.documents), 'default:getting-started/quick-start');
  assert.deepEqual(quick?.trail, ['Getting Started']);
  assert.equal(quick?.prev?.href, '/intro/');
  assert.equal(quick?.next?.label, 'Models');
});

test('markdown URL is the same origin plus the page meta path, never another host', () => {
  assert.equal(markdownUrl('https://preview-abc.docs.pages.dev', '/api/index.md'), 'https://preview-abc.docs.pages.dev/api/index.md');
  assert.equal(markdownUrl('http://stimaclawmac-mini:8802', '/getting-started/quick-start.md'), 'http://stimaclawmac-mini:8802/getting-started/quick-start.md');
  for (const bad of [null, '', 'api/index.md', '//raw.githubusercontent.com/x.md', 'https://raw.githubusercontent.com/apertis-ai/docs/main/docs-api/index.md', '/\\evil.example/x.md', '/api/index.html']) {
    assert.equal(markdownUrl('https://docs.apertis.ai', bad), null, String(bad));
  }
});

test('AI tool links carry the spec prompt with the same-release Markdown URL', () => {
  const url = 'https://docs.apertis.ai/api/index.md';
  const prompt = `Load the contents of ${url} into this chat's context so we can discuss it.`;
  assert.equal(promptFor(url), prompt);
  assert.deepEqual(aiToolUrls(url), {
    claude: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    chatgpt: `https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(prompt)}`,
    cursor: `https://cursor.com/link/prompt?text=${encodeURIComponent(prompt)}`,
  });
});
