export interface DocumentationSource {
  title: string
  href: string
}

export interface PageContext {
  title: string
  href: string
}

interface PageContextSource {
  title?: string
  href?: string
  pathname?: string
}

const DOCS_TITLE_SUFFIX = /\s*(?:\||-)\s*Apertis Documentation\s*$/i
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

export function extractDocumentationSources(content: string): DocumentationSource[] {
  const seen = new Set<string>()
  const sources: DocumentationSource[] = []

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    const title = match[1].replace(/\s+/g, ' ').trim()
    const href = match[2].trim()

    if (!title || !href.startsWith('/') || href.startsWith('//')) continue
    if (seen.has(href)) continue

    seen.add(href)
    sources.push({title, href})
  }

  return sources
}

export function getCurrentPageContext(source?: PageContextSource): PageContext | null {
  const pageSource = source || getBrowserPageContextSource()
  if (!pageSource) return null

  const href = normalizePageHref(pageSource)
  const title = normalizePageTitle(pageSource.title, href)
  if (!title || !href) return null

  return {title, href}
}

function getBrowserPageContextSource(): PageContextSource | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  return {
    title: document.title,
    href: window.location.href,
    pathname: window.location.pathname,
  }
}

function normalizePageHref(source: PageContextSource): string {
  if (source.pathname) return source.pathname || '/'

  if (!source.href) return '/'

  try {
    const url = new URL(source.href)
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch {
    return source.href.startsWith('/') ? source.href : '/'
  }
}

function normalizePageTitle(title: string | undefined, href: string): string {
  const cleaned = (title || '')
    .replace(DOCS_TITLE_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned) return cleaned

  const segment = href.split('/').filter(Boolean).pop()
  return segment ? humanizePathSegment(segment) : 'Current page'
}

function humanizePathSegment(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
