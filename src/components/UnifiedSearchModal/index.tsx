import React, {useState, useEffect, useCallback} from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import SearchTab from './SearchTab'
import AskAITab from './AskAITab'
import {PageContext, getCurrentPageContext} from './assistantUtils'
import styles from './styles.module.css'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'askai_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(key, id)
  }
  return id
}

type TabType = 'search' | 'askdocs'
type SurfaceType = TabType | null

export default function UnifiedSearchModal() {
  const [activeSurface, setActiveSurface] = useState<SurfaceType>(null)
  const [isAskExpanded, setIsAskExpanded] = useState(false)
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [sessionId, setSessionId] = useState('')
  const {siteConfig} = useDocusaurusContext()

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K'
  const isSearchOpen = activeSurface === 'search'
  const isAskOpen = activeSurface === 'askdocs'

  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  const openSearch = useCallback(() => {
    setActiveSurface('search')
  }, [])

  const openAskDocs = useCallback(() => {
    setPageContext(getCurrentPageContext())
    setActiveSurface('askdocs')
  }, [])

  const openSurface = useCallback((tab?: TabType) => {
    if (tab === 'askdocs') {
      openAskDocs()
      return
    }

    openSearch()
  }, [openAskDocs, openSearch])

  const closeSurface = useCallback(() => {
    setActiveSurface(null)
    setIsAskExpanded(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isSearchOpen) {
          closeSurface()
        } else {
          openSearch()
        }
      }
      if (e.key === 'Escape' && activeSurface) {
        const target = e.target as HTMLElement | null
        if (target?.tagName === 'TEXTAREA') return
        closeSurface()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeSurface, isSearchOpen, openSearch, closeSurface])

  // Expose search/Ask Docs globally for other components to trigger.
  useEffect(() => {
    ;(window as any).__openUnifiedSearch = openSurface
    return () => {
      delete (window as any).__openUnifiedSearch
    }
  }, [openSurface])

  // Intercept navbar search input clicks to open unified modal
  useEffect(() => {
    const handleSearchClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') {
        (target as HTMLInputElement).blur()
      }
      openSearch()
    }

    const attachListeners = () => {
      const searchInputs = document.querySelectorAll('.navbar__search-input')
      searchInputs.forEach((input) => {
        input.addEventListener('click', handleSearchClick, true)
        input.addEventListener('focus', handleSearchClick, true)
      })
      return searchInputs.length > 0
    }

    // Try immediately, then retry after DOM settles
    if (!attachListeners()) {
      const timer = setTimeout(attachListeners, 1000)
      return () => clearTimeout(timer)
    }

    return () => {
      const searchInputs = document.querySelectorAll('.navbar__search-input')
      searchInputs.forEach((input) => {
        input.removeEventListener('click', handleSearchClick, true)
        input.removeEventListener('focus', handleSearchClick, true)
      })
    }
  }, [openSearch])

  return (
    <>
      {!activeSurface && (
        <button
          className={styles.floatingButton}
          onClick={openAskDocs}
          aria-label="Ask Docs"
          title="Ask Docs"
        >
          <svg
            className={styles.buttonIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className={styles.buttonText}>Ask Docs</span>
        </button>
      )}

      {/* Search Modal */}
      {isSearchOpen && (
        <div className={styles.overlay} onClick={closeSurface}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
          >
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <svg
                  className={styles.headerIcon}
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
              </div>
              <div className={styles.tabGroup}>
                <button
                  className={`${styles.tab} ${styles.tabActive}`}
                  onClick={openSearch}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search
                </button>
                <button
                  className={styles.tab}
                  onClick={openAskDocs}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Ask Docs
                </button>
              </div>
            </div>

            <div className={styles.content}>
              <SearchTab onClose={closeSurface} />
            </div>
          </div>
        </div>
      )}

      {/* Ask Docs Panel */}
      {isAskOpen && sessionId && (
        <>
          <div
            className={styles.askPanelBackdrop}
            onClick={closeSurface}
            aria-hidden="true"
          />
          <aside
            className={`${styles.askPanel} ${isAskExpanded ? styles.askPanelExpanded : ''}`}
            role="dialog"
            aria-label="Ask Docs"
            aria-modal="false"
          >
            <div className={styles.askPanelHeader}>
              <div className={styles.askPanelIdentity}>
                <img src="/img/logo.svg" alt="" className={styles.askPanelLogo} />
                <div>
                  <div className={styles.askPanelTitle}>Ask Docs</div>
                  <div className={styles.askPanelSubtitle}>
                    {pageContext ? pageContext.title : siteConfig.title}
                  </div>
                </div>
              </div>
              <div className={styles.askPanelActions}>
                <button
                  type="button"
                  className={styles.panelIconButton}
                  aria-label="Conversation history is preserved for this session"
                  title="History preserved for this session"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 3v6h6" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.panelIconButton}
                  onClick={() => setIsAskExpanded((expanded) => !expanded)}
                  aria-label={isAskExpanded ? 'Collapse Ask Docs panel' : 'Expand Ask Docs panel'}
                  title={isAskExpanded ? 'Collapse panel' : 'Expand panel'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isAskExpanded ? (
                      <>
                        <path d="M8 3v5H3" />
                        <path d="M16 3v5h5" />
                        <path d="M8 21v-5H3" />
                        <path d="M16 21v-5h5" />
                      </>
                    ) : (
                      <>
                        <path d="M3 8V3h5" />
                        <path d="M21 8V3h-5" />
                        <path d="M3 16v5h5" />
                        <path d="M21 16v5h-5" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.panelIconButton}
                  onClick={closeSurface}
                  aria-label="Close Ask Docs"
                  title="Close"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <AskAITab
              sessionId={sessionId}
              shortcutLabel={shortcutLabel}
              pageContext={pageContext}
            />
          </aside>
        </>
      )}
    </>
  )
}
