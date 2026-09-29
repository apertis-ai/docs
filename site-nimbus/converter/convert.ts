// #7 converter (phase 1): legacy Docusaurus sources -> candidate content + publication manifest.
//   node converter/convert.ts        (from site-nimbus/; rewrites the generated paths below)
// Legacy docs/ and docs-api/ stay authoritative. Every output is regenerated from them and never
// hand-edited: src/content/docs/** (Astro render sources), src/content/public/** (clean Markdown
// artifacts and bundled images, copied verbatim into dist by converter/integration.ts) and
// src/manifest/manifest.json. Unsupported syntax throws ConversionError; nothing is dropped silently.
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { markdownPathFor, type ManifestDocument, type ManifestV1 } from '../src/contracts/manifest.ts';
import { MANIFEST_KINDS, type InventoryRoute, type RouteInventory } from '../src/contracts/navigation.ts';
import { TITLE_SUFFIX } from '../src/contracts/page.ts';
import { decodeEntities } from '../src/contracts/validate-manifest.ts';
export { decodeEntities };

export const SITE_ROOT = path.resolve(import.meta.dirname, '..');
export const REPO_ROOT = path.resolve(SITE_ROOT, '..');
/** Legacy publication roots; `sourceSha` is the last commit touching any of them. */
export const LEGACY_ROOTS = ['docs', 'docs-api', 'src/pages', 'blog', 'static'];
export const INVENTORY_PATH = 'migration/nimbus/route-inventory.json';
export const GENERATED_DOCS = 'src/content/docs';
export const GENERATED_PUBLIC = 'src/content/public';
const MANIFEST_FILE = 'src/manifest/manifest.json';
/**
 * Page header meta (#8 reading layout), keyed by document id: `updated` is the author date (`%aI`) of
 * the last legacy commit touching the source file, as of `sourceSha`; `readingMinutes` comes from
 * readingMinutes(). Written here so the build never calls git. It lives in src/content/docs (covered
 * by the drift test) but is not a collection entry (the loader globs Markdown only). Not front matter:
 * Nimbus's docs schema rejects unknown keys, and src/content.config.ts is outside this packet.
 */
export const PAGE_META_FILE = `${GENERATED_DOCS}/page-meta.json`;
export interface PageMeta {
  updated: string;
  readingMinutes: number;
}
/** Standalone pages (`page:*`) are rendered by their own .astro route; they only get a manifest entry. */
const isStandalonePage = (id: string) => id.startsWith('page:');

export class ConversionError extends Error {}

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

export interface ConvertContext {
  inventory: InventoryRoute[];
  repoRoot: string;
}

export interface BundledAsset {
  /** Served path, e.g. `/assets/images/roocode_1-<16 hex>.png`. */
  publicPath: string;
  /** Repository-relative source file. */
  file: string;
}

export interface ConvertedDocument {
  /** Astro render source (front matter + Markdown; admonitions as `<aside>`). */
  render: string;
  /** Clean Markdown artifact (no front matter, JSX or directives). */
  clean: string;
  title: string;
  assets: BundledAsset[];
}

const FRONT_MATTER_KEYS = new Set(['title', 'description', 'sidebar_label', 'sidebar_position']);
const ADMONITIONS = ['note', 'tip', 'info', 'warning', 'caution', 'danger'];
const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
// The one MDX construct these sources use outside code: a decorative icon before the H1 text.
const HEADING_ICON = /^# <img src="([^"]+)" width="(\d+)" style=\{\{([^}]*)\}\} \/> (.+)$/;

/** Canonical path of the inventory row: pathname of `live.canonical`. */
const canonicalPath = (row: InventoryRoute) => new URL(row.live!.canonical!).pathname;
/** `/x` -> `/x/`; slash canonicals (`/`, `/api/`) are served as is. */
export const servedPathOf = (row: InventoryRoute) => {
  const p = canonicalPath(row);
  return p.endsWith('/') ? p : `${p}/`;
};
const inventoryTitle = (row: InventoryRoute) => {
  const t = row.live?.title ?? '';
  return t.endsWith(TITLE_SUFFIX) ? t.slice(0, -TITLE_SUFFIX.length) : t;
};

