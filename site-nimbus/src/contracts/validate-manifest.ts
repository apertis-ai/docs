// Build-time manifest validation (openspec docs-publication-manifest, scenario "Validation").
// Node-only: reads the build output. Never import this from client code.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ELIGIBILITY_KEYS,
  MANIFEST_SITE,
  RESERVED_RUNTIME_PATH,
  markdownPathFor,
  type ManifestDocument,
  type ManifestV1,
} from './manifest.ts';
import type { InventoryRoute } from './navigation.ts';

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
const isReserved = (p: string) => trimSlash(p) === RESERVED_RUNTIME_PATH;

/** Returns every violation as `<id>: <problem>`; an empty array means the manifest is valid. */
export function validateManifest(
  input: unknown,
  { inventory, outDir }: { inventory: InventoryRoute[]; outDir: string },
): string[] {
  const errors: string[] = [];
  const m = input as ManifestV1;
  if (m?.manifestVersion !== 1) errors.push(`manifest: manifestVersion must be 1`);
  if (m?.site !== MANIFEST_SITE) errors.push(`manifest: site must be ${MANIFEST_SITE}`);
  if (!HEX40.test(m?.sourceSha ?? '')) errors.push(`manifest: sourceSha must be a 40-hex commit`);
  if (!new RegExp(`^${m?.sourceSha}\\.[0-9a-f]{12}$`).test(m?.buildId ?? '')) {
    errors.push(`manifest: buildId must be <sourceSha>.<12 hex>`);
  }
  if (!Array.isArray(m?.documents)) return [...errors, 'manifest: documents must be an array'];

  const rows = new Map(inventory.filter((r) => r.documentId).map((r) => [r.documentId, r]));
  const seen = { id: new Set<string>(), servedPath: new Set<string>(), canonicalUrl: new Set<string>() };

  for (const d of m.documents as ManifestDocument[]) {
    const at = d?.id ?? '<no id>';
    for (const field of ['id', 'servedPath', 'canonicalUrl'] as const) {
      if (seen[field].has(d[field])) errors.push(`${at}: duplicate ${field} ${d[field]}`);
      seen[field].add(d[field]);
    }
    for (const field of ['id', 'sourcePath', 'servedPath', 'canonicalUrl', 'title'] as const) {
      if (typeof d[field] !== 'string' || !d[field]) errors.push(`${at}: ${field} must be a non-empty string`);
    }
    if (!HEX64.test(d.contentSha256 ?? '')) errors.push(`${at}: contentSha256 must be 64 hex`);

    let canonicalPath = '';
    try {
      const url = new URL(d.canonicalUrl);
      canonicalPath = url.pathname;
      if (url.origin !== MANIFEST_SITE) errors.push(`${at}: canonicalUrl must be on ${MANIFEST_SITE}`);
    } catch {
      errors.push(`${at}: canonicalUrl is not an absolute URL`);
    }
    if ([d.servedPath, canonicalPath, d.markdown?.path ?? ''].some(isReserved)) {
      errors.push(`${at}: maps to reserved ${RESERVED_RUNTIME_PATH}`);
    }

    const row = rows.get(d.id);
    if (!row) errors.push(`${at}: no inventory row with this documentId`);
    else if (!d.eligibility || ELIGIBILITY_KEYS.some((k) => d.eligibility[k] !== row.eligibility[k])) {
      errors.push(`${at}: eligibility ${JSON.stringify(d.eligibility)} differs from inventory ${JSON.stringify(row.eligibility)}`);
    }

    if (!d.eligibility?.agent) {
      if (d.markdown !== null) errors.push(`${at}: markdown must be null when not agent-eligible`);
      continue;
    }
    if (!d.markdown) {
      errors.push(`${at}: agent-eligible document needs markdown`);
      continue;
    }
    if (canonicalPath && d.markdown.path !== markdownPathFor(d.canonicalUrl)) {
      errors.push(`${at}: markdown.path ${d.markdown.path} should be ${markdownPathFor(d.canonicalUrl)}`);
    }
    if (d.contentSha256 !== d.markdown.sha256) errors.push(`${at}: contentSha256 must equal markdown.sha256`);
    const file = path.resolve(outDir, `.${d.markdown.path}`);
    if (!file.startsWith(path.resolve(outDir) + path.sep) || !fs.existsSync(file)) {
      errors.push(`${at}: markdown ${d.markdown.path} missing from build output`);
      continue;
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== d.markdown.sha256) errors.push(`${at}: markdown ${d.markdown.path} sha256 ${actual} != recorded ${d.markdown.sha256}`);
  }
  return errors;
}
