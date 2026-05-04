'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrbResponse } from '@/app/actions/orb-converse'

export type ConversationMessage = {
    id: string
    type: 'user' | 'orb'
    text: string
    results?: OrbResponse['results']
    queryLabel?: string
}

type Props = {
    messages: ConversationMessage[]
    input: string
    submitting: boolean
    productCode: string
    products: { code: string | null; name: string }[]
    scopeToProduct: boolean
    hintIndex: number
    onInputChange: (v: string) => void
    onSubmit: (e?: React.FormEvent) => void
    onShowResults: (results: NonNullable<OrbResponse['results']>, label: string) => void
    onScopeChange: (v: boolean) => void
}

export default function OrbConversation({
    messages,
    input,
    submitting,
    productCode,
    products,
    scopeToProduct,
    hintIndex,
    onInputChange,
    onSubmit,
    onShowResults,
    onScopeChange,
}: Props) {
    const threadRef             = useRef<HTMLDivElement>(null)
    const textareaRef           = useRef<HTMLTextAreaElement>(null)
    const slashMenuDismissed    = useRef(false)
    const [inputFocused, setInputFocused] = useState(false)
    
    // Command History
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState<number>(-1)

    const [slashIndex, setSlashIndex] = useState(0)

    const ROTATING_HINTS = [
        'Type ? or / for help.',
        "What's most urgent?",
        '💡Ask "Switch to [project]"',
        "Mark the invoice as done…",
        '💡Ask "Open my settings"',
    ]

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
        const h = Math.min(el.scrollHeight, 160)
        el.style.height = `${h}px`
        el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden'
    }, [])

    useEffect(() => { autoResize() }, [input, autoResize])

    const handleFormSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || submitting) return
        
        const newHist = [...history]
        if (newHist[newHist.length - 1] !== input.trim()) {
            newHist.push(input.trim())
            setHistory(newHist)
            sessionStorage.setItem('todos_orb_cmd_hist', JSON.stringify(newHist))
        }
        setHistoryIndex(-1)

        // Form submission is handled entirely by parent now
        onSubmit()
    }

    const lastOrbMessage = [...messages].reverse().find(m => m.type === 'orb')
    const hasMessages = !!lastOrbMessage

    return (
        <div style={{
            width: '420px',
            maxWidth: '90vw',
            background: 'var(--bg2)',
            border: `1px solid ${inputFocused ? 'var(--border-focus)' : 'var(--border)'}`,
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            transition: 'border-color 0.15s',
        }}>

            {hasMessages && (
                <div
                    ref={threadRef}
                    aria-live="polite"
                    style={{
                        padding: '16px 20px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        // Minimal animation for transient entry
                        animation: 'todos-fade-in 0.3s ease-out',
                    }}
                >
                    <div style={{ lineHeight: 1.5 }}>
                        <div>
                            <span style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: 'var(--fs-sm)',
                                fontWeight: 600,
                                color: 'var(--text)',
                                letterSpacing: '0.02em',
                            }}>
                                Orb:
                            </span>
                            {' '}
                            <span style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: 'var(--fs-base)',
                                color: 'var(--text2)',
                                whiteSpace: 'pre-wrap',
                            }}>
                                {lastOrbMessage.text}
                            </span>
                            {lastOrbMessage.results && lastOrbMessage.results.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                    <button
                                        onClick={() => onShowResults(lastOrbMessage.results!, lastOrbMessage.queryLabel ?? '')}
                                        style={{
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
                                        Show list · {lastOrbMessage.results.length}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {hasMessages && (
                <div style={{ height: '1px', background: 'var(--border)', flexShrink: 0 }} />
            )}

            <form onSubmit={handleFormSubmit} style={{ position: 'relative' }}>
                {!input && (
                    <div
                        key={hintIndex}
                        style={{
                            position: 'absolute',
                            top: '13px',
                            left: '20px',
                            pointerEvents: 'none',
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-input)',
                            color: 'var(--muted)',
                            lineHeight: 1.5,
                            zIndex: 1,
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                            animation: 'todos-fade-in 0.5s ease-out',
                        }}
                    >
                        {ROTATING_HINTS[hintIndex % ROTATING_HINTS.length]}
                    </div>
                )}
                
                {showSlashMenu && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '16px',
                        marginBottom: '8px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
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
                    style={{
                        width: '100%',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 'var(--fs-input)',
                        background: 'transparent',
                        border: 'none',
                        padding: '12px 20px',
                        color: 'var(--text)',
                        outline: 'none',
                        resize: 'none',
                        lineHeight: 1.5,
                        overflowY: 'hidden',
                        boxSizing: 'border-box',
                    }}
                />

                {/* Pill strip */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px 10px',
                }}>
                    {/* Scope pill */}
                    <button
                        type="button"
                        onClick={() => onScopeChange(!scopeToProduct)}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: `1px solid ${!scopeToProduct ? 'var(--pill-active-border)' : 'var(--border)'}`,
                            color: !scopeToProduct ? 'var(--pill-active-color)' : 'var(--muted)',
                            background: !scopeToProduct ? 'var(--pill-active-bg)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all var(--transition)',
                        }}
                    >
                        All
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* History nav pills */}
                    <button
                        type="button"
                        onClick={handleHistoryUp}
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={history.length === 0}
                        aria-label="Previous command"
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 500,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            color: 'var(--muted)',
                            background: 'transparent',
                            cursor: history.length === 0 ? 'default' : 'pointer',
                            opacity: history.length === 0 ? 0.35 : 1,
                            transition: 'all var(--transition)',
                        }}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={handleHistoryDown}
                        onMouseDown={(e) => e.preventDefault()}
                        disabled={historyIndex === -1}
                        aria-label="Next command"
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 500,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            color: 'var(--muted)',
                            background: 'transparent',
                            cursor: historyIndex === -1 ? 'default' : 'pointer',
                            opacity: historyIndex === -1 ? 0.35 : 1,
                            transition: 'all var(--transition)',
                        }}
                    >
                        ↓
                    </button>

                    {/* Submit pill */}
                    <button
                        type="submit"
                        disabled={!input.trim() || submitting}
                        aria-label="Submit"
                        style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            padding: '3px 12px',
                            borderRadius: '12px',
                            border: `1px solid ${input.trim() ? 'var(--pill-active-border)' : 'var(--border)'}`,
                            color: input.trim() ? 'var(--pill-active-color)' : 'var(--muted)',
                            background: input.trim() ? 'var(--pill-active-bg)' : 'transparent',
                            cursor: input.trim() ? 'pointer' : 'default',
                            transition: 'all var(--transition)',
                        }}
                    >
                        ↵
                    </button>
                </div>
            </form>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes todos-fade-in {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </div>
    )
}
