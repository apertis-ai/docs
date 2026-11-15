/// <reference types="@cloudflare/workers-types" />

// GET /_nimbus/changelog: the /changelog/ page's live data (site-nimbus/src/components/catalog/changelog.ts),
// the public release notes without their items (the page shows a summary and a link; the feed keeps the items),
// fetched server-side and kept in the edge cache for ten minutes. Any upstream failure answers 502 and is not
// cached; the page then keeps the build's copy. Only GET is exported: other methods fall through to the static 404.
import { fetchChangelog } from '../../site-nimbus/src/components/catalog/changelog.ts'

const TTL = 600

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const key = new Request(new URL('/_nimbus/changelog', request.url).toString())
  const hit = await caches.default.match(key)
  if (hit) return hit
  try {
    const notes = (await fetchChangelog(fetch)).map(({ items: _items, ...summary }) => summary)
    const res = Response.json(notes, { headers: { 'cache-control': `public, max-age=${TTL}` } })
    waitUntil(caches.default.put(key, res.clone()))
    return res
  } catch (e) {
    console.error('changelog:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'changelog unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
