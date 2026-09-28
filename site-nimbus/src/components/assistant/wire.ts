// Ask Docs wire client (migration/nimbus/fixtures/ask-wire.json, legacy contract v1). DOM-free so
// node --test can exercise it; the panel in assistant.ts owns rendering.
import { pageContext, TITLE_SUFFIX, type PageContext } from '../../contracts/page.ts';

export const ASK_PATH = '/api/ask';
export const MAX_QUESTION = 2000;
export const QUERY_LIMIT_MESSAGE = 'You have reached the query limit. Please refresh to continue.';

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

/** The reader-facing message for a non-2xx answer, as the legacy client showed it. */
export async function errorMessage(res: Response): Promise<string> {
  if (res.status === 429) return QUERY_LIMIT_MESSAGE;
  let detail = '';
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    detail = [json?.error, json?.details].filter((s) => typeof s === 'string' && s).join(': ');
  } catch {
    detail = text.trim().slice(0, 300);
  }
  return `Ask Docs could not answer (HTTP ${res.status})${detail ? `: ${detail}` : '.'}`;
}

/** Internal documentation links in an answer (`[title](/path)`), unique by href, as source pills. */
export function sourceLinks(answer: string): { title: string; href: string }[] {
  const seen = new Map<string, string>();
  for (const [, title, href] of answer.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (href.startsWith('/') && !href.startsWith('//') && !seen.has(href)) seen.set(href, title);
  }
  return [...seen].map(([href, title]) => ({ title, href }));
}
