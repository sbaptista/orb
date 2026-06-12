'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { orbConverse, type OrbResponse } from '@/app/actions/orb-converse'

export type PanelMessage = {
  id: string
  role: 'user' | 'orb'
  text: string
  thoughts?: string[]
  isStreaming?: boolean
}

type Props = {
  productId: string | null
  productCode: string | null
  todoCount: number
  onMutation: () => void
}

let _msgCounter = 0
function genId() { return `op-${Date.now()}-${++_msgCounter}` }

export default function OrbPanel({ productId, productCode, todoCount, onMutation }: Props) {
  const [messages, setMessages] = useState<PanelMessage[]>([])
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function handleSubmit() {
    const text = input.trim()
    if (!text || submitting) return

    const processingId = genId()
    setMessages(prev => [
      ...prev,
      { id: genId(), role: 'user', text },
      { id: processingId, role: 'orb', text: 'Processing…', isStreaming: true },
    ])
    setInput('')
    setSubmitting(true)
    abortRef.current = false

    const history = messages
      .filter(m => m.text !== 'Processing…')
      .map(m => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', text: m.text }))

    try {
      const stream = await orbConverse({
        input: text,
        productId,
        history,
        dryRun: false,
      })

      let didMutate = false

      for await (const chunk of readStreamableValue(stream)) {
        if (abortRef.current) break
        if (!chunk) continue

        setMessages(prev => prev.map(m => {
          if (m.id !== processingId) return m

          const newThoughts = m.thoughts ? [...m.thoughts] : []
          if (chunk.thought && !newThoughts.includes(chunk.thought)) {
            newThoughts.push(chunk.thought)
          }

          return {
            ...m,
            text: chunk.speech || m.text,
            thoughts: newThoughts,
            isStreaming: chunk.isStreaming,
          }
        }))

        if (chunk.refresh) didMutate = true
      }

      if (didMutate) onMutation()
    } catch (err) {
      console.error('[OrbPanel] converse error:', err)
      setMessages(prev => prev.map(m =>
        m.id === processingId
          ? { ...m, text: 'Something went wrong. Please try again.', isStreaming: false }
          : m
      ))
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="up-panel">
      {/* Mini Orb */}
      <div className="up-orb-header">
        <div className="up-mini-orb">
          <div className="up-mini-orb-glow" />
          <div className="up-mini-orb-sphere">
            <svg width="100%" height="100%" viewBox="0 0 80 80" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              <defs>
                <path id="up-arc-top" d="M 12 40 A 28 28 0 0 1 68 40" fill="none" />
                <path id="up-arc-bot" d="M 12 40 A 28 28 0 0 0 68 40" fill="none" />
              </defs>
              <text fontFamily="var(--font-ui)" fontSize="6" fontWeight="600" letterSpacing="2" fill="rgba(255,255,255,0.7)" style={{ textTransform: 'uppercase' }}>
                <textPath href="#up-arc-top" startOffset="50%" textAnchor="middle">
                  {(productCode ?? 'ORB').toUpperCase()}
                </textPath>
              </text>
              <text fontFamily="var(--font-ui)" fontSize="6" fontWeight="600" letterSpacing="2" fill="rgba(255,255,255,0.7)" style={{ textTransform: 'uppercase' }}>
                <textPath href="#up-arc-bot" startOffset="50%" textAnchor="middle">
                  ACTIVE
                </textPath>
              </text>
            </svg>
            <span className="up-mini-orb-count">{todoCount}</span>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            className="up-clear-btn"
            onClick={() => { setMessages([]); abortRef.current = true }}
            title="Clear transcript"
          >
            Clear
          </button>
        )}
      </div>

      <div className="up-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="up-empty">
            <p>Ask Orb anything about your backlog.</p>
            <p className="text-xs text-muted">Summarize, query, create, update, or bulk edit tasks.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`up-msg up-msg--${msg.role}`}>
              {msg.role === 'orb' && msg.thoughts && msg.thoughts.length > 0 && (
                <div className="up-thoughts">
                  {msg.thoughts.map((t, i) => (
                    <span key={i} className="text-xs text-muted">{'•'} {t}</span>
                  ))}
                </div>
              )}
              <span className="up-msg-text">
                {msg.text}
                {msg.isStreaming && (
                  <span className="up-cursor" />
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="up-composer">
        <textarea
          ref={textareaRef}
          className="up-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Orb…"
          rows={1}
          disabled={submitting}
        />
        <button
          className="up-send"
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          title="Send"
        >
          {submitting ? (
            <span className="up-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
