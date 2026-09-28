// #9 Ask Docs wire client against migration/nimbus/fixtures/ask-wire.json (contract evidence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { askBody, currentPageContext, errorMessage, QUERY_LIMIT_MESSAGE, readAnswer, sourceLinks } from '../src/components/assistant/wire.ts';

const wire = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../migration/nimbus/fixtures/ask-wire.json'), 'utf8'));
const wireCase = (name: string) => wire.cases.find((c: { name: string }) => c.name === name);

/** A body delivered in the given byte chunks. */
const stream = (...chunks: (string | Uint8Array)[]) => new ReadableStream<Uint8Array>({
  start(c) {
    for (const x of chunks) c.enqueue(typeof x === 'string' ? new TextEncoder().encode(x) : x);
    c.close();
  },
});
async function read(...chunks: (string | Uint8Array)[]) {
  let text = '';
  const end = await readAnswer(stream(...chunks), (d) => { text += d; });
  return { text, end };
}

test('request body has exactly the wire fields', () => {
  assert.deepEqual(Object.keys(wire.request.body).sort(), ['pageContext', 'question', 'sessionId', 'turnstileToken']);
  assert.deepEqual(askBody('q', 's', 't', { title: 'T', href: '/x' }), { question: 'q', sessionId: 's', turnstileToken: 't', pageContext: { title: 'T', href: '/x' } });
  assert.deepEqual(Object.keys(askBody('q', 's', 't')), ['question', 'sessionId', 'turnstileToken']);
});

test('page context is the manifest title and the current location, read when called', () => {
  const loc = { pathname: '/api/', search: '?a=1', hash: '#h' };
  assert.deepEqual(currentPageContext('API Reference | Apertis Documentation', loc), { title: 'API Reference', href: '/api/?a=1#h' });
  assert.deepEqual(currentPageContext('Home | Apertis Documentation', { pathname: '/', search: '', hash: '' }), { title: 'Home', href: '/' });
  assert.equal(currentPageContext(' | Apertis Documentation', loc), undefined);
});

test('success stream: content frames in order, [DONE] ends the answer', async () => {
  const frames: string[] = wireCase('success-stream').frames.filter((f: string) => f !== '...');
  assert.deepEqual(await read(...frames), { text: '<delta text>', end: 'done' });
  assert.deepEqual(await read('data: {"content":"Hel"}\n\ndata: {"content":"lo"}\n\ndata: [DONE]\n\ndata: {"content":"after"}\n\n'),
    { text: 'Hello', end: 'done' });
});

test('frames split mid-line and mid-character are reassembled', async () => {
  const bytes = new TextEncoder().encode('data: {"content":"café → ok"}\n\ndata: [DONE]\n\n');
  const cuts = [3, 14, 21, 22, bytes.length - 4];
  const parts = cuts.map((c, i) => bytes.slice(i ? cuts[i - 1] : 0, c)).concat(bytes.slice(cuts.at(-1)));
  assert.deepEqual(await read(...parts), { text: 'café → ok', end: 'done' });
});

test('EOF without [DONE] is an interrupted answer', async () => {
  assert.deepEqual(await read('data: {"content":"partial"}\n\n'), { text: 'partial', end: 'interrupted' });
  assert.deepEqual(await read(''), { text: '', end: 'interrupted' });
  assert.deepEqual(await read('data: {"content":"x"}\n\ndata: [DO'), { text: 'x', end: 'interrupted' });
});

test('frames without content, extra fields and junk are ignored', async () => {
  assert.deepEqual(await read(': ping\n\nevent: meta\ndata: {"traceId":"t1"}\n\ndata: not json\n\ndata: {"content":""}\n\ndata: {"content":"a","x":1}\r\n\r\ndata: [DONE]\r\n\r\n'),
    { text: 'a', end: 'done' });
});

test('error responses are shown with their wire text; 429 is the fixed legacy message', async () => {
  const res = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  for (const name of ['empty', 'no-session', 'no-turnstile', 'question-too-long', 'bad-turnstile', 'missing-server-bindings']) {
    const c = wireCase(name);
    const msg = await errorMessage(res(c.status, c.json));
    assert.ok(msg.includes(`HTTP ${c.status}`) && msg.includes(c.json.error), `${name}: ${msg}`);
  }
  assert.equal(await errorMessage(res(429, wireCase('session-limit').json)), QUERY_LIMIT_MESSAGE);
  assert.match(await errorMessage(res(500, { error: 'Apertis API error: 502', details: 'upstream' })), /HTTP 500\): Apertis API error: 502: upstream/);
  assert.match(await errorMessage(res(502, '<html>Bad gateway</html>')), /HTTP 502\): <html>Bad gateway/);
  assert.equal(await errorMessage(res(503, '')), 'Ask Docs could not answer (HTTP 503).');
});

test('source links are internal, unique documentation links', () => {
  assert.deepEqual(sourceLinks('See [Quick Start](/getting-started/quick-start), [QS](/getting-started/quick-start), [x](//evil.test/a) and [ext](https://example.com).'),
    [{ title: 'Quick Start', href: '/getting-started/quick-start' }]);
});
