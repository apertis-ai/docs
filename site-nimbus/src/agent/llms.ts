// /llms.txt and /llms-full.txt (openspec docs-agent-access): the one definition of both formats. The build
// writes them (converter/integration.ts publicationFiles) and the docs MCP server reads them back
// (src/agent/mcp.ts, served by functions/mcp.ts), so the two can never disagree. Pure: no fs, no Node APIs.
//
// llms.txt follows llmstxt.org: H1, a one-paragraph blockquote, then one H2 per section with
// `- [<title>](<Markdown artifact URL>): <description>` entries. llms-full.txt is every artifact, in the same
// order, each after a `Source: <canonical URL>` line, with a `---` line between artifacts.
import { MANIFEST_SITE } from '../contracts/manifest.ts';

export interface LlmsPage {
  title: string;
  /** Absolute canonical URL (manifest `canonicalUrl`). */
  url: string;
  /** Absolute URL of the clean Markdown artifact. */
  markdownUrl: string;
  /** One line, non-empty. */
  description: string;
  /** The H2 the entry is listed under. */
  section: string;
  /** The artifact, verbatim. */
  markdown: string;
}

export type LlmsEntry = Pick<LlmsPage, 'title' | 'markdownUrl' | 'description' | 'section'>;

const SUMMARY = 'Apertis is an AI API gateway: one API key reaches models from many providers through OpenAI- and Anthropic-compatible '
  + 'endpoints. Each link below is the clean Markdown version of a documentation page; /llms-full.txt holds all of them in one file, '
  + 'and the docs MCP server at https://docs.apertis.ai/mcp searches and reads the same pages.';

const ENTRY = /^- \[((?:\\.|[^\\\]])*)\]\((\S+)\): (.+)$/;
const SOURCE = 'Source: ';

export function llmsIndex(pages: LlmsPage[]): string {
  const sections = new Map<string, LlmsPage[]>();
  for (const p of pages) {
    if (!/\S/.test(p.description) || /[\r\n]/.test(p.description)) throw new Error(`llms: ${p.markdownUrl} needs a one-line description`);
    sections.set(p.section, [...(sections.get(p.section) ?? []), p]);
  }
  const entry = (p: LlmsPage) => `- [${p.title.replace(/[\\[\]]/g, '\\$&')}](${p.markdownUrl}): ${p.description}`;
  return `# Apertis Documentation\n\n> ${SUMMARY}\n${[...sections].map(([name, list]) => `\n## ${name}\n\n${list.map(entry).join('\n')}\n`).join('')}`;
}

export function parseIndex(text: string): LlmsEntry[] {
  let section = '';
  const out: LlmsEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3);
    const m = ENTRY.exec(line);
    if (m) out.push({ title: m[1].replace(/\\(.)/g, '$1'), markdownUrl: m[2], description: m[3], section });
  }
  return out;
}

export function llmsFull(pages: LlmsPage[]): string {
  for (const p of pages) if (!p.markdown.endsWith('\n')) throw new Error(`llms: ${p.markdownUrl} does not end with a newline`);
  const text = pages.map((p) => `${SOURCE}${p.url}\n${p.markdown}`).join('---\n');
  // An artifact holding a `---` line followed by a Source line for a later page would split wrongly when read back.
  const back = parseFull(text);
  if (back.length !== pages.length || back.some((b, i) => b.url !== pages[i].url || b.markdown !== pages[i].markdown)) {
    throw new Error('llms: an artifact contains a line pair that reads as an llms-full.txt frame (--- then Source:)');
  }
  return text;
}

export function parseFull(text: string): { url: string; markdown: string }[] {
  if (!text) return [];
  return text.split(/(?<=\n)---\n(?=Source: )/).map((chunk) => {
    const nl = chunk.indexOf('\n');
    if (!chunk.startsWith(SOURCE) || nl < 0) throw new Error('llms-full.txt: a frame does not start with a Source line');
    return { url: chunk.slice(SOURCE.length, nl), markdown: chunk.slice(nl + 1) };
  });
}

/**
 * The page a URL or path names, as a path without a trailing slash (`/api`, `/intro`), or null when it is not
 * on docs.apertis.ai. `https://docs.apertis.ai/x/`, `/x/`, `/x`, `x`, `/x.md` and `/x/index.md` all give `/x`.
 */
export function pageKey(urlOrPath: string): string | null {
  let u: URL;
  try { u = new URL(urlOrPath.trim(), `${MANIFEST_SITE}/`); } catch { return null; }
  if (u.host !== new URL(MANIFEST_SITE).host || !/^https?:$/.test(u.protocol)) return null;
  return u.pathname.replace(/\/index\.md$/, '/').replace(/\.md$/, '').replace(/\/+$/, '') || '/';
}
