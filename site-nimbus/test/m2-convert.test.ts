// #7 converter: construct handling, loud failures, determinism and drift of the committed output.
// Pure: needs no build output. Post-build checks live in test/dist.check.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ConversionError, convert, convertDocument, mainTextSha256 } from '../converter/convert.ts';
import type { InventoryRoute, RouteInventory } from '../src/contracts/navigation.ts';

const site = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(site, '..');
const inventory: InventoryRoute[] = (JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'migration/nimbus/route-inventory.json'), 'utf8'),
) as RouteInventory).routes;
const row = (id: string) => inventory.find((r) => r.documentId === id)!;
const ctx = { inventory, repoRoot };

// A doc under docs/authentication/ whose inventory title is "API Keys".
const keys = row('default:authentication/api-keys');
const doc = (body: string, file = keys) => convertDocument(`# API Keys\n\n${body}\n`, file, ctx);
const fails = (body: string, construct: RegExp, file = keys) =>
  assert.throws(() => doc(body, file), (e: unknown) => e instanceof ConversionError && construct.test(e.message) && e.message.includes(file.sourcePath!));

test('admonitions become an <aside> in the HTML source and a blockquote in clean Markdown', () => {
  const out = doc(':::tip Why `code:` prefix?\n\nUse **it**.\n\n```bash\necho hi\n```\n:::');
  assert.match(out.render, /<aside class="admonition admonition-tip">\n<p class="admonition-title">Why <code>code:<\/code> prefix\?<\/p>\n\nUse \*\*it\*\*\.\n\n```bash\necho hi\n```\n\n<\/aside>/);
  assert.match(out.clean, /> \*\*Tip: Why `code:` prefix\?\*\*\n>\n> Use \*\*it\*\*\.\n>\n> ```bash\n> echo hi\n> ```\n/);
  assert.doesNotMatch(out.clean + out.render, /:::/);
  assert.match(doc(':::warning\nCareful.\n:::').clean, /> \*\*Warning\*\*\n>\n> Careful\./);
});

