// #10486: the build identity is a function of content, so a squash merge (same tree, new commit) keeps
// buildId and page-meta `updated`, while a real source or build-input change still makes the committed
// buildId differ from the expected one (which is what scripts/nimbus/check-build-id.mjs refuses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PAGE_META_FILE, convert, expectedBuildId, readInventory, sourceShaOf } from '../converter/convert.ts';
import type { InventoryRoute } from '../converter/inventory.ts';

const realRepo = path.resolve(import.meta.dirname, '../..');
const template = readInventory(realRepo).find((r) => r.documentId === 'api:index') as InventoryRoute;

const T1 = '2026-01-01T00:00:00Z';
const T2 = '2026-02-02T00:00:00Z';
const T3 = '2026-03-03T00:00:00Z';
const T4 = '2026-09-09T00:00:00Z';

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-ident-'));
  const run = (date: string, ...args: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@invalid', ...args],
    { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } }).trim();
  const put = (rel: string, body: string) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), body); };
  run(T1, 'init', '-q', '-b', 'main');
  const row = (id: string, file: string, url: string, title: string): InventoryRoute => ({
    ...template, documentId: id, sourcePath: file, path: url, sidebar: null,
    live: { ...template.live!, canonical: `https://docs.apertis.ai${url}/`, title, headingIds: [], links: [], images: [], articleSha256: null },
  } as InventoryRoute);
  const inventory = [row('docs:a', 'docs/a.md', '/a', 'A'), row('docs:b', 'docs/b.md', '/b', 'B')];
  put('docs/a.md', '# A\n\nalpha\n');
  put('docs/b.md', '# B\n\nbeta\n');
  put('site-nimbus/package.json', '{}\n');
  run(T1, 'add', '-A');
  run(T1, 'commit', '-q', '-m', 'first');
  const siteRoot = path.join(repo, 'site-nimbus');
  const out = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-ident-out-'));
  const meta = (root: string) => fs.readFileSync(path.join(root, PAGE_META_FILE), 'utf8');
  /** Convert, commit the generated page-meta as the regenerate PR would, and return the output root. */
  const regenerate = (date: string) => {
    const o = out();
    const m = convert({ outRoot: o, repoRoot: repo, siteRoot, inventory });
    put('site-nimbus/src/content/docs/page-meta.json', meta(o));
    put('site-nimbus/src/manifest/manifest.json', `${JSON.stringify(m)}\n`);
    run(date, 'add', '-A');
    run(date, 'commit', '-q', '-m', 'regenerate');
    return { o, m };
  };
  const committedBuildId = () => JSON.parse(fs.readFileSync(path.join(siteRoot, 'src/manifest/manifest.json'), 'utf8')).buildId as string;
  return { repo, run, put, siteRoot, inventory, out, meta, regenerate, committedBuildId };
}

test('sourceShaOf is 40 hex and names the legacy trees, not a commit', () => {
  const f = fixture();
  assert.match(sourceShaOf(f.repo), /^[0-9a-f]{40}$/);
  assert.notEqual(sourceShaOf(f.repo), f.run(T1, 'rev-parse', 'HEAD'));
  const before = sourceShaOf(f.repo);
  f.put('site-nimbus/package.json', '{"a":1}\n');
  f.run(T2, 'add', '-A'); f.run(T2, 'commit', '-q', '-m', 'build input only');
  assert.equal(sourceShaOf(f.repo), before, 'a commit outside the legacy roots does not move it');
});

test('a squash-equivalent commit (same tree, other parent and author date) keeps the buildId and page-meta bytes', () => {
  const f = fixture();
  const first = f.regenerate(T2);
  const id = expectedBuildId(f.repo, f.siteRoot);
  assert.equal(id, f.committedBuildId());
  assert.equal(id, first.m.buildId);
  const before = f.run(T3, 'rev-parse', 'HEAD');
  const tree = f.run(T3, 'rev-parse', 'HEAD^{tree}');
  const root = f.run(T3, 'rev-list', '--max-parents=0', 'HEAD');
  const squash = f.run(T4, 'commit-tree', tree, '-p', root, '-m', 'squash');
  f.run(T4, 'reset', '-q', '--hard', squash);
  assert.notEqual(squash, before, 'a different commit');
  assert.equal(expectedBuildId(f.repo, f.siteRoot), id, 'buildId survives the squash');
  assert.equal(expectedBuildId(f.repo, f.siteRoot), f.committedBuildId(), 'the committed manifest is still fresh');
  const again = f.out();
  convert({ outRoot: again, repoRoot: f.repo, siteRoot: f.siteRoot, inventory: f.inventory });
  assert.equal(f.meta(again), f.meta(first.o), 'page-meta, updated included, is byte-identical');
  assert.match(f.meta(again), new RegExp(`"updated": "${T1}"`));
});

test('a source change or a build-input change without regeneration makes the committed buildId stale', () => {
  const f = fixture();
  f.regenerate(T2);
  const committed = f.committedBuildId();
  f.put('docs/a.md', '# A\n\nalpha edited\n');
  f.run(T3, 'add', '-A'); f.run(T3, 'commit', '-q', '-m', 'edit source');
  const afterSource = expectedBuildId(f.repo, f.siteRoot);
  assert.notEqual(afterSource, committed);
  assert.notEqual(afterSource.slice(0, 40), committed.slice(0, 40), 'source change moves the first part');
  assert.equal(afterSource.slice(41), committed.slice(41));

  const g = fixture();
  g.regenerate(T2);
  const committedG = g.committedBuildId();
  g.put('site-nimbus/package.json', '{"changed":true}\n');
  g.run(T3, 'add', '-A'); g.run(T3, 'commit', '-q', '-m', 'edit build input');
  const afterInput = expectedBuildId(g.repo, g.siteRoot);
  assert.notEqual(afterInput, committedG);
  assert.equal(afterInput.slice(0, 40), committedG.slice(0, 40));
  assert.notEqual(afterInput.slice(41), committedG.slice(41), 'build input change moves the second part');
});

test('updated is carried forward while the source bytes are unchanged and recomputed from HEAD when they change', () => {
  const f = fixture();
  f.regenerate(T2);
  f.put('docs/a.md', '# A\n\nalpha edited\n');
  f.run(T3, 'add', '-A'); f.run(T3, 'commit', '-q', '-m', 'edit a');
  const o = f.out();
  convert({ outRoot: o, repoRoot: f.repo, siteRoot: f.siteRoot, inventory: f.inventory });
  const m = JSON.parse(f.meta(o));
  assert.equal(m['docs:a'].updated, T3, 'changed source: the author date of the last commit touching it at HEAD');
  assert.equal(m['docs:b'].updated, T1, 'unchanged source: carried forward');
  assert.match(m['docs:a'].sourceSha256, /^[0-9a-f]{64}$/);
  // An entry without sourceSha256 (a pre-#10486 file) is recomputed, never trusted.
  const legacy = JSON.parse(fs.readFileSync(path.join(f.siteRoot, PAGE_META_FILE), 'utf8'));
  for (const k of Object.keys(legacy)) delete legacy[k].sourceSha256;
  legacy['docs:b'].updated = '1999-01-01T00:00:00Z';
  fs.writeFileSync(path.join(f.siteRoot, PAGE_META_FILE), JSON.stringify(legacy));
  const o2 = f.out();
  // the working tree is dirty only under site-nimbus/src/content, which is not a legacy root
  convert({ outRoot: o2, repoRoot: f.repo, siteRoot: f.siteRoot, inventory: f.inventory });
  assert.equal(JSON.parse(f.meta(o2))['docs:b'].updated, T1);
});
