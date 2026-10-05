// Ask Docs wire client (migration/nimbus/fixtures/ask-wire.json, legacy contract v1). DOM-free so
// node --test can exercise it; the panel in assistant.ts owns rendering.
import { pageContext, TITLE_SUFFIX, type PageContext } from '../../contracts/page.ts';

export const ASK_PATH = '/api/ask';
export const MAX_QUESTION = 2000;
export const QUERY_LIMIT_MESSAGE = 'You have reached the query limit. Please refresh to continue.';

// The Turnstile sitekey of the legacy widget (src/components/UnifiedSearchModal/AskAITab.tsx), unless the
// build names another one in PUBLIC_TURNSTILE_SITEKEY. A local preview build sets Cloudflare's always-pass test
// sitekey there (`1x00000000000000000000AA`, assistant/README.md): local hosts are not on the real key's domain
// list, and test tokens verify only against the matching test secret, never a deployment's real secret. The
// choice is the build's, never the page's host (dist.check: no host-dependent client behaviour).
export const REAL_SITE_KEY = '0x4AAAAAACS2SzpYBFytHb_E';
export const turnstileSiteKey = (configured?: string) => configured?.trim() || REAL_SITE_KEY;

export interface AskRequest {
  question: string;
  sessionId: string;
  turnstileToken: string;
  pageContext?: PageContext;
}

/** Page context read now: the manifest title (the `<title>` without TITLE_SUFFIX) and the current location. */
export function currentPageContext(
  documentTitle: string,
  loc: Pick<Location, 'pathname' | 'search' | 'hash'>,
): PageContext | undefined {
  const title = (documentTitle.endsWith(TITLE_SUFFIX) ? documentTitle.slice(0, -TITLE_SUFFIX.length) : documentTitle).trim();
  return title ? pageContext(title, loc) : undefined;
}

export function askBody(question: string, sessionId: string, turnstileToken: string, context?: PageContext): AskRequest {
  return context ? { question, sessionId, turnstileToken, pageContext: context } : { question, sessionId, turnstileToken };
}

/**
 * Reads `data: {"content": …}` SSE frames, calling `onContent` per delta. Resolves 'done' at
 * `data: [DONE]` and 'interrupted' when the stream ends without it. Frames without a `content`
 * string and unparseable frames are ignored (the server may add frames).
 */
export async function readAnswer(
  body: ReadableStream<Uint8Array>,
  onContent: (delta: string) => void,
): Promise<'done' | 'interrupted'> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const line = (raw: string) => {
    const l = raw.replace(/\r$/, '');
    if (!l.startsWith('data: ')) return false;
    const data = l.slice(6);
    if (data === '[DONE]') return true;
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed?.content === 'string' && parsed.content) onContent(parsed.content);
    } catch {
      // not a JSON frame
    }
    return false;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop()!;
      for (const l of lines) if (line(l)) return 'done';
      if (done) return 'interrupted';
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export const REJECTED_MESSAGE = 'Ask Docs could not accept this question. Reload the page and try again.';
export const UNAVAILABLE_MESSAGE = 'Ask Docs is unavailable right now. Please try again in a moment.';

/**
 * The reader-facing message for a non-2xx answer. The server's detail (for example "Jina API error: timeout")
 * goes to the console, not the panel; the traceId, when the server sent one, is shown so a report can be matched
 * with the server log.
 */
export async function errorMessage(res: Response): Promise<string> {
  if (res.status === 429) return QUERY_LIMIT_MESSAGE;
  const text = await res.text().catch(() => '');
  let body: { error?: unknown; details?: unknown; traceId?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const traceId = typeof body?.traceId === 'string' && /^[\w-]{1,64}$/.test(body.traceId) ? body.traceId : '';
  console.warn('Ask Docs error', { status: res.status, error: body?.error, details: body?.details, traceId, body: body ? undefined : text.trim().slice(0, 300) });
  const message = res.status >= 400 && res.status < 500 ? REJECTED_MESSAGE : UNAVAILABLE_MESSAGE;
  return traceId ? `${message} (Reference: ${traceId})` : message;
}

/** A root-relative same-origin path. Rejects `//host`, backslash tricks such as `/\\host` (URL parsers treat `\\` as `/`) and schemes. */
export function isInternalHref(href: string): boolean {
  if (!href.startsWith('/') || href.includes('\\')) return false;
  const origin = 'https://docs.invalid';
  try {
    return new URL(href, origin).origin === origin;
  } catch {
    return false;
  }
}

/** Internal documentation links in an answer (`[title](/path)`), unique by href, as source pills. */
export function sourceLinks(answer: string): { title: string; href: string }[] {
  const seen = new Map<string, string>();
  for (const [, title, href] of answer.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (isInternalHref(href) && !seen.has(href)) seen.set(href, title);
  }
  return [...seen].map(([href, title]) => ({ title, href }));
}
