// Publication hygiene of the build output (openspec docs-routing-publication "No unintended public content").
//   npm run build && npm run test:dist
// ponytail: file allowlist = manifest HTML + 404 + assets referenced from that HTML; #7 extends it with .md/llms/sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { manifest } from '../src/manifest/manifest.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.relative(dist, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
const read = (f: string) => fs.readFileSync(path.join(dist, f), 'utf8');

// Nimbus writes this stylesheet unconditionally (writeShikiStyleSheet); code blocks reference it from #7 on.
const FRAMEWORK_ASSETS = ['_nimbus/shiki.css'];

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
  const allowed = new Set([...html, ...referenced, ...FRAMEWORK_ASSETS]);
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
