import React, {useState, useEffect, useRef, useCallback} from 'react'
import {useHistory} from '@docusaurus/router'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import styles from './styles.module.css'

interface SearchResult {
  document: {
    i: number
    t: string
    u: string
    b?: string[]
    s?: string
    p?: number
  }
  type: number
  page?: {
    t: string
    u: string
  }
  tokens: string[]
  score: number
}

interface Props {
  onClose: () => void
}

/**
 * Splits text into segments for safe highlight rendering.
 * Matched tokens become {text, match: true}, rest become {text, match: false}.
 */
function splitHighlight(text: string, tokens: string[]): Array<{text: string; match: boolean}> {
  if (!tokens.length) return [{text, match: false}]
  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const segments: Array<{text: string; match: boolean}> = []
  let cursor = 0
  let found = pattern.test(text)
  if (!found) return [{text, match: false}]

  // Reset and iterate
  pattern.lastIndex = 0
  let result: RegExpMatchArray | null
  const allText = text
  // Use matchAll for safe iteration
  for (const m of allText.matchAll(new RegExp(`(${escaped.join('|')})`, 'gi'))) {
    const idx = m.index ?? 0
    if (idx > cursor) {
      segments.push({text: allText.slice(cursor, idx), match: false})
    }
    segments.push({text: m[1], match: true})
    cursor = idx + m[0].length
  }
  if (cursor < allText.length) {
    segments.push({text: allText.slice(cursor), match: false})
  }
  return segments.length ? segments : [{text, match: false}]
}

export default function SearchTab({onClose}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchReadyRef = useRef(false)
  const history = useHistory()
  const {siteConfig} = useDocusaurusContext()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load search index
  useEffect(() => {
    const loadSearch = async () => {
      try {
        const mod = await import(
          // @ts-ignore
          '@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker'
        )
        await mod.fetchIndexesByWorker(siteConfig.baseUrl, '')
        searchReadyRef.current = true
      } catch {
        // Search not available
      }
    }
    loadSearch()
  }, [siteConfig.baseUrl])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !searchReadyRef.current) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const mod = await import(
        // @ts-ignore
        '@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker'
      )
      const searchResults = await mod.searchByWorker(siteConfig.baseUrl, '', searchQuery)
      setResults(searchResults.slice(0, 10))
      setSelectedIndex(0)
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [siteConfig.baseUrl])

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 150)
    return () => clearTimeout(timer)
  }, [query, handleSearch])

  const navigateToResult = useCallback((r: SearchResult) => {
    onClose()
    history.push(r.document.u)
  }, [onClose, history])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigateToResult(results[selectedIndex])
    }
  }

  return (
    <div className={styles.searchTab}>
      <div className={styles.searchInputWrapper}>
        <svg
          className={styles.searchInputIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for anything..."
          className={styles.searchInput}
          autoComplete="off"
        />
        {query && (
          <button
            className={styles.searchClear}
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label="Clear"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.searchResults}>
        {!query && (
          <div className={styles.searchEmpty}>
            <p>Type to search documentation</p>
          </div>
        )}
        {query && results.length === 0 && !isLoading && (
          <div className={styles.searchEmpty}>
            <p>No results found for &ldquo;{query}&rdquo;</p>
          </div>
        )}
        {results.map((r, index) => (
          <button
            key={`${r.document.i}-${r.type}`}
            className={`${styles.searchResultItem} ${index === selectedIndex ? styles.searchResultSelected : ''}`}
            onClick={() => navigateToResult(r)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className={styles.searchResultIcon}>
              {r.type === 0 ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </div>
            <div className={styles.searchResultContent}>
              <div className={styles.searchResultTitle}>
                {splitHighlight(r.document.t, r.tokens).map((seg, i) =>
                  seg.match ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>
                )}
              </div>
              {r.document.b && r.document.b.length > 0 && (
                <div className={styles.searchResultBreadcrumb}>
                  {r.document.b.join(' > ')}
                </div>
              )}
            </div>
            {index === selectedIndex && (
              <span className={styles.searchResultEnter}>&#8629;</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
