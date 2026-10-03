/// <reference types="@cloudflare/workers-types" />

// GET /_nimbus/home-feed: the homepage's live data (site-nimbus/src/components/home/feed.ts), fetched
// server-side from the public Apertis changelog and model catalog (they do not allow this origin in CORS)
// and kept in the edge cache for ten minutes. Any upstream failure answers 502 and is not cached; the
// homepage then keeps the build's copy. Only GET is exported: other methods fall through to the static 404.
import { fetchFeed } from '../../site-nimbus/src/components/home/feed.ts'

const TTL = 600

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const key = new Request(new URL('/_nimbus/home-feed', request.url).toString())
  const hit = await caches.default.match(key)
  if (hit) return hit
  try {
    const res = Response.json(await fetchFeed(fetch), { headers: { 'cache-control': `public, max-age=${TTL}` } })
    waitUntil(caches.default.put(key, res.clone()))
    return res
  } catch (e) {
    console.error('home-feed:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'feed unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
