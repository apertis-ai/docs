import React, { useState, useEffect } from 'react'
import ChatModal from './ChatModal'
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

export default function AskAI() {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState('')

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K'

  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <button
        className={styles.floatingButton}
        onClick={() => setIsOpen(true)}
        aria-label="Ask AI"
        title={`Ask AI (${shortcutLabel})`}
      >
        <span className={styles.glassOverlay} />
        <img
          src="https://apertis.ai/logo.png"
          alt=""
          className={styles.buttonIcon}
        />
        <span className={styles.buttonText}>Ask AI</span>
      </button>

      {isOpen && sessionId && (
        <ChatModal sessionId={sessionId} onClose={() => setIsOpen(false)} shortcutLabel={shortcutLabel} />
      )}
    </>
  )
}
