// Validation for POST /_nimbus/feedback (openspec docs-reader-shell-extras "Page feedback"): the one
// place `functions/_nimbus/feedback.ts` and its tests agree on what a feedback submission is. Pure (no
// Workers or D1 API): the endpoint turns a thrown message into its 400 body, and a valid result into
// the one row site-nimbus/d1/feedback.sql stores. No identifier, cookie or IP is ever part of the shape.
export const LIMITS = { MAX_BODY_BYTES: 4096, MAX_COMMENT: 1000 } as const;

export interface Feedback {
  path: string;
  helpful: boolean;
  /** Trimmed; an empty-after-trim comment is stored as no comment. */
  comment: string | null;
}

/** The set of paths a submission's `path` may name: every published document's `servedPath`. */
export function publishedPaths(docs: readonly { servedPath: string; eligibility: { publish: boolean; [k: string]: unknown } }[]): Set<string> {
  return new Set(docs.filter((d) => d.eligibility.publish).map((d) => d.servedPath));
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
