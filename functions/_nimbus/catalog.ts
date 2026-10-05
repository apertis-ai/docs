/// <reference types="@cloudflare/workers-types" />

// GET /_nimbus/catalog: the /models/ page's live data (site-nimbus/src/components/catalog/models.ts), every
// page of the public model catalog filtered as apertis.ai filters it, fetched server-side and kept in the edge
// cache for ten minutes. Any upstream failure answers 502 and is not cached; the page then keeps the build's
// copy. Only GET is exported: other methods fall through to the static 404.
import { fetchCatalog } from '../../site-nimbus/src/components/catalog/models.ts'

const TTL = 600

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const key = new Request(new URL('/_nimbus/catalog', request.url).toString())
  const hit = await caches.default.match(key)
  if (hit) return hit
  try {
    const res = Response.json(await fetchCatalog(fetch), { headers: { 'cache-control': `public, max-age=${TTL}` } })
    waitUntil(caches.default.put(key, res.clone()))
    return res
  } catch (e) {
    console.error('catalog:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'catalog unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
