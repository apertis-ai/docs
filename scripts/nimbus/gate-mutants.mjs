// Gate mutants for the Nimbus PR gates (issue #12, acceptance criterion 1).
//
//   node scripts/nimbus/gate-mutants.mjs [--only activation,exclusion,wire,route,anchor] [--port 8805] [--out result.json]
//
// For every mutant: the gate passes on the pristine input, fails for the injected reason (the failure
// output must name it) with the regression injected, and passes again after the input is restored.
// - activation: hermetic temp copy of the guard's inputs, one injection per scanned root.
// - route, anchor: temp copy of site-nimbus/dist served by `wrangler pages dev` on --port (it must be
//   free: stop your preview first), checked with route-fixtures.mjs --scope poc.
// - exclusion: in place in site-nimbus/dist (test:dist reads that fixed path), restored in `finally`.
// - wire: in place in migration/nimbus/fixtures/ask-wire.json, restored in `finally` and verified by hash.
// Requires `npm ci` at the root and in site-nimbus, and a `CI=1 npm run build` in site-nimbus.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SITE = path.join(ROOT, 'site-nimbus');
const DIST = path.join(SITE, 'dist');
const WIRE = path.join(ROOT, 'migration/nimbus/fixtures/ask-wire.json');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const only = opt('only', 'activation,exclusion,wire,route,anchor').split(',');
const port = Number(opt('port', '8805'));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rows = [];

function run(cmd, argv, cwd, env = {}) {
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 26 });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

// Runs one gate three times: pristine, mutated, restored. `expect` must match the mutated failure output.
async function mutant(name, gate, { check, inject, restore, expect }) {
  const pristine = await check();
  let mutated;
  try {
    await inject();
    mutated = await check();
  } finally {
    await restore();
  }
  const restored = await check();
  const named = expect.test(mutated.output);
  const ok = pristine.status === 0 && mutated.status !== 0 && named && restored.status === 0;
  rows.push({ mutant: name, gate, pristine: pristine.status, mutated: mutated.status, failureNamesInjection: named, restored: restored.status, result: ok ? 'DETECTED' : 'MISSED' });
  console.error(`${ok ? 'DETECTED' : 'MISSED  '} ${name}: pristine rc=${pristine.status}, mutated rc=${mutated.status} (${named ? 'names the injection' : 'does not name the injection'}), restored rc=${restored.status}`);
  if (!ok) console.error(mutated.output.split('\n').filter(Boolean).slice(-15).join('\n'));
}