test('relative, extensionless and absolute links resolve to inventory paths', () => {
  const out = doc('[a](./organizations.md) [b](../billing/rate-limits#x) [c](/installation/claude-code#coding-model-ids) [d](mailto:hi@apertis.ai) [e](#same)');
  assert.match(out.render, /\[a\]\(\/authentication\/organizations\) \[b\]\(\/billing\/rate-limits#x\) \[c\]\(\/installation\/claude-code#coding-model-ids\) \[d\]\(mailto:hi@apertis\.ai\) \[e\]\(#same\)/);
  assert.equal(out.clean.includes('](/authentication/organizations)'), true);
});

test('links and code inside code spans and fences are left untouched', () => {
  const out = doc('Use `[x](./nowhere)` and `<b>`.\n\n```md\n[y](./nowhere) <Tabs> {#id} :::tip\n```');
  assert.match(out.render, /`\[x\]\(\.\/nowhere\)` and `<b>`/);
  assert.match(out.render, /\[y\]\(\.\/nowhere\) <Tabs> \{#id\} :::tip/);
});

test('bundled relative images get a content-addressed public path; the MDX heading icon is kept in HTML only', () => {
  const roo = row('default:installation/roocode');
  const src = fs.readFileSync(path.join(repoRoot, roo.sourcePath!), 'utf8');
  const out = convertDocument(src, roo, ctx);
  assert.equal(out.title, 'Roo Code (prev. Roo Cline)');
  assert.deepEqual(out.assets.map((a) => a.file), ['docs/static/img/roocode_1.png', 'docs/static/img/roocode_2.png']);
  for (const a of out.assets) {
    assert.match(a.publicPath, /^\/assets\/images\/roocode_[12]-[0-9a-f]{16}\.png$/);
    assert.ok(out.render.includes(`](${a.publicPath})`) && out.clean.includes(`](${a.publicPath})`));
  }
  assert.match(out.render, /^---\ntitle: "Roo Code \(prev\. Roo Cline\)"\n---\n\n# <img src="\/img\/roocode\.svg" width="36" alt="" style="display:inline-block;vertical-align:middle;margin-right:8px" \/> Roo Code \(prev\. Roo Cline\)\n/);
  assert.match(out.clean, /^# Roo Code \(prev\. Roo Cline\)\n/);
  assert.doesNotMatch(out.clean, /<|\{\{|^---/m);
});

test('unsupported constructs fail loudly with the file and construct', () => {
  fails('import Tabs from "@theme/Tabs";', /import\/export/);
  fails('<Tabs>\n<TabItem value="a">x</TabItem>\n</Tabs>', /inline HTML\/JSX/);
  fails('## Heading {#custom-id}', /explicit heading id/);
  fails('Value {props.x}', /MDX expression/);
  fails('```js title="a.js"\nx\n```', /code fence meta/);
  fails('```bash npm2yarn\nnpm i\n```', /code fence meta/);
  fails('```bash\nunclosed', /unclosed code fence/);
  fails('- item\n  :::tip\n  x\n  :::', /indented admonition/);
  fails(':::tip\n:::note\nx\n:::\n:::', /nested admonition/);
  fails(':::tip\nnever closed', /unclosed admonition/);
  fails(':::danger-zone\nx\n:::', /admonition/);
  fails('[x](../nowhere/at-all)', /not in the route inventory/);
  fails('[x](./missing.md)', /no inventory document/);
  fails('![x](../static/img/missing.png)', /image/);
  fails('[ref]: /intro', /reference-style/);
  fails('<!-- hidden -->', /inline HTML\/JSX/);
  fails('# Second H1', /one H1/);
  assert.throws(() => convertDocument('---\nslug: /x\n---\n# API Keys\n', keys, ctx), /front matter key slug/);
  assert.throws(() => convertDocument('# Not The Title\n', keys, ctx), /title/);
});

test('the <main> text hash collapses whitespace, strips tags and decodes entities', () => {
  const a = mainTextSha256('<html><main class="x">\n <h1>A &amp; B</h1>\n\n<p>c&#39;d&nbsp;e</p></main><footer>z</footer></html>');
  const b = mainTextSha256('<main><h1>A & B</h1> <p>c\'d e</p></main>');
  assert.equal(a, b);
  assert.throws(() => mainTextSha256('<div>no main</div>'), /main/);
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-m2-'));
const tree = (root: string, dirs: string[]) => Object.fromEntries(dirs.flatMap((d) => {
  const abs = path.join(root, d);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
    .map((e) => { const f = path.join(e.parentPath, e.name); return [path.relative(root, f), fs.readFileSync(f).toString('base64')]; });
}));
const OUT = ['src/content/docs', 'src/content/public', 'src/manifest'];

test('converting twice is byte-identical, and a rerun leaves no stale output', () => {
  const [a, b] = [tmp(), tmp()];
  convert({ outRoot: a });
  fs.mkdirSync(path.join(b, 'src/content/docs/stale'), { recursive: true });
  fs.writeFileSync(path.join(b, 'src/content/docs/stale/index.md'), '# stale\n');
  fs.mkdirSync(path.join(b, 'src/content/public'), { recursive: true });
  fs.writeFileSync(path.join(b, 'src/content/public/stale.md'), 'stale\n');
  convert({ outRoot: b });
  convert({ outRoot: b });
  assert.deepEqual(tree(b, OUT), tree(a, OUT));
  assert.equal(Object.keys(tree(a, ['src/content/public'])).filter((f) => f.endsWith('.md')).length, 11);
});

test('the committed generated output equals a fresh conversion (never hand-edited)', () => {
  const out = tmp();
  convert({ outRoot: out });
  const fresh = tree(out, ['src/content/docs', 'src/content/public']);
  assert.deepEqual(tree(site, ['src/content/docs', 'src/content/public']), fresh);
  // page:index contentSha256 is finalized after the build (phase 2); everything else is phase 1.
  const strip = (m: { documents: { id: string; contentSha256: string }[] }) => ({
    ...m, documents: m.documents.map((d) => (d.id === 'page:index' ? { ...d, contentSha256: '-' } : d)),
  });
  const read = (root: string) => JSON.parse(fs.readFileSync(path.join(root, 'src/manifest/manifest.json'), 'utf8'));
  assert.deepEqual(strip(read(site)), strip(read(out)));
});

test('the manifest covers all 12 PoC documents with the spec buildId form', () => {
  const m = convert({ outRoot: tmp() });
  assert.deepEqual(m.documents.map((d) => d.id).sort(), inventory.filter((r) => r.poc && r.documentId).map((r) => r.documentId).sort());
  assert.equal(m.documents.length, 12);
  assert.match(m.sourceSha, /^[0-9a-f]{40}$/);
  assert.match(m.buildId, new RegExp(`^${m.sourceSha}\\.[0-9a-f]{12}$`));
  const home = m.documents.find((d) => d.id === 'page:index')!;
  assert.equal(home.markdown, null);
  for (const d of m.documents.filter((x) => x.id !== 'page:index')) assert.equal(d.contentSha256, d.markdown?.sha256);
});