export function convertDocument(source: string, row: InventoryRoute, ctx: ConvertContext): ConvertedDocument {
  const file = row.sourcePath!;
  const fail = (line: number, what: string): never => {
    throw new ConversionError(`${file}:${line}: ${what}`);
  };
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  // Front matter: flat `key: value` lines with known keys only.
  const front: Record<string, string> = {};
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end < 0) fail(1, 'unclosed front matter');
    for (i = 1; i < end; i++) {
      const m = /^([a-z_]+):\s*(.*)$/.exec(lines[i]);
      if (!m) fail(i + 1, `unsupported front matter line ${JSON.stringify(lines[i])}`);
      if (!FRONT_MATTER_KEYS.has(m![1])) fail(i + 1, `unsupported front matter key ${m![1]}`);
      front[m![1]] = m![2].replace(/^(["'])(.*)\1$/, '$2');
    }
    i = end + 1;
  }

  const bySource = new Map(ctx.inventory.filter((r) => r.sourcePath).map((r) => [r.sourcePath, r]));
  const paths = new Set(ctx.inventory.filter((r) => r.disposition !== 'absent-at-baseline').map((r) => r.path));
  const assets: BundledAsset[] = [];
  const base = canonicalPath(row);

  const resolveLink = (url: string, n: number): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) return url;
    const at = url.search(/[?#]/);
    const [target, suffix] = at < 0 ? [url, ''] : [url.slice(0, at), url.slice(at)];
    let resolved: string;
    if (target.startsWith('/')) resolved = target;
    else if (/\.mdx?$/.test(target)) {
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      const hit = bySource.get(rel) ?? fail(n, `link ${url}: no inventory document has source ${rel}`);
      resolved = hit.path;
    } else resolved = new URL(target, `https://x${base}`).pathname; // Docusaurus resolves against the permalink
    if (resolved.length > 1) resolved = resolved.replace(/\/$/, '');
    if (!paths.has(resolved)) fail(n, `link ${url}: ${resolved} is not in the route inventory`);
    return resolved + suffix;
  };

  const resolveImage = (url: string, n: number): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    if (url.startsWith('/')) {
      if (!fs.existsSync(path.join(ctx.repoRoot, 'static', url))) fail(n, `image ${url} is not a legacy static/ file`);
      return url;
    }
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), url));
    const abs = path.join(ctx.repoRoot, rel);
    if (!/^docs(-api)?\//.test(rel) || !fs.existsSync(abs)) fail(n, `image ${url}: bundled file ${rel} not found under docs/ or docs-api/`);
    const ext = path.posix.extname(rel);
    const publicPath = `/assets/images/${path.posix.basename(rel, ext)}-${sha256(fs.readFileSync(abs)).slice(0, 16)}${ext}`;
    if (!assets.some((a) => a.publicPath === publicPath)) assets.push({ publicPath, file: rel });
    return publicPath;
  };

  // Text outside code: mask code spans (same length) so checks and link rewrites skip them.
  const transformText = (line: string, n: number): string => {
    const masked = line.replace(/(`+)(.+?)\1/g, (m) => ' '.repeat(m.length));
    if (/^\s*(import|export)\s/.test(masked)) fail(n, 'MDX import/export');
    if (/\{#[^}]*\}/.test(masked)) fail(n, 'explicit heading id {#...}');
    if (/[{}]/.test(masked)) fail(n, 'MDX expression {...}');
    if (/<[A-Za-z/!]/.test(masked.replace(/<(https?|mailto):[^>\s]+>/g, ''))) fail(n, 'inline HTML/JSX');
    if (/^\s*\[[^\]]+\]:\s/.test(masked)) fail(n, 'reference-style link definition');
    const edits: [number, number, string][] = [];
    const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;
    if (/\]\(/.test(masked.replace(LINK, (m) => ' '.repeat(m.length)))) fail(n, 'unmatched link `](` (multi-line or malformed link)');
    for (const m of masked.matchAll(LINK)) {
      const urlStart = m.index! + m[1].length + m[2].length + 3;
      const url = line.slice(urlStart, urlStart + m[3].length);
      edits.push([urlStart, urlStart + m[3].length, m[1] ? resolveImage(url, n) : resolveLink(url, n)]);
    }
    let out = line;
    for (const [s, e, v] of edits.reverse()) out = out.slice(0, s) + v + out.slice(e);
    return out;
  };

  const render: string[] = [];
  const clean: string[] = [];
  let fence: { char: string; len: number; line: number } | null = null;
  let admonition: { line: number; bodyStarted: boolean } | null = null;
  let h1Text: string | null = null;
  // After `</aside>` / the blockquote: a blank line before the next content, so a paragraph that
  // follows `:::` directly is neither swallowed by the HTML block nor lazily continued in the quote.
  let blankAfterAdmonition = false;
  const separate = (r: string) => {
    if (blankAfterAdmonition && r.trim() !== '') { render.push(''); clean.push(''); }
    blankAfterAdmonition = false;
  };

  const emit = (r: string, c: string = r) => {
    separate(r);
    if (admonition && !admonition.bodyStarted) {
      if (r.trim() === '') return;
      admonition.bodyStarted = true;
    }
    render.push(r);
    clean.push(admonition ? (c ? `> ${c}` : '>') : c);
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (fence) {
      emit(line);
      const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) fence = null;
      continue;
    }
    const f = FENCE.exec(line);
    if (f) {
      if (!/^[A-Za-z0-9_+#.-]*$/.test(f[3].trim())) fail(n, `code fence meta ${JSON.stringify(f[3].trim())} (only a language is supported)`);
      fence = { char: f[2][0], len: f[2].length, line: n };
      emit(line);
      continue;
    }
    if (/^\s+:::/.test(line)) fail(n, 'indented admonition');
    if (line.startsWith(':::')) {
      if (/^:::\s*$/.test(line)) {
        if (!admonition) fail(n, 'admonition close without open');
        while (render.length && render.at(-1)!.trim() === '') { render.pop(); clean.pop(); }
        render.push('', '</aside>');
        admonition = null;
        blankAfterAdmonition = true;
        continue;
      }
      const m = /^:::([a-z]+)(?:[ \t]+(.+?))?[ \t]*$/.exec(line);
      if (admonition) fail(n, 'nested admonition');
      if (!m || !ADMONITIONS.includes(m[1])) fail(n, `unsupported admonition ${JSON.stringify(line)}`);
      if (m![2] && /[*_[\]<>~\\{}]/.test(m![2].replace(/`[^`]+`/g, ''))) fail(n, `unsupported Markdown in admonition title ${JSON.stringify(m![2])} (only code spans)`);
      const [type, title] = [m![1], m![2] ? transformText(m![2], n) : undefined];
      separate(line);
      const label = type[0].toUpperCase() + type.slice(1);
      const titleHtml = (title ?? label).split(/(`[^`]+`)/).map((s) =>
        (s.startsWith('`') ? `<code>${escapeHtml(s.slice(1, -1))}</code>` : escapeHtml(s))).join('');
      render.push(`<aside class="admonition admonition-${type}">`, `<p class="admonition-title">${titleHtml}</p>`, '');
      clean.push(`> **${title ? `${label}: ${title}` : label}**`, '>');
      admonition = { line: n, bodyStarted: false };
      continue;
    }
    if (/^# /.test(line)) {
      if (h1Text !== null) fail(n, 'more than one H1');
      const icon = HEADING_ICON.exec(line);
      if (icon) {
        const [, src, width, style, text] = icon;
        const resolved = resolveImage(src, n);
        h1Text = text;
        emit(`# <img src="${resolved}" width="${width}" alt="" style="${jsxStyle(style, () => fail(n, `unsupported icon style ${style}`))}" /> ${transformText(text, n)}`,
          `# ${transformText(text, n)}`);
        continue;
      }
      h1Text = line.slice(2).trim();
    }
    const t = transformText(line, n);
    emit(t);
  }
  if (fence) fail(fence.line, 'unclosed code fence');
  if (admonition) fail(admonition.line, 'unclosed admonition');

  const title = front.title ?? h1Text ?? fail(1, 'no title (front matter or H1)');
  if (title !== inventoryTitle(row)) fail(1, `title ${JSON.stringify(title)} differs from inventory ${JSON.stringify(inventoryTitle(row))}`);
  const trim = (ls: string[]) => `${ls.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')}\n`;
  // A document without a body H1 gets its title as the one H1 (avoids a duplicate H1 otherwise).
  const h1 = h1Text === null ? `# ${title}\n\n` : '';
  const fm = [`title: ${JSON.stringify(title)}`, ...(front.description ? [`description: ${JSON.stringify(front.description)}`] : [])];
  return {
    render: `---\n${fm.join('\n')}\n---\n\n${h1}${trim(render)}`,
    clean: `${h1}${trim(clean)}`,
    title,
    assets,
  };
}

