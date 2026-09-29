// PoC acceptance matrix for the Docusaurus -> Nimbus migration (issue #12).
//
//   PLAYWRIGHT=<playwright/index.mjs or scripts/nimbus/playwright-channel.mjs> \
//   node scripts/nimbus/acceptance.mjs --sha <candidate commit> --preview <candidate preview origin>
//     [--perf <paired-perf result.json> ...] [--mutants <gate-mutants result.json>]
//     [--indexer-receipt <receipt.json>] [--only id,id] [--out records.jsonl] [--artifacts <dir>]
//
// Emits one JSON record per matrix entry (migration/nimbus/acceptance/matrix.json): PASS, FAIL or
// BLOCKED, with the evidence class, the commands and their exit status, the candidate commit, the
// manifest and served buildId, the environment and artifact identities (hashes). Records carry no
// secret, no internal hostname and no home or temp path. BLOCKED means the proof could not be taken
// here; it is never counted as passed. isolated-real entries are BLOCKED unless their operator-configured
// isolated preview is named: NIMBUS_ISOLATED_URL (real Turnstile keys) for real-turnstile, and
// NIMBUS_ISOLATED_ALWAYS_PASS_URL (Cloudflare's always-pass test secret, same build and generation) for
// real-assistant and real-indexing (see scripts/nimbus/real-evidence.mjs and nimbus-isolated.yml).
// Exit status: 0 when no entry FAILs, 1 when any does, 2 on a usage or identity error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ALWAYS_PASS_SITEKEY, DUMMY_TOKEN, judgeReal } from './real-evidence.mjs';
import { checkWorkflows } from './workflow-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SITE = path.join(ROOT, 'site-nimbus');
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/acceptance/matrix.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const opts = (name) => { const out = []; for (let v; (v = opt(name)) !== undefined;) out.push(v); return out; };
const sha = opt('sha');
const preview = opt('preview')?.replace(/\/$/, '');
const perfFiles = opts('perf');
const perfFullFiles = opts('perf-full');
const mutantsFile = opt('mutants');
const receiptFile = opt('indexer-receipt');
const generationEnvironment = opt('generation-environment');
const previewGenerationEnvironment = opt('preview-generation-environment');
const only = opt('only')?.split(',');
const outFile = opt('out');
const isolated = process.env.NIMBUS_ISOLATED_URL?.replace(/\/$/, '');
const testkeyIsolated = process.env.NIMBUS_ISOLATED_ALWAYS_PASS_URL?.replace(/\/$/, '');
const artifacts = path.resolve(opt('artifacts') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'nimbus-acceptance-')));
fs.mkdirSync(artifacts, { recursive: true });
if (!sha) { console.error('usage: acceptance.mjs --sha <candidate commit> [--preview <origin>] [...]'); process.exit(2); }

// ---- redaction: no secrets, internal hostnames, home or temp paths in records or kept logs ----------
const SECRET_VALUES = Object.entries(process.env)
  .filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|SUPABASE_URL/i.test(k) && v && v.length >= 8)
  .map(([k, v]) => [v, `<redacted:${k}>`]);
