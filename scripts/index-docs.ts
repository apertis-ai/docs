import { createClient } from '@supabase/supabase-js'
import { glob } from 'glob'
import matter from 'gray-matter'
import { readFileSync } from 'fs'

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

function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current += '\n\n' + para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
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

function removeCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '[code block]')
}

async function indexDocs() {
  console.log('Starting documentation indexing...')

  const files = await glob(['docs/**/*.md', 'docs-api/**/*.md'], {
    ignore: ['docs/plans/**']
  })

  console.log(`Found ${files.length} markdown files`)

  let totalChunks = 0

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const { data: frontmatter, content: body } = matter(content)

      const urlPath = '/' + filePath
        .replace(/^docs-api\//, 'api/')
        .replace(/^docs\//, '')
        .replace(/\.md$/, '')
        .replace(/\/index$/, '')

      // Upsert document
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .upsert({
          file_path: filePath,
          title: frontmatter.title || extractH1(body) || filePath,
          url_path: urlPath
        })
        .select()
        .single()

      if (docError) {
        console.error(`Error upserting document ${filePath}:`, docError)
        continue
      }

      // Clean and chunk the content
      const cleanedBody = removeCodeBlocks(body)
      const chunks = chunkText(cleanedBody)

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

  console.log(`\n✅ Indexing complete! Total: ${files.length} files, ${totalChunks} chunks`)
}

indexDocs().catch(console.error)