// ---- activation guard: every scanned root, hermetic ------------------------------------------------
async function activation() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-guard-'));
  const copy = (rel) => { if (fs.existsSync(path.join(ROOT, rel))) fs.cpSync(path.join(ROOT, rel), path.join(tmp, rel), { recursive: true }); };
  for (const rel of ['docs', 'docs-api', 'src', 'docusaurus.config.js', 'sidebars.js', 'sidebarsApi.js', 'scripts/check-developer-activation.mjs',
    'migration/nimbus/route-inventory.json', 'site-nimbus/src', 'site-nimbus/astro.config.ts', 'site-nimbus/nimbus.json', 'site-nimbus/dist']) copy(rel);
  const check = () => run(process.execPath, ['scripts/check-developer-activation.mjs'], tmp);
  const at = (rel) => path.join(tmp, rel);
  const addFile = (rel, text) => ({ inject: () => { fs.mkdirSync(path.dirname(at(rel)), { recursive: true }); fs.writeFileSync(at(rel), text); }, restore: () => fs.rmSync(at(rel)) });
  const edit = (rel, fn) => { let before; return { inject: () => { before = fs.readFileSync(at(rel), 'utf8'); fs.writeFileSync(at(rel), fn(before)); }, restore: () => fs.writeFileSync(at(rel), before) }; };
  const jsonEdit = (rel, fn) => edit(rel, (text) => { const data = JSON.parse(text); fn(data); return JSON.stringify(data); });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const cases = [
    ['legacy docs .md (PR #3 root)', addFile('docs/mutant.md', 'Get a key at https://apertis.ai/token today.\n'), 'docs/mutant.md:1: legacy API-key route'],
    ['legacy navbar Create account removed (PR #3 invariant)', edit('docusaurus.config.js', (t) => t.replaceAll('https://apertis.ai/register', 'https://apertis.ai/signup')), 'docusaurus.config.js: missing required activation content: https://apertis.ai/register'],
    ['candidate .astro', addFile('site-nimbus/src/components/Mutant.astro', '<a href="https://apertis.ai/setting?tab=apikeys">keys</a>\n'), 'site-nimbus/src/components/Mutant.astro:1: legacy API-key settings tab'],
    ['candidate .ts', addFile('site-nimbus/src/mutant.ts', "export const cta = 'https://apertis.ai/register?utm_source=docs';\n"), 'site-nimbus/src/mutant.ts:1: owned-surface acquisition UTM'],
    ['candidate .tsx', addFile('site-nimbus/src/components/Mutant.tsx', 'export const Claim = () => <p>Access 300+ AI models</p>;\n'), 'site-nimbus/src/components/Mutant.tsx:1: fixed model-count claim'],
    ['candidate generated content collection .md', addFile('site-nimbus/src/content/docs/mutant/index.md', '# Mutant\n\nOpen https://apertis.ai/token\n'), 'site-nimbus/src/content/docs/mutant/index.md:3: legacy API-key route'],
    ['candidate clean Markdown artifact source', addFile('site-nimbus/src/content/public/mutant.md', 'We serve 500+ models.\n'), 'site-nimbus/src/content/public/mutant.md:1: fixed model-count claim'],
    ['candidate config', edit('site-nimbus/astro.config.ts', (t) => `${t}\n// https://apertis.ai/token\n`), 'site-nimbus/astro.config.ts:'],
    ['navigation label from the inventory', jsonEdit('migration/nimbus/route-inventory.json', (d) => { d.routes.find((r) => r.sidebar?.label).sidebar.label = 'Browse 300+ models'; }), 'sidebar label:1: fixed model-count claim'],
    ['navigation title from the manifest', jsonEdit('site-nimbus/src/manifest/manifest.json', (d) => { d.documents[1].title = 'Access 200+ AI models'; }), 'title:1: fixed model-count claim'],
    ['converted Quick Start loses the activation path', edit('site-nimbus/src/content/public/getting-started/quick-start.md', (t) => t.replaceAll('matching Activity record', 'Activity record')), 'site-nimbus/src/content/public/getting-started/quick-start.md: missing required activation content: matching Activity record'],
  ];
  if (fs.existsSync(path.join(tmp, 'site-nimbus/dist'))) {
    cases.push(['built Markdown artifact (dist)', edit('site-nimbus/dist/installation/roocode.md', (t) => `${t}\nhttps://apertis.ai/token\n`), 'site-nimbus/dist/installation/roocode.md:']);
    cases.push(['rendered navbar loses Create account (dist)', edit('site-nimbus/dist/api/index.html', (t) => t.replace(/(<header\b[\s\S]*?)https:\/\/apertis\.ai\/register/, '$1https://apertis.ai/signup')), 'site-nimbus/dist/api/index.html navbar: missing required activation content: https://apertis.ai/register']);
    cases.push(['rendered page loses its whole navbar (dist)', edit('site-nimbus/dist/installation/claude-code/index.html', (t) => t.replace(/<header\b[\s\S]*?<\/header>/, '')), 'site-nimbus/dist/installation/claude-code/index.html navbar: missing required activation content: https://apertis.ai/register']);
    cases.push(['built HTML (dist)', edit('site-nimbus/dist/index.html', (t) => t.replace('</body>', '<a href="https://apertis.ai/token">k</a></body>')), 'site-nimbus/dist/index.html:']);
  }
  try {
    for (const [name, { inject, restore }, reason] of cases) {
      await mutant(`activation: ${name}`, 'node scripts/check-developer-activation.mjs', { check, inject, restore, expect: new RegExp(esc(reason)) });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- publication exclusion: test:dist on site-nimbus/dist, in place ---------------------------------
async function exclusion() {
  if (!fs.existsSync(DIST)) throw new Error('site-nimbus/dist is missing: run `CI=1 npm run build` in site-nimbus first');
  const check = () => run('npm', ['run', 'test:dist'], SITE);
  const listing = () => fs.readdirSync(DIST, { recursive: true }).sort().join('\n');
  const before = listing();
  const expose = (rel, text) => ({ inject: () => { fs.mkdirSync(path.dirname(path.join(DIST, rel)), { recursive: true }); fs.writeFileSync(path.join(DIST, rel), text); },
    restore: () => { fs.rmSync(path.join(DIST, rel)); for (let d = path.dirname(rel); d !== '.'; d = path.dirname(d)) { const abs = path.join(DIST, d); if (fs.readdirSync(abs).length) break; fs.rmdirSync(abs); } } });
  // /help/ideas is published in the inventory but outside the PoC manifest: not eligible for this candidate.
  const cases = [
    ['non-PoC document Markdown published (help/ideas.md)', expose('help/ideas.md', fs.readFileSync(path.join(ROOT, 'docs/help/ideas.md'), 'utf8')), /help\/ideas\.md/],
    ['reserved runtime path emitted (api/ask/index.html)', expose('api/ask/index.html', '<!doctype html><title>shadow</title>'), /api\/ask\/index\.html/],
    ['planning material emitted (openspec proposal)', expose('openspec/proposal.md', fs.readFileSync(path.join(ROOT, 'openspec/changes/nimbus-migration-contracts/proposal.md'), 'utf8')), /openspec\/proposal\.md/],
  ];
  try {
    for (const [name, { inject, restore }, expect] of cases) await mutant(`exclusion: ${name}`, 'site-nimbus: npm run test:dist', { check, inject, restore, expect });
  } finally {
    if (listing() !== before) throw new Error('site-nimbus/dist was not restored');
  }
}

// ---- ask-wire contract: client (m4-wire) and server (assistant replay), in place --------------------
async function wire() {
  const original = fs.readFileSync(WIRE);
  const originalSha = sha(WIRE);
  const restore = () => fs.writeFileSync(WIRE, original);
  const onExit = () => { restore(); process.exit(130); };
  process.once('SIGINT', onExit).once('SIGTERM', onExit);
  const rename = (fn) => () => { const d = JSON.parse(original); fn(d); fs.writeFileSync(WIRE, JSON.stringify(d, null, 2)); };
  try {
    await mutant('wire: client request field renamed (turnstileToken -> turnstile_token)', 'site-nimbus: node --test test/m4-wire.test.ts', {
      check: () => run(process.execPath, ['--test', 'test/m4-wire.test.ts'], SITE),
      inject: rename((d) => { d.request.body = Object.fromEntries(Object.entries(d.request.body).map(([k, v]) => [k === 'turnstileToken' ? 'turnstile_token' : k, v])); }),
      restore, expect: /✖ request body has exactly the wire fields/,
    });
    await mutant('wire: server fixture field renamed in bad-turnstile (turnstileToken -> turnstile_token)', "node --test 'assistant/test/*.test.ts'", {
      check: () => run(process.execPath, ['--test', '--test-timeout=10000', 'assistant/test/*.test.ts'], ROOT),
      inject: rename((d) => { const c = d.cases.find((x) => x.name === 'bad-turnstile'); c.body.turnstile_token = c.body.turnstileToken; delete c.body.turnstileToken; }),
      restore, expect: /✖ bad-turnstile/,
    });
  } finally {
    restore();
    process.off('SIGINT', onExit).off('SIGTERM', onExit);
    if (sha(WIRE) !== originalSha) throw new Error('ask-wire.json was not restored');
  }
}

// ---- served route and anchor fixtures: temp copy of dist behind wrangler ----------------------------
async function served(which) {
  if (!fs.existsSync(DIST)) throw new Error('site-nimbus/dist is missing: run `CI=1 npm run build` in site-nimbus first');
  const probe = await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false);
  if (probe) throw new Error(`port ${port} is in use; stop your preview before the served mutants`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-served-'));
  const dist = path.join(tmp, 'dist');
  fs.cpSync(DIST, dist, { recursive: true });
  const base = `http://127.0.0.1:${port}`;
  const check = async () => {
    // wrangler from the repo root, so functions/ is the real /api/ask handler, as in `npm run preview`.
    const child = spawn(path.join(SITE, 'node_modules/.bin/wrangler'), ['pages', 'dev', dist, '--port', String(port), '--ip', '127.0.0.1', '--compatibility-date=2024-01-01', '--persist-to', path.join(tmp, 'state')],
      { cwd: ROOT, env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', WRANGLER_SEND_METRICS: 'false' }, stdio: 'ignore', detached: true });
    try {
      const deadline = Date.now() + 60000;
      while (!(await fetch(base + '/').then((r) => r.ok, () => false))) {
        if (Date.now() > deadline) throw new Error('wrangler did not serve the copy within 60 s');
        await new Promise((r) => setTimeout(r, 500));
      }
      return run(process.execPath, ['scripts/nimbus/route-fixtures.mjs', 'check', base, '--scope', 'poc'], ROOT);
    } finally {
      process.kill(-child.pid, 'SIGTERM');
      await new Promise((r) => child.once('exit', r));
      for (const until = Date.now() + 30000; await fetch(base + '/').then(() => true, () => false);) {
        if (Date.now() > until) throw new Error(`port ${port} still serves 30 s after stopping wrangler`);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  };
  const swap = (rel, fn) => { const file = path.join(dist, rel); const before = fs.readFileSync(file); return { inject: () => fn(file), restore: () => fs.writeFileSync(file, before) }; };
  try {
    if (which === 'route') {
      const { inject, restore } = swap('installation/roocode/index.html', (f) => fs.rmSync(f));
      await mutant('route: /installation/roocode/ removed', 'route-fixtures.mjs check --scope poc', { check, inject, restore, expect: /\/installation\/roocode\/: status \d+, expected 200/ });
    } else {
      const { inject, restore } = swap('installation/claude-code/index.html', (f) => fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replaceAll('id="coding-model-ids"', 'id="coding-model-ids-renamed"')));
      await mutant('anchor: #coding-model-ids removed from /installation/claude-code/', 'route-fixtures.mjs check --scope poc', { check, inject, restore, expect: /\/installation\/claude-code\/: missing anchor #coding-model-ids/ });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (only.includes('activation')) await activation();
if (only.includes('exclusion')) await exclusion();
if (only.includes('wire')) await wire();
if (only.includes('route')) await served('route');
if (only.includes('anchor')) await served('anchor');

const result = { ranAt: new Date().toISOString(), mutants: rows, detected: rows.filter((r) => r.result === 'DETECTED').length, total: rows.length };
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(result, null, 2) + '\n');
console.log(`gate-mutants: ${result.detected}/${result.total} regressions detected`);
process.exit(result.total > 0 && result.detected === result.total ? 0 : 1);
