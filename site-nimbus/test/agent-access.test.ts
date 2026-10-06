// openspec docs-agent-access: the llms.txt / llms-full.txt format and the docs MCP server (functions/mcp.ts),
// on a small corpus. The built files themselves are checked by test:dist.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { llmsFull, llmsIndex, pageKey, parseFull, parseIndex, type LlmsPage } from '../src/agent/llms.ts';
import { corpusFrom, handleMcp } from '../src/agent/mcp.ts';

const page = (path: string, title: string, section: string, markdown: string, description = `About ${title} in a sentence.`): LlmsPage => ({
  title, section, description, markdown,
  url: `https://docs.apertis.ai${path}`,
  markdownUrl: `https://docs.apertis.ai${path.endsWith('/') ? `${path}index.md` : `${path}.md`}`,
});
const PAGES = [
  page('/intro', 'Quick Overview', 'Getting Started', '# Quick Overview\n\nSign up and make a request.\n\n---\n\nSource: not a frame\n'),
  page('/api/', 'API Reference', 'API Reference', '# API Reference\n\nEvery endpoint.\n'),
  page('/api/text-generation/prompt-cache', 'Prompt Cache', 'Text Generation', '# Prompt Cache\n\nApertis caches repeated prompts, so cached prompt tokens cost less.\n'),
  page('/api/text-generation/streaming', 'Streaming [SSE] Output', 'Text Generation', '# Streaming\n\nStream tokens. A prompt is sent once.\n'),
  page('/help/ideas', 'Ideas', 'Other', '# Ideas\n\nTell us.\n'),
];
const INDEX = llmsIndex(PAGES);
const FULL = llmsFull(PAGES);

test('llms.txt: H1, summary blockquote, one H2 per section in first-appearance order, one entry per page', () => {
  const lines = INDEX.split('\n');
  assert.equal(lines[0], '# Apertis Documentation');
  assert.match(lines[2], /^> \S/);
  assert.deepEqual(lines.filter((l) => l.startsWith('## ')), ['## Getting Started', '## API Reference', '## Text Generation', '## Other']);
  assert.ok(INDEX.includes('- [Streaming \\[SSE\\] Output](https://docs.apertis.ai/api/text-generation/streaming.md): About Streaming [SSE] Output in a sentence.\n'));
  assert.ok(INDEX.includes('- [API Reference](https://docs.apertis.ai/api/index.md): '));
  assert.deepEqual(parseIndex(INDEX), PAGES.map(({ title, markdownUrl, description, section }) => ({ title, markdownUrl, description, section })));
  assert.ok(INDEX.endsWith('\n') && !INDEX.endsWith('\n\n'));
});

test('llms.txt refuses an entry without a one-line description', () => {
  assert.throws(() => llmsIndex([page('/a', 'A', 'S', '# A\n', '')]), /description/);
  assert.throws(() => llmsIndex([page('/a', 'A', 'S', '# A\n', 'two\nlines')]), /description/);
});

test('llms-full.txt: Source line, the artifact bytes, --- between; parsing gives the bytes back', () => {
  assert.ok(FULL.startsWith('Source: https://docs.apertis.ai/intro\n# Quick Overview\n'));
  assert.ok(FULL.includes('Source: not a frame\n---\nSource: https://docs.apertis.ai/api/\n# API Reference\n'));
  assert.deepEqual(parseFull(FULL), PAGES.map(({ url, markdown }) => ({ url, markdown })));
  // A framing an artifact could fake is refused at build time rather than mis-split later.
  assert.throws(() => llmsFull([page('/a', 'A', 'S', '# A\n---\nSource: https://docs.apertis.ai/b\nx\n'), page('/b', 'B', 'S', '# B\n')]), /frame/);
  assert.throws(() => llmsFull([page('/a', 'A', 'S', '# A')]), /newline/);
});

test('pageKey accepts URL, path, slash, no-slash and .md forms on docs.apertis.ai only', () => {
  for (const s of ['https://docs.apertis.ai/api/text-generation/prompt-cache', 'https://docs.apertis.ai/api/text-generation/prompt-cache/',
    '/api/text-generation/prompt-cache', '/api/text-generation/prompt-cache/', '/api/text-generation/prompt-cache.md', 'api/text-generation/prompt-cache?x=1#h']) {
    assert.equal(pageKey(s), '/api/text-generation/prompt-cache', s);
  }
  for (const s of ['/api', '/api/', '/api/index.md', 'https://docs.apertis.ai/api/']) assert.equal(pageKey(s), '/api', s);
  assert.equal(pageKey('https://evil.example/api/'), null);
  assert.equal(pageKey('http://[bad'), null);
});

// ---- POST /mcp ----
const corpus = corpusFrom(INDEX, FULL);
const post = (body: unknown, headers: Record<string, string> = {}) => handleMcp(new Request('https://docs.apertis.ai/mcp', {
  method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}), async () => corpus);
