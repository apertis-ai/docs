// POST /_nimbus/feedback (openspec docs-reader-shell-extras "Page feedback"): validation, and the HTTP
// handling built on it, in one plain module (Request/Response/Headers only, never a Workers ambient
// type), so site-nimbus/test/feedback.test.ts can import it directly. A test importing
// `functions/_nimbus/feedback.ts` instead would pull in `@cloudflare/workers-types`'s triple-slash
// reference, which merges HTMLRewriter's `Element.append` overload into the whole typecheck program
// (confirmed: 19 unrelated DOM errors with the root `@cloudflare/workers-types` package installed).
// `functions/_nimbus/feedback.ts` stays the one file that carries that reference, as a thin wrapper
// around `handleFeedback`. No identifier, cookie or IP is ever part of the stored shape.
export const LIMITS = { MAX_BODY_BYTES: 4096, MAX_COMMENT: 1000 } as const;

export interface Feedback {
  path: string;
  helpful: boolean;
  /** Trimmed; an empty-after-trim comment is stored as no comment. */
  comment: string | null;
}

/** The D1 surface `handleFeedback` needs, structurally: `env.FEEDBACK_DB` satisfies this without a cast. */
export interface FeedbackDB {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
}

/** The set of paths a submission's `path` may name: every published document's `servedPath`. */
export function publishedPaths(docs: readonly { servedPath: string; eligibility: { publish: boolean; [k: string]: unknown } }[]): Set<string> {
  return new Set(docs.filter((d) => d.eligibility.publish).map((d) => d.servedPath));
}

/**
 * The same set from the deployment's own /sitemap.xml, which lists exactly the publish-eligible manifest
 * entries (no-slash URLs except `/` and slash-canonical ones): the function reads it through the static
 * assets instead of bundling the manifest, whose JSON import attribute the Pages build's wrangler cannot parse.
 */
export function publishedFromSitemap(xml: string): Set<string> {
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/?$/, '/'));
  if (!paths.length) throw new Error('sitemap lists no URL');
  return new Set(paths);
}

/** Throws a one-line message naming what failed; never partially valid. */
export function parseFeedback(bodyBytes: number, body: unknown, published: ReadonlySet<string>): Feedback {
  if (bodyBytes > LIMITS.MAX_BODY_BYTES) throw new Error(`body exceeds ${LIMITS.MAX_BODY_BYTES} bytes`);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('body must be a JSON object');
  const { path, helpful, comment } = body as Record<string, unknown>;
  if (typeof path !== 'string' || !published.has(path)) throw new Error('path is not a published document');
  if (typeof helpful !== 'boolean') throw new Error('helpful must be a boolean');
  if (comment === undefined) return { path, helpful, comment: null };
  if (typeof comment !== 'string') throw new Error('comment must be a string');
  const trimmed = comment.trim();
  if (trimmed.length > LIMITS.MAX_COMMENT) throw new Error(`comment exceeds ${LIMITS.MAX_COMMENT} characters`);
  return { path, helpful, comment: trimmed === '' ? null : trimmed };
}

const noStore = { 'cache-control': 'no-store' } as const;
const json = (status: number, body: unknown) => Response.json(body, { status, headers: noStore });

/**
 * POST /_nimbus/feedback end to end: Origin, Content-Type, size, JSON, `parseFeedback`, then the D1
 * write. 400 for anything invalid, 503 with no `db` or on a write failure, 204 on success.
 */
export async function handleFeedback(request: Request, db: FeedbackDB | undefined, published: ReadonlySet<string>): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(400, { error: 'cross-origin request' });
  if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json(400, { error: 'Content-Type must be application/json' });
  }

  // Refuse a declared oversize body before reading it; the byte check below still covers a missing header.
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.MAX_BODY_BYTES) return json(400, { error: 'body too large' });
  const bytes = await request.arrayBuffer();
  let body: unknown;
  try {
    body = bytes.byteLength > LIMITS.MAX_BODY_BYTES ? undefined : JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  let feedback: Feedback;
  try {
    feedback = parseFeedback(bytes.byteLength, body, published);
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : 'invalid feedback' });
  }

  if (!db) return json(503, { error: 'feedback storage unavailable' });
  try {
    await db.prepare('INSERT INTO feedback (path, helpful, comment) VALUES (?, ?, ?)')
      .bind(feedback.path, feedback.helpful ? 1 : 0, feedback.comment)
      .run();
  } catch (e) {
    console.error('feedback:', e instanceof Error ? e.message : e);
    return json(503, { error: 'feedback storage unavailable' });
  }
  return new Response(null, { status: 204, headers: noStore });
}
