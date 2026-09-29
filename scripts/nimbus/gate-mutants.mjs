// Gate mutants for the Nimbus PR gates (issue #12, acceptance criterion 1).
//
//   node scripts/nimbus/gate-mutants.mjs [--only activation,exclusion,wire,route,anchor,policy,preflight,real,perfgate] [--port 8805] [--out result.json]
//
// For every mutant: the gate passes on the pristine input, fails for the injected reason (the failure
// output must name it) with the regression injected, and passes again after the input is restored.
// - activation: hermetic temp copy of the guard's inputs, one injection per scanned root.
// - route, anchor: temp copy of site-nimbus/dist served by `wrangler pages dev` on --port (it must be
//   free: stop your preview first), checked with route-fixtures.mjs --scope poc.
// - exclusion: in place in site-nimbus/dist (test:dist reads that fixed path), restored in `finally`.
// - wire: in place in migration/nimbus/fixtures/ask-wire.json, restored in `finally` and verified by hash.
// - policy: a temp copy of the nimbus workflows and the README, checked by workflow-policy.mjs.
// - preflight: isolated-preflight.mjs with a synthetic, secret-free environment.
// - real: real-evidence.mjs judgement over synthetic isolated-run facts (no network).
// - perfgate: paired-perf.mjs gate over synthetic samples at the recorded baseline (no browser).
// The result names the HEAD commit and the manifest buildId it ran against.
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
const only = opt('only', 'activation,exclusion,wire,route,anchor,policy,preflight,real,perfgate').split(',');
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
  // /blog/first-blog-post is retired by the decision on #4 (#13): never publishable. (Until #13 this case
  // used /help/ideas, which the full-corpus manifest now publishes.)
  const cases = [
    ['retired document Markdown published (blog/first-blog-post.md)', expose('blog/first-blog-post.md', fs.readFileSync(path.join(ROOT, 'blog/2019-05-28-first-blog-post.md'), 'utf8')), /blog\/first-blog-post\.md/],
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

// ---- paired-perf gate: synthetic samples at the recorded baseline (no browser) --------------------------
async function perfgate() {
  const budgets = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/budgets.json'), 'utf8'));
  const buildId = JSON.parse(fs.readFileSync(path.join(SITE, 'src/manifest/manifest.json'), 'utf8')).buildId;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-perfgate-'));
  const file = path.join(tmp, 'samples.json');
  const good = () => {
    const samples = [];
    for (const page of budgets.protocol.pages) for (const profile of Object.keys(budgets.protocol.profiles)) for (let run = 0; run < budgets.protocol.runs; run++) {
      for (const site of ['legacy', 'candidate']) {
        samples.push({ site, page, profile, run, served: site === 'candidate' ? { build: buildId, mainBundle: null } : { build: null, mainBundle: 'main.333b8d31.js' },
          metrics: { ...budgets.baseline.gatedBytes[profile][page], lcp: 500, tbt: 10, searchOpenMs: 50, keyboardFocus: 1, unreadableResponses: 0 } });
      }
    }
    return { legacy: 'legacy', candidate: 'candidate', runs: budgets.protocol.runs, startedAt: 'synthetic', finishedAt: 'synthetic', samples };
  };
  const write = (d) => fs.writeFileSync(file, JSON.stringify(d));
  const check = () => run(process.execPath, ['scripts/nimbus/paired-perf.mjs', 'gate', file, '--build-id', buildId, '--out', path.join(tmp, 'out.json')], ROOT);
  const set = (fn) => ({ inject: () => { const d = good(); fn(d); write(d); }, restore: () => write(good()) });
  write(good());
  const page = budgets.protocol.pages[3];
  const cases = [
    ['one page missing', set((d) => { d.samples = d.samples.filter((x) => x.page !== page); }), new RegExp(`${page.replace(/\//g, '\\/')}: 0 legacy and 0 candidate samples`)],
    ['one profile missing', set((d) => { d.samples = d.samples.filter((x) => x.profile !== 'mobile'); }), /mobile .*: 0 legacy and 0 candidate samples/],
    ['a candidate run missing', set((d) => { d.samples.splice(d.samples.findIndex((x) => x.site === 'candidate'), 1); }), /4 candidate samples, protocol requires 5/],
    ['no samples', set((d) => { d.samples = []; }), /no samples/],
    ['candidate served another build', set((d) => { d.samples.find((x) => x.site === 'candidate').served.build = 'deadbeef.000000000000'; }), /candidate samples served buildId .*deadbeef/],
    ['candidate build unrecorded', set((d) => { for (const x of d.samples) delete x.served; }), /candidate samples served buildId \[null\]/],
    ['legacy server changed mid-run', set((d) => { d.samples.find((x) => x.site === 'legacy').served.mainBundle = 'main.9321920d.js'; }), /legacy samples served main bundles/],
    ['page outside the frozen set', set((d) => { d.samples.push({ ...d.samples[0], page: '/extra/' }); }), /outside budgets.protocol.pages: \/extra\//],
    ['byte budget exceeded', set((d) => { for (const x of d.samples) if (x.site === 'candidate' && x.page === page && x.profile === 'desktop') x.metrics.jsGzip += 1; }), /jsGzip: candidate median .* > recorded legacy median/],
    ['timing budget exceeded', set((d) => { for (const x of d.samples) if (x.site === 'candidate' && x.page === page && x.profile === 'mobile') x.metrics.lcp = 600; }), /lcp: candidate median 600 > max\(500 x 1.10, 500 \+ 50\)/],
  ];
  try {
    for (const [name, { inject, restore }, expect] of cases) await mutant(`perfgate: ${name}`, 'paired-perf.mjs gate', { check, inject, restore, expect });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- workflow policy: mutated copies of the two workflows and the README ------------------------------
async function policy() {
  const { checkWorkflows } = await import('./workflow-policy.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-policy-'));
  const files = ['.github/workflows/nimbus-pr-gates.yml', '.github/workflows/nimbus-isolated.yml', 'migration/nimbus/acceptance/README.md'];
  for (const rel of files) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel)); }
  const check = () => { const r = checkWorkflows(tmp, { gitRoot: ROOT, yamlFrom: ROOT }); return { status: r.failures.length ? 1 : 0, output: r.failures.join('\n') }; };
  const edit = (rel, fn) => { let before; return { inject: () => { before = fs.readFileSync(path.join(tmp, rel), 'utf8'); const after = fn(before); if (after === before) throw new Error(`mutation did not apply to ${rel}`); fs.writeFileSync(path.join(tmp, rel), after); }, restore: () => fs.writeFileSync(path.join(tmp, rel), before) }; };
  const iso = '.github/workflows/nimbus-isolated.yml', pr = '.github/workflows/nimbus-pr-gates.yml';
  const cases = [
    ['activation pipe without pipefail (no default shell)', edit(iso, (t) => t.replace('    shell: bash --noprofile --norc -euo pipefail {0}\n', '    shell: bash {0}\n')), /pipe without pipefail/],
    ['PR multi-line step without errexit', edit(pr, (t) => t.replace('    shell: bash --noprofile --norc -euo pipefail {0}\n', '    shell: bash {0}\n')), /multi-line run without errexit/],
    ['unpinned action', edit(pr, (t) => t.replace(/actions\/setup-node@[0-9a-f]{40} # v4/, 'actions/setup-node@v4')), /actions\/setup-node@v4 is not pinned/],
    ['pull_request_target', edit(pr, (t) => t.replace('  pull_request:\n', '  pull_request_target:\n')), /pull_request_target/],
    ['write permission', edit(pr, (t) => t.replace('contents: read', 'contents: write')), /permissions must be exactly contents: read/],
    ['indexer path filter removed', edit(pr, (t) => t.replace("      - 'indexer/**'\n", '')), /paths miss indexer\/\*\*/],
    ['isolated environment removed', edit(iso, (t) => t.replace('    environment: nimbus-isolated\n', '')), /not bound to the nimbus-isolated environment/],
    ['preflight not run', edit(iso, (t) => t.replace('          node scripts/nimbus/isolated-preflight.mjs\n', '')), /does not run isolated-preflight/],
    ['production project ref not fail-closed', edit(iso, (t) => t.replace('          : "${NIMBUS_PRODUCTION_PROJECT_REF:?variable NIMBUS_PRODUCTION_PROJECT_REF is missing}"\n', '')), /fail closed on NIMBUS_PRODUCTION_PROJECT_REF/],
    ['README drops the protected-branch rule', edit('migration/nimbus/acceptance/README.md', (t) => t.replace('restrict deployment\n  branches to protected branches', 'limit deployments')), /README does not require/],
  ];
  try {
    for (const [name, { inject, restore }, expect] of cases) await mutant(`policy: ${name}`, 'workflow-policy.mjs', { check, inject, restore, expect });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- isolated preflight: synthetic environment, no secret values ---------------------------------------
async function preflight() {
  const ref = 'abcdefghijklmnopqrst', prodRef = 'zyxwvutsrqponmlkjihg';
  const good = {
    TARGET_URL: 'https://nimbus-isolated.example.org/', NIMBUS_ISOLATED_HOST: 'nimbus-isolated.example.org.', GEN_ENV: 'preview', PREVIEW_GEN_ENV: 'preview',
    ACTIVATE: 'true', ALREADY_ACTIVE: 'false', SUPABASE_URL: `https://${ref}.supabase.co`, DATABASE_URL: `postgresql://postgres.${ref}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    NIMBUS_PRODUCTION_PROJECT_REF: prodRef,
  };
  let env = { ...good };
  const check = () => run(process.execPath, ['scripts/nimbus/isolated-preflight.mjs'], ROOT, Object.fromEntries(Object.keys(good).map((k) => [k, env[k] ?? ''])));
  const set = (patch) => ({ inject: () => { env = { ...good, ...patch }; }, restore: () => { env = { ...good }; } });
  const cases = [
    ['target host not the allowlisted host', set({ TARGET_URL: 'https://other.example.org/' }), /not the allowlisted NIMBUS_ISOLATED_HOST/],
    ['production host even when allowlisted', set({ TARGET_URL: 'https://docs.apertis.ai/', NIMBUS_ISOLATED_HOST: 'docs.apertis.ai' }), /production host/],
    ['production pages.dev deployment host', set({ TARGET_URL: 'https://2efbe4c4.docs-2r1.pages.dev/', NIMBUS_ISOLATED_HOST: '2efbe4c4.docs-2r1.pages.dev' }), /production host/],
    ['0.0.0.0 target', set({ TARGET_URL: 'https://0.0.0.0/', NIMBUS_ISOLATED_HOST: '0.0.0.0' }), /loopback or unspecified/],
    ['allowlist unset', set({ NIMBUS_ISOLATED_HOST: '' }), /NIMBUS_ISOLATED_HOST is not set/],
    ['database and Supabase URL in different projects', set({ DATABASE_URL: `postgresql://postgres:x@db.${prodRef.replace('z', 'y')}.supabase.co:5432/postgres` }), /different projects/],
    ['isolated project is production', set({ SUPABASE_URL: `https://${prodRef}.supabase.co`, DATABASE_URL: `postgresql://postgres:x@db.${prodRef}.supabase.co:5432/postgres` }), /is the production project/],
    ['production project ref unset', set({ NIMBUS_PRODUCTION_PROJECT_REF: '' }), /NIMBUS_PRODUCTION_PROJECT_REF is not set/],
    ['generation environment differs from the preview', set({ PREVIEW_GEN_ENV: 'staging' }), /differs from the preview/],
    ['neither activation nor confirmation', set({ ACTIVATE: 'false', ALREADY_ACTIVE: 'false' }), /activate_generation or an explicit/],
    ['http target', set({ TARGET_URL: 'http://nimbus-isolated.example.org/' }), /must be https/],
  ];
  for (const [name, { inject, restore }, expect] of cases) await mutant(`preflight: ${name}`, 'isolated-preflight.mjs', { check, inject, restore, expect });
}

// ---- real-* judgement: synthetic facts ------------------------------------------------------------------
async function real() {
  const { judgeReal, DUMMY_TOKEN } = await import('./real-evidence.mjs');
  const buildId = JSON.parse(fs.readFileSync(path.join(SITE, 'src/manifest/manifest.json'), 'utf8')).buildId;
  const good = () => ({
    manifestBuildId: buildId, servedBuildId: buildId, testkeyServedBuildId: buildId, generationEnvironment: 'preview', previewGenerationEnvironment: 'preview', activeGenerationId: 42,
    receipt: { generationId: 42, generationState: 'ready', buildId, documents: { failed: 0, pending: 0 }, items: [{ urlPath: '/authentication/api-keys' }, { urlPath: '/getting-started/quick-start' }] },
    enforcement: { sitekey: '0x4AAAAAACS2SzpYBFytHb_E', missing: { status: 400, error: 'Missing Turnstile token' }, forged: { status: 403, error: 'Turnstile verification failed', codes: ['invalid-input-response'] } },
    probe: { ok: true, sources: ['/authentication/api-keys'], record: { sitekey: '1x00000000000000000000AA', tokenSent: true, dummyToken: true, status: 200 } },
  });
  let facts = good();
  const entries = ['real-assistant', 'real-turnstile', 'real-indexing'];
  // Pass only when all three entries PASS; the output lists each verdict and its reasons.
  const check = () => {
    const v = entries.map((e) => [e, judgeReal(e, facts)]);
    return { status: v.every(([, x]) => x.status === 'PASS') ? 0 : 1, output: v.map(([e, x]) => `${e} ${x.status}: ${x.reasons.join('; ')}`).join('\n') };
  };
  const set = (fn) => ({ inject: () => { facts = good(); fn(facts); }, restore: () => { facts = good(); } });
  const cases = [
    ['real-key preview serves another buildId', set((f) => { f.servedBuildId = 'deadbeef.000000000000'; }), /real-turnstile FAIL: real-key isolated preview serves buildId deadbeef/],
    ['test-key preview serves another buildId', set((f) => { f.testkeyServedBuildId = 'deadbeef.000000000000'; }), /real-assistant FAIL: test-key isolated preview serves buildId deadbeef/],
    ['preview build meta missing', set((f) => { f.testkeyServedBuildId = null; }), /real-indexing FAIL: test-key isolated preview serves buildId null/],
    ['another generation is active', set((f) => { f.activeGenerationId = 41; }), /real-assistant FAIL: .*active generation 41 is not the receipt's 42/],
    ['no generation active', set((f) => { f.activeGenerationId = 'none'; }), /active generation none is not the receipt's 42/],
    ['active generation unreadable', set((f) => { f.activeGenerationId = null; }), /real-indexing BLOCKED: active generation could not be read/],
    ['preview reads another environment', set((f) => { f.previewGenerationEnvironment = 'staging'; }), /indexed environment preview is not the preview's staging/],
    ['citation outside the generation', set((f) => { f.probe.sources = ['/billing/payg']; }), /real-indexing FAIL: .*citations .* are not all documents of the generation/],
    ['Turnstile test sitekey on the real-key preview', set((f) => { f.enforcement.sitekey = '1x00000000000000000000AA'; }), /real-turnstile FAIL: Turnstile test sitekey .* on the real-key preview/],
    ['real-key sitekey not observed', set((f) => { f.enforcement.sitekey = undefined; }), /real-turnstile BLOCKED: Turnstile sitekey not observed on the real-key preview/],
    ['a request without a token is answered', set((f) => { f.enforcement.missing = { status: 200 }; }), /real-turnstile FAIL: a request without a token answered 200/],
    ['a forged token is accepted', set((f) => { f.enforcement.forged = { status: 200 }; }), /real-turnstile FAIL: a forged token answered 200/],
    ['a forged token is rejected without siteverify', set((f) => { f.enforcement.forged.codes = []; }), /real-turnstile FAIL: a forged token was not rejected by Cloudflare siteverify/],
    ['forged-token request not observed', set((f) => { f.enforcement.forged = undefined; }), /real-turnstile BLOCKED: no request with a forged token was observed/],
    ['assistant probe with the real sitekey', set((f) => { f.probe.record.sitekey = '0x4AAAAAACS2SzpYBFytHb_E'; }), /real-assistant FAIL: the assistant probe used sitekey 0x4AAAAAACS2SzpYBFytHb_E/],
    ['assistant probe without the dummy token', set((f) => { f.probe.record.dummyToken = false; }), /real-indexing FAIL: the assistant probe did not send the always-pass dummy token/],
    ['receipt generation not ready', set((f) => { f.receipt.generationState = 'failed'; }), /real-indexing FAIL: .*receipt generation is not ready/],
  ];
  if (DUMMY_TOKEN !== 'XXXX.DUMMY.TOKEN.XXXX') throw new Error('dummy token constant changed');
  for (const [name, { inject, restore }, expect] of cases) await mutant(`real: ${name}`, 'real-evidence.mjs judgeReal', { check, inject, restore, expect });
}

if (only.includes('activation')) await activation();
if (only.includes('exclusion')) await exclusion();
if (only.includes('wire')) await wire();
if (only.includes('route')) await served('route');
if (only.includes('anchor')) await served('anchor');
if (only.includes('policy')) await policy();
if (only.includes('preflight')) await preflight();
if (only.includes('real')) await real();
if (only.includes('perfgate')) await perfgate();

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const buildId = JSON.parse(fs.readFileSync(path.join(SITE, 'src/manifest/manifest.json'), 'utf8')).buildId;
const result = { ranAt: new Date().toISOString(), candidateSha: head, buildId, only, mutants: rows, detected: rows.filter((r) => r.result === 'DETECTED').length, total: rows.length };
if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(result, null, 2) + '\n');
console.log(`gate-mutants: ${result.detected}/${result.total} regressions detected`);
process.exit(result.total > 0 && result.detected === result.total ? 0 : 1);
