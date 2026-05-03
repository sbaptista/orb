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
    scopeToProduct: boolean
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
    scopeToProduct,
    onInputChange,
    onSubmit,
    onShowResults,
    onScopeChange,
}: Props) {
    const threadRef   = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [inputFocused, setInputFocused] = useState(false)

    const autoResize = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const h = Math.min(el.scrollHeight, 160)
        el.style.height = `${h}px`
        el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden'
    }, [])

    useEffect(() => { autoResize() }, [input, autoResize])

    useEffect(() => {
        const el = threadRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages])

    const hasMessages = messages.length > 0

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
            overflow: 'hidden',
            transition: 'border-color 0.15s',
        }}>

            {hasMessages && (
                <div
                    ref={threadRef}
                    aria-live="polite"
                    style={{
                        overflowY: 'auto',
                        maxHeight: '220px',
                        padding: '16px 20px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        maskImage: 'linear-gradient(to bottom, transparent 0px, black 52px)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 52px)',
                    }}
                >
                    {messages.map(msg => (
                        <div key={msg.id} style={{ lineHeight: 1.5 }}>
                            {msg.type === 'orb' ? (
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
                                        {msg.text}
                                    </span>
                                    {msg.results && msg.results.length > 0 && (
                                        <div style={{ marginTop: '8px' }}>
                                            <button
                                                onClick={() => onShowResults(msg.results!, msg.queryLabel ?? '')}
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
                                                Show list · {msg.results.length}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: 'var(--fs-base)',
                                    color: 'var(--muted)',
                                }}>
                                    {msg.text}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {hasMessages && (
                <div style={{ height: '1px', background: 'var(--border)', flexShrink: 0 }} />
            )}

            <form onSubmit={onSubmit} style={{ position: 'relative' }}>
                {!input && !inputFocused && (
                    <div style={{
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
                    }}>
                        {'Type '}
                        <span style={{
                            background: 'var(--bg3)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '1px 5px',
                            color: 'var(--text)',
                            fontFamily: 'monospace',
                            fontSize: '0.85em',
                        }}>hint</span>
                        {' or '}
                        <svg
                            style={{ display: 'inline-block', verticalAlign: 'middle', marginBottom: '1px' }}
                            width="13" height="13" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        {' for help.'}
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={e => { onInputChange(e.target.value); autoResize() }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            onSubmit()
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
                        padding: '12px 50px 12px 20px',
                        color: 'var(--text)',
                        outline: 'none',
                        resize: 'none',
                        lineHeight: 1.5,
                        overflowY: 'hidden',
                        boxSizing: 'border-box',
                    }}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || submitting}
                    style={{
                        position: 'absolute',
                        right: '12px',
                        bottom: '34px',
                        background: 'none',
                        border: 'none',
                        cursor: input.trim() ? 'pointer' : 'default',
                        color: input.trim() ? 'var(--pill-active-color)' : 'var(--muted)',
                        fontSize: '16px',
                        padding: '4px',
                        lineHeight: 1,
                        transition: 'color 0.15s',
                    }}
                    aria-label="Submit"
                >
                    ↵
                </button>

                {/* Scope pills */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px 10px',
                }}>
                    <button
                        type="button"
                        onClick={() => onScopeChange(!scopeToProduct)}
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
                </div>
            </form>
        </div>
    )
}
