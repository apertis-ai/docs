// Docs MCP server (openspec docs-agent-access "Docs MCP endpoint"): stateless MCP over Streamable HTTP with
// JSON responses, no key and no session. functions/mcp.ts is the Pages adapter; this module is pure (Fetch API
// only) so node --test reaches it. Its only data is the deployment's own /llms.txt and /llms-full.txt, read
// through src/agent/llms.ts, so both tools see exactly the agent-eligible pages.
import { pageKey, parseFull, parseIndex } from './llms.ts';

/** Newest first; an initialize that asks for one of these gets it back, any other gets the first. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26'];

export interface CorpusPage {
  title: string;
  /** Absolute canonical URL. */
  url: string;
  description: string;
  markdown: string;
  /** pageKey(url). */
  key: string;
  titleWords: string[];
  words: string[];
}
export interface DocsCorpus { pages: CorpusPage[] }

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
// ponytail: suffix-stripping prefix match ("caching" finds "cache"); a real stemmer if ranking needs it.
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w);

/** The pages listed in llms.txt, each with its llms-full.txt artifact; a page without one is a broken deployment. */
export function corpusFrom(index: string, full: string): DocsCorpus {
  const bodies = new Map(parseFull(full).map((f) => [pageKey(f.url), f]));
  return {
    pages: parseIndex(index).map((e) => {
      const key = pageKey(e.markdownUrl);
      const body = key === null ? undefined : bodies.get(key);
      if (!body) throw new Error(`docs MCP: ${e.markdownUrl} is listed in llms.txt but has no llms-full.txt artifact`);
      return { title: e.title, url: body.url, description: e.description, markdown: body.markdown, key: key!, titleWords: words(e.title), words: words(body.markdown) };
    }),
  };
}

export interface SearchResult { title: string; url: string; snippet: string }

export function searchDocs(corpus: DocsCorpus, query: string, limit: number): SearchResult[] {
  const terms = [...new Set(words(query).map(stem))];
  const phrase = query.trim().toLowerCase();
  const scored = corpus.pages.map((p) => {
    let score = 0;
    for (const t of terms) {
      const hits = p.words.filter((w) => w.startsWith(t)).length;
      if (hits) score += 1 + Math.log(hits);
      if (p.titleWords.some((w) => w.startsWith(t))) score += 5;
    }
    if (score && p.title.toLowerCase().includes(phrase)) score += 5;
    return { p, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ p }) => ({ title: p.title, url: p.url, snippet: snippet(p, phrase, terms) }));
}

function snippet(p: CorpusPage, phrase: string, terms: string[]): string {
  const text = p.markdown.replace(/^#.*\n/, '').replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  let at = lower.indexOf(phrase);
  for (const t of terms) if (at < 0) at = lower.search(new RegExp(`\\b${t}`));
  if (at < 0) return p.description;
  const start = Math.max(0, lower.lastIndexOf(' ', Math.max(0, at - 80)) + 1);
  const end = text.indexOf(' ', at + 200);
  return `${start > 0 ? '…' : ''}${text.slice(start, end < 0 ? undefined : end).trim()}${end < 0 ? '' : '…'}`;
}

export const TOOLS = [
  {
    name: 'search_docs',
    title: 'Search Apertis docs',
    description: 'Search the Apertis documentation. Returns ranked pages with title, URL and a text snippet; read one with get_page.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms, e.g. "prompt caching".' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Maximum number of results.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_page',
    title: 'Read an Apertis docs page',
    description: 'Get one Apertis documentation page as Markdown. Accepts a docs.apertis.ai URL or path (as returned by search_docs).',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'e.g. https://docs.apertis.ai/api/text-generation/prompt-cache or /api/text-generation/prompt-cache' } },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

type Id = string | number | null;
class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) { super(message); this.code = code; }
}
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const failure = (status: number, id: Id, code: number, message: string) => json(status, { jsonrpc: '2.0', id, error: { code, message } });
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

async function callTool(params: Record<string, unknown>, corpus: () => Promise<DocsCorpus>) {
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  if (typeof args !== 'object' || args === null) throw new RpcError(-32602, 'arguments must be an object');
  if (params.name === 'search_docs') {
    const { query, limit = 5 } = args;
    if (typeof query !== 'string' || !query.trim()) throw new RpcError(-32602, 'search_docs: query must be a non-empty string');
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 10) throw new RpcError(-32602, 'search_docs: limit must be an integer from 1 to 10');
    const results = searchDocs(await corpus(), query, limit);
    const body = results.length ? results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n') : `No pages match "${query}".`;
    return { ...text(body), structuredContent: { results } };
  }
  if (params.name === 'get_page') {
    if (typeof args.url !== 'string') throw new RpcError(-32602, 'get_page: url must be a string');
    const key = pageKey(args.url);
    const page = (await corpus()).pages.find((p) => p.key === key);
    // Unlisted pages get a tool error with no document content (never a fetch of the path itself).
    return page ? text(page.markdown) : text(`Not an Apertis documentation page: ${args.url}. Use search_docs to find one, or see https://docs.apertis.ai/llms.txt.`, true);
  }
  throw new RpcError(-32602, `Unknown tool: ${String(params.name)}`);
}

export async function handleMcp(request: Request, corpus: () => Promise<DocsCorpus>): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  const version = request.headers.get('mcp-protocol-version');
  if (version && !PROTOCOL_VERSIONS.includes(version)) return failure(400, null, -32600, `Unsupported MCP-Protocol-Version ${version}`);
  let msg: unknown;
  try { msg = JSON.parse(await request.text()); } catch { return failure(400, null, -32700, 'Parse error'); }
  if (Array.isArray(msg)) return failure(400, null, -32600, 'Batched JSON-RPC is not supported');
  if (typeof msg !== 'object' || msg === null || (msg as { jsonrpc?: unknown }).jsonrpc !== '2.0') return failure(400, null, -32600, 'Invalid Request');
  const { id, method, params = {} } = msg as { id?: unknown; method?: unknown; params?: unknown };
  const validId = typeof id === 'string' || typeof id === 'number';
  // Notifications (no id) and responses to us (no method) are accepted with 202 and no body.
  if (typeof method === 'string' && id === undefined) return new Response(null, { status: 202 });
  if (method === undefined && validId && ('result' in msg || 'error' in msg)) return new Response(null, { status: 202 });
  if (typeof method !== 'string' || !validId) return failure(400, validId ? id : null, -32600, 'Invalid Request');
  if (typeof params !== 'object' || params === null) return failure(200, id, -32602, 'params must be an object');
  const p = params as Record<string, unknown>;
  try {
    let result: unknown;
    if (method === 'initialize') {
      result = {
        protocolVersion: PROTOCOL_VERSIONS.includes(p.protocolVersion as string) ? p.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'apertis-docs', title: 'Apertis Documentation', version: '1.0.0' },
        instructions: 'Search the Apertis documentation with search_docs, then read a result with get_page.',
      };
    } else if (method === 'ping') result = {};
    else if (method === 'tools/list') result = { tools: TOOLS };
    else if (method === 'tools/call') result = await callTool(p, corpus);
    else return failure(200, id, -32601, `Method not found: ${method}`);
    return json(200, { jsonrpc: '2.0', id, result });
  } catch (e) {
    if (e instanceof RpcError) return failure(200, id, e.code, e.message);
    console.error('mcp:', e instanceof Error ? e.message : e);
    return failure(500, id, -32603, 'Internal error');
  }
}
