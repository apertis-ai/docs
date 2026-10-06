// Try it (openspec docs-api-reference-ux "Try it"): the cURL parser that decides, at build time, which code
// blocks get the control and, in the panel, what the request is. Checked on hand cases and on every cURL
// sample in docs-api/ that targets https://api.apertis.ai/v1/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseCurl, type CurlRequest } from '../src/components/try-it/curl.ts';

const ok = (text: string): CurlRequest => {
  const r = parseCurl(text);
  assert.ok(!('reason' in r), `expected a request, got ${'reason' in r ? r.reason : ''}`);
  return r as CurlRequest;
};
const reason = (text: string) => {
  const r = parseCurl(text);
  assert.ok('reason' in r, 'expected a rejection');
  return (r as { reason: string }).reason;
};

test('multi-line cURL: URL, -X, -H and a single-quoted -d body across backslash continuations', () => {
  const r = ok(`# Basic request\ncurl -X POST "https://api.apertis.ai/v1/chat/completions" \\\n  -H "Authorization: Bearer sk-your-api-key" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n    "model": "gpt-4.1",\n    "stream": true\n  }' \\\n  -w "\\nStatus: %{http_code}\\n" \\\n  -v\n`);
  assert.equal(r.method, 'POST');
  assert.equal(r.url, 'https://api.apertis.ai/v1/chat/completions');
  assert.deepEqual(r.headers, [['Authorization', 'Bearer sk-your-api-key'], ['Content-Type', 'application/json']]);
  assert.deepEqual(JSON.parse(r.body!), { model: 'gpt-4.1', stream: true });
});

test('GET by default without a body, POST by default with one; double-quoted bodies unescape', () => {
  const get = ok('curl "https://api.apertis.ai/v1/recommend?task=coding&budget=medium" \\\n  -H "Authorization: Bearer <APERTIS_API_KEY>"');
  assert.equal(get.method, 'GET');
  assert.equal(get.url, 'https://api.apertis.ai/v1/recommend?task=coding&budget=medium');
  assert.equal(get.body, null);
  const post = ok('curl https://api.apertis.ai/v1/embeddings --data "{\\"input\\": \\"a \\\\\\"b\\\\\\"\\"}"');
  assert.equal(post.method, 'POST');
  assert.deepEqual(JSON.parse(post.body!), { input: 'a "b"' });
  assert.equal(ok('curl --request PUT https://api.apertis.ai/v1/x --data-raw "{}"').method, 'PUT');
  assert.equal(ok('curl https://api.apertis.ai/v1/audio/speech -d \'{}\' --output out.mp3').url, 'https://api.apertis.ai/v1/audio/speech');
});

test('blocks that are not one plain cURL request to api.apertis.ai/v1 get no Try it', () => {
  assert.match(reason('curl https://api.apertis.ai/v1/images/edits -F image=@a.png -F prompt=x'), /multipart/);
  assert.match(reason('curl https://api.apertis.ai/v1/x -d @body.json'), /file/);
  assert.match(reason('curl https://api.openai.com/v1/chat/completions -d "{}"'), /api\.apertis\.ai\/v1/);
  assert.match(reason('curl https://api.apertis.ai/sora/v1/characters -d "{}"'), /api\.apertis\.ai\/v1/);
  assert.match(reason('curl https://api.apertis.ai.evil.example/v1/x'), /api\.apertis\.ai\/v1/);
  assert.match(reason('curl https://api.apertis.ai/v1/models\ncurl https://api.apertis.ai/v1/models'), /one command/);
  assert.match(reason('AUDIO_B64=$(base64 -i q.wav)\ncurl https://api.apertis.ai/v1/chat/completions -d "{}"'), /shell/);
  assert.match(reason('AUDIO_B64=x\ncurl https://api.apertis.ai/v1/chat/completions -d "{}"'), /one command/);
  assert.match(reason('curl https://api.apertis.ai/v1/models | jq .'), /shell/);
  assert.match(reason('pip install openai'), /cURL/);
  assert.match(reason('curl https://api.apertis.ai/v1/models \'unterminated'), /quote/);
});

// Fenced blocks of the legacy API sources, dedented (fences may sit in lists or tabs).
const docsApi = path.resolve(import.meta.dirname, '../../docs-api');
const samples = fs.readdirSync(docsApi, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
  .flatMap((e) => {
    const file = path.relative(docsApi, path.join(e.parentPath, e.name));
    const src = fs.readFileSync(path.join(e.parentPath, e.name), 'utf8');
    return [...src.matchAll(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\2[ \t]*$/gm)].map((m) => ({
      file,
      text: m[3].split('\n').map((l) => (l.startsWith(m[1]) ? l.slice(m[1].length) : l)).join('\n'),
    }));
  })
  .filter((s) => /^\s*(#.*\n\s*)*curl\b/.test(s.text) && s.text.includes('https://api.apertis.ai/v1/'));

test('every cURL sample in docs-api/ to api.apertis.ai/v1 parses, or is rejected for a stated reason', (t) => {
  assert.ok(samples.length >= 30, `found only ${samples.length} samples`);
  const rejected: string[] = [];
  for (const s of samples) {
    const r = parseCurl(s.text);
    if ('reason' in r) {
      rejected.push(`${s.file}: ${r.reason}`);
      // Multipart uploads need a file picker, and a script is not one request. The one other gap is a sample
      // that is malformed as authored (its -d quote never closes); fixing it is a content edit.
      const broken = s.file === 'vision/image-generation.md' && r.reason === 'unterminated quote';
      assert.ok(broken || /multipart|one command/.test(r.reason), `${s.file}: ${r.reason}\n${s.text}`);
      continue;
    }
    assert.ok(r.url.startsWith('https://api.apertis.ai/v1/'), s.file);
    assert.equal(new URL(r.url).origin, 'https://api.apertis.ai');
    assert.match(r.method, /^(GET|POST|PUT|PATCH|DELETE)$/);
    assert.equal(r.method === 'GET', r.body === null, `${s.file}: ${r.method} ${r.url}`);
    // The panel prefills this body; each documented one is valid JSON as authored.
    if (r.body !== null) assert.doesNotThrow(() => JSON.parse(r.body!), `${s.file}: ${r.url}\n${r.body}`);
    for (const [name] of r.headers) assert.match(name, /^[A-Za-z][\w-]*$/, s.file);
  }
  t.diagnostic(`${samples.length} samples, ${samples.length - rejected.length} with Try it; rejected:\n${rejected.join('\n')}`);
});
