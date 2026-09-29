// Query handling for the Pagefind client (#9). Browser-safe (no Node imports). Every rule here applies
// the same way to every query and page: no query list, no per-page keyword, no page id or path.
//
// Tokenization: Pagefind indexes a path or URL such as `https://api.apertis.ai/v1/chat/completions`
// as one compound word, so a reader's partial path (`chat/completions`) matches it neither literally
// nor by prefix. Every query that contains separator punctuation is therefore also searched with that
// punctuation as word breaks, the way most search engines tokenize it.
//
// Ranking: variants merge by Pagefind score, not by variant order, so a page that merely mentions a
// path literally does not outrank the page about it. Then the top RERANK results re-rank by how much
// of the query names the page (its title, URL path and headings), Pagefind score breaking ties.

/** Anything that is not a letter, digit, whitespace, `_` (a Pagefind word character) or `-` (Pagefind splits hyphenated words itself). */
const SEPARATORS = /[^\p{L}\p{N}\s_-]+/gu;

/** The query as typed, then (when it differs) with separator punctuation turned into word breaks. */
export function queryVariants(query: string): string[] {
  const q = query.trim();
  const parts = q.replace(SEPARATORS, ' ').replace(/\s+/g, ' ').trim();
  return parts && parts !== q ? [q, parts] : [q];
}

/**
 * How many top results re-rank: the dialog's visible results, whose fragments it loads anyway. Re-ranking
 * loads them before the dialog knows whether a newer keystroke superseded the search, so a superseded
 * search now loads its fragments too.
 */
export const RERANK = 10;

interface Hit {
  id: string;
  score?: number;
  data?(): Promise<{ url: string; meta: { title?: string }; anchors?: { text: string }[] }>;
}

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Share of the query's words that name the page: a word in its title or URL path counts 1, a word only in a heading ½. */
function naming(query: string[], page: Awaited<ReturnType<NonNullable<Hit['data']>>>): number {
  const named = new Set([...words(page.meta.title ?? ''), ...words(page.url)]);
  const headed = new Set((page.anchors ?? []).flatMap((a) => words(a.text)));
  return query.reduce((sum, w) => sum + (named.has(w) ? 1 : headed.has(w) ? 0.5 : 0), 0) / query.length;
}

/** Runs every variant, keeps each page once at its best score, orders by score, then re-ranks the top RERANK. */
export async function searchWithVariants<R extends Hit>(query: string, run: (q: string) => Promise<R[]>): Promise<R[]> {
  const best = new Map<string, R>();
  for (const q of queryVariants(query)) {
    for (const r of await run(q)) {
      const seen = best.get(r.id);
      if (!seen || (r.score ?? 0) > (seen.score ?? 0)) best.set(r.id, r);
    }
  }
  const merged = [...best.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const q = [...new Set(words(query))];
  if (!q.length) return merged;
  const top = merged.slice(0, RERANK);
  const named = await Promise.all(top.map(async (r) => (r.data ? naming(q, await r.data()) : 0)));
  const order = top.map((r, i) => ({ r, n: named[i] })).sort((a, b) => b.n - a.n).map((x) => x.r);
  return [...order, ...merged.slice(RERANK)];
}
