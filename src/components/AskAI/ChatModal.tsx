import React, { useState, useRef, useEffect } from 'react'
import styles from './styles.module.css'
import LoadingSkeleton from './LoadingSkeleton'
import MarkdownContent from './MarkdownContent'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessionId: string
  onClose: () => void
  shortcutLabel: string
}

export default function ChatModal({ sessionId, onClose, shortcutLabel }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWaitingFirstToken, setIsWaitingFirstToken] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setIsLoading(true)
    setIsWaitingFirstToken(true)
    // Add empty assistant message immediately to show LoadingSkeleton
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sessionId }),
      })

      if (res.status === 429) {
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: 'You have reached the query limit for this session. Please refresh the page to continue.',
          }
          return newMessages
        })
        setIsLoading(false)
        setIsWaitingFirstToken(false)
        return
      }

      if (!res.ok) {
        throw new Error('Request failed')
      }

      if (!res.body) {
        throw new Error('Response body is null')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                if (isWaitingFirstToken) {
                  setIsWaitingFirstToken(false)
                }
                assistantMessage += parsed.content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  }
                  return newMessages
                })
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
      setIsWaitingFirstToken(false)
    }
  }

  const handleSuggestion = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  const isLastMessageLoading = (index: number) => {
    return isWaitingFirstToken && index === messages.length - 1
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="askai-modal-title"
      >
        <div className={styles.header}>
          <h3 id="askai-modal-title" className={styles.title}>Ask AI Assistant</h3>
          <span className={styles.shortcut}>{shortcutLabel}</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.messagesContainer}>
          {messages.length === 0 && (
            <div className={styles.welcomeMessage}>
              <p>Hi! Ask me anything about Apertis API.</p>
              <div className={styles.suggestions}>
                <button onClick={() => handleSuggestion('How do I get started with Apertis?')}>
                  How do I get started?
                </button>
                <button onClick={() => handleSuggestion('What models are available?')}>
                  What models are available?
                </button>
                <button onClick={() => handleSuggestion('How do I use streaming?')}>
                  How do I use streaming?
                </button>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${styles[msg.role]} ${isLastMessageLoading(i) ? styles.loadingMessage : ''}`}
            >
              <div className={styles.messageContent}>
                {msg.role === 'assistant' ? (
                  isLastMessageLoading(i) ? (
                    <LoadingSkeleton />
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.inputForm} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
