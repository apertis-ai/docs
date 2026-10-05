// Try it (openspec docs-api-reference-ux "Try it"): reads a documented cURL sample into the request the panel
// sends. DocLayout runs it at build time to mark the code blocks that get the control; the panel runs it again
// on the block's text. Only one plain `curl` command (after leading `#` comment lines) to
// https://api.apertis.ai/v1/... qualifies; anything else returns the reason it does not.

export interface CurlRequest {
  method: string;
  url: string;
  /** The sample's -H headers in order, as [name, value]. */
  headers: [string, string][];
  /** The -d body as authored, or null. */
  body: string | null;
}

export const API_ORIGIN = 'https://api.apertis.ai';
const API_PREFIX = `${API_ORIGIN}/v1/`;
// Flags whose value is not part of the request the panel sends (output files, curl's own reporting).
const SKIP_VALUE = new Set(['-o', '--output', '-w', '--write-out', '-D', '--dump-header', '-m', '--max-time']);
const DATA = new Set(['-d', '--data', '--data-raw', '--data-binary', '--json']);

/** Shell words of `text`, with a `null` at each unescaped newline (end of a command). */
function words(text: string): (string | null)[] | string {
  const out: (string | null)[] = [];
  let word: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      if (text[i + 1] === '\n') { i++; continue; }
      word = (word ?? '') + (text[++i] ?? '');
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0) return 'unterminated quote';
      word = (word ?? '') + text.slice(i + 1, end);
      i = end;
    } else if (c === '"') {
      let s = '';
      for (i++; i < text.length && text[i] !== '"'; i++) {
        if (text[i] === '\\' && '"\\$`\n'.includes(text[i + 1])) { i++; if (text[i] === '\n') continue; }
        s += text[i];
      }
      if (i >= text.length) return 'unterminated quote';
      word = (word ?? '') + s;
    } else if (c === '#' && word === null) {
      while (i + 1 < text.length && text[i + 1] !== '\n') i++;
    } else if (/\s/.test(c)) {
      if (word !== null) out.push(word);
      word = null;
      if (c === '\n') out.push(null);
    } else if ('|;&<>()`'.includes(c)) {
      return 'shell syntax beyond one command';
    } else {
      word = (word ?? '') + c;
    }
  }
  if (word !== null) out.push(word);
  return out;
}

export function parseCurl(text: string): CurlRequest | { reason: string } {
  const all = words(text);
  if (typeof all === 'string') return { reason: all };
  const commands: string[][] = [[]];
  for (const w of all) {
    if (w === null) { if (commands[commands.length - 1].length) commands.push([]); } else commands[commands.length - 1].push(w);
  }
  const args = commands.filter((c) => c.length);
  if (args.length !== 1) return { reason: args.length ? 'more than one command' : 'not a cURL command' };
  const [cmd, ...rest] = args[0];
  if (cmd !== 'curl') return { reason: 'not a cURL command' };

  let method: string | null = null;
  let url: string | null = null;
  const headers: [string, string][] = [];
  const data: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const value = () => { if (i + 1 >= rest.length) throw new Error(`${a} without a value`); return rest[++i]; };
    try {
      if (a === '-X' || a === '--request') method = value().toUpperCase();
      else if (a === '-H' || a === '--header') {
        const h = value();
        const colon = h.indexOf(':');
        if (colon < 1) return { reason: `header without a name: ${h}` };
        headers.push([h.slice(0, colon).trim(), h.slice(colon + 1).trim()]);
      } else if (DATA.has(a)) {
        const d = value();
        if (d.startsWith('@')) return { reason: 'body read from a file' };
        if (a === '--json') headers.push(['Content-Type', 'application/json']);
        data.push(d);
      } else if (a === '-F' || a === '--form') return { reason: 'multipart form upload' };
      else if (SKIP_VALUE.has(a)) value();
      else if (a.startsWith('-')) continue; // -i, -v, -s, -N, -L ...: no effect on the request
      else if (url === null) url = a;
      else return { reason: `second URL ${a}` };
    } catch (e) {
      return { reason: (e as Error).message };
    }
  }
  if (!url?.startsWith(API_PREFIX)) return { reason: `not a request to ${API_PREFIX}` };
  const body = data.length ? data.join('&') : null;
  return { method: method ?? (body === null ? 'GET' : 'POST'), url, headers, body };
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** Source text of a rendered code block's inner HTML (Shiki spans stripped, entities decoded). Build-time only. */
export function codeText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITY[e] ?? m);
}

/** DocLayout: adds `data-try-it` to every `<pre>` in `html` whose code is an eligible sample. */
export function markTryIt(html: string): { html: string; count: number } {
  let count = 0;
  const out = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (m, attrs: string, inner: string) => {
    if ('reason' in parseCurl(codeText(inner))) return m;
    count++;
    return `<pre${attrs} data-try-it>${inner}</pre>`;
  });
  return { html: out, count };
}
