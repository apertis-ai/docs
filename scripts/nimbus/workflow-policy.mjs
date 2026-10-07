// Workflow policy for the Nimbus workflows (issue #12). Pure over a directory tree, so gate-mutants.mjs
// can prove each rule on a mutated copy. Returns { failures, files }.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

export function checkWorkflows(ROOT, { gitRoot = ROOT, yamlFrom = ROOT } = {}) {
  const failures = [];
  const dir = path.join(ROOT, '.github/workflows');
  const require = createRequire(path.join(yamlFrom, 'package.json'));
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
      const defaultShell = String(job.defaults?.run?.shell ?? wf.defaults?.run?.shell ?? '');
      for (const [n, step] of (job.steps ?? []).entries()) {
        if (String(step.uses ?? '').startsWith('actions/checkout') && step.with?.['fetch-depth'] !== 0) failures.push(`${f} ${id}: checkout without fetch-depth 0`);
        // Third-party actions are pinned to a full commit SHA.
        if (step.uses && !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(step.uses)) failures.push(`${f} ${id}: ${step.uses} is not pinned to a commit SHA`);
        // A pipe hides the exit status of its left side unless pipefail is on.
        const run = String(step.run ?? '').replace(/\|\|/g, '').replace(/'[^']*'/g, "''");
        const shell = String(step.shell ?? defaultShell);
        if (/\|/.test(run) && !/pipefail/.test(shell) && !/set -[a-z]*o pipefail|set -o pipefail/.test(String(step.run))) failures.push(`${f} ${id} step ${n + 1}: pipe without pipefail`);
        if (step.run && !/(^|\s)-[a-z]*e[a-z]*(\s|$)|errexit/.test(shell) && !/^\s*set -[a-z]*e/m.test(String(step.run)) && /\n./.test(String(step.run).trim())) failures.push(`${f} ${id} step ${n + 1}: multi-line run without errexit`);
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
      const inputs = on.workflow_dispatch?.inputs ?? {};
      if (!inputs.activate_generation || !inputs.generation_already_active || !inputs.preview_generation_environment) failures.push(`${f}: activation/confirmation and preview generation environment inputs are required`);
      const phrase = /restrict deployment branches to protected branches/;
      if (!phrase.test(text.replace(/\n#\s*/g, ' '))) failures.push(`${f}: header does not require the environment to restrict deployment branches to protected branches`);
      if (!phrase.test(fs.readFileSync(path.join(ROOT, 'migration/nimbus/acceptance/README.md'), 'utf8').replace(/\s+/g, ' '))) failures.push('README does not require the nimbus-isolated environment to restrict deployment branches to protected branches');
      for (const [id, job] of Object.entries(wf.jobs)) {
        if (job.environment !== 'nimbus-isolated') failures.push(`${f} ${id}: not bound to the nimbus-isolated environment`);
        // The first run step (after checkout) fails closed on every secret and variable and runs the preflight.
        const guard = job.steps?.find((st) => st.run)?.run ?? '';
        const firstRun = job.steps?.findIndex((st) => st.run) ?? -1;
        if (job.steps?.slice(0, firstRun).some((st) => !String(st.uses ?? '').startsWith('actions/checkout'))) failures.push(`${f} ${id}: a step other than checkout runs before the fail-closed step`);
        for (const name of Object.keys(job.env ?? {}).filter((k) => /(secrets|vars)\./.test(String(job.env[k])))) if (!guard.includes(`\${${name}:?`)) failures.push(`${f} ${id}: first step does not fail closed on ${name}`);
        if (!/TARGET_URL:\?/.test(guard)) failures.push(`${f} ${id}: first step does not fail closed on the target`);
        if (!/scripts\/nimbus\/isolated-preflight\.mjs/.test(guard)) failures.push(`${f} ${id}: first step does not run isolated-preflight.mjs`);
        if (!/NIMBUS_ISOLATED_HOST/.test(JSON.stringify(job.env)) || !/NIMBUS_PRODUCTION_PROJECT_REF/.test(JSON.stringify(job.env))) failures.push(`${f} ${id}: host allowlist or production project ref not wired`);
      }
    }
  }
  const legacyIndexing = spawnSync('git', ['diff', '--quiet', 'bb057a7', '--', '.github/workflows/index-docs.yml'], { cwd: gitRoot }).status;
  if (legacyIndexing !== 0) failures.push('.github/workflows/index-docs.yml differs from bb057a7');
  return { failures, files };
}
