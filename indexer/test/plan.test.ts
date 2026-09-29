// Dry run over the real #7 manifest and build, chunking, and plan validation failures.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chunkMarkdown } from '../chunker.ts'
import { main } from '../index.ts'
import { PlanError, plan } from '../indexer.ts'
import { fixture, page } from './fixture.ts'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const MANIFEST = path.join(ROOT, 'site-nimbus/src/manifest/manifest.json')
const DIST = path.join(ROOT, 'site-nimbus/dist')
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

test('dry run over the real #7 manifest and build: every rag-eligible document, canonical URLs, no credentials, no I/O', async () => {
  assert.ok(existsSync(DIST), 'site-nimbus/dist is missing: run `cd site-nimbus && npm run build` first')
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const rag = manifest.documents.filter((d: any) => d.eligibility.rag)
  assert.equal(rag.length, 11)

  let fetches = 0
  globalThis.fetch = (async () => { fetches++; throw new Error('no network in a dry run') }) as typeof fetch
  const out: string[] = []
  const code = await main(['--environment', 'preview', '--dry-run', '--manifest', MANIFEST, '--dist', DIST], {}, (s) => out.push(s))
  assert.equal(code, 0, out.join('\n'))
  assert.equal(fetches, 0)
  const r = JSON.parse(out.join('\n'))

  assert.equal(r.ok, true)
  assert.equal(r.mode, 'dry-run')
  assert.equal(r.buildId, manifest.buildId)
  assert.equal(r.sourceSha, manifest.sourceSha)
  assert.equal(r.generationId, null)
  assert.deepEqual(r.documents, { planned: 11, pending: 0, complete: 0, failed: 0, excluded: 1 })
  assert.deepEqual(r.excluded, ['page:index'])
  assert.deepEqual(
    r.items.map((i: any) => [i.id, i.urlPath, i.contentSha256]),
    rag.map((d: any) => [d.id, new URL(d.canonicalUrl).pathname, d.markdown.sha256]),
  )
  assert.ok(r.items.some((i: any) => i.urlPath === '/api/'), 'slash canonical kept as-is')
  assert.equal(r.chunks.planned, r.items.reduce((n: number, i: any) => n + i.chunks, 0))
  assert.ok(r.items.every((i: any) => i.chunks > 0 && /^[0-9a-f]{64}$/.test(i.chunksSha256)))
  assert.doesNotMatch(out.join('\n'), /Bearer|apikey|SERVICE_KEY|JINA_API_KEY/)

  // Every chunk anchor of every document is a heading id of its built page (plan() rejects otherwise).
  const p = plan(MANIFEST, DIST)
  const quick = p.documents.find((d) => d.id === 'default:getting-started/quick-start')!
  assert.equal(quick.chunks[0].anchor, 'quick-start')
  assert.equal(quick.title, 'Quick Start')
})

test('write mode without credentials exits 2 before any call; the plan is still validated first', async () => {
  let fetches = 0
  globalThis.fetch = (async () => { fetches++; throw new Error('unexpected') }) as typeof fetch
  const out: string[] = []
  assert.equal(await main(['--environment', 'preview', '--manifest', MANIFEST, '--dist', DIST], {}, (s) => out.push(s)), 2)
  assert.match(out.join('\n'), /missing SUPABASE_URL, SUPABASE_SERVICE_KEY, JINA_API_KEY/)
  assert.equal(await main(['--environment', 'Prod!', '--dry-run'], {}, () => {}), 2)
  assert.equal(fetches, 0)
})