const INTERNAL_NAMES = [...new Set([os.hostname(), os.hostname().replace(/\.local$/, '')])].filter((h) => h.length > 2);
const publicHost = (h) => /^(localhost|127(\.\d+){3}|\[::1\])$/.test(h) || (/[a-z]\.[a-z]/i.test(h) && !/\.(local|lan|internal|home|ts\.net)$/i.test(h));
function redact(text) {
  let s = String(text);
  for (const [v, label] of SECRET_VALUES) s = s.replaceAll(v, label);
  s = s.replace(/\b(https?):\/\/([^/\s:'"<>)]+)(:\d+)?/g, (m, scheme, host, port = '') => (publicHost(host) ? m : `${scheme}://<internal-host>${port}`));
  for (const h of INTERNAL_NAMES) s = s.replaceAll(h, '<internal-host>');
  return s.replaceAll(artifacts, '<artifacts>').replaceAll(ROOT, '<repo>').replaceAll(os.homedir(), '~')
    .replace(/(?:\/private)?\/(?:tmp|var\/folders)\/[^\s'"`)]*/g, '<tmp>');
}

// ---- identity -----------------------------------------------------------------------------------------
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const head = git('rev-parse', 'HEAD');
if (!head.startsWith(sha)) { console.error(`HEAD ${head} is not the named candidate ${sha}`); process.exit(2); }
const dirty = git('status', '--porcelain', '--untracked-files=no');
if (dirty) { console.error(`the candidate tree has tracked changes:\n${dirty}`); process.exit(2); }
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const manifestPath = path.join(SITE, 'src/manifest/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const distDir = path.join(SITE, 'dist');
function treeSha(dir) {
  if (!fs.existsSync(dir)) return null;
  const h = crypto.createHash('sha256');
  for (const f of fs.readdirSync(dir, { recursive: true }).map(String).sort()) {
    const abs = path.join(dir, f);
    if (fs.statSync(abs).isFile()) h.update(`${f}\0`).update(fs.readFileSync(abs)).update('\0');
  }
  return h.digest('hex');
}
const buildMeta = (html) => html?.match(/<meta name="apertis-docs:build" content="([^"]*)"/)?.[1] ?? null;
const distBuildId = fs.existsSync(path.join(distDir, 'index.html')) ? buildMeta(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')) : null;
const servedBuildId = preview ? await fetch(preview + '/').then((r) => r.text()).then(buildMeta, () => null) : null;
const identity = {
  candidateSha: head,
  buildId: manifest.buildId,
  sourceSha: manifest.sourceSha,
  distBuildId,
  servedBuildId,
  artifacts: {
    manifestSha256: sha256(fs.readFileSync(manifestPath)),
    distSha256: treeSha(distDir),
    routeFixturesSha256: sha256(fs.readFileSync(path.join(ROOT, 'migration/nimbus/route-fixtures.json'))),
    searchQueriesSha256: sha256(fs.readFileSync(path.join(ROOT, 'migration/nimbus/search-queries.json'))),
    budgetsSha256: sha256(fs.readFileSync(path.join(ROOT, 'migration/nimbus/budgets.json'))),
    askWireSha256: sha256(fs.readFileSync(path.join(ROOT, 'migration/nimbus/fixtures/ask-wire.json'))),
  },
};
const environment = {
  runner: process.env.CI ? 'ci' : 'local',
  platform: `${os.platform()}-${os.arch()}`,
  node: process.version,
  preview: preview ? redact(preview) : null,
  browserChannel: process.env.PLAYWRIGHT_CHANNEL ?? 'caller default (system Chrome)',
  isolated: isolated ? redact(isolated) : null,
  testkeyIsolated: testkeyIsolated ? redact(testkeyIsolated) : null,
};

// ---- command runners ---------------------------------------------------------------------------------
const browserEnv = { PREVIEW_URL: preview ?? '', PLAYWRIGHT: process.env.PLAYWRIGHT ?? '' };
let logSeq = 0;
function exec(label, cmd, argv, cwd, env = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
  const log = redact(`${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`);
  const file = `${String(++logSeq).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-')}.log`;
  fs.writeFileSync(path.join(artifacts, file), log);
  return {
    step: { command: redact([cmd === process.execPath ? 'node' : cmd, ...argv].join(' ')), cwd: path.relative(ROOT, cwd) || '.', exitCode: r.status, durationMs: Date.now() - t0, log: file, logSha256: sha256(log) },
    stdout: r.stdout ?? '', log,
  };
}

// node --test with the spec reporter; per-test results parsed from the output.
const SUITES = {
  routes: { cwd: SITE, argv: ['--test', '--test-reporter=spec', 'test/routes.check.ts'], env: browserEnv, needs: ['preview'] },
  dist: { cwd: SITE, argv: ['--test', '--test-reporter=spec', 'test/dist.check.ts'] },
  unit: { cwd: SITE, argv: ['--test', '--test-reporter=spec', ...fs.readdirSync(path.join(SITE, 'test')).filter((f) => f.endsWith('.test.ts') && !['m3-browser.test.ts', 'm4-e2e.test.ts'].includes(f)).sort().map((f) => `test/${f}`)] },
  wire: { cwd: SITE, argv: ['--test', '--test-reporter=spec', 'test/m4-wire.test.ts'] },
  m3: { cwd: SITE, argv: ['--test', '--test-reporter=spec', 'test/m3-browser.test.ts'], env: browserEnv, needs: ['preview', 'playwright'] },
  m4: { cwd: SITE, argv: ['--test', '--test-reporter=spec', 'test/m4-e2e.test.ts'], env: browserEnv, needs: ['preview', 'playwright'] },
  assistantContract: { cwd: ROOT, argv: ['--test', '--test-reporter=spec', '--test-timeout=10000', 'assistant/test/contract.test.ts'] },
  assistantCompat: { cwd: ROOT, argv: ['--test', '--test-reporter=spec', '--test-timeout=10000', 'assistant/test/compat.test.ts'] },
  assistantFailure: { cwd: ROOT, argv: ['--test', '--test-reporter=spec', '--test-timeout=10000', 'assistant/test/failure.test.ts'] },
  assistantRetrieval: { cwd: ROOT, argv: ['--test', '--test-reporter=spec', '--test-timeout=10000', ...fs.readdirSync(path.join(ROOT, 'assistant/test')).filter((f) => /^retrieval.*\.test\.ts$/.test(f)).map((f) => `assistant/test/${f}`)] },
  newClientOldServer: { cwd: ROOT, argv: ['--test', '--test-reporter=spec', '--test-timeout=20000', 'migration/nimbus/acceptance/new-client-old-server.test.ts'] },
  indexer: { cwd: path.join(ROOT, 'indexer'), argv: ['--test', '--test-reporter=spec', '--test-timeout=120000', 'test/*.test.ts'], needs: ['indexer'] },
};
const have = {
  preview: () => !!preview && servedBuildId === manifest.buildId,
  playwright: () => !!process.env.PLAYWRIGHT,
  indexer: () => fs.existsSync(path.join(ROOT, 'indexer/package.json')) && fs.existsSync(path.join(ROOT, 'indexer/node_modules')),
};
const missing = (needs = []) => needs.filter((n) => !have[n]());
const WHY = { preview: 'no preview serving this candidate (--preview, and its buildId must equal the manifest)', playwright: 'PLAYWRIGHT is not set', indexer: 'indexer/ is absent or not installed' };
const suiteCache = {};
function suite(key) {
  if (suiteCache[key]) return suiteCache[key];
  const s = SUITES[key];
  const { step, stdout } = exec(`suite-${key}`, process.execPath, s.argv, s.cwd, s.env);
  const tests = [];
  for (const line of stdout.split('\n')) {
    const m = line.match(/^\s*(✔|✖|﹣)\s+(.*?)(?:\s+#\s+SKIP.*?)?\s+\([\d.]+m?s\)\s*$/);
    if (m) tests.push({ name: m[2], ok: m[1] === '✔' && !/# SKIP/.test(line), skipped: m[1] === '﹣' || /# SKIP/.test(line) });
  }
  const count = (k) => Number(stdout.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm'))?.[1] ?? NaN);
  step.counts = { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), cancelled: count('cancelled'), todo: count('todo') };
  return (suiteCache[key] = { step, tests });
}

// ---- matrix steps ------------------------------------------------------------------------------------
// Each step returns { status, reason, steps: [...] }. PASS requires real, non-skipped passing tests.
function suiteStep({ suite: key, match }) {
  const why = missing(SUITES[key].needs);
  if (why.length) return { status: 'BLOCKED', reason: why.map((w) => WHY[w]).join('; '), steps: [] };
  const { step, tests } = suite(key);
  if (!match) {
    const c = step.counts;
    const ok = step.exitCode === 0 && c.tests > 0 && c.fail === 0 && c.skipped === 0 && c.cancelled === 0 && c.todo === 0;
    return { status: ok ? 'PASS' : 'FAIL', reason: `${c.pass}/${c.tests} passed, ${c.fail} failed, ${c.skipped} skipped, ${c.cancelled} cancelled`, steps: [step] };
  }
  const problems = [];
  const used = [];
  for (const pattern of match) {
    const re = new RegExp(pattern);
    const hits = tests.filter((t) => re.test(t.name));
    if (!hits.length) problems.push(`no test matches /${pattern}/`);
    for (const t of hits) { used.push(t.name); if (!t.ok) problems.push(`${t.skipped ? 'skipped' : 'failed'}: ${t.name}`); }
  }
  return { status: problems.length ? 'FAIL' : 'PASS', reason: problems.length ? problems.join('; ') : `${used.length} named tests passed`, steps: [{ ...step, tests: used }] };
}

function exitStep(label, cmd, argv, cwd, env, needs) {
  const why = missing(needs);
  if (why.length) return { status: 'BLOCKED', reason: why.map((w) => WHY[w]).join('; '), steps: [] };
  const { step, log } = exec(label, cmd, argv, cwd, env);
  const lines = log.trim().split('\n').filter(Boolean);
  const summary = lines.findLast((l) => /\b(passed|detected|without failure|errors?|failures?)\b/i.test(l)) ?? lines.at(-1) ?? '';
  return { status: step.exitCode === 0 ? 'PASS' : 'FAIL', reason: summary.slice(0, 300), steps: [step] };
}

const CUSTOM = {
  identity() {
    const problems = [];
    if (manifest.buildId !== distBuildId) problems.push(`dist buildId ${distBuildId} != manifest ${manifest.buildId}`);
    if (preview && servedBuildId !== manifest.buildId) problems.push(`served buildId ${servedBuildId} != manifest ${manifest.buildId}`);
    if (!preview) problems.push('no --preview');
    return { status: problems.length ? (preview ? 'FAIL' : 'BLOCKED') : 'PASS', reason: problems.join('; ') || `HEAD, manifest, dist and served buildId agree (${manifest.buildId})`, steps: [] };
  },
  fixtures() {
    const r = exitStep('route-fixtures', process.execPath, ['scripts/nimbus/route-fixtures.mjs', 'check', preview ?? '', '--scope', 'poc'], ROOT, {}, ['preview']);
    if (!r.steps.length) return r;
    // Per-path result, so every PoC page is readable from the record itself.
    const log = fs.readFileSync(path.join(artifacts, r.steps[0].log), 'utf8');
    const failed = new Set([...log.matchAll(/^- (\S+?): /gm)].map((m) => m[1]));
    const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/route-fixtures.json'), 'utf8')).routes.filter((f) => f.scope === 'poc');
    r.steps[0].result = fixtures.map((f) => ({ path: f.path, status: f.status, anchors: f.anchors?.length ?? 0, pass: !failed.has(f.path) }));
    return r;
  },
  // #13 full corpus: every inventory route, not just the 26 tagged `poc` (228/228, `pocCoverageLimits`
  // does not apply outside the PoC scope). Reuses the same gate, only the `--scope` flag is dropped.
  fixturesFull() {
    const r = exitStep('route-fixtures-full', process.execPath, ['scripts/nimbus/route-fixtures.mjs', 'check', preview ?? ''], ROOT, {}, ['preview']);
    if (!r.steps.length) return r;
    const log = fs.readFileSync(path.join(artifacts, r.steps[0].log), 'utf8');
    const failed = new Set([...log.matchAll(/^- (\S+?): /gm)].map((m) => m[1]));
    const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/route-fixtures.json'), 'utf8')).routes;
    r.steps[0].result = fixtures.map((f) => ({ path: f.path, status: f.status, anchors: f.anchors?.length ?? 0, pass: !failed.has(f.path) }));
    return r;
  },
  guard: () => exitStep('activation-guard', process.execPath, ['scripts/check-developer-activation.mjs'], ROOT),
  typecheck: () => exitStep('typecheck', 'npm', ['run', 'typecheck'], SITE),
  search() {
    const why = missing(['preview', 'playwright']);
    if (why.length) return { status: 'BLOCKED', reason: why.map((w) => WHY[w]).join('; '), steps: [] };
    const { step, stdout } = exec('search', process.execPath, ['scripts/nimbus/measure.mjs', 'search', preview, '--scope', 'poc'], ROOT);
    let r;
    try { r = JSON.parse(stdout); } catch { return { status: 'FAIL', reason: 'measure.mjs search produced no result', steps: [step] }; }
    const passed = r.rows.filter((x) => x.pass).length;
    const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/search-queries.json'), 'utf8')).queries.filter((q) => q.scope === 'poc').length;
    const ok = step.exitCode === 0 && r.rows.length === expected && passed === expected && r.keyboardFocus === true;
    step.result = { passed, of: r.rows.length, keyboardFocus: r.keyboardFocus, retyped: r.retyped, failing: r.rows.filter((x) => !x.pass).map((x) => ({ q: x.q, top3: x.top3 })) };
    return { status: ok ? 'PASS' : 'FAIL', reason: `${passed}/${expected} PoC queries in the top 3, keyboardFocus ${r.keyboardFocus}`, steps: [step] };
  },
  // #13 full corpus: all 24 queries (`search-queries.json`), not just the 14 tagged `poc`. Ranking over
  // the wider corpus is a separate repair (#9); this entry may legitimately FAIL until that lands.
  searchFull() {
    const why = missing(['preview', 'playwright']);
    if (why.length) return { status: 'BLOCKED', reason: why.map((w) => WHY[w]).join('; '), steps: [] };
    const { step, stdout } = exec('search-full', process.execPath, ['scripts/nimbus/measure.mjs', 'search', preview], ROOT);
    let r;
    try { r = JSON.parse(stdout); } catch { return { status: 'FAIL', reason: 'measure.mjs search produced no result', steps: [step] }; }
    const passed = r.rows.filter((x) => x.pass).length;
    const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/search-queries.json'), 'utf8')).queries.length;
    const ok = step.exitCode === 0 && r.rows.length === expected && passed === expected && r.keyboardFocus === true;
    step.result = { passed, of: r.rows.length, keyboardFocus: r.keyboardFocus, retyped: r.retyped, failing: r.rows.filter((x) => !x.pass).map((x) => ({ q: x.q, top3: x.top3 })) };
    return { status: ok ? 'PASS' : 'FAIL', reason: `${passed}/${expected} full-corpus queries in the top 3, keyboardFocus ${r.keyboardFocus}`, steps: [step] };
  },
  perf() {
    if (!perfFiles.length) return { status: 'BLOCKED', reason: 'no paired-perf result supplied (--perf); run scripts/nimbus/paired-perf.mjs', steps: [] };
    const merged = path.join(artifacts, 'paired-perf-merged.json');
    const { step, log } = exec('paired-perf-gate', process.execPath, ['scripts/nimbus/paired-perf.mjs', 'gate', ...perfFiles.map((f) => path.resolve(f)), '--build-id', manifest.buildId, '--out', merged], ROOT);
    const r = JSON.parse(fs.readFileSync(merged, 'utf8'));
    step.inputsSha256 = perfFiles.map((f) => sha256(fs.readFileSync(f)));
    step.result = { pages: r.pages.length, samples: r.samples.length, gated: r.gates.length, withinBudget: r.gates.filter((g) => g.pass).length, failures: r.failures.map(redact), window: [r.startedAt, r.finishedAt] };
    return { status: step.exitCode === 0 ? 'PASS' : 'FAIL', reason: log.trim().split('\n').at(-1), steps: [step] };
  },
  // #13 full corpus (`--set full`, `budgets.json` `fullCorpus`). `paired-perf.mjs gate` already fails
  // closed with "no recorded byte baseline" while `fullCorpus.baseline` is null, so this is BLOCKED
  // (no --perf-full supplied) or FAIL (supplied but ungated) until that baseline is recorded; it can
  // never PASS before then, with no special-casing needed here.
  perfFull() {
    if (!perfFullFiles.length) return { status: 'BLOCKED', reason: 'no full-corpus paired-perf result supplied (--perf-full); run scripts/nimbus/paired-perf.mjs ... --set full', steps: [] };
    const merged = path.join(artifacts, 'paired-perf-full-merged.json');
    const { step, log } = exec('paired-perf-gate-full', process.execPath, ['scripts/nimbus/paired-perf.mjs', 'gate', ...perfFullFiles.map((f) => path.resolve(f)), '--build-id', manifest.buildId, '--set', 'full', '--out', merged], ROOT);
    const r = JSON.parse(fs.readFileSync(merged, 'utf8'));
    step.inputsSha256 = perfFullFiles.map((f) => sha256(fs.readFileSync(f)));
    step.result = { pages: r.pages.length, samples: r.samples.length, gated: r.gates.length, withinBudget: r.gates.filter((g) => g.pass).length, failures: r.failures.map(redact), window: [r.startedAt, r.finishedAt] };
    return { status: step.exitCode === 0 ? 'PASS' : 'FAIL', reason: log.trim().split('\n').at(-1), steps: [step] };
  },
  mutants() {
    if (mutantsFile) {
      const r = JSON.parse(fs.readFileSync(mutantsFile, 'utf8'));
      const kinds = ['activation', 'exclusion', 'wire', 'route', 'anchor', 'policy', 'preflight', 'real', 'perfgate'];
      const absent = kinds.filter((k) => !r.mutants.some((m) => m.mutant.startsWith(`${k}:`)));
      const identity = [];
      if (r.candidateSha !== head) identity.push(`ran at ${r.candidateSha}, candidate is ${head}`);
      if (r.buildId !== manifest.buildId) identity.push(`ran against buildId ${r.buildId}, candidate is ${manifest.buildId}`);
      const ok = r.total > 0 && r.detected === r.total && !absent.length && !identity.length;
      return { status: ok ? 'PASS' : 'FAIL', reason: `${r.detected}/${r.total} injected regressions detected at ${String(r.candidateSha).slice(0, 12)}${absent.length ? `; missing classes ${absent.join(', ')}` : ''}${identity.length ? `; ${identity.join('; ')}` : ''} (recorded ${r.ranAt})`, steps: [{ command: 'node scripts/nimbus/gate-mutants.mjs --out <file>', input: path.basename(mutantsFile), inputSha256: sha256(fs.readFileSync(mutantsFile)) }] };
    }
    return { status: 'BLOCKED', reason: 'no gate-mutants result supplied (--mutants); its served mutants need the preview port free, so run scripts/nimbus/gate-mutants.mjs --out <file> first', steps: [] };
  },
  exclusionMutants: () => exitStep('gate-mutants-exclusion', process.execPath, ['scripts/nimbus/gate-mutants.mjs', '--only', 'exclusion'], ROOT),
  dryRun() {
    if (missing(['indexer']).length) return { status: 'BLOCKED', reason: WHY.indexer, steps: [] };
    const receipt = path.join(artifacts, 'indexer-dry-run.json');
    const { step } = exec('indexer-dry-run', process.execPath, ['indexer/index.ts', '--environment', 'preview', '--dry-run', '--receipt', receipt], ROOT);
    const r = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    // An invalid manifest plan (PlanError) is a real, reportable outcome, not a harness bug: the
    // receipt then carries only {ok:false, error, problems}, with no documents/items/chunks at all.
    if (!r.ok || !r.documents) {
      step.result = { receiptSha256: sha256(fs.readFileSync(receipt)), error: r.error, problems: r.problems };
      return { status: 'FAIL', reason: `${r.error ?? 'indexer dry run did not produce a valid receipt'}${r.problems?.length ? `: ${r.problems.join('; ')}` : ''}`, steps: [step] };
    }
    const rag = manifest.documents.filter((d) => d.eligibility.rag).length;
    const ok = step.exitCode === 0 && r.buildId === manifest.buildId && r.documents.planned === rag && r.documents.planned + r.documents.excluded === manifest.documents.length && r.items.length === rag;
    step.result = { receiptSha256: sha256(fs.readFileSync(receipt)), buildId: r.buildId, planned: r.documents.planned, excluded: r.documents.excluded, chunks: r.chunks.planned };
    return { status: ok ? 'PASS' : 'FAIL', reason: `${r.items.length} items, ${r.documents.excluded} excluded, ${r.chunks.planned} chunks planned for ${r.buildId}`, steps: [step] };
  },
  workflowPolicy() {
    const dir = path.join(ROOT, '.github/workflows');
    const { failures, files } = checkWorkflows(ROOT);
    return { status: failures.length ? 'FAIL' : 'PASS', reason: failures.join('; ') || `${files.length} nimbus workflows: no pull_request_target, contents: read, fetch-depth 0, no secrets in PR gates, dispatch-only isolated path bound to its environment, legacy indexing workflow byte-identical`, steps: [{ command: 'workflow policy (YAML parse)', files: files.map((f) => ({ file: f, sha256: sha256(fs.readFileSync(path.join(dir, f))) })) }] };
  },
  async real(entry) {
    const turnstileEntry = entry.id === 'real-turnstile';
    const target = turnstileEntry ? isolated : testkeyIsolated;
    const variable = turnstileEntry ? 'NIMBUS_ISOLATED_URL' : 'NIMBUS_ISOLATED_ALWAYS_PASS_URL';
    if (!target) return { status: 'BLOCKED', reason: `no isolated environment configured (${variable}); mock/contract evidence cannot close this entry`, steps: [] };
    if (/^(localhost|0\.0\.0\.0|127\.|\[?::1)/.test(new URL(target).hostname)) return { status: 'FAIL', reason: 'real evidence must not come from a loopback host', steps: [] };
    // Every real entry names the exact corpus: the generation receipt of the isolated run.
    if (!receiptFile) return { status: 'BLOCKED', reason: 'no generation receipt (--indexer-receipt); real evidence must name the generation it retrieved from', steps: [] };
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    const servedBuild = (origin) => (origin ? fetch(origin + '/').then((res) => res.text()).then(buildMeta, () => null) : null);
    const [servedBuildId, testkeyServedBuildId] = await Promise.all([servedBuild(isolated), servedBuild(testkeyIsolated)]);
    const enforcement = turnstileEntry ? await enforcementProbe() : null;
    const probe = turnstileEntry ? { ok: false, sources: [], record: {}, reason: '' } : await realProbe();
    const active = activeGeneration(generationEnvironment); // read after the probe
    const verdict = judgeReal(entry.id, { manifestBuildId: manifest.buildId, servedBuildId, testkeyServedBuildId, receipt, generationEnvironment, previewGenerationEnvironment, activeGenerationId: active.id, enforcement: enforcement?.facts, probe });
    const observed = turnstileEntry ? enforcement.reason : probe.reason;
    return {
      status: verdict.status,
      reason: `generation ${receipt.generationId}; ${observed}${verdict.reasons.length ? `; ${verdict.reasons.join('; ')}` : ''}`,
      steps: [{ command: turnstileEntry ? 'Turnstile enforcement probe (sitekey served, /api/ask without and with a forged token) against the real-key isolated preview + generation receipt + docs_generation_slots' : 'real probe (Playwright, always-pass test sitekey) against the test-key isolated preview + generation receipt + docs_generation_slots',
        generationId: receipt.generationId, receiptSha256: sha256(fs.readFileSync(receiptFile)),
        isolatedServedBuildId: servedBuildId, testkeyServedBuildId, generationEnvironment: generationEnvironment ?? null, previewGenerationEnvironment: previewGenerationEnvironment ?? null, activeGenerationId: active.id, activeGenerationNote: active.why ?? null,
        ...(turnstileEntry ? { enforcement: enforcement.facts } : { probe: probe.record }) }],
    };
  },
};

// The environment's active generation in the isolated project. null when it cannot be read.
function activeGeneration(environment) {
  if (!environment || !/^[a-z][a-z0-9-]{0,31}$/.test(environment)) return { id: null, why: 'no valid --generation-environment' };
  if (!process.env.DATABASE_URL) return { id: null, why: 'DATABASE_URL is not set' };
  const r = spawnSync('psql', [process.env.DATABASE_URL, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', `env=${environment}`],
    { input: "select coalesce(active_generation_id::text, 'none') from docs_generation_slots where environment = :'env';\n", encoding: 'utf8' });
  if (r.status !== 0) return { id: null, why: 'psql could not read docs_generation_slots' };
  const v = r.stdout.trim();
  return /^\d+$/.test(v) ? { id: Number(v) } : { id: 'none', why: 'no active generation for this environment' };
}

// Turnstile enforcement on the real-key preview, without a browser token: the sitekey the page renders
// the widget with, and the real handler's answers to a request without a token and with a forged one.
let enforcementResult;
async function enforcementProbe() {
  if (enforcementResult) return enforcementResult;
  const facts = {};
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    page.on('request', (req) => {
      const u = new URL(req.url());
      const key = u.hostname === 'challenges.cloudflare.com' && u.pathname.match(/\/([0-3]x[0-9A-Za-z_-]{10,})(\/|$)/)?.[1];
      if (key) facts.sitekey ??= key;
    });
    await page.goto(isolated + '/getting-started/quick-start/', { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
    await page.waitForRequest((req) => new URL(req.url()).hostname === 'challenges.cloudflare.com' && /\/[0-3]x[0-9A-Za-z_-]{10,}(\/|$)/.test(new URL(req.url()).pathname), { timeout: 30000 }).catch(() => {});
  } catch (e) {
    facts.sitekeyError = redact(e.message).slice(0, 200);
  } finally {
    await browser.close();
  }
  const ask = async (extra) => {
    const res = await fetch(isolated + '/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'How do I create an API key?', sessionId: `acceptance-${Date.now()}`, ...extra }) });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, error: body.error, codes: body.codes };
  };
  facts.missing = await ask({});
  facts.forged = await ask({ turnstileToken: `forged-${crypto.randomBytes(24).toString('hex')}` });
  enforcementResult = { facts, reason: `real-key sitekey ${facts.sitekey ?? 'not observed'}; no token: ${facts.missing.status} ${JSON.stringify(facts.missing.error)}; forged token: ${facts.forged.status} ${JSON.stringify(facts.forged.error)} ${JSON.stringify(facts.forged.codes ?? [])}` };
  return enforcementResult;
}

// One real question through the candidate UI on the test-key isolated preview: the Turnstile widget with
// Cloudflare's always-pass test sitekey (real widget script, dummy token, real siteverify with the
// always-pass secret), /api/ask (real handler, real providers, configured generation), streamed frames,
// rendered citations.
let probeResult;
async function realProbe() {
  if (probeResult) return probeResult;
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
  const browser = await chromium.launch();
  const record = { url: redact(testkeyIsolated), path: '/getting-started/quick-start/' };
  try {
    const page = await (await browser.newContext()).newPage();
    // The candidate renders the widget with the production sitekey, which is bound to production hosts.
    // A capture listener on document (a load event never reaches window) runs before the loader's own
    // onload and hands it a turnstile object whose render() uses the always-pass test sitekey.
    await page.addInitScript((key) => {
      document.addEventListener('load', (e) => {
        const t = window.turnstile;
        if (!(e.target instanceof HTMLScriptElement) || !t || t.__keyed) return;
        const keyed = { __keyed: true };
        for (const k of Object.keys(t)) keyed[k] = typeof t[k] === 'function' ? t[k].bind(t) : t[k];
        keyed.render = (el, o) => t.render(el, { ...o, sitekey: key });
        Object.defineProperty(window, 'turnstile', { value: keyed, configurable: true, writable: true });
      }, true);
      // Playwright cannot read a streamed response body, so the page keeps a copy of the /api/ask stream.
      const realFetch = window.fetch;
      window.fetch = async (input, init) => {
        const res = await realFetch(input, init);
        if (new URL(String(input), location.href).pathname === '/api/ask') window.__askBody = res.clone().text();
        return res;
      };
    }, ALWAYS_PASS_SITEKEY);
    let body = '';
    page.on('request', (req) => {
      const u = new URL(req.url());
      const key = u.hostname === 'challenges.cloudflare.com' && u.pathname.match(/\/([0-3]x[0-9A-Za-z_-]{10,})(\/|$)/)?.[1];
      if (key) record.sitekey = key;
      if (req.method() === 'POST' && u.pathname === '/api/ask') {
        const b = req.postDataJSON();
        record.requestFields = Object.keys(b).sort();
        record.tokenSent = typeof b.turnstileToken === 'string' && b.turnstileToken.length > 20;
        record.dummyToken = b.turnstileToken === DUMMY_TOKEN;
      }
    });
    const answered = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/ask', { timeout: 120000 });
    // A later step can fail first (for example Turnstile never enabling Send); the browser then closes and
    // this wait rejects. It is awaited below; this only keeps that rejection from crashing the harness.
    answered.catch(() => {});
    await page.goto(testkeyIsolated + record.path, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
    await page.locator('#aa-send').waitFor({ state: 'visible', timeout: 30000 });
    await page.fill('#aa-question', 'How do I create an API key?');
    await page.waitForFunction(() => !document.getElementById('aa-send').disabled, null, { timeout: 60000 });
    await page.press('#aa-question', 'Enter');
    const res = await answered;
    record.status = res.status();
    record.contentType = res.headers()['content-type'];
    body = await page.evaluate(() => window.__askBody ?? '').catch(() => '');
    await page.waitForFunction(() => { const m = [...document.querySelectorAll('.aa-msg[data-role="assistant"]')].at(-1); return m && m.dataset.state !== 'streaming'; }, null, { timeout: 120000 });
    const last = page.locator('.aa-msg[data-role="assistant"]').last();
    record.renderedState = (await last.getAttribute('data-state')) ?? 'done';
    const sources = await last.locator('.aa-sources a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    const frames = body.split('\n').filter((l) => l.startsWith('data: '));
    record.frames = { total: frames.length, content: frames.filter((l) => /"content"\s*:\s*"[^"]/.test(l)).length, done: frames.at(-1) === 'data: [DONE]' };
    const served = new Set(manifest.documents.filter((d) => d.eligibility.rag).map((d) => new URL(d.canonicalUrl).pathname));
    record.citations = sources.map((s) => ({ href: s, known: served.has(s.replace(/[#?].*$/, '')) || served.has(s.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1')) }));
    const ok = record.status === 200 && /text\/event-stream/.test(record.contentType ?? '') && record.frames.content > 0 && record.frames.done && sources.length > 0 && record.citations.every((c) => c.known);
    probeResult = { ok, sources, record, reason: `status ${record.status}, ${record.frames.content} content frames, [DONE] ${record.frames.done}, ${sources.length} citations (${record.citations.filter((c) => c.known).length} to rag-eligible manifest pages); server-side embedding and retrieval are evidenced by the cited generation, not observed here` };
  } catch (e) {
    probeResult = { ok: false, sources: [], record, reason: redact(e.message).slice(0, 300) };
  } finally {
    await browser.close();
  }
  return probeResult;
}

// ---- run the matrix ----------------------------------------------------------------------------------
const records = [];
for (const entry of MATRIX.entries) {
  if (only && !only.includes(entry.id)) continue;
  const parts = [];
  for (const s of entry.steps) {
    try { parts.push(s.suite ? suiteStep(s) : await CUSTOM[s.custom](entry)); }
    catch (e) { parts.push({ status: 'FAIL', reason: `harness error: ${e.message.split('\n')[0]}`, steps: [] }); }
  }
  const status = parts.some((p) => p.status === 'FAIL') ? 'FAIL' : parts.some((p) => p.status === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  const record = {
    entry: entry.id, title: entry.title, evidenceClass: entry.class, status,
    evidence: parts.map((p) => redact(p.reason)).join(' | '),
    commands: parts.flatMap((p) => p.steps),
    ...identity, environment, recordedAt: new Date().toISOString(),
  };
  records.push(record);
  console.error(`${status.padEnd(7)} ${entry.id}: ${record.evidence.slice(0, 220)}`);
}
const text = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
if (/(^|[^<])\/Users\/|\/home\/runner/.test(text) || INTERNAL_NAMES.some((h) => text.includes(h))) { console.error('refusing to emit: a record still contains a local path or hostname'); process.exit(2); }
if (outFile) fs.writeFileSync(outFile, text); else process.stdout.write(text);
const tally = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map((s) => [s, records.filter((r) => r.status === s).length]));
console.error(`acceptance ${head.slice(0, 12)} ${manifest.buildId}: ${tally.PASS} PASS, ${tally.FAIL} FAIL, ${tally.BLOCKED} BLOCKED; logs in ${redact(artifacts)}`);
process.exit(tally.FAIL ? 1 : 0);
