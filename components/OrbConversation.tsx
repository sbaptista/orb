'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrbResponse } from '@/app/actions/orb-converse'

export type ConversationMessage = {
    id: string
    type: 'user' | 'orb'
    text: string
    results?: OrbResponse['results']
    queryLabel?: string
    isStreaming?: boolean
    thoughts?: string[]
}

type Props = {
    messages: ConversationMessage[]
    input: string
    submitting: boolean
    productCode: string
    products: { id: string; code: string | null; name: string }[]
    scopeToProduct: boolean
    onInputChange: (v: string) => void
    onSubmit: (value: string) => void
    onShowResults: (results: NonNullable<OrbResponse['results']>, label: string) => void
    onScopeChange: (v: boolean) => void
    onFocusChange: (v: boolean) => void
    onSelectProject: (id: string) => void
    selectedProjectId?: string | null
    onShowEditProject: () => void
    onShowAddProject: () => void
    priorityColors?: Map<number, string>
    conversationActive?: boolean
    onRestoreConversation?: () => void
    onClearTranscript?: () => void
    onStop?: () => void
    projectStrip?: React.ReactNode
    orbElement?: React.ReactNode
}

function OrbCard({ msg, onShowResults, priorityColors }: { msg: ConversationMessage; onShowResults: Props['onShowResults']; priorityColors?: Map<number, string> }) {
    const [copied, setCopied] = useState(false)

    function copy() {
        navigator.clipboard.writeText(msg.text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <div className="oc-orb-card">
            {msg.thoughts && msg.thoughts.length > 0 && (
                <div className="flex-col" style={{ gap: '1px', marginBottom: '4px' }}>
                    {msg.thoughts.map((t, i) => (
                        <span key={i} className="text-xs text-muted" style={{ display: 'block', padding: '1px 0' }}>
                            {'\u2022'} {t}
                        </span>
                    ))}
                </div>
            )}
            <div className="flex-row" style={{ gap: '6px', alignItems: 'flex-start' }}>
                <span style={{
                    flex: 1,
                    whiteSpace: 'pre-wrap',
                    opacity: msg.isStreaming ? 0.8 : 1,
                    transition: 'opacity 0.2s',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text)',
                }}>
                    {msg.text}
                    {msg.isStreaming && (
                        <span style={{
                            display: 'inline-block',
                            width: '4px',
                            height: '14px',
                            background: 'var(--pill-active-bg)',
                            marginLeft: '4px',
                            verticalAlign: 'middle',
                            animation: 'todos-cursor-blink 0.8s infinite',
                        }} />
                    )}
                </span>
                <button
                    type="button"
                    className="oc-copy-btn"
                    onClick={copy}
                    title="Copy response"
                    aria-label="Copy response"
                    style={{ color: copied ? 'var(--pill-active-color)' : 'var(--muted)' }}
                >
                    {copied ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    )}
                </button>
            </div>
            {msg.results && msg.results.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div className="oc-results-card">
                        {msg.results.slice(0, 5).map(r => (
                            <div key={r.id} className="oc-result-row"
                                onClick={() => onShowResults(msg.results!, msg.queryLabel ?? '')}
                            >
                                <span className="tv-priority-dot" style={{
                                    background: r.status === 'closed' ? 'var(--muted)' : (r.priority_value ? priorityColors?.get(r.priority_value) ?? 'var(--muted)' : 'var(--border)'),
                                }} />
                                <span style={{
                                    fontFamily: 'monospace',
                                    fontSize: 'var(--fs-xs)',
                                    color: 'var(--muted)',
                                    minWidth: '56px',
                                    flexShrink: 0,
                                }}>
                                    {r.code || r.id.slice(0, 6)}
                                </span>
                                <span className="truncate text-xs" style={{ flex: 1 }}>
                                    {r.title}
                                </span>
                                <span className="shrink-0" style={{
                                    fontSize: '11px',
                                    textTransform: 'capitalize',
                                    color: r.status === 'closed' ? '#6a8a6a' : '#4a7a4a',
                                }}>
                                    {r.status}
                                </span>
                            </div>
                        ))}
                        {msg.results.length > 5 && (
                            <div className="text-xs text-muted" style={{
                                padding: '6px 12px',
                                textAlign: 'center',
                                borderTop: '1px solid var(--border)',
                            }}>
                                +{msg.results.length - 5} more &rarr;
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="oc-show-list-btn"
                        onClick={() => onShowResults(msg.results!, msg.queryLabel ?? '')}
                    >
                        Show list &middot; {msg.results.length}
                    </button>
                </div>
            )}
        </div>
    )
}

