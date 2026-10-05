// openspec docs-api-reference-ux "SDK samples": every tab sample (a fence tagged tab="<Label>") in the legacy
// sources passes its syntax check, every model ID it names is in the committed public catalog snapshot
// (test/fixtures/catalog-model-ids.json), and the five SDK sample pages carry their tab groups.
// Checks: bash -n, python3 -m py_compile, node --check (.mjs for JavaScript, .mts with type stripping for TypeScript).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const catalog = new Set<string>(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/catalog-model-ids.json'), 'utf8')).ids);

const SDK_PAGES: Record<string, string[]> = {
  'docs-api/text-generation/chat-completions.md': ['cURL', 'Python', 'JavaScript'],
  'docs-api/text-generation/responses.md': ['cURL', 'Python', 'JavaScript'],
  'docs-api/embeddings/embeddings-api.md': ['cURL', 'Python', 'JavaScript'],
  'docs-api/text-generation/messages.md': ['cURL', 'Python', 'TypeScript'],
  'docs-api/utilities/models.md': ['cURL', 'Python', 'JavaScript'],
};
const CHECKS: Record<string, { ext: string; cmd: (file: string) => [string, string[]] }> = {
  bash: { ext: '.sh', cmd: (f) => ['bash', ['-n', f]] },
  python: { ext: '.py', cmd: (f) => ['python3', ['-m', 'py_compile', f]] },
  javascript: { ext: '.mjs', cmd: (f) => [process.execPath, ['--check', f]] },
  typescript: { ext: '.mts', cmd: (f) => [process.execPath, ['--check', f]] },
};
// Model IDs named by a sample: request fields, the models endpoint path and models.retrieve().
const MODEL_REFS = [/["']?\bmodel["']?\s*[:=]\s*["']([^"']+)["']/g, /\/v1\/models\/([A-Za-z0-9._:/-]+)/g, /\bretrieve\(\s*["']([^"']+)["']/g];

interface Sample { file: string; line: number; label: string; lang: string; code: string }
/** Tagged fences of a source, grouped into runs separated by nothing but whitespace (the converter's rule). */
function tabGroups(file: string): Sample[][] {
  const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  const groups: Sample[][] = [];
  let lastEnd = -1;
  for (const m of src.matchAll(/^(`{3,}|~{3,})([A-Za-z0-9_+#.-]*)\s+tab="([^"]+)"\n([\s\S]*?)\n\1[ \t]*$/gm)) {
    const sample = { file, line: src.slice(0, m.index).split('\n').length, label: m[3], lang: m[2], code: `${m[4]}\n` };
    if (lastEnd >= 0 && src.slice(lastEnd, m.index).trim() === '') groups.at(-1)!.push(sample);
    else groups.push([sample]);
    lastEnd = m.index! + m[0].length;
  }
  return groups;
}

const sources = ['docs', 'docs-api'].flatMap((root) => fs.readdirSync(path.join(repoRoot, root), { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.mdx?$/.test(f)).map((f) => `${root}/${f.split(path.sep).join('/')}`));
const samples = sources.flatMap((f) => tabGroups(f).flat());

test('the SDK sample pages have tab groups with exactly their required labels', () => {
  for (const [file, labels] of Object.entries(SDK_PAGES)) {
    const groups = tabGroups(file);
    assert.ok(groups.length > 0, `${file}: no tab group`);
    for (const g of groups) assert.deepEqual(g.map((s) => s.label), labels, `${file}:${g[0].line}`);
  }
});

test('every tab sample passes its syntax check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-samples-'));
  try {
    assert.ok(samples.length >= 15, `${samples.length} samples`);
    for (const [n, s] of samples.entries()) {
      const check = CHECKS[s.lang] ?? assert.fail(`${s.file}:${s.line}: no syntax check for language ${JSON.stringify(s.lang)}`);
      const file = path.join(dir, `sample-${n}${check.ext}`);
      fs.writeFileSync(file, s.code);
      const [cmd, args] = check.cmd(file);
      const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8' });
      assert.equal(r.status, 0, `${s.file}:${s.line} (${s.label}): ${cmd} ${args[0]}\n${r.stderr}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every model ID a tab sample names is in the public catalog snapshot', () => {
  let named = 0;
  for (const s of samples) {
    for (const re of MODEL_REFS) {
      for (const [, id] of s.code.matchAll(re)) {
        if (/^<[^>]+>$/.test(id)) continue; // a documented placeholder such as <MODEL_ALIAS>
        named++;
        assert.ok(catalog.has(id), `${s.file}:${s.line} (${s.label}): model ${id} is not in the catalog snapshot`);
      }
    }
  }
  assert.ok(named >= 10, `${named} model IDs checked`);
});
