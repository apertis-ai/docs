// Judgement of the isolated-real matrix entries (issue #12), kept pure so gate-mutants.mjs can prove
// that every binding fails when it does not hold. acceptance.mjs collects the facts; this decides.
//
// Two isolated deployments serve the same candidate build and read the same generation (operator
// decision on #12: a real Turnstile widget never issues a token to an automated browser):
// - the real-key preview (NIMBUS_ISOLATED_URL) carries the real sitekey and secret. real-turnstile is
//   judged there without a browser token: the real sitekey is served, and the real handler rejects a
//   request without a token (400) and a forged token through Cloudflare siteverify (403,
//   invalid-input-response).
// - the test-key preview (NIMBUS_ISOLATED_TESTKEY_URL) has Cloudflare's always-pass test secret. The
//   harness renders the widget with the always-pass test sitekey, so real-assistant and real-indexing
//   drive the real handler, Jina, the isolated Supabase generation and the Apertis completion end to
//   end. There the dummy token is required, which labels the path instead of hiding it.
// A real-* entry PASSes only when its preview served this candidate's buildId, the preview reads the
// generation environment that was indexed, that environment's active generation (read from
// docs_generation_slots after the probe) is the receipt's generation, and the entry's own evidence
// holds. A fact that could not be observed is BLOCKED; a fact that contradicts is FAIL.

// Cloudflare Turnstile test sitekeys (always pass / always block / force a challenge) and its dummy token.
export const TEST_SITEKEY = /^[123]x0{20}[A-F]{2}$/i;
export const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
export const ALWAYS_PASS_SITEKEY = '1x00000000000000000000AA';
// The exact legacy error strings (migration/nimbus/fixtures/ask-wire.json).
export const MISSING_TOKEN_ERROR = 'Missing Turnstile token';
export const FAILED_TOKEN_ERROR = 'Turnstile verification failed';

const norm = (p) => p.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1');

/**
 * @param {'real-assistant'|'real-turnstile'|'real-indexing'} entry
 * @param {{ manifestBuildId: string, servedBuildId: string|null, testkeyServedBuildId: string|null, receipt: any|null,
 *           generationEnvironment?: string, previewGenerationEnvironment?: string,
 *           activeGenerationId: number|'none'|null,
 *           enforcement: { sitekey?: string, missing?: { status: number, error?: string }, forged?: { status: number, error?: string, codes?: string[] } },
 *           probe: { ok: boolean, sources: string[], record: any } }} f
 * `servedBuildId` is the real-key preview's, `testkeyServedBuildId` the test-key preview's.
 * `activeGenerationId` null means it could not be read.
 */
export function judgeReal(entry, f) {
  const fail = [], blocked = [];
  if (!f.receipt) blocked.push('no generation receipt');
  const served = entry === 'real-turnstile' ? ['real-key', f.servedBuildId] : ['test-key', f.testkeyServedBuildId];
  if (served[1] !== f.manifestBuildId) fail.push(`${served[0]} isolated preview serves buildId ${served[1]}, candidate is ${f.manifestBuildId}`);
  if (!f.generationEnvironment || !f.previewGenerationEnvironment) blocked.push('generation environment or the preview\'s ASK_GENERATION_ENVIRONMENT not stated');
  else if (f.generationEnvironment !== f.previewGenerationEnvironment) fail.push(`indexed environment ${f.generationEnvironment} is not the preview's ${f.previewGenerationEnvironment}`);
  const generationId = f.receipt?.generationId;
  if (f.activeGenerationId === null || f.activeGenerationId === undefined) blocked.push('active generation could not be read from docs_generation_slots');
  else if (f.receipt && String(f.activeGenerationId) !== String(generationId)) fail.push(`active generation ${f.activeGenerationId} is not the receipt's ${generationId}`);

  // real-key preview: the real sitekey is served and the real handler enforces Turnstile.
  const enforcement = () => {
    const e = f.enforcement ?? {};
    if (!e.sitekey) blocked.push('Turnstile sitekey not observed on the real-key preview');
    else if (TEST_SITEKEY.test(e.sitekey)) fail.push(`Turnstile test sitekey ${e.sitekey} on the real-key preview`);
    if (!e.missing) blocked.push('no request without a token was observed');
    else if (e.missing.status !== 400 || e.missing.error !== MISSING_TOKEN_ERROR) fail.push(`a request without a token answered ${e.missing.status} ${JSON.stringify(e.missing.error)}, expected 400 ${JSON.stringify(MISSING_TOKEN_ERROR)}`);
    if (!e.forged) blocked.push('no request with a forged token was observed');
    else if (e.forged.status !== 403 || e.forged.error !== FAILED_TOKEN_ERROR) fail.push(`a forged token answered ${e.forged.status} ${JSON.stringify(e.forged.error)}, expected 403 ${JSON.stringify(FAILED_TOKEN_ERROR)}`);
    else if (!(e.forged.codes ?? []).includes('invalid-input-response')) fail.push(`a forged token was not rejected by Cloudflare siteverify (codes ${JSON.stringify(e.forged.codes ?? [])})`);
  };
  // test-key preview: the always-pass test sitekey and its dummy token, answered 200 by the real handler.
  const r = f.probe.record ?? {};
  const testkey = () => {
    if (!r.sitekey) blocked.push('Turnstile sitekey not observed on the test-key preview');
    else if (r.sitekey !== ALWAYS_PASS_SITEKEY) fail.push(`the assistant probe used sitekey ${r.sitekey}, not the always-pass test sitekey`);
    if (r.tokenSent !== true || r.dummyToken !== true) fail.push('the assistant probe did not send the always-pass dummy token');
    if (r.status !== 200) fail.push(`/api/ask answered ${r.status}`);
  };
  const ready = f.receipt && f.receipt.generationState === 'ready' && f.receipt.buildId === f.manifestBuildId && f.receipt.documents?.failed === 0 && f.receipt.documents?.pending === 0;
  const cited = f.probe.sources.map(norm);
  const inGeneration = new Set((f.receipt?.items ?? []).map((i) => norm(i.urlPath)));
  const fromGeneration = cited.length > 0 && cited.every((p) => inGeneration.has(p));
  const corpus = () => {
    if (f.receipt && !ready) fail.push('receipt generation is not ready for this buildId');
    if (f.receipt && !fromGeneration) fail.push(`citations ${JSON.stringify(cited)} are not all documents of the generation`);
  };
  if (entry === 'real-turnstile') enforcement();
  else if (entry === 'real-indexing') { testkey(); corpus(); }
  else { testkey(); corpus(); if (!f.probe.ok) fail.push('the answer did not stream to [DONE] with valid citations'); }

  const status = fail.length ? 'FAIL' : blocked.length ? 'BLOCKED' : 'PASS';
  return { status, reasons: [...fail, ...blocked], generationId: generationId ?? null };
}
