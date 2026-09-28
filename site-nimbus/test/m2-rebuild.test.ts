// #7 deterministic regeneration: building twice from the committed conversion gives a byte-identical
// manifest, Markdown artifacts and HTML, and the build agrees with the committed manifest bytes
// (M2_CHECK=1: finalize fails instead of rewriting a stale manifest, so no tracked file changes). Builds into temporary outDirs, so dist/ is untouched; it never
// reruns the converter (that would race the drift test in m2-convert.test.ts, which also covers
// convert-twice determinism).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const site = path.resolve(import.meta.dirname, '..');
const manifestFile = path.join(site, 'src/manifest/manifest.json');
const digest = (dir: string) => Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => { const f = path.join(e.parentPath, e.name); return [path.relative(dir, f), crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]; })
  .sort(([a], [b]) => (a < b ? -1 : 1)));

function run() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-m2-build-'));
  execFileSync(path.join(site, 'node_modules/.bin/astro'), ['build', '--outDir', out], {
    cwd: site, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', M2_CHECK: '1' }, stdio: 'pipe',
  });
  return { manifest: fs.readFileSync(manifestFile, 'utf8'), files: digest(out) };
}

test('building twice is byte-identical and matches the committed manifest', { timeout: 300_000 }, () => {
  const committed = fs.readFileSync(manifestFile, 'utf8');
  const first = run();
  assert.equal(first.manifest, committed);
  const second = run();
  assert.equal(second.manifest, first.manifest);
  assert.deepEqual(second.files, first.files);
  assert.ok(Object.keys(first.files).filter((f) => f.endsWith('.md')).length === 11);
});
