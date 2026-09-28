// Generated render sources (converter/convert.ts) under src/content/docs; never edit them by hand.
// src/content/public holds the clean Markdown artifacts and bundled images and is not a collection.
import { defineCollection } from 'astro:content';
import { docsCollection } from '@cloudflare/nimbus-docs/content';

export const collections = { docs: defineCollection(docsCollection()) };
