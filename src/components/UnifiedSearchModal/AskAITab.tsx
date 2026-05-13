import React, { useState, useRef, useEffect } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import styles from "./styles.module.css";
import MarkdownContent from "../AskAI/MarkdownContent";
import {
  DocumentationSource,
  PageContext,
  extractDocumentationSources,
} from "./assistantUtils";

const TURNSTILE_SITE_KEY = "0x4AAAAAACS2SzpYBFytHb_E";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: DocumentationSource[];
  feedback?: "helpful" | "not-helpful";
}

interface Props {
  sessionId: string;
  shortcutLabel: string;
  pageContext: PageContext | null;
}

function getMessagesStorageKey(sessionId: string) {
  return `askdocs_messages_${sessionId}`;
}

function loadStoredMessages(sessionId: string): Message[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = sessionStorage.getItem(getMessagesStorageKey(sessionId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function isLocalPreviewHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function getLocalPreviewAnswer(question: string, pageContext: PageContext | null) {
  const pageTitle = pageContext?.title || "the docs";
  const pageHref = pageContext?.href || "/";

  return `Local preview response for: "${question}"

Use this panel to ask page-aware questions while developing the docs UI. On production, this request streams from the Apertis documentation assistant and cites matching documentation sources.

For this page, start from [${pageTitle}](${pageHref}) and the [Quick Start](/docs/getting-started/quick-start) guide.`;
}

async function copyTextToClipboard(content: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      // Fall back for browsers or automation contexts that deny clipboard writes.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  document.body.removeChild(textarea);
  return didCopy;
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function AskAITab({ sessionId, shortcutLabel, pageContext }: Props) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadStoredMessages(sessionId)
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingFirstToken, setIsWaitingFirstToken] = useState(false);
  const [isLocalPreview, setIsLocalPreview] = useState(false);
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setIsLocalPreview(isLocalPreviewHost());
    setIsRuntimeReady(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(getMessagesStorageKey(sessionId), JSON.stringify(messages));
  }, [messages, sessionId]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const canSendQuestion =
    isRuntimeReady && (isLocalPreview || Boolean(turnstileToken));

  const handleClearChat = () => {
    if (messages.length === 0) return;
    setMessages([]);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(getMessagesStorageKey(sessionId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !canSendQuestion) return;

    const question = input.trim();
    const token = turnstileToken;
    setInput("");
    setTurnstileToken(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);
    setIsWaitingFirstToken(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      if (isLocalPreview) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const assistantMessage = getLocalPreviewAnswer(question, pageContext);
        setMessages((prev) => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = {
            role: "assistant",
            content: assistantMessage,
            sources: extractDocumentationSources(assistantMessage),
          };
          return msgs;
        });
        return;
      }

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId, turnstileToken: token, pageContext }),
      });

      if (res.status === 429) {
        setMessages((prev) => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = {
            role: "assistant",
            content:
              "You have reached the query limit. Please refresh to continue.",
          };
          return msgs;
        });
        setIsLoading(false);
        setIsWaitingFirstToken(false);
        return;
      }

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                if (isWaitingFirstToken) setIsWaitingFirstToken(false);
                assistantMessage += parsed.content;
                setMessages((prev) => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                    sources: extractDocumentationSources(assistantMessage),
                  };
                  return msgs;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          role: "assistant",
          content: "Sorry, an error occurred. Please try again.",
        };
        return msgs;
      });
    } finally {
      setIsLoading(false);
      setIsWaitingFirstToken(false);
      if (!isLocalPreview) {
        turnstileRef.current?.reset();
      }
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleCopy = (content: string, index: number) => {
    setCopiedMessageIndex(index);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedMessageIndex(null);
    }, 1600);

    void copyTextToClipboard(content);
  };

  const handleFeedback = (index: number, feedback: Message["feedback"]) => {
    setMessages((prev) =>
      prev.map((message, messageIndex) =>
        messageIndex === index ? { ...message, feedback } : message
      )
    );
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const isLastLoading = (index: number) =>
    isWaitingFirstToken && index === messages.length - 1;

  const suggestions = pageContext
    ? [
        `Summarize ${pageContext.title}`,
        "What should I do next from this page?",
        "Show me the most relevant example here",
      ]
    : [
        "How do I get started with Apertis?",
        "What models are available?",
        "How do I use streaming with the API?",
      ];

  return (
    <div className={styles.askTab}>
      <div className={styles.askMessages}>
        {messages.length === 0 && (
          <div className={styles.askWelcome}>
            <div className={styles.askWelcomeKicker}>Apertis documentation</div>
            <h2 className={styles.askWelcomeTitle}>Ask about this page or the API.</h2>
            <p className={styles.askWelcomeText}>
              Answers use Apertis docs and show sources when the documentation supports them.
            </p>
            {pageContext && (
              <a className={styles.contextChip} href={pageContext.href}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                {pageContext.title}
              </a>
            )}
            <div className={styles.askSuggestions}>
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => handleSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isAssistantAnswer =
            msg.role === "assistant" && msg.content && !isLastLoading(i);
          const isCopied = copiedMessageIndex === i;

          return (
            <div
              key={i}
              className={`${styles.askMessage} ${styles[`ask_${msg.role}`]} ${isLastLoading(i) ? styles.askLoading : ""}`}
            >
              <div className={styles.askBubble}>
                {msg.role === "assistant" ? (
                  isLastLoading(i) ? (
                    <div className={styles.askSkeleton}>
                      <div
                        className={styles.askSkeletonLine}
                        style={{ width: "80%" }}
                      />
                      <div
                        className={styles.askSkeletonLine}
                        style={{ width: "60%" }}
                      />
                      <div
                        className={styles.askSkeletonLine}
                        style={{ width: "70%" }}
                      />
                    </div>
                  ) : (
                    <>
                      <MarkdownContent content={msg.content} />
                      {msg.sources && msg.sources.length > 0 && (
                        <div className={styles.sourceList} aria-label="Sources">
                          <span className={styles.sourceListLabel}>Sources</span>
                          {msg.sources.map((source) => (
                            <a key={source.href} href={source.href} className={styles.sourcePill}>
                              {source.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  msg.content
                )}
              </div>
              {isAssistantAnswer && (
                <div className={styles.answerActions}>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content, i)}
                    className={`${styles.answerIconButton} ${isCopied ? styles.answerCopied : ""}`}
                    aria-label={isCopied ? "Answer copied" : "Copy answer"}
                    title={isCopied ? "Copied" : "Copy answer"}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(i, "helpful")}
                    className={`${styles.answerFeedbackButton} ${msg.feedback === "helpful" ? styles.answerActionActive : ""}`}
                    aria-label="Mark answer helpful"
                    title="Helpful"
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(i, "not-helpful")}
                    className={`${styles.answerFeedbackButton} ${msg.feedback === "not-helpful" ? styles.answerActionActive : ""}`}
                    aria-label="Mark answer not helpful"
                    title="Not helpful"
                  >
                    Needs work
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.askInputForm} onSubmit={handleSubmit}>
        {pageContext && (
          <div className={styles.composerContext}>
            <span>Using current page</span>
            <a href={pageContext.href}>{pageContext.title}</a>
          </div>
        )}
        <div className={styles.askInputWrapper}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask a question..."
            disabled={isLoading}
            rows={2}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !canSendQuestion}
            aria-label="Send question"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className={styles.composerMeta}>
          <span>
            {isLocalPreview
              ? "Local preview uses mock answers. Production uses verified Ask Docs."
              : "Enter to send. Shift+Enter for a new line."}
          </span>
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
        <span>Search opens with {shortcutLabel}. Powered by </span>
        <a href="https://apertis.ai" target="_blank" rel="noopener noreferrer">
          Apertis
        </a>
      </footer>
      {isRuntimeReady && !isLocalPreview && (
        <div className={styles.turnstileContainer} aria-hidden="true">
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            options={{ size: "invisible" }}
          />
        </div>
      )}
    </div>
  );
}
