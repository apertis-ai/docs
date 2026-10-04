// Page header (#8 reading layout): splits the rendered body into its H1 and the rest, and picks the
// one-sentence description. Build-time only; works on the Markdown renderer's HTML string.
//
// Description rule (openspec docs-shell-interfaces "Reading layout and page header", lead review of
// 65cc9b1):
// - front-matter `description` when present (the body is untouched);
// - else the first sentence of the body's OPENING block, only when that block is a prose paragraph.
//   The sentence MOVES into the header, so the body does not repeat it; the rest of the paragraph stays
//   (or the paragraph is removed when nothing is left). Links and code stay intact because the split is
//   only in top-level text;
// - a sentence ending with ':' or shorter than 4 words is rejected; a later paragraph is never borrowed;
// - otherwise there is no description (DocLayout renders no element for it).

export interface PageHeaderParts {
  /** The body's H1 element, verbatim (id, icon image and inline markup kept). */
  h1: string;
  /** Description HTML, or null when neither front matter nor the opening paragraph qualifies. */
  description: string | null;
  /** The body without the H1 (and without the moved sentence). */
  body: string;
}

const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
// "e.g. OpenAI" and similar do not end a sentence.
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|approx|incl|Mr|Ms|Dr|No|Inc|Ltd)\.$/i;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html: string) => html.replace(/<[^>]*>/g, '').trim();

/** Top-level `<p>` elements of `html`: [start, end, innerStart, innerEnd]. */
function topLevelParagraphs(html: string): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let depth = 0;
  let open: [number, number] | null = null;
  for (const m of html.matchAll(TAG)) {
    if (!m[2] || VOID.has(m[2].toLowerCase()) || m[3]) continue;
    if (m[1]) {
      depth--;
      if (depth === 0 && open && m[2].toLowerCase() === 'p') { out.push([open[0], m.index! + m[0].length, open[1], m.index!]); open = null; }
    } else {
      if (depth === 0 && m[2].toLowerCase() === 'p') open = [m.index!, m.index! + m[0].length];
      depth++;
    }
  }
  return out;
}

/** End offset of the first sentence in `inner` (a paragraph's HTML), splitting only in top-level text. */
export function firstSentenceEnd(inner: string): number {
  let depth = 0;
  let last = 0;
  const scan = (from: number, to: number): number => {
    const re = /[.!?](?=\s)/g;
    re.lastIndex = from;
    for (let m = re.exec(inner); m && m.index < to; m = re.exec(inner)) {
      if (!ABBREVIATION.test(inner.slice(Math.max(0, m.index - 8), m.index + 1))) return m.index + 1;
    }
    return -1;
  };
  for (const m of inner.matchAll(TAG)) {
    if (depth === 0) {
      const end = scan(last, m.index!);
      if (end >= 0) return end;
    }
    if (m[2] && !VOID.has(m[2].toLowerCase()) && !m[3]) depth += m[1] ? -1 : 1;
    last = m.index! + m[0].length;
  }
  const end = depth === 0 ? scan(last, inner.length) : -1;
  return end >= 0 ? end : inner.length;
}

export function pageHeaderParts(html: string, frontDescription?: string): PageHeaderParts {
  const m = /^\s*(<h1\b[\s\S]*?<\/h1>)/.exec(html);
  if (!m) throw new Error('page header: the rendered body must start with its <h1> (converter/convert.ts guarantees one)');
  const h1 = m[1];
  const body = html.slice(m[0].length);
  if (frontDescription) return { h1, description: escapeHtml(frontDescription), body };
  const none = { h1, description: null, body };
  const p = topLevelParagraphs(body)[0];
  if (!p || body.slice(0, p[0]).trim() !== '') return none; // the opening block is not a paragraph
  const [start, end, innerStart, innerEnd] = p;
  const inner = body.slice(innerStart, innerEnd);
  const cut = firstSentenceEnd(inner);
  const sentence = inner.slice(0, cut).trim();
  const words = text(sentence).split(/\s+/).filter(Boolean);
  if (words.length < 4 || text(sentence).endsWith(':')) return none;
  const rest = inner.slice(cut).trim();
  const lead = rest ? `${body.slice(start, innerStart)}${rest}${body.slice(innerEnd, end)}` : '';
  return { h1, description: sentence, body: body.slice(0, start) + lead + body.slice(end) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2025-03-01T10:00:00+08:00` -> `Mar 1, 2025`: the author's own calendar date, independent of the build machine. */
export function displayDate(iso: string): string {
  const [, y, mo, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) ?? [];
  if (!y) throw new Error(`page header: bad date ${iso}`);
  return `${MONTHS[Number(mo) - 1]} ${Number(d)}, ${y}`;
}
