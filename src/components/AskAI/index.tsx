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
        title="Ask AI (⌘K)"
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
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className={styles.buttonText}>Ask AI</span>
      </button>

      {isOpen && sessionId && (
        <ChatModal sessionId={sessionId} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
