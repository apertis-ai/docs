// Synthetic manifest + built-site fixtures in the #7 layout: manifest.json, dist/<markdown.path> and the
// built page dist/<servedPath>index.html carrying the heading ids.
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { headingText, slugger } from '../chunker.ts'

export interface FixtureDoc {
  id: string
  /** Canonical pathname, e.g. `/guide/a` or `/api/`. */
  path: string
  title: string
  body: string
  sourcePath?: string
  rag?: boolean
}

const hex = (s: string, n: number) => createHash('sha256').update(s).digest('hex').slice(0, n)

export function fixture(docs: FixtureDoc[], seed: string): { manifest: string; dist: string; buildId: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'm6-fixture-'))
  const dist = path.join(dir, 'dist')
  const sourceSha = hex(`source:${seed}`, 40)
  const buildId = `${sourceSha}.${hex(`build:${seed}`, 12)}`
  const documents = docs.map((d) => {
    const rag = d.rag ?? true
    const servedPath = d.path.endsWith('/') ? d.path : `${d.path}/`
    const mdPath = d.path.endsWith('/') ? `${d.path}index.md` : `${d.path}.md`
    const bytes = Buffer.from(d.body)
    const sha = createHash('sha256').update(bytes).digest('hex')
    if (rag) {
      mkdirSync(path.dirname(path.join(dist, mdPath)), { recursive: true })
      writeFileSync(path.join(dist, mdPath), bytes)
    }
    const slug = slugger()
    const ids: string[] = []
    let fence = false
    for (const line of d.body.split('\n')) {
      if (/^(`{3,}|~{3,})/.test(line)) fence = !fence
      const h = !fence && /^(#{1,6})\s+(.+)$/.exec(line)
      if (h) ids.push(`<h${h[1].length} id="${slug(headingText(h[2]))}">${h[2]}</h${h[1].length}>`)
    }
    mkdirSync(path.join(dist, servedPath), { recursive: true })
    writeFileSync(path.join(dist, servedPath, 'index.html'), `<!doctype html><main>${ids.join('\n')}</main>`)
    return {
      id: d.id,
      sourcePath: d.sourcePath ?? `docs${d.path.replace(/\/$/, '/index')}.md`,
      servedPath,
      canonicalUrl: `https://docs.apertis.ai${d.path}`,
      title: d.title,
      eligibility: { publish: true, search: rag, agent: rag, rag },
      markdown: rag ? { path: mdPath, sha256: sha } : null,
      contentSha256: sha,
    }
  })
  const manifest = path.join(dir, 'manifest.json')
  writeFileSync(manifest, JSON.stringify({ manifestVersion: 1, site: 'https://docs.apertis.ai', sourceSha, buildId, documents }, null, 2))
  return { manifest, dist, buildId }
}

export const page = (title: string, ...sections: Array<[string, string]>) =>
  [`# ${title}`, '', `${title} introduction.`, '', ...sections.flatMap(([h, t]) => [`## ${h}`, '', t, ''])].join('\n')