const rpc = async (method: string, params?: unknown, id: number | string = 1) => {
  const res = await post({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  return { status: res.status, body: await res.json() as { jsonrpc: string; id: unknown; result?: any; error?: { code: number; message: string } } };
};
const call = async (name: string, args: unknown) => (await rpc('tools/call', { name, arguments: args })).body;

test('corpusFrom keeps exactly the pages listed in llms.txt and refuses a mismatch', () => {
  assert.deepEqual(corpus.pages.map((p) => p.key), ['/intro', '/api', '/api/text-generation/prompt-cache', '/api/text-generation/streaming', '/help/ideas']);
  assert.throws(() => corpusFrom(INDEX, llmsFull(PAGES.slice(1))), /llms-full/);
});

test('initialize negotiates the protocol version and advertises tools', async () => {
  const { status, body } = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  assert.equal(status, 200);
  assert.equal(body.jsonrpc, '2.0');
  assert.equal(body.id, 1);
  assert.equal(body.result.protocolVersion, '2025-03-26');
  assert.deepEqual(body.result.capabilities, { tools: {} });
  assert.equal(body.result.serverInfo.name, 'apertis-docs');
  assert.equal((await rpc('initialize', { protocolVersion: '1999-01-01' })).body.result.protocolVersion, '2025-06-18');
  assert.equal((await rpc('initialize', {})).body.result.protocolVersion, '2025-06-18');
});

test('notifications and client responses get 202 with no body; ping answers {}', async () => {
  for (const msg of [{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 9, result: {} }]) {
    const res = await post(msg);
    assert.equal(res.status, 202);
    assert.equal(await res.text(), '');
  }
  assert.deepEqual((await rpc('ping', undefined, 'p')).body, { jsonrpc: '2.0', id: 'p', result: {} });
});

test('tools/list exposes search_docs and get_page with their input schemas', async () => {
  const { tools } = (await rpc('tools/list')).body.result;
  assert.deepEqual(tools.map((t: { name: string }) => t.name), ['search_docs', 'get_page']);
  assert.deepEqual(tools[0].inputSchema.required, ['query']);
  assert.deepEqual([tools[0].inputSchema.properties.limit.minimum, tools[0].inputSchema.properties.limit.maximum], [1, 10]);
  assert.deepEqual(tools[1].inputSchema.required, ['url']);
});

test('search_docs ranks title matches first and returns title, URL and snippet', async () => {
  const r = await call('search_docs', { query: 'prompt caching' });
  assert.equal(r.result.isError, undefined);
  const results = r.result.structuredContent.results as { title: string; url: string; snippet: string }[];
  assert.equal(results[0].url, 'https://docs.apertis.ai/api/text-generation/prompt-cache');
  assert.equal(results[0].title, 'Prompt Cache');
  assert.match(results[0].snippet, /caches repeated prompts/);
  assert.ok(results.some((x) => x.url.endsWith('/streaming')), 'a body-only match still ranks');
  assert.ok(!results.some((x) => x.url.endsWith('/help/ideas')), 'no match, no result');
  assert.match(r.result.content[0].text, /Prompt Cache\nhttps:\/\/docs\.apertis\.ai\/api\/text-generation\/prompt-cache\n/);
  assert.equal((await call('search_docs', { query: 'prompt', limit: 1 })).result.structuredContent.results.length, 1);
  assert.deepEqual((await call('search_docs', { query: 'zzqx' })).result.structuredContent.results, []);
});

test('get_page returns the listed artifact for every accepted form, and a tool error otherwise', async () => {
  for (const url of ['https://docs.apertis.ai/api/text-generation/prompt-cache', '/api/text-generation/prompt-cache/', '/api/text-generation/prompt-cache.md']) {
    const r = await call('get_page', { url });
    assert.equal(r.result.isError, undefined, url);
    assert.deepEqual(r.result.content, [{ type: 'text', text: PAGES[2].markdown }], url);
  }
  assert.equal((await call('get_page', { url: '/api' })).result.content[0].text, PAGES[1].markdown);
  for (const url of ['/openspec/', '/', '/not-listed', 'https://evil.example/intro', '/intro.html']) {
    const r = await call('get_page', { url });
    assert.equal(r.result.isError, true, url);
    assert.equal(r.result.content.length, 1);
    assert.doesNotMatch(r.result.content[0].text, /# |Sign up/, `${url}: no document content`);
  }
});

test('bad arguments, unknown tools and unknown methods are JSON-RPC errors', async () => {
  for (const [name, args] of [['search_docs', {}], ['search_docs', { query: '  ' }], ['search_docs', { query: 'x', limit: 11 }],
    ['search_docs', { query: 'x', limit: 1.5 }], ['get_page', {}], ['get_page', { url: 3 }], ['nope', {}]] as const) {
    assert.equal((await call(name, args)).error?.code, -32602, `${name} ${JSON.stringify(args)}`);
  }
  assert.equal((await rpc('resources/list')).body.error?.code, -32601);
});

test('malformed JSON-RPC gets a JSON-RPC error; batches are refused', async () => {
  const error = async (body: unknown) => { const res = await post(body); return [res.status, (await res.json() as { id: unknown; error: { code: number } })] as const; };
  const [s1, b1] = await error('{not json');
  assert.deepEqual([s1, b1.id, b1.error.code], [400, null, -32700]);
  const [s2, b2] = await error([{ jsonrpc: '2.0', id: 1, method: 'ping' }]);
  assert.deepEqual([s2, b2.id, b2.error.code], [400, null, -32600]);
  for (const bad of [{ id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 1 }, { jsonrpc: '2.0', id: {}, method: 'ping' }, 'null', '3']) {
    const [s, b] = await error(bad);
    assert.deepEqual([s, b.error.code], [400, -32600], JSON.stringify(bad));
  }
});

test('an unsupported MCP-Protocol-Version header is a 400', async () => {
  assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2025-06-18' })).status, 200);
  assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '1999-01-01' })).status, 400);
});

test('every method but POST is 405 with Allow: POST', async () => {
  for (const method of ['GET', 'DELETE', 'PUT', 'OPTIONS', 'HEAD']) {
    const res = await handleMcp(new Request('https://docs.apertis.ai/mcp', { method }), async () => corpus);
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'POST', method);
  }
});

test('a corpus that cannot load is a JSON-RPC internal error', async () => {
  const res = await handleMcp(new Request('https://docs.apertis.ai/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_page', arguments: { url: '/intro' } } }) }),
    async () => { throw new Error('assets down'); });
  assert.equal(res.status, 500);
  assert.equal((await res.json() as { error: { code: number } }).error.code, -32603);
});
