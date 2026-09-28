// #7 deterministic regeneration: convert + build twice gives a byte-identical manifest, Markdown
// artifacts and HTML. Builds into temporary outDirs, so dist/ is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { convert } from '../converter/convert.ts';

const site = path.resolve(import.meta.dirname, '..');
const manifestFile = path.join(site, 'src/manifest/manifest.json');
const digest = (dir: string) => Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => { const f = path.join(e.parentPath, e.name); return [path.relative(dir, f), crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]; })
  .sort(([a], [b]) => (a < b ? -1 : 1)));

function run() {
  convert();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-m2-build-'));
  execFileSync(path.join(site, 'node_modules/.bin/astro'), ['build', '--outDir', out], {
    cwd: site, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, stdio: 'pipe',
  });
  return { manifest: fs.readFileSync(manifestFile, 'utf8'), files: digest(out) };
}

test('converting and building twice is byte-identical', { timeout: 300_000 }, () => {
  const first = run();
  const second = run();
  assert.equal(second.manifest, first.manifest);
  assert.deepEqual(second.files, first.files);
  assert.ok(Object.keys(first.files).filter((f) => f.endsWith('.md')).length === 11);
});
