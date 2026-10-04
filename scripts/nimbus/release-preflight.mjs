// #14 release preflight. Read-only: it reads git, the GitHub check runs, the Cloudflare Pages project and
// the live site, and never deploys, merges or changes a setting. Exit 0 only when every check holds.
//   node scripts/nimbus/release-preflight.mjs --candidate <sha> --account <cloudflare account id> [--after-release]
// The Pages API token is CLOUDFLARE_API_TOKEN, or wrangler's login (`wrangler login`); it is never printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PROJECT = 'docs';
const SITE = 'https://docs.apertis.ai';
const REPO = 'apertis-ai/docs';

/** Every reason the release must not go ahead; none means it may. */
export function judge(f) {
  const fail = [];
  const p = f.project;
  if (p.name !== PROJECT) fail.push(`project is ${p.name}, not the production project ${PROJECT}`);
  if (p.productionBranch !== 'main') fail.push(`production branch is ${p.productionBranch}, not main`);
  if (p.buildCommand !== 'npm run build') fail.push(`build command is "${p.buildCommand}", not "npm run build"`);
  if (p.outputDir !== 'build') fail.push(`output directory is ${p.outputDir}, not build`);
  if (p.rootDir) fail.push(`root directory is ${p.rootDir}, not the repository root`);
  // The preview build is the evidence for the production build only while nothing build-relevant differs:
  // a production sitekey override would ship a test key, a NODE_VERSION would override .node-version.
  for (const name of ['PUBLIC_TURNSTILE_SITEKEY', 'NODE_VERSION'])
    if (p.productionEnvNames.includes(name) || p.previewEnvNames.includes(name)) fail.push(`${name} is set on the project; the build must take it from the repository`);

  const c = f.candidate;
  if (c.head !== c.expected) fail.push(`HEAD ${c.head} is not the approved candidate ${c.expected}`);
  if (!c.clean) fail.push('the checkout has uncommitted changes');
  if (!c.pushed) fail.push(f.phase === 'after-release' ? 'the candidate is not on main' : 'the candidate is not pushed to its branch');
  // Before the release the Pages preview build proves the build path; after it, the production deployment does.
  if (f.phase !== 'after-release' && (!c.previewBuildId || c.previewBuildId !== c.buildId)) fail.push(`the Pages preview build of the candidate serves ${c.previewBuildId ?? 'nothing'}, not buildId ${c.buildId}`);

  if (!f.ci.conclusions.length || f.ci.missing || f.ci.pending || f.ci.conclusions.some((x) => x !== 'success' && x !== 'skipped' && x !== 'neutral'))
    fail.push(`CI on the candidate is not green (${f.ci.pending} running, ${f.ci.missing ?? 0} unread; ${f.ci.conclusions.join(', ') || 'no runs'})`);

  const rb = p.deployments.find((d) => d.id === f.rollback.deploymentId);
  if (!rb || rb.status !== 'success') fail.push(`rollback point ${f.rollback.deploymentId} is not a successful deployment of ${PROJECT}`);
  if (p.askRetrievalSource !== 'legacy') fail.push(`production ASK_RETRIEVAL_SOURCE is ${p.askRetrievalSource ?? 'unset'}; set it to legacy before the release (server first)`);

  if (f.phase === 'after-release') {
    if (p.canonicalDeploymentId === f.rollback.deploymentId) fail.push('production has no new deployment since the rollback point');
    if (f.live.buildId !== c.buildId) fail.push(`${SITE} serves ${f.live.buildId ?? f.live.legacyBundle ?? 'nothing recognisable'}, not buildId ${c.buildId}`);
  } else {
    if (p.canonicalDeploymentId !== f.rollback.deploymentId) fail.push(`production moved since the rollback point was recorded (now ${p.canonicalDeploymentId}); record the new one first`);
    if (f.live.legacyBundle !== f.rollback.legacyBundle) fail.push(`the live site serves ${f.live.buildId ?? f.live.legacyBundle ?? 'nothing recognisable'}, not the recorded legacy bundle ${f.rollback.legacyBundle}`);
  }
  return { ok: fail.length === 0, failures: fail };
}

