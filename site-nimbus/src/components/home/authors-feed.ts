// The blog's live authors: name, position title and avatar as the Apertis console stores them, keyed by the
// slug an article's byline resolves to (contracts/articles.ts, bylineParts). Two readers, one validator:
//   - functions/_nimbus/blog-authors.ts serves this shape at /_nimbus/blog-authors, edge-cached;
//   - LiveAuthors.astro swaps it into the byline and the author page after load.
// The build never calls the network: a page renders the byline and portrait committed with the article, and
// keeps them when the endpoint, an author or an avatar is missing. Pure (no Node or Workers APIs).
export const SOURCE = 'https://apertis.ai/api/blog/authors';

export interface LiveAuthor { name: string; title: string; avatar: string }
export type LiveAuthors = Record<string, LiveAuthor>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const text = (v: unknown): v is string => typeof v === 'string';
/** An avatar is an https URL without credentials; anything else is no avatar, and the committed portrait stays. */
const avatar = (v: unknown) => {
  try {
    const u = new URL(text(v) ? v : '');
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : '';
  } catch { return ''; }
};

/** The authors by slug; throws on anything that is not the endpoint's list. An entry without a slug or name is skipped. */
export function liveAuthors(data: unknown): LiveAuthors {
  if (!Array.isArray(data)) throw new Error('blog authors: expected a list');
  const authors: LiveAuthors = {};
  for (const a of data) {
    if (!a || !text(a.slug) || !SLUG.test(a.slug) || !text(a.name) || !a.name.trim()) continue;
    authors[a.slug] = { name: a.name.trim(), title: text(a.title) ? a.title.trim() : '', avatar: avatar(a.avatar_url) };
  }
  return authors;
}

export async function fetchAuthors(fetcher: typeof fetch): Promise<LiveAuthors> {
  const res = await fetcher(SOURCE, { headers: { accept: 'application/json', 'user-agent': 'apertis-docs-blog-authors' }, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`);
  const body = await res.json() as { success?: boolean; message?: string; data?: unknown };
  if (body.success === false) throw new Error(`${SOURCE}: ${body.message || 'not successful'}`);
  return liveAuthors(body.data);
}

/**
 * Swap the live authors into every `[data-author]` element under `root`: `data-author-field` says which part
 * it shows (`name`, `title` or `avatar`). An author the list does not hold keeps what the build rendered; an
 * empty live title hides the title; an avatar replaces the portrait only once it has loaded.
 */
export function applyAuthors(root: ParentNode, authors: LiveAuthors): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-author]')) {
    const a = Object.hasOwn(authors, el.dataset.author!) ? authors[el.dataset.author!] : null;
    if (!a) continue;
    const field = el.dataset.authorField;
    if (field === 'name') el.textContent = a.name;
    else if (field === 'title') { el.textContent = a.title; el.hidden = !a.title; }
    else if (field === 'avatar' && a.avatar && el.getAttribute('src') !== a.avatar) {
      const img = new Image(el.offsetWidth, el.offsetHeight);
      img.className = 'avatar';
      img.alt = '';
      img.decoding = 'async';
      for (const k of ['author', 'authorField'] as const) img.dataset[k] = el.dataset[k]!;
      img.onload = () => el.replaceWith(img);
      img.src = a.avatar;
    }
  }
}
