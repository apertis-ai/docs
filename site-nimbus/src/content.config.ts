// Generated render sources (converter/convert.ts) under src/content/docs; never edit them by hand.
// src/content/public holds the clean Markdown artifacts and bundled images and is not a collection.
// `articles` are the native articles (src/articles/<slug>.md, converter/articles.ts validates them and
// decides publication); pages render only the ones with a manifest entry, so a draft never renders.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsCollection } from '@cloudflare/nimbus-docs/content';
import { ARTICLES_ROOT } from './contracts/articles.ts';

export const collections = {
  docs: defineCollection(docsCollection()),
  articles: defineCollection({ loader: glob({ pattern: '*.md', base: `./${ARTICLES_ROOT}` }) }),
};
