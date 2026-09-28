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
// here; it is never counted as passed. isolated-real entries are BLOCKED unless NIMBUS_ISOLATED_URL
// names an operator-configured isolated preview (see .github/workflows/nimbus-isolated.yml).
// Exit status: 0 when no entry FAILs, 1 when any does, 2 on a usage or identity error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SITE = path.join(ROOT, 'site-nimbus');
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/acceptance/matrix.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const opts = (name) => { const out = []; for (let v; (v = opt(name)) !== undefined;) out.push(v); return out; };
const sha = opt('sha');
const preview = opt('preview')?.replace(/\/$/, '');
const perfFiles = opts('perf');
const mutantsFile = opt('mutants');
const receiptFile = opt('indexer-receipt');
const only = opt('only')?.split(',');
const outFile = opt('out');
const isolated = process.env.NIMBUS_ISOLATED_URL?.replace(/\/$/, '');
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
  return { status: step.exitCode === 0 ? 'PASS' : 'FAIL', reason: log.trim().split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 300) ?? '', steps: [step] };
}

const CUSTOM = {
  identity() {
    const problems = [];
    if (manifest.buildId !== distBuildId) problems.push(`dist buildId ${distBuildId} != manifest ${manifest.buildId}`);
    if (preview && servedBuildId !== manifest.buildId) problems.push(`served buildId ${servedBuildId} != manifest ${manifest.buildId}`);
    if (!preview) problems.push('no --preview');
    return { status: problems.length ? (preview ? 'FAIL' : 'BLOCKED') : 'PASS', reason: problems.join('; ') || `HEAD, manifest, dist and served buildId agree (${manifest.buildId})`, steps: [] };
  },
  fixtures: () => exitStep('route-fixtures', process.execPath, ['scripts/nimbus/route-fixtures.mjs', 'check', preview ?? '', '--scope', 'poc'], ROOT, {}, ['preview']),
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
  perf() {
    if (!perfFiles.length) return { status: 'BLOCKED', reason: 'no paired-perf result supplied (--perf); run scripts/nimbus/paired-perf.mjs', steps: [] };
    const merged = path.join(artifacts, 'paired-perf-merged.json');
    const { step, log } = exec('paired-perf-gate', process.execPath, ['scripts/nimbus/paired-perf.mjs', 'gate', ...perfFiles.map((f) => path.resolve(f)), '--out', merged], ROOT);
    const r = JSON.parse(fs.readFileSync(merged, 'utf8'));
    step.inputsSha256 = perfFiles.map((f) => sha256(fs.readFileSync(f)));
    step.result = { pages: r.pages.length, samples: r.samples.length, gated: r.gates.length, withinBudget: r.gates.filter((g) => g.pass).length, failures: r.failures.map(redact), window: [r.startedAt, r.finishedAt] };
    return { status: step.exitCode === 0 ? 'PASS' : 'FAIL', reason: log.trim().split('\n').at(-1), steps: [step] };
  },
  mutants(entry) {
    if (mutantsFile) {
      const r = JSON.parse(fs.readFileSync(mutantsFile, 'utf8'));
      const kinds = ['activation', 'exclusion', 'wire', 'route', 'anchor'];
      const absent = kinds.filter((k) => !r.mutants.some((m) => m.mutant.startsWith(`${k}:`)));
      const ok = r.total > 0 && r.detected === r.total && !absent.length;
      return { status: ok ? 'PASS' : 'FAIL', reason: `${r.detected}/${r.total} injected regressions detected${absent.length ? `; missing classes ${absent.join(', ')}` : ''} (recorded ${r.ranAt})`, steps: [{ command: 'node scripts/nimbus/gate-mutants.mjs --out <file>', input: path.basename(mutantsFile), inputSha256: sha256(fs.readFileSync(mutantsFile)) }] };
    }
    return exitStep('gate-mutants', process.execPath, ['scripts/nimbus/gate-mutants.mjs', ...(entry.only ? ['--only', entry.only] : [])], ROOT);
  },
  exclusionMutants: () => exitStep('gate-mutants-exclusion', process.execPath, ['scripts/nimbus/gate-mutants.mjs', '--only', 'exclusion'], ROOT),
  dryRun() {
    if (missing(['indexer']).length) return { status: 'BLOCKED', reason: WHY.indexer, steps: [] };
    const receipt = path.join(artifacts, 'indexer-dry-run.json');
    const { step } = exec('indexer-dry-run', process.execPath, ['indexer/index.ts', '--environment', 'preview', '--dry-run', '--receipt', receipt], ROOT);
    const r = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    const rag = manifest.documents.filter((d) => d.eligibility.rag).length;
    const ok = step.exitCode === 0 && r.ok && r.buildId === manifest.buildId && r.documents.planned === rag && r.documents.planned + r.documents.excluded === manifest.documents.length && r.items.length === rag;
    step.result = { receiptSha256: sha256(fs.readFileSync(receipt)), buildId: r.buildId, planned: r.documents.planned, excluded: r.documents.excluded, chunks: r.chunks.planned };
    return { status: ok ? 'PASS' : 'FAIL', reason: `${r.items.length} items, ${r.documents.excluded} excluded, ${r.chunks.planned} chunks planned for ${r.buildId}`, steps: [step] };
  },
  workflowPolicy() {
    const failures = [];
    const dir = path.join(ROOT, '.github/workflows');
    const require = createRequire(path.join(ROOT, 'package.json'));
    const YAML = require('yaml');
    const files = fs.readdirSync(dir).filter((f) => /^nimbus-.*\.ya?ml$/.test(f));
    const pr = files.find((f) => f.startsWith('nimbus-pr')), iso = files.find((f) => f.startsWith('nimbus-isolated'));
    if (!pr || !iso) failures.push('nimbus-pr-gates.yml and nimbus-isolated.yml are both required');
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const wf = YAML.parse(text);
      const on = wf.on ?? wf.true;
      const triggers = Object.keys(typeof on === 'string' ? { [on]: null } : on);
      if (triggers.includes('pull_request_target')) failures.push(`${f}: pull_request_target`);
      if (JSON.stringify(wf.permissions) !== JSON.stringify({ contents: 'read' })) failures.push(`${f}: top-level permissions must be exactly contents: read`);
      for (const [id, job] of Object.entries(wf.jobs)) {
        if (job.permissions) failures.push(`${f} ${id}: job-level permissions`);
        for (const step of job.steps ?? []) {
          if (String(step.uses ?? '').startsWith('actions/checkout') && step.with?.['fetch-depth'] !== 0) failures.push(`${f} ${id}: checkout without fetch-depth 0`);
          if (/\b(wrangler\s+(pages\s+)?deploy|gh\s+(pr|release|workflow)|git\s+push|supabase\s+db\s+push)\b/.test(step.run ?? '')) failures.push(`${f} ${id}: deploy/push/dispatch command`);
        }
      }
      if (f === pr) {
        if (triggers.some((t) => !['pull_request', 'push'].includes(t))) failures.push(`${f}: triggers ${triggers}`);
        if (/secrets\./.test(text) || /^\s*environment:/m.test(text)) failures.push(`${f}: uses secrets or an environment`);
        if (wf.concurrency?.['cancel-in-progress'] !== true) failures.push(`${f}: superseded runs are not cancelled`);
        const need = ['site-nimbus/**', 'docs/**', 'docs-api/**', 'src/**', 'functions/**', 'assistant/**', 'indexer/**', 'supabase/migrations/**', 'migration/nimbus/**', 'scripts/**', '.github/workflows/nimbus-*.yml'];
        for (const t of ['pull_request', 'push']) for (const p of need) if (!on[t]?.paths?.includes(p)) failures.push(`${f}: ${t} paths miss ${p}`);
      }
      if (f === iso) {
        if (JSON.stringify(triggers) !== '["workflow_dispatch"]') failures.push(`${f}: must be workflow_dispatch only`);
        if (wf.concurrency?.['cancel-in-progress'] !== false) failures.push(`${f}: an isolated run must not be cancelled midway`);
        for (const [id, job] of Object.entries(wf.jobs)) {
          if (job.environment !== 'nimbus-isolated') failures.push(`${f} ${id}: not bound to the nimbus-isolated environment`);
          const guard = job.steps?.[0]?.run ?? '';
          for (const name of Object.keys(job.env ?? {}).filter((k) => /secrets\./.test(String(job.env[k])))) if (!guard.includes(`\${${name}:?`)) failures.push(`${f} ${id}: first step does not fail closed on ${name}`);
          if (!/TARGET_URL:\?/.test(guard)) failures.push(`${f} ${id}: first step does not fail closed on the target`);
        }
      }
    }
    const legacyIndexing = spawnSync('git', ['diff', '--quiet', '7b6ef85', '--', '.github/workflows/index-docs.yml'], { cwd: ROOT }).status;
    if (legacyIndexing !== 0) failures.push('.github/workflows/index-docs.yml differs from 7b6ef85');
    return { status: failures.length ? 'FAIL' : 'PASS', reason: failures.join('; ') || `${files.length} nimbus workflows: no pull_request_target, contents: read, fetch-depth 0, no secrets in PR gates, dispatch-only isolated path bound to its environment, legacy indexing workflow byte-identical`, steps: [{ command: 'workflow policy (YAML parse)', files: files.map((f) => ({ file: f, sha256: sha256(fs.readFileSync(path.join(dir, f))) })) }] };
  },
  async real(entry) {
    if (!isolated) return { status: 'BLOCKED', reason: 'no isolated environment configured (NIMBUS_ISOLATED_URL); mock/contract evidence cannot close this entry', steps: [] };
    const host = new URL(isolated).hostname;
    if (/^(localhost|127\.|\[?::1)/.test(host)) return { status: 'FAIL', reason: 'real evidence must not come from a loopback host', steps: [] };
    if (entry.id === 'real-indexing') {
      if (!receiptFile) return { status: 'BLOCKED', reason: 'no generation receipt (--indexer-receipt)', steps: [] };
      const r = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
      const probe = await realProbe();
      const paths = new Set(r.items.map((i) => i.urlPath));
      const cited = probe.sources.map((s) => s.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1'));
      const ok = r.generationState === 'ready' && r.buildId === manifest.buildId && r.documents.failed === 0 && probe.ok && cited.length > 0 && cited.every((p) => paths.has(p));
      return { status: ok ? 'PASS' : 'FAIL', reason: `generation ${r.generationId} ${r.generationState} for ${r.buildId}; cited ${cited.join(', ') || 'nothing'}`, steps: [{ command: 'receipt + real probe', receiptSha256: sha256(fs.readFileSync(receiptFile)), generationId: r.generationId, probe: probe.record }] };
    }
    const probe = await realProbe();
    const ok = entry.id === 'real-turnstile' ? probe.record.tokenSent && probe.record.status === 200 : probe.ok;
    return { status: ok ? 'PASS' : 'FAIL', reason: probe.reason, steps: [{ command: 'real probe (Playwright) against the isolated preview', probe: probe.record }] };
  },
};

// One real question through the candidate UI on the isolated preview: Turnstile (real widget),
// /api/ask (real handler, real providers, configured generation), streamed frames, rendered citations.
let probeResult;
async function realProbe() {
  if (probeResult) return probeResult;
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
  const browser = await chromium.launch();
  const record = { url: redact(isolated), path: '/getting-started/quick-start/' };
  try {
    const page = await (await browser.newContext()).newPage();
    let body = '';
    page.on('request', (req) => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/ask') { const b = req.postDataJSON(); record.requestFields = Object.keys(b).sort(); record.tokenSent = typeof b.turnstileToken === 'string' && b.turnstileToken.length > 20; } });
    const answered = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/ask', { timeout: 120000 });
    await page.goto(isolated + record.path, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
    await page.locator('#aa-send').waitFor({ state: 'visible', timeout: 30000 });
    await page.fill('#aa-question', 'How do I create an API key?');
    await page.waitForFunction(() => !document.getElementById('aa-send').disabled, null, { timeout: 60000 });
    await page.press('#aa-question', 'Enter');
    const res = await answered;
    record.status = res.status();
    record.contentType = res.headers()['content-type'];
    body = await res.text().catch(() => '');
    await page.waitForFunction(() => { const m = [...document.querySelectorAll('.aa-msg[data-role="assistant"]')].at(-1); return m && m.dataset.state !== 'streaming'; }, null, { timeout: 120000 });
    const last = page.locator('.aa-msg[data-role="assistant"]').last();
    record.renderedState = (await last.getAttribute('data-state')) ?? 'done';
    const sources = await last.locator('.aa-sources a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    const frames = body.split('\n').filter((l) => l.startsWith('data: '));
    record.frames = { total: frames.length, content: frames.filter((l) => /"content"\s*:\s*"[^"]/.test(l)).length, done: frames.at(-1) === 'data: [DONE]' };
    const served = new Set(manifest.documents.filter((d) => d.eligibility.rag).map((d) => new URL(d.canonicalUrl).pathname));
    record.citations = sources.map((s) => ({ href: s, known: served.has(s.replace(/[#?].*$/, '')) || served.has(s.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1')) }));
    const ok = record.tokenSent && record.status === 200 && /text\/event-stream/.test(record.contentType ?? '') && record.frames.content > 0 && record.frames.done && sources.length > 0 && record.citations.every((c) => c.known);
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