/** Words of the clean Markdown outside fenced code blocks, at 200 per minute, rounded up (at least 1). */
export function readingMinutes(clean: string): number {
  const prose = clean.replace(/^(?:> )?[ \t]*(`{3,}|~{3,})[\s\S]*?^(?:> )?[ \t]*\1[ \t]*$/gm, '');
  return Math.max(1, Math.ceil(prose.split(/\s+/).filter(Boolean).length / 200));
}

/** Author date of the last commit touching `sourcePath` up to `sourceSha` (deterministic for a given sourceSha). */
export function lastUpdatedOf(repoRoot: string, sourceSha: string, sourcePath: string): string {
  const date = git(repoRoot, ['log', '-1', '--format=%aI', sourceSha, '--', sourcePath]);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date)) throw new ConversionError(`${sourcePath}: no commit up to ${sourceSha} touches it`);
  return date;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** `{display: 'inline-block', marginRight: 8}` -> `display:inline-block;margin-right:8px` (React numeric = px). */
function jsxStyle(body: string, fail: () => never): string {
  return body.split(',').map((pair) => {
    const m = /^\s*([a-zA-Z]+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(\d+))\s*$/.exec(pair) ?? fail();
    const value = m[4] !== undefined ? `${m[4]}px` : (m[2] ?? m[3]);
    return `${m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`;
  }).join(';');
}

/**
 * SHA-256 of the text content of `<main>`, whitespace runs collapsed to one space and trimmed
 * (manifest `contentSha256` for entries without Markdown).
 */
export function mainTextSha256(html: string): string {
  const m = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html);
  if (!m) throw new Error('no <main> element');
  const text = decodeEntities(m[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ''));
  return sha256(Buffer.from(text.replace(/\s+/g, ' ').trim(), 'utf8'));
}


const git = (repoRoot: string, args: string[]) => execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();

/** Last commit touching the legacy publication roots; refuses shallow clones and uncommitted source edits. */
export function sourceShaOf(repoRoot: string): string {
  if (git(repoRoot, ['rev-parse', '--is-shallow-repository']) === 'true') throw new Error('sourceSha needs full history (shallow clone)');
  const dirty = git(repoRoot, ['status', '--porcelain', '--', ...LEGACY_ROOTS]);
  if (dirty) throw new Error(`sourceSha: uncommitted changes under legacy roots:\n${dirty}`);
  return git(repoRoot, ['log', '-1', '--format=%H', '--', ...LEGACY_ROOTS]);
}

/** site-nimbus files that cannot change dist: documentation, tests and git metadata. */
export const NOT_BUILD_INPUTS = ['README.md', '.gitignore', 'test/'];

/**
 * First 12 hex of SHA-256 over every build input: the working-tree bytes of each file `git ls-files`
 * tracks under site-nimbus/ (lockfile, package.json, config, converter, contracts, routes, layouts,
 * components, styles, search) plus the route inventory, sorted by repository path, each hashed as
 * `path\0bytes\0`. Excluded: generated output (src/content/**, the manifest), NOT_BUILD_INPUTS
 * (README.md, .gitignore, test/**) and untracked files.
 */
export function buildHashOf(siteRoot: string, repoRoot: string = REPO_ROOT): string {
  const site = path.relative(repoRoot, siteRoot).split(path.sep).join('/');
  const generated = (f: string) => f.startsWith(`${site}/src/content/`) || f === `${site}/${MANIFEST_FILE}`;
  const notInput = (f: string) => NOT_BUILD_INPUTS.some((x) => (x.endsWith('/') ? f.startsWith(`${site}/${x}`) : f === `${site}/${x}`));
  const tracked = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z', '--', site], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = [...new Set([...tracked.filter((f) => !generated(f) && !notInput(f)), INVENTORY_PATH])].sort();
  const h = crypto.createHash('sha256');
  for (const f of files) {
    const abs = path.join(repoRoot, f);
    if (!fs.existsSync(abs)) continue; // tracked but deleted in the working tree
    h.update(`${f}\0`).update(fs.readFileSync(abs)).update('\0');
  }
  return h.digest('hex').slice(0, 12);
}

function writeFile(root: string, rel: string, data: string | Buffer) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs)) throw new ConversionError(`output collision at ${rel}`);
  fs.writeFileSync(abs, data);
}

/** Atomic write (temp + rename) so concurrent readers never see a partial manifest. */
export function writeManifest(root: string, manifest: ManifestV1) {
  const abs = path.join(root, MANIFEST_FILE);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(`${abs}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(`${abs}.tmp`, abs);
}

/**
 * Phase 1: regenerate every converter output under `outRoot` (default site-nimbus/) from the
 * legacy sources. Generated directories are wiped first, so deleted or renamed sources leave no
 * stale output. Entries without Markdown (`page:index`) keep their previous contentSha256 (all
 * zeros when none): phase 2 (converter/integration.ts, after `astro build`) sets it from the built `<main>`.
 */
/**
 * The inventory rows, with `live.title` decoded: #5 recorded the raw `<title>` HTML (for example
 * `Reasoning &amp; Extended Thinking`), while manifest and page titles are text. Every converter and
 * phase-2 reader goes through here, so the title check, the manifest and validateManifest see one value.
 */
export const readInventory = (repoRoot: string = REPO_ROOT): InventoryRoute[] =>
  (JSON.parse(fs.readFileSync(path.join(repoRoot, INVENTORY_PATH), 'utf8')) as RouteInventory).routes
    .map((r) => (r.live?.title ? { ...r, live: { ...r.live, title: decodeEntities(r.live.title) } } : r));

export function convert({ outRoot = SITE_ROOT, repoRoot = REPO_ROOT, inventory = readInventory(repoRoot) }:
  { outRoot?: string; repoRoot?: string; inventory?: InventoryRoute[] } = {}): ManifestV1 {
  const ctx = { inventory, repoRoot };
  const sourceSha = sourceShaOf(repoRoot);
  const buildId = `${sourceSha}.${buildHashOf(SITE_ROOT, repoRoot)}`;
  const previous = path.join(outRoot, MANIFEST_FILE);
  const previousHashes = new Map(fs.existsSync(previous)
    ? ((JSON.parse(fs.readFileSync(previous, 'utf8')) as ManifestV1).documents ?? []).map((d) => [d.id, d.contentSha256])
    : []);
  // Entries without Markdown hash their built <main> text: carried here, recomputed by phase 2.
  const htmlHash = (id: string) => (/^[0-9a-f]{64}$/.test(previousHashes.get(id) ?? '') ? previousHashes.get(id)! : '0'.repeat(64));

  for (const dir of [GENERATED_DOCS, GENERATED_PUBLIC]) fs.rmSync(path.join(outRoot, dir), { recursive: true, force: true });

  const pageMeta: Record<string, PageMeta> = {};
  // Every preserved doc/page/blog-post row (#13). Retired rows (decision on #4) get no entry and no output.
  const rows = inventory.filter((r) => r.disposition === 'preserve' && r.documentId && (MANIFEST_KINDS as readonly string[]).includes(r.kind));
  const documents: ManifestDocument[] = rows.map((row) => {
    const canonicalUrl = row.live!.canonical!;
    const base = {
      id: row.documentId!,
      sourcePath: row.sourcePath!,
      servedPath: servedPathOf(row),
      canonicalUrl,
      title: inventoryTitle(row),
      eligibility: { ...row.eligibility },
    };
    if (!row.eligibility.publish && row.eligibility.agent) throw new ConversionError(`${row.documentId}: agent-eligible but not publish-eligible`);
    if (isStandalonePage(row.documentId!)) {
      if (!row.eligibility.publish) throw new ConversionError(`${row.documentId}: unpublished standalone pages are not supported`);
      if (row.eligibility.agent) throw new ConversionError(`${row.documentId}: agent-eligible standalone pages are not converted`);
      return { ...base, markdown: null, contentSha256: htmlHash(base.id) };
    }
    const out = convertDocument(fs.readFileSync(path.join(repoRoot, row.sourcePath!), 'utf8'), row, ctx);
    // Not published: still converted (constructs are checked) but nothing is written; there is no
    // HTML and no artifact, so contentSha256 is the hash of the clean Markdown.
    if (!row.eligibility.publish) return { ...base, markdown: null, contentSha256: sha256(out.clean) };
    writeFile(outRoot, `${GENERATED_DOCS}${base.servedPath}index.md`, out.render);
    pageMeta[base.id] = { updated: lastUpdatedOf(repoRoot, sourceSha, row.sourcePath!), readingMinutes: readingMinutes(out.clean) };
    for (const a of out.assets) {
      const dest = path.join(outRoot, GENERATED_PUBLIC, a.publicPath);
      if (!fs.existsSync(dest)) writeFile(outRoot, `${GENERATED_PUBLIC}${a.publicPath}`, fs.readFileSync(path.join(repoRoot, a.file)));
    }
    if (!row.eligibility.agent) return { ...base, markdown: null, contentSha256: htmlHash(base.id) };
    const md = { path: markdownPathFor(canonicalUrl), sha256: sha256(out.clean) };
    writeFile(outRoot, `${GENERATED_PUBLIC}${md.path}`, out.clean);
    return { ...base, markdown: md, contentSha256: md.sha256 };
  });

  writeFile(outRoot, PAGE_META_FILE, `${JSON.stringify(pageMeta, null, 2)}\n`);
  const manifest: ManifestV1 = { manifestVersion: 1, site: 'https://docs.apertis.ai', sourceSha, buildId, documents };
  writeManifest(outRoot, manifest);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const m = convert();
  console.log(`converted ${m.documents.length} documents; buildId ${m.buildId}`);
}
