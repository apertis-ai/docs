// Published native articles as list rows, newest first: what the /blog/ index, the homepage, a tag page and an
// author page all list. Publication is the manifest's call (a draft has no entry); the collection supplies
// the front matter, the converter's page meta the date and the reading time.
import { getCollection } from 'astro:content';
import pageMetaFile from '../../content/docs/page-meta.json' with { type: 'json' };
import { bylineParts, isNativeArticle, parseTags } from '../../contracts/articles.ts';
import type { ManifestDocument } from '../../contracts/manifest.ts';
import { manifest } from '../../manifest/manifest.ts';

export type Author = ReturnType<typeof bylineParts>;

export interface ArticleRow {
  doc: ManifestDocument;
  slug: string;
  /** YYYY-MM-DD... (the converter's page meta). */
  date: string;
  minutes: number;
  category: string;
  description: string;
  tags: string[];
  author: Author;
}

export async function articleRows(): Promise<ArticleRow[]> {
  const meta = pageMetaFile as Record<string, { updated: string; readingMinutes: number }>;
  const data = new Map((await getCollection('articles')).map((e) => [e.id, e.data as { category: string; description: string; author: string; tags?: unknown }]));
  return manifest.documents.filter(isNativeArticle)
    .map((doc) => {
      const slug = doc.servedPath.slice('/blog/'.length, -1);
      const a = data.get(slug)!;
      return { doc, slug, date: meta[doc.id].updated, minutes: meta[doc.id].readingMinutes, category: a.category, description: a.description, tags: parseTags(a.tags), author: bylineParts(a.author) };
    })
    .sort((a, b) => (a.date === b.date ? (a.doc.id < b.doc.id ? -1 : 1) : a.date < b.date ? 1 : -1));
}

/** An author's portrait, when src/assets/authors/<slug>.{png,jpg,jpeg,webp} exists; otherwise the page shows initials. */
const portraits = import.meta.glob<{ default: ImageMetadata }>('../../assets/authors/*.{png,jpg,jpeg,webp}', { eager: true });
export const portrait = (slug: string) => Object.entries(portraits).find(([file]) => file.replace(/^.*\/|\.[a-z]+$/g, '') === slug)?.[1].default;
