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
}

function OrbCard({ msg, onShowResults }: { msg: ConversationMessage; onShowResults: Props['onShowResults'] }) {
    const [copied, setCopied] = useState(false)

    function copy() {
        navigator.clipboard.writeText(msg.text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <div style={{
            margin: '0 2px',
            padding: '10px 14px',
            background: 'transparent',
            color: 'var(--text2)',
            fontSize: 'var(--fs-sm)',
            lineHeight: 1.5,
            textAlign: 'left',
            borderRadius: '4px',
        }}>
            {msg.thoughts && msg.thoughts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '4px' }}>
                    {msg.thoughts.map((t, i) => (
                        <span key={i} style={{
                            display: 'block',
                            fontSize: 'var(--fs-xs)',
                            color: 'var(--muted)',
                            padding: '1px 0',
                        }}>
                            {'\u2022'} {t}
                        </span>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
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
                    onClick={copy}
                    title="Copy response"
                    aria-label="Copy response"
                    style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copied ? 'var(--pill-active-color)' : 'var(--muted)',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s',
                        opacity: 0.5,
                    }}
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
                    <div style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r)',
                        background: 'var(--bg2)',
                        overflow: 'hidden',
                    }}>
                        {msg.results.slice(0, 5).map(r => (
                            <div key={r.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                                onClick={() => onShowResults(msg.results!, msg.queryLabel ?? '')}
                            >
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    background: r.status === 'done' ? 'var(--muted)' : r.priority_value === 1 ? '#a05010' : '#5a3090',
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
                                <span style={{
                                    flex: 1,
                                    fontSize: 'var(--fs-xs)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {r.title}
                                </span>
                                <span style={{
                                    fontSize: '11px',
                                    textTransform: 'capitalize',
                                    flexShrink: 0,
                                    color: r.status === 'done' ? '#6a8a6a' : '#4a7a4a',
                                }}>
                                    {r.status}
                                </span>
                            </div>
                        ))}
                        {msg.results.length > 5 && (
                            <div style={{
                                fontSize: 'var(--fs-xs)',
                                color: 'var(--muted)',
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
                        onClick={() => onShowResults(msg.results!, msg.queryLabel ?? '')}
                        style={{
                            marginTop: '6px',
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            padding: '5px 14px',
                            borderRadius: '16px',
                            border: '1px solid var(--pill-active-border)',
                            color: 'var(--pill-active-color)',
                            background: 'var(--pill-active-bg)',
                            cursor: 'pointer',
                        }}
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
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
            if (isNearBottom) {
                requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
            }
        }
    }, [messages])

    // Command History
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState<number>(-1)

    const [slashIndex, setSlashIndex] = useState(0)

    const SLASH_COMMANDS = [
        { cmd: '/switch [project]', desc: 'e.g. [project]' },
        { cmd: '/edit', desc: 'Edit current project' },
        { cmd: '/edit [project]', desc: 'Switch and edit' },
        { cmd: '/settings', desc: 'Open settings panel' },
        { cmd: '/help', desc: 'Show help overlay' },
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
        <div style={{
            width: '100%',
            maxWidth: '420px',
            height: '100%',
            border: `1px solid ${inputFocused ? 'var(--border-focus)' : 'var(--border)'}`,
            borderRadius: 'var(--r-xl)',
            background: 'rgba(255, 255, 255, 0.96)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'border-color 0.2s ease',
        }}>
            <div
                ref={threadRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: 'clamp(200px, 34vh, 280px) 0 8px 0',
                }}
            >
                {messages.map(msg => (
                        msg.type === 'user' ? (
                            <div
                                key={msg.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    margin: '0 2px',
                                }}
                            >
                                <div style={{
                                    maxWidth: '75%',
                                    padding: '10px 14px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--r-xl)',
                                    background: '#dae5da',
                                    color: 'var(--text)',
                                    fontSize: 'var(--fs-sm)',
                                    lineHeight: 1.5,
                                    textAlign: 'right',
                                    wordBreak: 'break-word',
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ) : (
                            <OrbCard key={msg.id} msg={msg} onShowResults={onShowResults} />
                        )
                ))}
            </div>

            <div style={{
                flexShrink: 0,
                margin: '0 2px 12px',
            }}>
                <div style={{
                    border: `1px solid ${inputFocused ? 'var(--border-focus)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-xl)',
                    background: '#fff',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease',
                }}>
                    <form onSubmit={handleFormSubmit} style={{ position: 'relative' }}>
                        {showSlashMenu && (
                            <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '8px',
                                marginBottom: '4px',
                                background: 'var(--bg)',
                                border: '1.5px solid rgba(60,110,60,0.35)',
                                borderRadius: '6px',
                                boxShadow: 'var(--shadow-md)',
                                padding: '4px',
                                zIndex: 50,
                                minWidth: '200px',
                            }}>
                                {activeSlashCommands.map((c, i) => (
                                    <div
                                        key={c.cmd}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '4px',
                                            background: slashIndex === i ? 'var(--bg2)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '12px',
                                        }}
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
                            <div style={{
                                position: 'absolute',
                                top: '13px',
                                left: '14px',
                                pointerEvents: 'none',
                                fontFamily: 'var(--font-ui)',
                                fontSize: 'var(--fs-sm)',
                                color: 'var(--muted)',
                                lineHeight: 1.5,
                                zIndex: 1,
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                            }}>
                                Ask the Orb...
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
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
                            style={{
                                width: '100%',
                                fontFamily: 'var(--font-ui)',
                                fontSize: 'var(--fs-sm)',
                                background: 'transparent',
                                border: 'none',
                                padding: '12px 14px',
                                color: 'var(--text)',
                                outline: 'none',
                                resize: 'none',
                                lineHeight: 1.5,
                                overflowY: 'hidden',
                                boxSizing: 'border-box',
                                minHeight: '44px',
                                maxHeight: '120px',
                            }}
                        />

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px 8px',
                            borderTop: '1px solid var(--border)',
                        }}>
                            <button
                                type="button"
                                onClick={() => onScopeChange(!scopeToProduct)}
                                onMouseDown={(e) => e.preventDefault()}
                                title={scopeToProduct ? 'Search all projects' : 'Search current project only'}
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    letterSpacing: '0.06em',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: `1px solid ${!scopeToProduct ? 'var(--pill-active-border)' : 'var(--border)'}`,
                                    color: !scopeToProduct ? 'var(--pill-active-color)' : 'var(--muted)',
                                    background: !scopeToProduct ? 'var(--pill-active-bg)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition)',
                                }}
                            >
                                All
                            </button>

                            <button
                                type="button"
                                onClick={handleHistoryUp}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={history.length === 0}
                                title="Previous command"
                                aria-label="Previous command"
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    color: 'var(--muted)',
                                    background: 'transparent',
                                    cursor: history.length === 0 ? 'default' : 'pointer',
                                    opacity: history.length === 0 ? 0.35 : 1,
                                    transition: 'all var(--transition)',
                                }}
                            >
                                &uarr;
                            </button>
                            <button
                                type="button"
                                onClick={handleHistoryDown}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={historyIndex === -1}
                                title="Next command"
                                aria-label="Next command"
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    color: 'var(--muted)',
                                    background: 'transparent',
                                    cursor: historyIndex === -1 ? 'default' : 'pointer',
                                    opacity: historyIndex === -1 ? 0.35 : 1,
                                    transition: 'all var(--transition)',
                                }}
                            >
                                &darr;
                            </button>

                            <button
                                type="button"
                                onClick={() => input.trim() && navigator.clipboard.writeText(input).then(() => {
                                    setCopiedInput(true)
                                    setTimeout(() => setCopiedInput(false), 1500)
                                })}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={!input.trim()}
                                title="Copy input"
                                aria-label="Copy input"
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    color: copiedInput ? 'var(--pill-active-color)' : 'var(--muted)',
                                    background: copiedInput ? 'var(--pill-active-bg)' : 'transparent',
                                    cursor: input.trim() ? 'pointer' : 'default',
                                    opacity: input.trim() ? 1 : 0.35,
                                    transition: 'all var(--transition)',
                                }}
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
                                onClick={copyTranscript}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={messages.length === 0}
                                title="Copy transcript"
                                aria-label="Copy transcript"
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    color: copiedTranscript ? 'var(--pill-active-color)' : 'var(--muted)',
                                    background: copiedTranscript ? 'var(--pill-active-bg)' : 'transparent',
                                    cursor: messages.length === 0 ? 'default' : 'pointer',
                                    opacity: messages.length === 0 ? 0.35 : 1,
                                    transition: 'all var(--transition)',
                                }}
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

                            <button
                                type="button"
                                onClick={() => isListening ? stopListening() : startListening()}
                                onMouseDown={(e) => e.preventDefault()}
                                disabled={!supportsVoice || submitting}
                                title={isListening ? 'Stop recording' : 'Voice input'}
                                aria-label={isListening ? 'Stop recording' : 'Voice input'}
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    color: isListening ? '#c00' : 'var(--muted)',
                                    background: isListening ? 'rgba(200,0,0,0.06)' : 'transparent',
                                    cursor: !supportsVoice || submitting ? 'default' : 'pointer',
                                    opacity: !supportsVoice || submitting ? 0.35 : 1,
                                    transition: 'all var(--transition)',
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={isListening ? { animation: 'voice-pulse 1s ease-in-out infinite' } : undefined}>
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </button>

                            <div style={{ flex: 1 }} />

                            <button
                                type="submit"
                                disabled={!input.trim() || submitting}
                                title="Submit"
                                aria-label="Submit"
                                style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    letterSpacing: '0.06em',
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    border: `1px solid ${input.trim() ? 'var(--pill-active-border)' : 'var(--border)'}`,
                                    color: input.trim() ? 'var(--pill-active-color)' : 'var(--muted)',
                                    background: input.trim() ? 'var(--pill-active-bg)' : 'transparent',
                                    cursor: input.trim() ? 'pointer' : 'default',
                                    transition: 'all var(--transition)',
                                }}
                            >
                                &crarr;
                            </button>
                        </div>
                    </form>
                </div>
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
