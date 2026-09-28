// Publication hygiene of the build output (openspec docs-routing-publication "No unintended public content").
//   npm run build && npm run test:dist
// ponytail: file allowlist = manifest HTML + 404 + assets referenced from that HTML; #7 extends it with .md/llms/sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { manifest } from '../src/manifest/manifest.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.relative(dist, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
const read = (f: string) => fs.readFileSync(path.join(dist, f), 'utf8');

// Nimbus writes this stylesheet unconditionally (writeShikiStyleSheet); code blocks reference it from #7 on.
const FRAMEWORK_ASSETS = ['_nimbus/shiki.css'];
// Legacy static/ files keep their paths (publicDir) and are governed by their inventory rows.
const inventory = JSON.parse(fs.readFileSync(path.join(root, '../migration/nimbus/route-inventory.json'), 'utf8'));
const STATIC_ASSETS: string[] = inventory.routes
  .filter((r: { kind: string; disposition: string }) => r.kind === 'static-asset' && r.disposition === 'preserve')
  .map((r: { path: string }) => r.path.slice(1));

// #9 search index (Pagefind, fetched lazily by the assistant client so no HTML references it). Only the
// files the client loads are allowed; the index content is checked against the manifest below.
const SEARCH_BUNDLE = /^pagefind\/(pagefind\.js|pagefind-worker\.js|pagefind-entry\.json|pagefind\.en_[0-9a-f]+\.pf_meta|wasm\.en\.pagefind|index\/en_[0-9a-f]+\.pf_index|fragment\/en_[0-9a-f]+\.pf_fragment)$/;
const SEARCH_FILES = files.filter((f) => SEARCH_BUNDLE.test(f));
const searchText = (f: string) => zlib.gunzipSync(fs.readFileSync(path.join(dist, f))).toString('utf8');
const fragments = () => SEARCH_FILES.filter((f) => f.startsWith('pagefind/fragment/'))
  .map((f) => JSON.parse(searchText(f).replace(/^pagefind_dcd/, '')) as { url: string; word_count: number; meta: { title?: string } });

const INTERNAL_SECRET_NAMES = /CLOUDFLARE_API_TOKEN|SUPABASE_|TURNSTILE_SECRET|JINA_API_KEY/;
const ENV_FILE = /^(\.env|\.dev\.vars)(\..+)?$/;

/** Values (>= 8 chars) from every `.env*` / `.dev.vars*` file in `dirs`, except `*.example`. */
function envValues(dirs: string[]): string[] {
  return dirs.flatMap((dir) => fs.readdirSync(dir)
    .filter((name) => ENV_FILE.test(name) && !name.endsWith('.example') && fs.statSync(path.join(dir, name)).isFile())
    .flatMap((name) => [...fs.readFileSync(path.join(dir, name), 'utf8')
      .matchAll(/^[ \t]*(?:export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*(.*?)[ \t]*$/gm)]
      .map((m) => m[1].replace(/^(["'])(.*)\1$/, '$2'))
      .filter((v) => v.length >= 8)));
}

test('every output file derives from a publishable manifest entry or is referenced by one', () => {
  const pages = manifest.documents.filter((d) => d.eligibility.publish).map((d) => `${d.servedPath.slice(1)}index.html`);
  const html = [...pages, '404.html'];
  const referenced = html.flatMap((f) => [...read(f).matchAll(/(?:href|src)="\/([^"#?]+)"/g)].map((m) => m[1]));
  const allowed = new Set([...html, ...referenced, ...FRAMEWORK_ASSETS, ...STATIC_ASSETS, ...SEARCH_FILES]);
  for (const f of STATIC_ASSETS) assert.ok(files.includes(f), `missing static asset ${f}`);
  assert.deepEqual(files.filter((f) => !allowed.has(f)), []);
  for (const f of html) assert.ok(files.includes(f), `missing ${f}`);
});

test('no source maps, raw MDX, planning material or manifest internals', () => {
  assert.deepEqual(files.filter((f) => /\.(map|mdx)$/.test(f)), []);
  const leaks = /sourceMappingURL|openspec|migration\/nimbus|scripts\/nimbus|functions\/api|"sourcePath"|"manifestVersion"|"contentSha256"/;
  assert.deepEqual(files.filter((f) => leaks.test(read(f))), []);
});

test('env value scanning covers every .env*/.dev.vars* file, quotes and export prefixes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-env-'));
  fs.writeFileSync(path.join(dir, '.env.local'), 'export TOKEN_A="aaaaaaaa11"\n# comment\nSHORT=abc\n');
  fs.writeFileSync(path.join(dir, '.dev.vars.preview'), "KEY_B='bbbbbbbb22'\nKEY_C = cccccccc33\n");
  fs.writeFileSync(path.join(dir, '.dev.vars.example'), 'KEY_D=dddddddd44\n');
  fs.writeFileSync(path.join(dir, 'env.txt'), 'KEY_E=eeeeeeee55\n');
  assert.deepEqual(envValues([dir]).sort(), ['aaaaaaaa11', 'bbbbbbbb22', 'cccccccc33']);
});

test('no environment secret values or internal secret names appear in the output', () => {
  const values = envValues([root, path.dirname(root)]);
  // Public docs legitimately name APERTIS_API_KEY; only internal backend names are blocked by name.
  const leaked = files.filter((f) => {
    const body = read(f);
    return values.some((v) => body.includes(v)) || INTERNAL_SECRET_NAMES.test(body);
  });
  // Report file names only, never the values.
  assert.deepEqual(leaked, []);
});

test('the search index holds exactly the publish+search-eligible manifest entries, with content', () => {
  const eligible = manifest.documents.filter((d) => d.eligibility.publish && d.eligibility.search);
  const indexed = fragments();
  assert.deepEqual(indexed.map((f) => f.url).sort(), eligible.map((d) => d.servedPath).sort());
  for (const f of indexed) assert.ok(f.word_count > 0 && f.meta.title, `${f.url} indexed without content or title`);
  for (const f of ['pagefind/pagefind.js', 'pagefind/pagefind-entry.json', 'pagefind/wasm.en.pagefind']) assert.ok(files.includes(f), `missing ${f}`);
});

test('decompressed search index carries no internals, secret names or env values', () => {
  const values = envValues([root, path.dirname(root)]);
  const leaks = /sourceMappingURL|openspec|migration\/nimbus|scripts\/nimbus|functions\/api|"sourcePath"|"manifestVersion"|"contentSha256"/;
  const compressed = SEARCH_FILES.filter((f) => /\.pf_(fragment|index|meta)$/.test(f));
  assert.ok(compressed.length > 0);
  assert.deepEqual(compressed.filter((f) => {
    const body = searchText(f);
    return leaks.test(body) || INTERNAL_SECRET_NAMES.test(body) || values.some((v) => body.includes(v));
  }), []);
});

test('no simulated or canned Ask Docs answer path ships (baseline defect 6)', () => {
  const scripts = [
    ...files.filter((f) => f.endsWith('.js') && !f.startsWith('pagefind/')).map(read),
    ...files.filter((f) => f.endsWith('.html')).flatMap((f) => [...read(f).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])),
  ];
  assert.ok(scripts.some((s) => s.includes('apertis-docs:open')), 'the assistant client is not in the output');
  const canned = /Local preview response|isLocalPreview|location\.hostname|["'](localhost|127\.0\.0\.1|::1)["']/;
  assert.deepEqual(scripts.filter((s) => canned.test(s)).map((s) => s.match(canned)![0]), []);
});
