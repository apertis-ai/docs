// #14 release preflight (scripts/nimbus/release-preflight.mjs): read-only facts about the candidate, its CI,
// the production Pages project and the rollback point; the release goes ahead only when every check holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { judge } from '../../scripts/nimbus/release-preflight.mjs';

const ROLLBACK = '2efbe4c4-db00-4b7f-b4cd-34df32047ff2';
const ready = () => ({
  phase: 'before-release',
  candidate: { expected: 'abc123', head: 'abc123', clean: true, pushed: true, buildId: 'd9ae.84b5', previewBuildId: 'd9ae.84b5' },
  ci: { conclusions: ['success', 'success', 'success'], pending: 0 },
  project: {
    name: 'docs', productionBranch: 'main', buildCommand: 'npm run build', outputDir: 'build',
    canonicalDeploymentId: ROLLBACK, deployments: [{ id: ROLLBACK, environment: 'production', status: 'success' }],
    askRetrievalSource: 'legacy',
  },
  rollback: { deploymentId: ROLLBACK, legacyBundle: 'main.9321920d.js' },
  live: { buildId: null, legacyBundle: 'main.9321920d.js' },
});
const failures = (mutate: (f: ReturnType<typeof ready>) => void) => { const f = ready(); mutate(f); return judge(f).failures; };

test('a ready release passes every check', () => {
  assert.deepEqual(judge(ready()), { ok: true, failures: [] });
});

test('the wrong project or changed build settings are refused', () => {
  assert.match(failures((f) => { f.project.name = 'apertis-docs-nimbus-isolated'; }).join(), /project/);
  assert.match(failures((f) => { f.project.productionBranch = 'release'; }).join(), /production branch/);
  assert.match(failures((f) => { f.project.buildCommand = 'npm run build:legacy'; }).join(), /build command/);
  assert.match(failures((f) => { f.project.outputDir = 'site-nimbus/dist'; }).join(), /output/);
});

test('a candidate that is not the approved commit, is dirty, unpushed or not built by Pages is refused', () => {
  assert.match(failures((f) => { f.candidate.head = 'def456'; }).join(), /approved candidate/);
  assert.match(failures((f) => { f.candidate.clean = false; }).join(), /uncommitted/);
  assert.match(failures((f) => { f.candidate.pushed = false; }).join(), /pushed/);
  assert.match(failures((f) => { f.candidate.previewBuildId = null; }).join(), /preview/);
  assert.match(failures((f) => { f.candidate.previewBuildId = 'd9ae.0000'; }).join(), /preview/);
});

test('CI that failed, is still running or never ran is refused', () => {
  assert.match(failures((f) => { f.ci.conclusions = ['success', 'failure']; }).join(), /CI/);
  assert.match(failures((f) => { f.ci.pending = 1; }).join(), /CI/);
  assert.match(failures((f) => { f.ci.conclusions = []; }).join(), /CI/);
});

test('a missing or moved rollback point is refused', () => {
  assert.match(failures((f) => { f.project.deployments = []; }).join(), /rollback/);
  assert.match(failures((f) => { f.project.deployments[0].status = 'failure'; }).join(), /rollback/);
  assert.match(failures((f) => { f.project.canonicalDeploymentId = 'other'; }).join(), /production moved/);
  assert.match(failures((f) => { f.live.legacyBundle = null; }).join(), /live site/);
});

test('the release waits for the server-first retrieval setting', () => {
  assert.match(failures((f) => { f.project.askRetrievalSource = null; }).join(), /ASK_RETRIEVAL_SOURCE/);
  assert.match(failures((f) => { f.project.askRetrievalSource = 'generation'; }).join(), /ASK_RETRIEVAL_SOURCE/);
});

test('after the release, production must serve the candidate from a new deployment', () => {
  const after = () => { const f = ready(); f.phase = 'after-release'; f.project.canonicalDeploymentId = 'new'; f.live = { buildId: 'd9ae.84b5', legacyBundle: null }; return f; };
  assert.deepEqual(judge(after()).failures, []);
  const stale = after(); stale.live = { buildId: null, legacyBundle: 'main.9321920d.js' };
  assert.match(judge(stale).failures.join(), /serves/);
  const same = after(); same.project.canonicalDeploymentId = ROLLBACK;
  assert.match(judge(same).failures.join(), /new deployment/);
});
