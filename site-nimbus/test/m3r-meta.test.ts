// #8 reading layout: the page header's "Updated" and "Reading time" come from the converter, computed
// from git at conversion time (never at build time) and committed in src/content/docs/page-meta.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PAGE_META_FILE, convert, readingMinutes, type PageMeta } from '../converter/convert.ts';
import type { ManifestV1 } from '../src/contracts/manifest.ts';

const site = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(site, '..');
const manifest: ManifestV1 = JSON.parse(fs.readFileSync(path.join(site, 'src/manifest/manifest.json'), 'utf8'));
const docs = manifest.documents.filter((d) => !d.id.startsWith('page:') && d.eligibility.publish);
const committed = (): Record<string, PageMeta> => JSON.parse(fs.readFileSync(path.join(site, PAGE_META_FILE), 'utf8'));

test('reading time is prose words (fenced code excluded) / 200, rounded up, at least one minute', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes(words(200)), 1);
  assert.equal(readingMinutes(words(201)), 2);
  assert.equal(readingMinutes(`${words(400)}\n\n\`\`\`json\n${words(900)}\n\`\`\`\n\n> ~~~\n> ${words(300)}\n> ~~~\n\nend`), 3);
});

test('every published document has committed meta: the last legacy commit author date and its reading time', () => {
  const meta = committed();
  assert.deepEqual(Object.keys(meta).sort(), docs.map((d) => d.id).sort());
  for (const d of docs) {
    const date = execFileSync('git', ['-C', repoRoot, 'log', '-1', '--format=%aI', manifest.sourceSha, '--', d.sourcePath], { encoding: 'utf8' }).trim();
    assert.match(date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, d.id);
    assert.equal(meta[d.id].updated, date, d.id);
    const clean = fs.readFileSync(path.join(site, 'src/content/public', d.markdown!.path), 'utf8');
    assert.equal(meta[d.id].readingMinutes, readingMinutes(clean), d.id);
    assert.ok(meta[d.id].readingMinutes >= 1 && meta[d.id].readingMinutes < 60, d.id);
  }
});

test('the meta is deterministic: two conversions write identical bytes, equal to the committed file', () => {
  const [a, b] = [0, 1].map(() => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-m3r-')));
  convert({ outRoot: a });
  convert({ outRoot: b });
  const read = (root: string) => fs.readFileSync(path.join(root, PAGE_META_FILE), 'utf8');
  assert.equal(read(a), read(b));
  assert.equal(read(a), fs.readFileSync(path.join(site, PAGE_META_FILE), 'utf8'));
});