export default function OrbConversation({
    messages,
    input,
    submitting,
    productCode,
    products,
    scopeToProduct,
    onInputChange,
    onSubmit,
    onShowResults,
    onScopeChange,
    onFocusChange,
    onSelectProject,
    selectedProjectId,
    onShowEditProject,
    onShowAddProject,
    priorityColors,
    conversationActive = true,
    onRestoreConversation,
    onClearTranscript,
    onStop,
    projectStrip,
    orbElement,
}: Props) {
    const threadRef             = useRef<HTMLDivElement>(null)
    const textareaRef           = useRef<HTMLTextAreaElement>(null)
    const slashMenuDismissed    = useRef(false)
    const [inputFocused, setInputFocused] = useState(false)
    const [copiedInput, setCopiedInput] = useState(false)
    const [copiedTranscript, setCopiedTranscript] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [supportsVoice, setSupportsVoice] = useState(false)
    const recognitionRef = useRef<any>(null)

    useEffect(() => {
        const api = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        setSupportsVoice(!!api)
    }, [])

    function startListening() {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognitionAPI || submitting) return
        try {
            const recognition = new SpeechRecognitionAPI()
            recognition.continuous = true
            recognition.interimResults = false
            recognition.lang = 'en-US'

            recognition.onresult = (event: any) => {
                let finalTranscript = ''
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript
                    }
                }
                if (finalTranscript && textareaRef.current) {
                    const currentVal = textareaRef.current.value
                    onInputChange(currentVal + finalTranscript)
                }
            }

            recognition.onerror = () => setIsListening(false)
            recognition.onend = () => setIsListening(false)

            recognitionRef.current = recognition
            recognition.start()
            setIsListening(true)
        } catch (err) {
            console.error('[voice]', err)
            setIsListening(false)
        }
    }

    function stopListening() {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
        }
        setIsListening(false)
    }

    useEffect(() => {
        onFocusChange(inputFocused)
    }, [inputFocused, onFocusChange])

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        const el = threadRef.current
        if (el) {
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300
            const lastMsg = messages[messages.length - 1]
            const forceScroll = lastMsg && (lastMsg.type === 'user' || lastMsg.isStreaming)
            if (isNearBottom || forceScroll) {
                setTimeout(() => { el.scrollTop = el.scrollHeight }, 10)
            }
        }
    }, [messages])

    // Command History
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState<number>(-1)

    const [slashIndex, setSlashIndex] = useState(0)

    const SLASH_COMMANDS = [
        { cmd: '/?', desc: 'Show help overlay' },
        { cmd: '/help', desc: 'Show help overlay' },
        { cmd: '/tasks', desc: 'Show open tasks in current project' },
        { cmd: '/projects', desc: 'List all your projects' },
        { cmd: '/clear', desc: 'Clear the conversation' },
        { cmd: '/switch [project]', desc: 'Switch to a project' },
        { cmd: '/edit', desc: 'Edit current project' },
        { cmd: '/edit [project]', desc: 'Switch and edit a project' },
        { cmd: '/settings', desc: 'Open settings panel' },
        { cmd: '/orb', desc: 'What can the orb do?' },
    ]

    const activeSlashCommands = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(input.toLowerCase()))
    const showSlashMenu = inputFocused && input.startsWith('/') && activeSlashCommands.length > 0 && historyIndex === -1 && !slashMenuDismissed.current

    function fillCommand(cmd: string) {
        slashMenuDismissed.current = true
        onInputChange(cmd)
        setSlashIndex(0)
        const idx = cmd.indexOf('[project]')
        if (idx !== -1) {
            setTimeout(() => {
                const el = textareaRef.current
                if (!el) return
                el.focus()
                el.setSelectionRange(idx, idx + '[project]'.length)
            }, 0)
        }
    }

    useEffect(() => {
        const saved = sessionStorage.getItem('todos_orb_cmd_hist')
        if (saved) {
            try { setHistory(JSON.parse(saved)) } catch {}
        }
    }, [])

    function handleHistoryUp() {
        if (history.length === 0) return
        const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIdx)
        onInputChange(history[newIdx])
    }

    function handleHistoryDown() {
        if (historyIndex === -1) return
        const newIdx = historyIndex + 1
        if (newIdx >= history.length) {
            setHistoryIndex(-1)
            onInputChange('')
        } else {
            setHistoryIndex(newIdx)
            onInputChange(history[newIdx])
        }
    }

    const autoResize = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const h = Math.min(el.scrollHeight, 120)
        el.style.height = `${h}px`
        el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'
    }, [])

    useEffect(() => { autoResize() }, [input, autoResize])

    const handleFormSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        const value = (textareaRef.current?.value ?? input).trim()
        if (!value || submitting) return

        const newHist = [...history]
        if (newHist[newHist.length - 1] !== value) {
            newHist.push(value)
            setHistory(newHist)
            sessionStorage.setItem('todos_orb_cmd_hist', JSON.stringify(newHist))
        }
        setHistoryIndex(-1)

        onSubmit(value)
    }

    function copyTranscript() {
        const transcript = messages.map(m => {
            const prefix = m.type === 'user' ? 'User' : 'Orb'
            const thoughts = m.thoughts?.length ? ` [${m.thoughts.join('; ')}]` : ''
            return `${prefix}:${thoughts} ${m.text}`
        }).join('\n\n')
        navigator.clipboard.writeText(transcript).then(() => {
            setCopiedTranscript(true)
            setTimeout(() => setCopiedTranscript(false), 1500)
        })
    }

    return (
        <div className="oc-wrap" data-mode={conversationActive ? 'dialogue' : 'ambient'} style={{
            borderColor: (inputFocused && conversationActive) ? 'var(--border-focus)' : undefined,
        }}>
            {orbElement}
            {conversationActive ? (
                <div ref={threadRef} className="oc-thread">
                    <div className="shrink-0" style={{ height: 'clamp(200px, 34vh, 280px)' }} />
                    {messages.map(msg => (
                            msg.type === 'user' ? (
                                <div
                                    key={msg.id}
                                    style={{ display: 'flex', justifyContent: 'flex-end', margin: '5px 2px' }}
                                >
                                    <div className="oc-user-bubble">
                                        {msg.text}
                                    </div>
                                </div>
                            ) : (
                                <OrbCard key={msg.id} msg={msg} onShowResults={onShowResults} priorityColors={priorityColors} />
                            )
                    ))}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '10px' }}>
                    {messages.length > 0 && onRestoreConversation && (
                        <button
                            type="button"
                            onClick={onRestoreConversation}
                            className="btn-outline"
                            style={{ background: 'var(--bg2)', padding: '8px 16px', borderRadius: 'var(--r-xl)' }}
                        >
                            Show Conversation
                        </button>
                    )}
                </div>
            )}

            <div className="oc-input-wrap">
                <div className="oc-input-border" style={{
                    borderColor: inputFocused ? 'var(--border-focus)' : undefined,
                }}>
                    <form onSubmit={handleFormSubmit} style={{ position: 'relative' }}>
                        {showSlashMenu && (
                            <div className="oc-slash-menu">
                                {activeSlashCommands.map((c, i) => (
                                    <div
                                        key={c.cmd}
                                        className="oc-slash-item"
                                        style={{ background: slashIndex === i ? 'var(--bg2)' : 'transparent' }}
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            fillCommand(c.cmd)
                                        }}
                                    >
                                        <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xs)', color: 'var(--text)', fontWeight: slashIndex === i ? 600 : 400 }}>{c.cmd}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{c.desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!input && !submitting && (
                            <div className="oc-placeholder">
                                Ask the Orb...
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            className="oc-textarea"
                            rows={1}
                            value={input}
                            onChange={e => { slashMenuDismissed.current = false; onInputChange(e.target.value); autoResize() }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (showSlashMenu && activeSlashCommands[slashIndex]) {
                                        fillCommand(activeSlashCommands[slashIndex].cmd)
                                    } else {
                                        handleFormSubmit()
                                    }
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault()
                                    if (showSlashMenu) {
                                        setSlashIndex(prev => Math.max(0, prev - 1))
                                    } else {
                                        handleHistoryUp()
                                    }
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault()
                                    if (showSlashMenu) {
                                        setSlashIndex(prev => Math.min(activeSlashCommands.length - 1, prev + 1))
                                    } else {
                                        handleHistoryDown()
                                    }
                                } else if (e.key === 'Escape') {
                                    if (showSlashMenu) {
                                        onInputChange('')
                                    }
                                }
                            }}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            disabled={submitting}
                            placeholder=""
                        />

                        <div className="oc-toolbar">
                            <button
                                type="button"
                                className="oc-tool-btn"
                                aria-pressed={!scopeToProduct}
                                onClick={() => onScopeChange(!scopeToProduct)}
                                onMouseDown={(e) => e.preventDefault()}
                                title={scopeToProduct ? 'Search all projects' : 'Search current project only'}
                                style={{ letterSpacing: '0.06em' }}
                            >
                                All
                            </button>

                            <button
                                type="button"
                                className="oc-tool-btn"
                                onClick={handleHistoryUp}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={history.length === 0}
                                title="Previous command"
                                aria-label="Previous command"
                            >
                                &uarr;
                            </button>
                            <button
                                type="button"
                                className="oc-tool-btn"
                                onClick={handleHistoryDown}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={historyIndex === -1}
                                title="Next command"
                                aria-label="Next command"
                            >
                                &darr;
                            </button>

                            <button
                                type="button"
                                className="oc-tool-btn"
                                aria-pressed={copiedInput}
                                onClick={() => input.trim() && navigator.clipboard.writeText(input).then(() => {
                                    setCopiedInput(true)
                                    setTimeout(() => setCopiedInput(false), 1500)
                                })}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={!input.trim()}
                                title="Copy input"
                                aria-label="Copy input"
                            >
                                {copiedInput ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                )}
                            </button>

                            <button
                                type="button"
                                className="oc-tool-btn"
                                aria-pressed={copiedTranscript}
                                onClick={copyTranscript}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={messages.length === 0}
                                title="Copy transcript"
                                aria-label="Copy transcript"
                            >
                                {copiedTranscript ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="8" y1="13" x2="16" y2="13"/>
                                        <line x1="8" y1="17" x2="16" y2="17"/>
                                    </svg>
                                )}
                            </button>

                            {onClearTranscript && (
                                <button
                                    type="button"
                                    className="oc-tool-btn"
                                    onClick={onClearTranscript}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={messages.length === 0 || submitting}
                                    title="Clear transcript"
                                    aria-label="Clear transcript"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"/>
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                    </svg>
                                </button>
                            )}

                            <button
                                type="button"
                                className="oc-tool-btn"
                                onClick={() => isListening ? stopListening() : startListening()}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={!supportsVoice || submitting}
                                title={isListening ? 'Stop recording' : 'Voice input'}
                                aria-label={isListening ? 'Stop recording' : 'Voice input'}
                                style={{
                                    color: isListening ? '#c00' : undefined,
                                    background: isListening ? 'rgba(200,0,0,0.06)' : undefined,
                                    opacity: !supportsVoice || submitting ? 0.35 : 1,
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={isListening ? { animation: 'voice-pulse 1s ease-in-out infinite' } : undefined}>
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </button>

                            <div className="flex-1" />

                            {submitting ? (
                                <button
                                    type="button"
                                    className="oc-stop-btn"
                                    onClick={onStop}
                                    title="Stop processing"
                                    aria-label="Stop processing"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        background: 'rgba(200, 0, 0, 0.08)',
                                        color: '#c00',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        animation: 'voice-pulse 1.2s ease-in-out infinite',
                                    }}
                                >
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        background: '#c00',
                                        borderRadius: '1px',
                                    }} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="oc-send-btn"
                                    disabled={!input.trim()}
                                    title="Send (Shift+Enter)"
                                    aria-label="Send"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"/>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </form>
                </div>
                {projectStrip}
            </div>

            <style>{`
                @keyframes todos-cursor-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes voice-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.15); }
                }
            `}</style>
        </div>
    )
}
