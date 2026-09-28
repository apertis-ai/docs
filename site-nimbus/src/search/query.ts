// Query tokenization for the Pagefind client (#9). Pagefind indexes a path or URL such as
// `https://api.apertis.ai/v1/chat/completions` as one compound word, so a reader's partial path
// (`chat/completions`) matches it neither literally nor by prefix. Every query that contains
// separator punctuation is therefore also searched with that punctuation as word breaks, the way
// most search engines tokenize it. Literal matches keep their rank; part matches follow. This
// applies to every query and page alike: no query list, no per-page keywords, no index change.
// Browser-safe (no Node imports).

/** Anything that is not a letter, digit, whitespace, `_` (a Pagefind word character) or `-` (Pagefind splits hyphenated words itself). */
const SEPARATORS = /[^\p{L}\p{N}\s_-]+/gu;

/** The query as typed, then (when it differs) with separator punctuation turned into word breaks. */
export function queryVariants(query: string): string[] {
  const q = query.trim();
  const parts = q.replace(SEPARATORS, ' ').replace(/\s+/g, ' ').trim();
  return parts && parts !== q ? [q, parts] : [q];
}

/** Runs every variant; results of earlier variants rank first, duplicates are dropped. */
export async function searchWithVariants<R extends { id: string }>(query: string, run: (q: string) => Promise<R[]>): Promise<R[]> {
  const seen = new Set<string>();
  const out: R[] = [];
  for (const q of queryVariants(query)) {
    for (const r of await run(q)) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
  }
  return out;
}
