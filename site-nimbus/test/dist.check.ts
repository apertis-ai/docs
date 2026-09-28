// Publication hygiene of the build output (openspec docs-routing-publication "No unintended public content").
//   npm run build && npm run test:dist
// ponytail: file allowlist = manifest HTML + 404 + assets referenced from that HTML; #7 extends it with .md/llms/sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { manifest } from '../src/fixtures/manifest.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.relative(dist, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
const read = (f: string) => fs.readFileSync(path.join(dist, f), 'utf8');

// Nimbus writes this stylesheet unconditionally (writeShikiStyleSheet); code blocks reference it from #7 on.
const FRAMEWORK_ASSETS = ['_nimbus/shiki.css'];

test('every output file derives from a publishable manifest entry or is referenced by one', () => {
  const pages = manifest.documents.filter((d) => d.eligibility.publish).map((d) => `${d.servedPath.slice(1)}index.html`);
  const html = [...pages, '404.html'];
  const referenced = html.flatMap((f) => [...read(f).matchAll(/(?:href|src)="\/([^"#?]+)"/g)].map((m) => m[1]));
  const allowed = new Set([...html, ...referenced, ...FRAMEWORK_ASSETS]);
  assert.deepEqual(files.filter((f) => !allowed.has(f)), []);
  for (const f of html) assert.ok(files.includes(f), `missing ${f}`);
});

test('no source maps, raw MDX, planning material or manifest internals', () => {
  assert.deepEqual(files.filter((f) => /\.(map|mdx)$/.test(f)), []);
  const leaks = /sourceMappingURL|openspec|migration\/nimbus|scripts\/nimbus|functions\/api|"sourcePath"|"manifestVersion"|"contentSha256"/;
  assert.deepEqual(files.filter((f) => leaks.test(read(f))), []);
});

test('no environment secret values appear in the output', () => {
  const envFiles = ['.env', '.dev.vars', '../.env', '../.dev.vars'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f));
  const values = envFiles.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/^\s*[A-Z0-9_]+\s*=\s*"?([^"\n]{8,})"?\s*$/gm)].map((m) => m[1]));
  const leaked = files.filter((f) => {
    const body = read(f);
    return values.some((v) => body.includes(v)) || /CLOUDFLARE_API_TOKEN|SUPABASE_|TURNSTILE_SECRET|JINA_API_KEY|APERTIS_API_KEY/.test(body);
  });
  // Report file names only, never the values.
  assert.deepEqual(leaked, []);
});
