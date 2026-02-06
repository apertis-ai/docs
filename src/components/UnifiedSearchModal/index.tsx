import React, {useState, useEffect, useCallback} from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import SearchTab from './SearchTab'
import AskAITab from './AskAITab'
import styles from './styles.module.css'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'askai_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

type TabType = 'search' | 'askdocs'

export default function UnifiedSearchModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('search')
  const [sessionId, setSessionId] = useState('')
  const {siteConfig} = useDocusaurusContext()

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K'

  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  const openModal = useCallback((tab?: TabType) => {
    setIsOpen(true)
    if (tab) setActiveTab(tab)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          closeModal()
        } else {
          openModal('search')
        }
      }
      if (e.key === 'Escape' && isOpen) {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, openModal, closeModal])

  // Expose openModal globally for other components to trigger
  useEffect(() => {
    ;(window as any).__openUnifiedSearch = openModal
    return () => {
      delete (window as any).__openUnifiedSearch
    }
  }, [openModal])

  // Intercept navbar search input clicks to open unified modal
  useEffect(() => {
    const handleSearchClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') {
        (target as HTMLInputElement).blur()
      }
      openModal('search')
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
  }, [openModal])

  return (
    <>
      {/* Floating "Ask Docs" button */}
      <button
        className={styles.floatingButton}
        onClick={() => openModal('askdocs')}
        aria-label="Ask Docs"
        title={`Ask Docs (${shortcutLabel})`}
      >
        <span className={styles.glassOverlay} />
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

      {/* Modal */}
      {isOpen && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header with tabs */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                {activeTab === 'search' && (
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
                )}
                {activeTab === 'askdocs' && (
                  <span className={styles.headerTitle}>Ask AI</span>
                )}
              </div>
              <div className={styles.tabGroup}>
                <button
                  className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('search')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'askdocs' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('askdocs')}
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

            {/* Tab content */}
            <div className={styles.content}>
              {activeTab === 'search' && (
                <SearchTab onClose={closeModal} />
              )}
              {activeTab === 'askdocs' && sessionId && (
                <AskAITab
                  sessionId={sessionId}
                  onClose={closeModal}
                  shortcutLabel={shortcutLabel}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
