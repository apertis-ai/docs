// /blog/index.md: the Markdown twin of the /blog/ index, as every article has one at /blog/<slug>/index.md. The
// articles are the rows the index renders (articleRows); the edge (functions/blog/[[path]].ts) adds the live ones.
import type { APIRoute } from 'astro';
import { articleRows } from '../../components/home/article-rows.ts';
import { blogMarkdown } from '../../contracts/blog-index.ts';
import { servedUrl } from '../../contracts/page.ts';

export const GET: APIRoute = async () => new Response(blogMarkdown((await articleRows()).map((r) => ({ title: r.doc.title, url: servedUrl(r.doc.canonicalUrl), description: r.description }))), {
  headers: { 'content-type': 'text/markdown; charset=utf-8' },
});
