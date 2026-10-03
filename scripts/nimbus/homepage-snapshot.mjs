// The build's copy of the homepage feed (openspec docs-shell-interfaces, homepage as revised on 2026-10-03):
// the newest release notes and the most recently added models, as site-nimbus/src/components/home/feed.ts
// reads and validates them. The homepage renders from this file first (the build never calls the network)
// and swaps in /_nimbus/home-feed after load, so the file only has to be fresh enough for a first paint.
//   node scripts/nimbus/homepage-snapshot.mjs
// Rewrites site-nimbus/src/components/home/home-feed.json; commit the diff like any content change.
import fs from 'node:fs';
import path from 'node:path';
import { fetchFeed } from '../../site-nimbus/src/components/home/feed.ts';

export const SNAPSHOT = path.resolve(import.meta.dirname, '../../site-nimbus/src/components/home/home-feed.json');

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const feed = await fetchFeed(fetch);
  fs.writeFileSync(SNAPSHOT, JSON.stringify(feed, null, 2) + '\n');
  console.log(`${feed.notes.length} release notes (newest ${feed.notes[0].version}), ${feed.models.length} new models (newest ${feed.models[0].id}), ${feed.total} models from ${feed.providers} providers`);
}
