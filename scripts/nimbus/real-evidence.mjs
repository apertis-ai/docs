// Judgement of the isolated-real matrix entries (issue #12), kept pure so gate-mutants.mjs can prove
// that every binding fails when it does not hold. acceptance.mjs collects the facts; this decides.
//
// A real-* entry PASSes only when the isolated preview served this candidate's buildId, the preview
// reads the generation environment that was indexed, that environment's active generation (read from
// docs_generation_slots after the probe) is the receipt's generation, and the entry's own evidence
// holds. A fact that could not be observed is BLOCKED; a fact that contradicts is FAIL.

// Cloudflare Turnstile test sitekeys (always pass / always block / force a challenge) and its dummy token.
export const TEST_SITEKEY = /^[123]x0{20}[A-F]{2}$/i;
export const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const norm = (p) => p.replace(/[#?].*$/, '').replace(/(.)\/$/, '$1');

/**
 * @param {'real-assistant'|'real-turnstile'|'real-indexing'} entry
 * @param {{ manifestBuildId: string, servedBuildId: string|null, receipt: any|null,
 *           generationEnvironment?: string, previewGenerationEnvironment?: string,
 *           activeGenerationId: number|'none'|null, probe: { ok: boolean, sources: string[], record: any } }} f
 * `activeGenerationId` null means it could not be read.
 */
export function judgeReal(entry, f) {
  const fail = [], blocked = [];
  if (!f.receipt) blocked.push('no generation receipt');
  if (f.servedBuildId !== f.manifestBuildId) fail.push(`isolated preview serves buildId ${f.servedBuildId}, candidate is ${f.manifestBuildId}`);
  if (!f.generationEnvironment || !f.previewGenerationEnvironment) blocked.push('generation environment or the preview\'s ASK_GENERATION_ENVIRONMENT not stated');
  else if (f.generationEnvironment !== f.previewGenerationEnvironment) fail.push(`indexed environment ${f.generationEnvironment} is not the preview's ${f.previewGenerationEnvironment}`);
  const generationId = f.receipt?.generationId;
  if (f.activeGenerationId === null || f.activeGenerationId === undefined) blocked.push('active generation could not be read from docs_generation_slots');
  else if (f.receipt && String(f.activeGenerationId) !== String(generationId)) fail.push(`active generation ${f.activeGenerationId} is not the receipt's ${generationId}`);

  const r = f.probe.record ?? {};
  const turnstile = () => {
    if (!r.sitekey) blocked.push('Turnstile sitekey not observed');
    else if (TEST_SITEKEY.test(r.sitekey)) fail.push(`Turnstile test sitekey ${r.sitekey}`);
    if (r.dummyToken) fail.push('Turnstile dummy token');
    if (r.tokenSent !== true) fail.push('no Turnstile token sent');
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
  if (entry === 'real-turnstile') turnstile();
  else if (entry === 'real-indexing') corpus();
  else { turnstile(); corpus(); if (!f.probe.ok) fail.push('the answer did not stream to [DONE] with valid citations'); }

  const status = fail.length ? 'FAIL' : blocked.length ? 'BLOCKED' : 'PASS';
  return { status, reasons: [...fail, ...blocked], generationId: generationId ?? null };
}
