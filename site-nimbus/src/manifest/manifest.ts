// The single loader of the publication manifest at MANIFEST_PATH (src/manifest/manifest.json).
// Until #7 generates it, the JSON is the M1 fixture (/ and /api/ only). Build-time only: never import
// this from client code, and never publish the unfiltered manifest.
import type { ManifestDocument, ManifestV1 } from '../contracts/manifest.ts';
import data from './manifest.json' with { type: 'json' };

export const manifest = data as ManifestV1;

export function documentAt(servedPath: string): ManifestDocument {
  const doc = manifest.documents.find((d) => d.servedPath === servedPath);
  if (!doc) throw new Error(`no manifest entry serves ${servedPath}`);
  return doc;
}
