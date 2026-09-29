// Heading-aware chunker for the clean Markdown artifacts (#7). Same shape as the legacy chunker
// (scripts/index-docs.ts): H2/H3 sections, paragraphs packed up to 1500 characters, and a
// "<title> > <heading>" prefix. Differences, each a defect fix:
//   * lines inside fenced code are never headings or paragraph breaks, so a snippet is never split or
//     dropped (a block larger than the limit becomes its own chunk);
//   * every chunk records its citation anchor: the heading id of its section, computed like the built
//     page (github-slugger, deduplicated over all headings), or for text before the first section the
//     page's H1 id (`introAnchor`, read from the built page). The indexer checks each anchor against the
//     built page.
import { createHash } from 'node:crypto'

/** Part of the embedding-cache identity: bump it whenever the chunk text for the same input can change. */
export const CHUNKER_VERSION = 'm6-chunker-1'
export const MAX_CHARS = 1500

export interface Chunk {
  index: number
  content: string
  contentSha256: string
  anchor: string
}

export const sha256 = (s: string | Uint8Array): string => createHash('sha256').update(s).digest('hex')

/** The same normalization is applied before chunking and hashing, so equal text gives equal hashes. */
export const normalize = (s: string): string => s.normalize('NFC').replace(/\r\n?/g, '\n')

/** Rendered text of an ATX heading: links, images, code spans and emphasis reduced to their text. */
export function headingText(raw: string): string {
  return raw
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .trim()
}

/** github-slugger: lower-case, drop punctuation and symbols, spaces to hyphens, dedupe with -1, -2… */
export function slugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text) => {
    const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-')
    let slug = base
    let n = seen.get(base) ?? 0
    while (seen.has(slug)) slug = `${base}-${++n}`
    seen.set(base, n)
    seen.set(slug, 0)
    return slug
  }
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/

interface Section {
  heading: string | null
  anchor: string
  blocks: string[]
}

export function chunkMarkdown(markdown: string, title: string, introAnchor = '', maxChars = MAX_CHARS): Chunk[] {
  const slug = slugger()
  const sections: Section[] = []
  let section: Section = { heading: null, anchor: introAnchor, blocks: [] }
  let block: string[] = []
  let fence: { char: string; len: number } | null = null

  const endBlock = () => {
    const text = block.join('\n').trim()
    if (text) section.blocks.push(text)
    block = []
  }

  for (const line of normalize(markdown).split('\n')) {
    if (fence) {
      block.push(line)
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) fence = null
      continue
    }
    const f = FENCE.exec(line)
    if (f && !(f[1][0] === '`' && f[2].includes('`'))) {
      fence = { char: f[1][0], len: f[1].length }
      block.push(line)
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      const text = headingText(h[2])
      const id = slug(text)
      if (h[1].length === 2 || h[1].length === 3) {
        endBlock()
        sections.push(section)
        section = { heading: text, anchor: id, blocks: [] }
        continue
      }
    }
    if (line.trim() === '') endBlock()
    else block.push(line)
  }
  endBlock()
  sections.push(section)

  const chunks: Chunk[] = []
  for (const s of sections) {
    const prefix = s.heading ? `${title} > ${s.heading}\n\n` : `${title}\n\n`
    let current = ''
    const push = () => {
      if (!current) return
      const content = prefix + current
      chunks.push({ index: chunks.length, content, contentSha256: sha256(content), anchor: s.anchor })
      current = ''
    }
    for (const b of s.blocks) {
      if (current && current.length + 2 + b.length > maxChars) push()
      current = current ? `${current}\n\n${b}` : b
    }
    push()
  }
  return chunks
}

/** Hash of the ordered chunk hashes; the migration recomputes it the same way. */
export const chunksSha256 = (chunks: Chunk[]): string => sha256(chunks.map((c) => c.contentSha256).join('\n'))
