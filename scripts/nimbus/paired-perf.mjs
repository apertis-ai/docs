// Paired legacy/candidate performance gate for the Nimbus PoC (issue #12), implementing
// migration/nimbus/budgets.json `budgetRules`.
//
//   PLAYWRIGHT=<playwright/index.mjs or scripts/nimbus/playwright-channel.mjs> \
//   node scripts/nimbus/paired-perf.mjs run --legacy <url> --candidate <url> [--runs 5] [--page /p/ ...] [--out result.json]
//   node scripts/nimbus/paired-perf.mjs gate <result.json> [<result.json> ...] [--out merged.json]
//
// `run` measures; `gate` re-evaluates recorded raw samples (for example page shards) without a browser.
// Each sample is one `measure.mjs perf <base> --runs 1 --page <p>` process, so the measurement code
// and its semantics are exactly #5's; only the scheduling is added here: for every page, legacy and
// candidate alternate for `runs` rounds, and the one measured first flips every round. Exit 0 only when
// every page and profile is within budget and every sample is valid.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const budgets = JSON.parse(fs.readFileSync(new URL('../../migration/nimbus/budgets.json', import.meta.url), 'utf8'));
const MEASURE = new URL('./measure.mjs', import.meta.url).pathname;
const BYTES = ['jsGzip', 'cssGzip', 'dataGzip', 'searchPayloadGzip'];
const TIMING = ['lcp', 'tbt', 'searchOpenMs'];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Records name loopback origins as they are and every other host by role, so no internal hostname leaks.
const redact = (url, role) => { const u = new URL(url); return ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ? u.origin : `http://<${role}-host>:${u.port || 80}`; };

const args = process.argv.slice(2);
const mode = args.shift();
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const opts = (name) => { const out = []; for (let v; (v = opt(name)) !== undefined;) out.push(v); return out; };

function measure(base, page) {
  const stdout = execFileSync(process.execPath, [MEASURE, 'perf', base, '--runs', '1', '--page', page], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 });
  const { results } = JSON.parse(stdout);
  return Object.fromEntries(Object.keys(budgets.protocol.profiles).map((profile) => [profile, results[profile][page].samples[0]]));
}

// Pure evaluation of raw samples against budgets.json. Returns medians, one row per gated value, and failures.
function evaluate(samples) {
  const medians = {};
  const gates = [];
  const failures = [];
  const pages = [...new Set(samples.map((s) => s.page))];
  for (const profile of Object.keys(budgets.protocol.profiles)) {
    for (const page of pages) {
      const of = (site) => samples.filter((s) => s.site === site && s.profile === profile && s.page === page);
      const leg = of('legacy'), cand = of('candidate');
      if (leg.length !== budgets.protocol.runs || cand.length !== budgets.protocol.runs) {
        failures.push(`${profile} ${page}: ${leg.length} legacy and ${cand.length} candidate samples, protocol requires ${budgets.protocol.runs} each`);
        continue;
      }
      const med = (list) => Object.fromEntries(Object.keys(list[0].metrics).map((k) => [k, median(list.map((s) => s.metrics[k]))]));
      const L = med(leg), C = med(cand);
      (medians[profile] ??= {})[page] = { legacy: L, candidate: C };
      for (const s of [...leg, ...cand]) if (s.metrics.unreadableResponses !== 0) failures.push(`${profile} ${page} ${s.site} run ${s.run}: invalid sample, unreadableResponses ${s.metrics.unreadableResponses}`);
      const recorded = budgets.baseline.gatedBytes[profile]?.[page];
      if (!recorded) { failures.push(`${profile} ${page}: no recorded byte baseline`); continue; }
      for (const m of BYTES) {
        const pass = C[m] <= recorded[m];
        gates.push({ profile, page, metric: m, rule: 'bytes', candidate: C[m], limit: recorded[m], pass });
        if (!pass) failures.push(`${profile} ${page} ${m}: candidate median ${C[m]} > recorded legacy median ${recorded[m]}`);
        // The paired legacy server must be the recorded baseline build, or the timing pairing is meaningless.
        if (L[m] !== recorded[m]) failures.push(`${profile} ${page} ${m}: paired legacy median ${L[m]} != recorded baseline ${recorded[m]} (legacy server is not the baseline build)`);
      }
      for (const m of TIMING) {
        const limit = Math.max(L[m] * 1.1, L[m] + 50);
        const pass = C[m] <= limit;
        gates.push({ profile, page, metric: m, rule: 'timing', candidate: C[m], legacy: L[m], limit, pass });
        if (!pass) failures.push(`${profile} ${page} ${m}: candidate median ${C[m]} > max(${L[m]} x 1.10, ${L[m]} + 50) = ${limit}`);
      }
      const unfocused = cand.filter((s) => s.metrics.keyboardFocus !== 1).length;
      gates.push({ profile, page, metric: 'keyboardFocus', rule: 'candidate must be 1', candidate: C.keyboardFocus, limit: 1, pass: unfocused === 0 });
      if (unfocused) failures.push(`${profile} ${page} keyboardFocus: ${unfocused} candidate samples without focus`);
    }
  }
  return { medians, gates, failures };
}