test('headings inside fenced code are not structure, and every snippet survives verbatim in exactly one chunk', () => {
  const md = [
    '# Tools', '', 'Intro.', '',
    '## Setup', '', 'Run this:', '',
    '```bash', '# install', 'npm install x', '', '## not a heading', '```', '',
    '~~~python', '### also not a heading', 'print(1)', '~~~', '',
    '````md', '```js', '## nested fence text', '```', '````', '',
    '## Setup', '', 'Second setup section.',
  ].join('\n')
  const chunks = chunkMarkdown(md, 'Tools', 'tools')
  assert.deepEqual(chunks.map((c) => c.anchor), ['tools', 'setup', 'setup-1'])
  assert.ok(chunks[1].content.startsWith('Tools > Setup\n\n'))
  for (const block of ['```bash\n# install\nnpm install x\n\n## not a heading\n```', '~~~python\n### also not a heading\nprint(1)\n~~~', '````md\n```js\n## nested fence text\n```\n````']) {
    assert.equal(chunks.filter((c) => c.content.includes(block)).length, 1, block)
  }
  // A code block larger than the chunk limit is kept whole in its own chunk.
  const big = ['```ts', ...Array.from({ length: 120 }, (_, i) => `const line${i} = ${i} // padding padding`), '```'].join('\n')
  const bigChunks = chunkMarkdown(`# T\n\n## Code\n\nBefore.\n\n${big}\n\nAfter.`, 'T', 't')
  assert.equal(bigChunks.filter((c) => c.content.includes(big)).length, 1)
  assert.ok(big.length > 1500)
})

test('SDK example page: every fenced example is kept whole, and sections cite their own heading', () => {
  const p = plan(MANIFEST, DIST)
  const sdk = p.documents.find((d) => d.id === 'api:sdks/ai-sdk-provider')!
  const md = readFileSync(path.join(DIST, 'api/sdks/ai-sdk-provider.md'), 'utf8')
  const fences = [...md.matchAll(/^(```+)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm)].map((m) => m[0])
  assert.ok(fences.length >= 10, `found ${fences.length} examples`)
  for (const f of fences) assert.equal(sdk.chunks.filter((c) => c.content.includes(f)).length, 1, f.slice(0, 60))
  const streaming = sdk.chunks.find((c) => c.content.startsWith('@apertis/ai-sdk-provider > Streaming\n\n'))!
  assert.equal(streaming.anchor, 'streaming')
  assert.match(streaming.content, /streamText/)
})

test('plan fails on hash mismatch, duplicate id or URL, missing or escaping artifacts and empty content', () => {
  const ok = [
    { id: 'default:a', path: '/guide/a', title: 'A', body: page('A', ['One', 'Alpha text.']) },
    { id: 'default:b', path: '/guide/b', title: 'B', body: page('B', ['Two', 'Beta text.']) },
  ]
  const f = fixture(ok, 'plan-ok')
  assert.equal(plan(f.manifest, f.dist).documents.length, 2)

  const problems = (mutate: (m: any, dist: string) => void): string => {
    const g = fixture(ok, 'plan-bad')
    const m = JSON.parse(readFileSync(g.manifest, 'utf8'))
    mutate(m, g.dist)
    writeFileSync(g.manifest, JSON.stringify(m))
    try {
      plan(g.manifest, g.dist)
    } catch (e) {
      assert.ok(e instanceof PlanError)
      return e.problems.join('\n')
    }
    assert.fail('plan accepted an invalid manifest')
  }
  assert.match(problems((_, dist) => writeFileSync(path.join(dist, 'guide/a.md'), 'tampered')), /default:a: artifact \/guide\/a.md hash differs/)
  assert.match(problems((m) => { m.documents[1].id = 'default:a' }), /duplicate id/)
  assert.match(problems((m) => { m.documents[1].canonicalUrl = m.documents[0].canonicalUrl }), /duplicate canonicalUrl/)
  assert.match(problems((m) => { m.documents[0].markdown.path = '/guide/missing.md' }), /is missing from/)
  assert.match(problems((m) => { m.documents[0].markdown.path = '/../manifest.json' }), /outside the build output/)
  assert.match(problems((m) => { m.documents[0].markdown = null }), /rag-eligible without a Markdown artifact/)
  assert.match(problems((m) => { m.documents[0].canonicalUrl = 'https://docs.apertis.ai/api/ask' }), /reserved/)
  assert.match(problems((m) => { m.buildId = `${'f'.repeat(40)}.${'0'.repeat(12)}` }), /buildId/)
  assert.match(problems((m, dist) => {
    writeFileSync(path.join(dist, 'guide/a.md'), '')
    m.documents[0].markdown.sha256 = m.documents[0].contentSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  }), /has no content/)
  assert.match(problems((_, dist) => writeFileSync(path.join(dist, 'guide/a/index.html'), '<h1 id="a">A</h1>')), /anchor "one" is not a heading id/)
})
