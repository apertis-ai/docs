// Build-time manifest validation (openspec docs-publication-manifest, scenario "Validation").
// Node-only: reads the build output. Never import this from client code.
// Every violation is returned as `<id>: <problem>`; malformed input is reported, never thrown.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ELIGIBILITY_KEYS,
  MANIFEST_SITE,
  RESERVED_RUNTIME_PATH,
  markdownPathFor,
  type ManifestDocument,
} from './manifest.ts';
import { MANIFEST_KINDS, type InventoryRoute } from './navigation.ts';
import { TITLE_SUFFIX } from './page.ts';

const HEX12 = /^[0-9a-f]{12}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isReserved = (p: unknown) => typeof p === 'string' && (p.length > 1 ? p.replace(/\/+$/, '') : p) === RESERVED_RUNTIME_PATH;
const pathnameOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin === MANIFEST_SITE ? u.pathname : null;
  } catch {
    return null;
  }
};

export function validateManifest(
  input: unknown,
  { inventory, outDir }: { inventory: InventoryRoute[]; outDir: string },
): string[] {
  if (!isObject(input)) return ['manifest: not an object'];
  const errors: string[] = [];
  const m = input;
  if (m.manifestVersion !== 1) errors.push('manifest: manifestVersion must be 1');
  if (m.site !== MANIFEST_SITE) errors.push(`manifest: site must be ${MANIFEST_SITE}`);
  const sourceSha = typeof m.sourceSha === 'string' ? m.sourceSha : '';
  if (!HEX40.test(sourceSha)) errors.push('manifest: sourceSha must be a 40-hex commit');
  const buildId = typeof m.buildId === 'string' ? m.buildId : '';
  if (!(buildId.startsWith(`${sourceSha}.`) && HEX12.test(buildId.slice(sourceSha.length + 1)))) {
    errors.push('manifest: buildId must be <sourceSha>.<12 hex>');
  }
  if (!Array.isArray(m.documents)) return [...errors, 'manifest: documents must be an array'];

  const rows = new Map(inventory.filter((r) => r.documentId).map((r) => [r.documentId, r]));
  const seen = { id: new Set<unknown>(), servedPath: new Set<unknown>(), canonicalUrl: new Set<unknown>() };
  const outRoot = path.resolve(outDir);

  m.documents.forEach((entry: unknown, i: number) => {
    if (!isObject(entry)) {
      errors.push(`documents[${i}]: not an object`);
      return;
    }
    const d = entry as Partial<ManifestDocument>;
    const at = str(d.id) ? d.id : `documents[${i}]`;
    for (const field of ['id', 'servedPath', 'canonicalUrl'] as const) {
      if (seen[field].has(d[field])) errors.push(`${at}: duplicate ${field} ${d[field]}`);
      seen[field].add(d[field]);
    }
    for (const field of ['id', 'sourcePath', 'servedPath', 'canonicalUrl', 'title'] as const) {
      if (!str(d[field])) errors.push(`${at}: ${field} must be a non-empty string`);
    }
    if (!HEX64.test(String(d.contentSha256))) errors.push(`${at}: contentSha256 must be 64 hex`);

    const canonicalPath = str(d.canonicalUrl) ? pathnameOf(d.canonicalUrl) : null;
    if (canonicalPath === null) errors.push(`${at}: canonicalUrl must be an absolute URL on ${MANIFEST_SITE}`);
    const markdown = isObject(d.markdown) ? d.markdown : null;
    if ([d.servedPath, canonicalPath, markdown?.path].some(isReserved)) {
      errors.push(`${at}: maps to reserved ${RESERVED_RUNTIME_PATH}`);
    }

    const eligibility = isObject(d.eligibility) ? d.eligibility : null;
    const row = rows.get(d.id ?? null);
    if (!row) {
      errors.push(`${at}: no inventory row with this documentId`);
    } else {
      if (!(MANIFEST_KINDS as readonly string[]).includes(row.kind)) {
        errors.push(`${at}: inventory kind ${row.kind} has no manifest entry (only ${MANIFEST_KINDS.join('|')})`);
      }
      if (!eligibility || ELIGIBILITY_KEYS.some((k) => eligibility[k] !== row.eligibility[k])) {
        errors.push(`${at}: eligibility ${JSON.stringify(d.eligibility)} differs from inventory ${JSON.stringify(row.eligibility)}`);
      }
      if (d.canonicalUrl !== row.live?.canonical) {
        errors.push(`${at}: canonicalUrl ${d.canonicalUrl} differs from inventory live.canonical ${row.live?.canonical}`);
      }
      const liveTitle = row.live?.title;
      // #5 recorded the raw <title> HTML; the manifest title is the rendered text.
      const liveText = liveTitle == null ? liveTitle : decodeEntities(liveTitle);
      const expectedTitle = liveText?.endsWith(TITLE_SUFFIX) ? liveText.slice(0, -TITLE_SUFFIX.length) : liveText;
      if (d.title !== expectedTitle) errors.push(`${at}: title ${JSON.stringify(d.title)} should be ${JSON.stringify(expectedTitle)}`);
    }

    if (!eligibility?.agent) {
      if (d.markdown !== null) errors.push(`${at}: markdown must be null when not agent-eligible`);
      return;
    }
    if (!markdown || !str(markdown.path) || !str(markdown.sha256)) {
      errors.push(`${at}: agent-eligible document needs markdown { path, sha256 }`);
      return;
    }
    if (canonicalPath !== null && markdown.path !== markdownPathFor(d.canonicalUrl!)) {
      errors.push(`${at}: markdown.path ${markdown.path} should be ${markdownPathFor(d.canonicalUrl!)}`);
    }
    if (d.contentSha256 !== markdown.sha256) errors.push(`${at}: contentSha256 must equal markdown.sha256`);
    const file = path.resolve(outRoot, `.${markdown.path}`);
    if (!file.startsWith(outRoot + path.sep) || !fs.existsSync(file)) {
      errors.push(`${at}: markdown ${markdown.path} missing from build output`);
      return;
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== markdown.sha256) errors.push(`${at}: markdown ${markdown.path} sha256 ${actual} != recorded ${markdown.sha256}`);
  });
  return errors;
}

/** Decodes the character references Astro and the legacy build emit; an unknown named entity throws instead of yielding wrong text. */
export function decodeEntities(s: string): string {
  // ponytail: numeric references + the named entities seen in this corpus; add names as they appear.
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (!(e in named)) throw new Error(`unknown HTML entity &${e};`);
    return named[e];
  });
}