const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
const served = async (origin) => {
  const html = await (await fetch(`${origin}/`, { headers: { 'cache-control': 'no-cache' } })).text();
  return { buildId: html.match(/apertis-docs:build" content="([^"]+)"/)?.[1] ?? null, legacyBundle: html.match(/main\.[0-9a-f]+\.js/)?.[0] ?? null };
};
function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const cfg = path.join(os.homedir(), 'Library/Preferences/.wrangler/config/default.toml');
  const alt = path.join(os.homedir(), '.config/.wrangler/config/default.toml');
  const file = [cfg, alt].find((x) => fs.existsSync(x));
  const t = file && fs.readFileSync(file, 'utf8').match(/^oauth_token = "(.+)"$/m)?.[1];
  if (!t) throw new Error('no Cloudflare token: set CLOUDFLARE_API_TOKEN or run wrangler login');
  return t;
}

async function facts(expected, account, phase) {
  const cf = async (p) => {
    const r = await (await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${PROJECT}${p}`, { headers: { authorization: `Bearer ${token()}` } })).json();
    if (!r.success) throw new Error(`Pages API ${p || '/'}: ${JSON.stringify(r.errors)}`);
    return r.result;
  };
  const head = git('rev-parse', 'HEAD');
  // Before the release the candidate is its pushed branch head; after it, a commit on main.
  let pushed;
  if (phase === 'after-release') {
    const main = execFileSync('git', ['ls-remote', `https://github.com/${REPO}`, 'refs/heads/main'], { encoding: 'utf8' }).split('\t')[0];
    git('fetch', '--quiet', `https://github.com/${REPO}`, 'main');
    pushed = !!main && spawnSync('git', ['-C', ROOT, 'merge-base', '--is-ancestor', expected, main]).status === 0;
  } else {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    pushed = execFileSync('git', ['ls-remote', `https://github.com/${REPO}`, `refs/heads/${branch}`], { encoding: 'utf8' }).split('\t')[0] === head;
  }
  const buildId = JSON.parse(fs.readFileSync(path.join(ROOT, 'site-nimbus/src/manifest/manifest.json'), 'utf8')).buildId;
  const checks = JSON.parse(execFileSync('gh', ['api', `repos/${REPO}/commits/${expected}/check-runs?per_page=100`], { encoding: 'utf8' }));
  const runs = checks.check_runs;
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'migration/nimbus/legacy-rollback.json'), 'utf8')).pages;
  // The rollback point is the recorded production deployment: the latest recorded successor, else the baseline one.
  const rollback = pages.currentProductionDeployment ?? { ...pages.servingDeployment, bundle: 'main.9321920d.js' };

  const project = await cf('');
  const previews = await cf('/deployments?env=preview&per_page=25');
  const preview = previews.find((d) => d.deployment_trigger?.metadata?.commit_hash === expected && d.latest_stage?.status === 'success');
  const rb = await cf(`/deployments/${rollback.id}`).catch(() => null);
  const env = project.deployment_configs?.production?.env_vars?.ASK_RETRIEVAL_SOURCE;
  return {
    phase,
    candidate: { expected, head, clean: git('status', '--porcelain') === '', pushed, buildId, previewBuildId: preview ? (await served(preview.url)).buildId : null },
    ci: { conclusions: runs.filter((r) => r.status === 'completed').map((r) => r.conclusion), pending: runs.filter((r) => r.status !== 'completed').length, missing: checks.total_count - runs.length },
    project: {
      name: project.name, productionBranch: project.production_branch, buildCommand: project.build_config?.build_command,
      outputDir: project.build_config?.destination_dir, rootDir: project.build_config?.root_dir ?? '',
      productionEnvNames: Object.keys(project.deployment_configs?.production?.env_vars ?? {}),
      previewEnvNames: Object.keys(project.deployment_configs?.preview?.env_vars ?? {}),
      canonicalDeploymentId: project.canonical_deployment?.id,
      deployments: rb ? [{ id: rb.id, environment: rb.environment, status: rb.latest_stage?.status }] : [],
      // A secret's value is never returned; this setting is a plain-text variable.
      askRetrievalSource: env?.type === 'plain_text' ? env.value : null,
    },
    rollback: { deploymentId: rollback.id, legacyBundle: rollback.bundle },
    live: await served(SITE),
  };
}

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const expected = arg('candidate'), account = arg('account') ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!expected || !account) { console.error('usage: release-preflight.mjs --candidate <sha> --account <id> [--after-release]'); process.exit(2); }
  const f = await facts(expected, account, process.argv.includes('--after-release') ? 'after-release' : 'before-release');
  const { ok, failures } = judge(f);
  console.log(JSON.stringify({ phase: f.phase, candidate: f.candidate, ci: f.ci, project: { ...f.project }, live: f.live }, null, 2));
  for (const x of failures) console.error(`FAIL ${x}`);
  console.error(ok ? `preflight ${f.phase}: PASS` : `preflight ${f.phase}: ${failures.length} failure(s)`);
  process.exit(ok ? 0 : 1);
}
