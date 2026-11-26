// The committed manifest's buildId must be the one this checkout produces: the content identity of the
// legacy roots' git trees (survives a squash merge, unlike a commit id) plus the hash of the tracked
// site-nimbus build inputs. A docs/ or site-nimbus change merged without `npm run m2:regenerate` would otherwise build and publish stale converted content.
//   node scripts/nimbus/check-build-id.mjs
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE_ROOT, expectedBuildId } from '../../site-nimbus/converter/convert.ts';

const committed = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'src/manifest/manifest.json'), 'utf8')).buildId;
const expected = expectedBuildId(REPO_ROOT, SITE_ROOT);
if (committed !== expected) {
  console.error(`stale manifest: committed buildId ${committed}, this checkout is ${expected}; run npm run m2:regenerate in site-nimbus`);
  process.exit(1);
}
console.log(`buildId ${expected} matches the committed manifest`);
