// Which pages a failed CI paired-perf run may re-measure (operator decision on #4, 2026-10-02):
// only when every failure of the full and PoC gates is a timing exceedance (lcp, tbt, searchOpenMs), on at
// most MAX_PAGES pages. Anything else (bytes, legacy identity, coverage, invalid samples) is final.
//   node scripts/nimbus/paired-perf-remeasure.mjs <full merged.json> <poc merged.json>
// Prints `remeasure=<JSON page list>` and exits 0 when the run may re-measure; exits 1 otherwise.
import fs from 'node:fs';

export const MAX_PAGES = 7;

/** @returns {{ pages: string[] } | { reason: string }} */
export function remeasurable(results) {
  const timing = (r) => r.gates.filter((g) => g.rule === 'timing' && !g.pass);
  if (!results.every((r) => r.failures.length === timing(r).length)) return { reason: 'a non-timing failure is final' };
  const pages = [...new Set(results.flatMap(timing).map((g) => g.page))];
  if (!pages.length) return { reason: 'nothing to re-measure' };
  if (pages.length > MAX_PAGES) return { reason: `${pages.length} pages exceed timing; more than ${MAX_PAGES} is final` };
  return { pages };
}

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const r = remeasurable(process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))));
  if ('reason' in r) { console.error(r.reason); process.exit(1); }
  console.log(`remeasure=${JSON.stringify(r.pages)}`);
  console.error(`timing exceedance only, re-measuring once: ${r.pages.join(' ')}`);
}
