/// <reference types="@cloudflare/workers-types" />

// GET /_nimbus/blog-authors: the blog's live authors (site-nimbus/src/components/home/authors-feed.ts),
// fetched server-side from the public Apertis API (it does not allow this origin in CORS) and kept in the
// edge cache for ten minutes. Any upstream failure answers 502 and is not cached; the page then keeps the
// byline and portrait committed with the article. Only GET is exported: other methods fall through to the
// static 404.
import { fetchAuthors } from '../../site-nimbus/src/components/home/authors-feed.ts'

const TTL = 600

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const key = new Request(new URL('/_nimbus/blog-authors', request.url).toString())
  const hit = await caches.default.match(key)
  if (hit) return hit
  try {
    const res = Response.json(await fetchAuthors(fetch), { headers: { 'cache-control': `public, max-age=${TTL}` } })
    waitUntil(caches.default.put(key, res.clone()))
    return res
  } catch (e) {
    console.error('blog-authors:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'authors unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