const methodology = {
  protocol: 'migration/nimbus/budgets.json protocol and budgetRules; measurement code is scripts/nimbus/measure.mjs unchanged',
  sampling: 'one measure.mjs perf process per site, page and round (a fresh browser per sample, both profiles in that process); legacy and candidate alternate within each page, and the site measured first flips every round',
  statistic: 'median of the runs per site, page, profile and metric; raw samples below, each with the host 1-minute load average',
  gates: 'bytes: candidate median <= recorded legacy median (zero tolerance); timing: candidate median <= max(paired legacy median x 1.10, paired legacy median + 50 ms); candidate keyboardFocus 1 in every sample; unreadableResponses 0 in every sample; paired legacy byte medians must equal the recorded baseline',
};

function emit(result) {
  const text = JSON.stringify(result, null, 2);
  const out = opt('out');
  if (out) fs.writeFileSync(out, text + '\n');
  else console.log(text);
  for (const f of result.failures) console.error(`- ${f}`);
  console.error(`paired-perf: ${result.gates.filter((g) => g.pass).length}/${result.gates.length} gated values within budget, ${result.failures.length} failures`);
  process.exit(result.failures.length ? 1 : 0);
}

if (mode === 'run') {
  const legacy = opt('legacy')?.replace(/\/$/, ''), candidate = opt('candidate')?.replace(/\/$/, '');
  const runs = Number(opt('runs') ?? budgets.protocol.runs);
  const pages = opts('page');
  const selected = pages.length ? pages : budgets.protocol.pages;
  if (!legacy || !candidate || selected.some((p) => !budgets.protocol.pages.includes(p))) {
    console.error('usage: paired-perf.mjs run --legacy <url> --candidate <url> [--runs 5] [--page /p/ ...] [--out file]'); process.exit(2);
  }
  const samples = [];
  const startedAt = new Date().toISOString();
  for (const page of selected) {
    for (let run = 0; run < runs; run++) {
      const order = run % 2 ? [['candidate', candidate], ['legacy', legacy]] : [['legacy', legacy], ['candidate', candidate]];
      for (const [site, base] of order) {
        const at = new Date().toISOString();
        for (const [profile, metrics] of Object.entries(measure(base, page))) samples.push({ site, page, profile, run, at, metrics });
        console.error(`${page} run ${run} ${site} done`);
      }
    }
  }
  emit({ methodology, legacy: redact(legacy, 'legacy'), candidate: redact(candidate, 'candidate'), runs, startedAt, finishedAt: new Date().toISOString(), pages: selected, ...evaluate(samples), samples });
} else if (mode === 'gate') {
  const out = opt('out');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('usage: paired-perf.mjs gate <result.json> ... [--out file]'); process.exit(2); }
  const parts = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const samples = parts.flatMap((p) => p.samples);
  if (out) args.push('--out', out);
  emit({ methodology, legacy: parts[0].legacy, candidate: parts[0].candidate, runs: parts[0].runs, startedAt: parts.map((p) => p.startedAt).sort()[0], finishedAt: parts.map((p) => p.finishedAt).sort().at(-1), pages: [...new Set(samples.map((s) => s.page))], ...evaluate(samples), samples });
} else if (mode) {
  console.error('usage: paired-perf.mjs run|gate ...'); process.exit(2);
}
