// Build-time access to the fixture manifest (#7 replaces the JSON with the generated manifest).
import type { ManifestDocument, ManifestV1 } from '../contracts/manifest.ts';
import data from './manifest.json' with { type: 'json' };

export const manifest = data as ManifestV1;

export function documentAt(servedPath: string): ManifestDocument {
  const doc = manifest.documents.find((d) => d.servedPath === servedPath);
  if (!doc) throw new Error(`no manifest entry serves ${servedPath}`);
  return doc;
}
