// Page feedback (openspec docs-reader-shell-extras "Page feedback"): parseFeedback, and handleFeedback
// (the HTTP handling `functions/_nimbus/feedback.ts` wraps for Workers) with a fake D1 (no real binding
// is reachable from `node --test`). Imports only the plain module, never `functions/_nimbus/feedback.ts`
// itself: see that file's comment for why.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITS, handleFeedback, parseFeedback, publishedPaths } from '../src/components/feedback/feedback.ts';

const published = publishedPaths([
  { servedPath: '/getting-started/quick-start/', eligibility: { publish: true, search: true, agent: true, rag: true } },
  { servedPath: '/drafts/unlisted/', eligibility: { publish: false, search: false, agent: false, rag: false } },
]);
const PATH = '/getting-started/quick-start/';

test('publishedPaths: only publish-eligible documents', () => {
  assert.deepEqual(published, new Set([PATH]));
});

test('parseFeedback: a valid Yes with no comment, and a valid No with a comment', () => {
  assert.deepEqual(parseFeedback(2, { path: PATH, helpful: true }, published), { path: PATH, helpful: true, comment: null });
  assert.deepEqual(parseFeedback(2, { path: PATH, helpful: false, comment: '  too slow  ' }, published), { path: PATH, helpful: false, comment: 'too slow' });
  // A comment that is only whitespace is no comment.
  assert.deepEqual(parseFeedback(2, { path: PATH, helpful: false, comment: '   ' }, published), { path: PATH, helpful: false, comment: null });
});

test('parseFeedback: rejects an unpublished or missing path, non-boolean helpful, an over-length comment, and a non-object body', () => {
  assert.throws(() => parseFeedback(2, { path: '/drafts/unlisted/', helpful: true }, published), /published/);
  assert.throws(() => parseFeedback(2, { path: '/nope/', helpful: true }, published), /published/);
  assert.throws(() => parseFeedback(2, { path: PATH, helpful: 'yes' }, published), /boolean/);
  assert.throws(() => parseFeedback(2, { path: PATH, helpful: true, comment: 'x'.repeat(LIMITS.MAX_COMMENT + 1) }, published), /1000/);
  assert.throws(() => parseFeedback(2, { path: PATH, helpful: true, comment: 7 }, published), /string/);
  assert.throws(() => parseFeedback(2, null, published), /object/);
  assert.throws(() => parseFeedback(2, [], published), /object/);
});

test('parseFeedback: rejects a body over the 4 KB cap before looking at its shape', () => {
  assert.throws(() => parseFeedback(LIMITS.MAX_BODY_BYTES + 1, { path: PATH, helpful: true }, published), /4096 bytes/);
});

// ---- the endpoint, with a fake env (no network, no real D1) ----
const req = (body: unknown, init: { origin?: string; contentType?: string | null; url?: string } = {}) => {
  const headers = new Headers();
  if (init.contentType !== null) headers.set('content-type', init.contentType ?? 'application/json');
  if (init.origin) headers.set('origin', init.origin);
  return new Request(init.url ?? 'http://127.0.0.1:8807/_nimbus/feedback', { method: 'POST', headers, body: JSON.stringify(body) });
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (request: Request, db?: any) => handleFeedback(request, db, published);

test('endpoint: a valid submission with no binding answers 503, never 204', async () => {
  const res = await call(req({ path: PATH, helpful: true }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('endpoint: a D1 write failure answers 503', async () => {
  const db = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('boom'); } }) }) };
  const res = await call(req({ path: PATH, helpful: true }), db);
  assert.equal(res.status, 503);
});

test('endpoint: a valid submission with a working binding answers 204 and writes one row', async () => {
  const calls: unknown[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({ run: async () => { calls.push({ sql, args }); return { success: true }; } }),
    }),
  };
  const res = await call(req({ path: PATH, helpful: false, comment: 'thanks' }), db);
  assert.equal(res.status, 204);
  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as { args: unknown[] }).args, [PATH, 0, 'thanks']);
});

test('endpoint: an unpublished path or an over-length comment is a 400, without touching the binding', async () => {
  let touched = false;
  const db = { prepare: () => { touched = true; throw new Error('must not be called'); } };
  for (const body of [{ path: '/nope/', helpful: true }, { path: PATH, helpful: true, comment: 'x'.repeat(1001) }]) {
    const res = await call(req(body), db);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(touched, false);
});

test('endpoint: a non-JSON content type is rejected', async () => {
  const res = await call(req({ path: PATH, helpful: true }, { contentType: 'text/plain' }));
  assert.equal(res.status, 400);
});

test('endpoint: a cross-origin Origin header is rejected; same-origin and absent Origin are not', async () => {
  const cross = await call(req({ path: PATH, helpful: true }, { origin: 'https://evil.example' }));
  assert.equal(cross.status, 400);
  const same = await call(req({ path: PATH, helpful: true }, { origin: 'http://127.0.0.1:8807' }), { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) });
  assert.equal(same.status, 204);
});

test('endpoint: a body over 4 KB is a 400', async () => {
  const res = await call(req({ path: PATH, helpful: true, comment: 'x'.repeat(5000) }));
  assert.equal(res.status, 400);
});
