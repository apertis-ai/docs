// Same-release Markdown actions (openspec docs-shell-interfaces "Same-release Markdown actions").
// Every action uses `<this origin><apertis-docs:markdown path>`; never GitHub `main` or another host.

/** Absolute Markdown URL on `origin`, or null unless `metaPath` is a same-origin `.md` path. */
export function markdownUrl(origin: string, metaPath: string | null | undefined): string | null {
  if (!metaPath || !metaPath.startsWith('/') || metaPath.startsWith('//') || !metaPath.endsWith('.md')) return null;
  const url = new URL(metaPath, origin);
  return url.origin === new URL(origin).origin && url.pathname === metaPath ? url.href : null;
}

export const promptFor = (url: string) => `Load the contents of ${url} into this chat's context so we can discuss it.`;

export function aiToolUrls(url: string) {
  const q = encodeURIComponent(promptFor(url));
  return {
    claude: `https://claude.ai/new?q=${q}`,
    chatgpt: `https://chatgpt.com/?hints=search&prompt=${q}`,
    cursor: `https://cursor.com/link/prompt?text=${q}`,
  };
}
