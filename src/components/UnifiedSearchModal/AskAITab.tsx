import React, {useState, useRef, useEffect} from 'react'
import {Turnstile} from '@marsidev/react-turnstile'
import styles from './styles.module.css'
import MarkdownContent from '../AskAI/MarkdownContent'

const TURNSTILE_SITE_KEY = '0x4AAAAAACS2SzpYBFytHb_E'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessionId: string
  onClose: () => void
  shortcutLabel: string
}

export default function AskAITab({sessionId, onClose, shortcutLabel}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWaitingFirstToken, setIsWaitingFirstToken] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const turnstileRef = useRef<{reset: () => void} | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'})
  }, [messages])

  const handleClearChat = () => {
    if (messages.length === 0) return
    setMessages([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !turnstileToken) return

    const question = input.trim()
    const token = turnstileToken
    setInput('')
    setTurnstileToken(null)
    setMessages(prev => [...prev, {role: 'user', content: question}])
    setIsLoading(true)
    setIsWaitingFirstToken(true)
    setMessages(prev => [...prev, {role: 'assistant', content: ''}])

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question, sessionId, turnstileToken: token}),
      })

      if (res.status === 429) {
        setMessages(prev => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: 'You have reached the query limit. Please refresh to continue.',
          }
          return msgs
        })
        setIsLoading(false)
        setIsWaitingFirstToken(false)
        return
      }

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let buffer = ''

      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                if (isWaitingFirstToken) setIsWaitingFirstToken(false)
                assistantMessage += parsed.content
                setMessages(prev => {
                  const msgs = [...prev]
                  msgs[msgs.length - 1] = {role: 'assistant', content: assistantMessage}
                  return msgs
                })
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = {
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
        }
        return msgs
      })
    } finally {
      setIsLoading(false)
      setIsWaitingFirstToken(false)
      turnstileRef.current?.reset()
    }
  }

  const handleSuggestion = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  const isLastLoading = (index: number) => isWaitingFirstToken && index === messages.length - 1

  return (
    <div className={styles.askTab}>
      <div className={styles.askMessages}>
        {messages.length === 0 && (
          <div className={styles.askWelcome}>
            <img
              src="https://apertis.ai/logo.png"
              alt=""
              className={styles.askWelcomeLogo}
            />
            <p className={styles.askWelcomeText}>
              Hi! I&apos;m an AI assistant trained on Apertis documentation.
            </p>
            <p className={styles.askWelcomeSub}>
              Ask me anything about <strong>Apertis API Platform</strong>.
            </p>
            <div className={styles.askSuggestions}>
              <button onClick={() => handleSuggestion('How do I get started with Apertis?')}>
                How do I get started with Apertis?
              </button>
              <button onClick={() => handleSuggestion('What models are available?')}>
                What models are available?
              </button>
              <button onClick={() => handleSuggestion('How do I use streaming with the API?')}>
                How do I use streaming with the API?
              </button>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.askMessage} ${styles[`ask_${msg.role}`]} ${isLastLoading(i) ? styles.askLoading : ''}`}
          >
            <div className={styles.askBubble}>
              {msg.role === 'assistant' ? (
                isLastLoading(i) ? (
                  <div className={styles.askSkeleton}>
                    <div className={styles.askSkeletonLine} style={{width: '80%'}} />
                    <div className={styles.askSkeletonLine} style={{width: '60%'}} />
                    <div className={styles.askSkeletonLine} style={{width: '70%'}} />
                  </div>
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

      <form className={styles.askInputForm} onSubmit={handleSubmit}>
        <div className={styles.askInputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="How do I get started?"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim() || !turnstileToken}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className={styles.askClearBtn}
            onClick={handleClearChat}
          >
            Clear chat
          </button>
        )}
      </form>
      <footer className={styles.askFooter}>
        <span>Powered by </span>
        <a href="https://apertis.ai" target="_blank" rel="noopener noreferrer">
          Apertis
        </a>
      </footer>
      <Turnstile
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={setTurnstileToken}
        onExpire={() => setTurnstileToken(null)}
        options={{size: 'invisible'}}
      />
    </div>
  )
}
