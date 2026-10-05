// The build's copy of the /models/ and /changelog/ data (openspec docs-live-catalog): the public model catalog
// as site-nimbus/src/components/catalog/models.ts filters and prices it, and the public release notes as
// changelog.ts validates them. The pages render from these files (the build never calls the network); /models/
// swaps in /_nimbus/catalog after load, so the files only have to be fresh enough for a first paint.
//   node scripts/nimbus/catalog-snapshot.mjs
// Rewrites site-nimbus/src/components/catalog/{models,changelog}.json; commit the diff like any content change.
import fs from 'node:fs';
import path from 'node:path';
import { fetchCatalog } from '../../site-nimbus/src/components/catalog/models.ts';
import { fetchChangelog } from '../../site-nimbus/src/components/catalog/changelog.ts';

const dir = path.resolve(import.meta.dirname, '../../site-nimbus/src/components/catalog');
export const MODELS_SNAPSHOT = path.join(dir, 'models.json');
export const CHANGELOG_SNAPSHOT = path.join(dir, 'changelog.json');

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const [catalog, notes] = await Promise.all([fetchCatalog(fetch), fetchChangelog(fetch)]);
  fs.writeFileSync(MODELS_SNAPSHOT, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(CHANGELOG_SNAPSHOT, JSON.stringify(notes, null, 2) + '\n');
  console.log(`${catalog.models.length} models (data version ${catalog.version}), ${notes.length} release notes (newest ${notes[0].version})`);
}
