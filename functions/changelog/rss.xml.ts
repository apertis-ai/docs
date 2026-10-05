/// <reference types="@cloudflare/workers-types" />

// GET /changelog/rss.xml: the public Apertis release notes as RSS 2.0 (site-nimbus/src/components/catalog/
// changelog.ts), fetched server-side and kept in the edge cache for ten minutes. Pages Functions route this
// file name to exactly that path. Any upstream failure answers 503 with Retry-After and is not cached. Only
// GET is exported: other methods answer 405.
import { fetchChangelog, rss } from '../../site-nimbus/src/components/catalog/changelog.ts'

const TTL = 600

export const onRequestGet: PagesFunction = async ({ request, waitUntil }) => {
  const url = new URL(request.url)
  const key = new Request(new URL('/changelog/rss.xml', url).toString())
  const hit = await caches.default.match(key)
  if (hit) return hit
  try {
    const res = new Response(rss(await fetchChangelog(fetch), url.origin), {
      headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': `public, max-age=${TTL}` },
    })
    waitUntil(caches.default.put(key, res.clone()))
    return res
  } catch (e) {
    console.error('changelog rss:', e instanceof Error ? e.message : e)
    return new Response('Release notes are unavailable; try again shortly.\n', {
      status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': String(TTL) },
    })
  }
}
