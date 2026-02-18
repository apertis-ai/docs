import { createClient } from '@supabase/supabase-js'
import { glob } from 'glob'
import matter from 'gray-matter'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const JINA_API_KEY = process.env.JINA_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !JINA_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface JinaEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

interface Section {
  heading: string | null
  content: string
}

/**
 * Split markdown into sections by H2/H3 headings.
 * Each section includes its heading and all content until the next heading.
 */
function splitBySections(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let currentHeading: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)$/)
    if (headingMatch) {
      // Save previous section
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
      }
      currentHeading = headingMatch[1]
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  // Save last section
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
  }

  return sections.filter(s => s.content.length > 0)
}

/**
 * Chunk a section's content by paragraph boundaries, respecting maxChars.
 * Returns chunks with the document/section context prefix prepended.
 */
function chunkSection(
  section: Section,
  docTitle: string,
  maxChars = 1500
): string[] {
  const prefix = section.heading
    ? `${docTitle} > ${section.heading}\n\n`
    : `${docTitle}\n\n`

  const paragraphs = section.content.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current) {
      chunks.push(prefix + current.trim())
      current = para
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }
  if (current.trim()) chunks.push(prefix + current.trim())
  return chunks
}

/**
 * Process a markdown body into context-enriched chunks.
 * #1: Keeps code blocks (no stripping)
 * #2: Splits by H2/H3 headings first, then by size
 * #3: Prepends doc title > section heading as metadata prefix
 */
function createChunks(body: string, docTitle: string): string[] {
  const sections = splitBySections(body)
  const allChunks: string[] = []

  for (const section of sections) {
    const sectionChunks = chunkSection(section, docTitle)
    allChunks.push(...sectionChunks)
  }

  return allChunks
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JINA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v4',
      input: texts,
      task: 'retrieval.passage',
      dimensions: 1024,
    }),
  })

  if (!res.ok) {
    throw new Error(`Jina API error: ${res.status} ${await res.text()}`)
  }

  const data: JinaEmbeddingResponse = await res.json()
  return data.data.map((d) => d.embedding)
}

function extractH1(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1] : null
}

async function indexDocs() {
  console.log('Starting documentation indexing...')

  const forceReindex = process.argv.includes('--force')
  if (forceReindex) {
    console.log('⚡ Force re-index mode: skipping content hash checks')
  }

  const files = await glob(['docs/**/*.md', 'docs-api/**/*.md'], {
    ignore: ['docs/plans/**']
  })

  console.log(`Found ${files.length} markdown files`)

  let totalChunks = 0
  let skippedFiles = 0

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const contentHash = sha256(content)
      const { data: frontmatter, content: body } = matter(content)

      const docTitle = frontmatter.title || extractH1(body) || filePath
      const urlPath = '/' + filePath
        .replace(/^docs-api\//, 'api/')
        .replace(/^docs\//, '')
        .replace(/\.md$/, '')
        .replace(/\/index$/, '')

      // Check if content has changed (#10: incremental indexing)
      if (!forceReindex) {
        const { data: existing } = await supabase
          .from('documents')
          .select('content_hash')
          .eq('file_path', filePath)
          .single()

        if (existing?.content_hash === contentHash) {
          skippedFiles++
          continue
        }
      }

      // Upsert document with content hash
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .upsert({
          file_path: filePath,
          title: docTitle,
          url_path: urlPath,
          content_hash: contentHash,
        })
        .select()
        .single()

      if (docError) {
        console.error(`Error upserting document ${filePath}:`, docError)
        continue
      }

      // Create heading-aware, metadata-enriched chunks (#1, #2, #3)
      const chunks = createChunks(body, docTitle)

      if (chunks.length === 0) {
        console.log(`⏭️  Skipped: ${filePath} (no content)`)
        continue
      }

      // Get embeddings
      const embeddings = await getEmbeddings(chunks)

      // Delete old chunks
      const { error: deleteError } = await supabase.from('document_chunks')
        .delete()
        .eq('document_id', doc.id)

      if (deleteError) {
        console.error(`Error deleting old chunks for ${filePath}:`, deleteError)
        continue
      }

      // Insert new chunks
      const { error: chunkError } = await supabase.from('document_chunks').insert(
        chunks.map((content, i) => ({
          document_id: doc.id,
          content,
          chunk_index: i,
          embedding: embeddings[i],
        }))
      )

      if (chunkError) {
        console.error(`Error inserting chunks for ${filePath}:`, chunkError)
        continue
      }

      totalChunks += chunks.length
      console.log(`✅ Indexed: ${filePath} (${chunks.length} chunks)`)

      // Rate limiting: wait 100ms between files to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`Error processing ${filePath}:`, error)
    }
  }

  console.log(`\n✅ Indexing complete! ${files.length} files, ${totalChunks} chunks indexed, ${skippedFiles} unchanged files skipped`)
}

indexDocs().catch(console.error)
