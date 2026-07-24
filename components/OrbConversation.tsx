'use client'

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useToast } from '@/components/ui/Toast'
import { startInteraction } from '@/lib/performance/telemetry'

// ORB-358: pause-based auto-segmentation was tried and reverted (Stan,
// 2026-07-23) — it introduced its own problems (queued transcriptions could
// visibly land out of sync, and very short/near-silent segments could make
// the transcription model hallucinate by echoing the STT prompt text back
// as if it had been spoken). A dictation machine is simpler and more
// predictable: one continuous recording for the whole session, transcribed
// once when the user explicitly stops it.
const DICTATE_MIN_MS = 400 // below this, treat as an accidental tap — skip the API call entirely

// ORB-358: removed from the UI (Stan, 2026-07-23) pending the live-streaming
// rebuild (see HANDOFF.md "ORB-358 Phase 2"). Code kept intact and reachable
// again by flipping this flag — same pattern already used to retire the old
// serial voice engine without deleting it.
const DICTATE_ENABLED = false

export type ConversationMessage = {
    id: string
    type: 'user' | 'orb' | 'dev'
    text: string
    spokenText?: string
    insight?: { type: 'observation' | 'coaching' | 'strategic'; summary: string }
    isStreaming?: boolean
    isServiceError?: boolean
    thoughts?: string[]
    senderLabel?: string
    source?: 'passive-status' | 'passive-greeting'
}

type Props = {
    messages: ConversationMessage[]
    input: string
    submitting: boolean
    productCode: string
    products: { id: string; code: string | null; name: string }[]
    onInputChange: (v: string) => void
    onSubmit: (value: string) => void
    onFocusChange: (v: boolean) => void
    onSelectProject: (id: string) => void
    selectedProjectId?: string | null
    onShowEditProject: () => void
    onShowAddProject: () => void
    conversationActive?: boolean
    onRestoreConversation?: () => void
    onClearTranscript?: () => void
    onStop?: () => void
    projectStrip?: React.ReactNode
    orbElement?: React.ReactNode
    voiceActive?: boolean
    voiceListening?: boolean
    voiceError?: string | null
    supportsVoiceMode?: boolean
    onStartVoiceMode?: () => void
    onExitVoiceMode?: () => void
}

function OrbCard({ msg }: { msg: ConversationMessage }) {
    const [copied, setCopied] = useState(false)
    const insightLabel = msg.insight?.type === 'strategic'
        ? 'Strategic read'
        : msg.insight?.type === 'coaching'
            ? 'Coaching read'
            : msg.insight?.type === 'observation'
                ? 'Observation'
                : null

    function copy() {
        navigator.clipboard.writeText(msg.text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }).catch(e => console.warn('[clipboard]', e))
    }

    return (
        <div className={msg.isServiceError ? 'oc-orb-card oc-service-error' : 'oc-orb-card'}>
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
                <div className="oc-orb-md" style={{
                    flex: 1,
                    opacity: msg.isStreaming ? 0.8 : 1,
                    transition: 'opacity 0.2s',
                }}>
                    {insightLabel && (
                        <div className="oc-insight">
                            <span className="oc-insight-dot" aria-hidden="true" />
                            <span>{insightLabel}</span>
                        </div>
                    )}
                    <Markdown remarkPlugins={[remarkGfm]} components={{
                        a: ({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>
                        ),
                    }}>
                        {msg.text}
                    </Markdown>
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
                </div>
                <button
                    type="button"
                    className="oc-copy-btn"
                    onClick={copy}
                    data-tooltip="Copy response"
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
        </div>
    )
}

function DevCard({ msg }: { msg: ConversationMessage }) {
    return (
        <div className="oc-dev-card">
            <div className="oc-dev-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                {msg.senderLabel ?? 'Developer'}
            </div>
            <div className="oc-orb-md">
                <Markdown components={{
                    a: ({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>
                    ),
                }}>
                    {msg.text}
                </Markdown>
            </div>
        </div>
    )
}

export default function OrbConversation({
    messages,
    input,
    submitting,
    productCode,
    products,
    onInputChange,
    onSubmit,
    onFocusChange,
    onSelectProject,
    selectedProjectId,
    onShowEditProject,
    onShowAddProject,
    conversationActive = true,
    onRestoreConversation,
    onClearTranscript,
    onStop,
    projectStrip,
    orbElement,
    voiceActive = false,
    voiceListening = false,
    voiceError = null,
    supportsVoiceMode = false,
    onStartVoiceMode,
    onExitVoiceMode,
}: Props) {
    const threadRef             = useRef<HTMLDivElement>(null)
    const textareaRef           = useRef<HTMLTextAreaElement>(null)
    const [slashMenuDismissed, setSlashMenuDismissed] = useState(false)
    const [inputFocused, setInputFocused] = useState(false)
    const [copiedInput, setCopiedInput] = useState(false)
    const [copiedTranscript, setCopiedTranscript] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [supportsVoice, setSupportsVoice] = useState(false)
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const recordingStartedAtRef = useRef(0)
    const processing = submitting || messages.some(msg => msg.isStreaming)
    const toast = useToast()

    // ORB-358: the browser-native SpeechRecognition API (Web Speech API) was
    // replaced with server-side transcription. Its free cloud backend only
    // reliably works in Google's own Chrome — Edge and Safari, two of the
    // three officially supported browsers, consistently failed with network
    // errors regardless of network or machine. MediaRecorder/getUserMedia has
    // much broader, browser-vendor-independent support, and this reuses the
    // same /api/orb-transcribe pipeline (gpt-4o-mini-transcribe) the old
    // serial voice engine already built and proved in production.
    useEffect(() => {
        setSupportsVoice(typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
    }, [])

    useEffect(() => {
        return () => {
            try { mediaRecorderRef.current?.stop() } catch {}
            mediaStreamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])

    // Return while dictating means "stop and send" (matches what Return
    // already means in this field when not dictating); clicking the button
    // means "stop, but let me review before sending" — deliberately
    // different actions, not two spellings of the same one (Stan, 2026-07-23).
    const submitAfterStopRef = useRef(false)

    // ORB-358: Stan reported unpredictable delay ("sometimes seconds,
    // sometimes nothing at all") with no way to tell where time was actually
    // going from a verbal description alone. Measures every real stage —
    // mic permission, recording duration, upload+transcription round-trip —
    // so a slow or failed run can be diagnosed from data, not memory. Same
    // focus/pattern already used for full voice mode (useVoiceMode.ts);
    // enable via DEV panel → Performance → focus areas → voice to capture.
    async function startListening() {
        if (!supportsVoice || submitting) return
        const measurement = startInteraction({
            focus: 'voice',
            flow: 'dictate',
            interaction: 'record_to_text',
            surface: 'dashboard',
        })
        measurement.mark('permission_requested')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream
            measurement.mark('permission_granted')

            const preferredTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
            const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type))
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
            mediaRecorderRef.current = recorder
            const chunks: Blob[] = []
            recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data) }

            recorder.onerror = () => {
                stream.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
                mediaRecorderRef.current = null
                setIsListening(false)
                submitAfterStopRef.current = false
                measurement.end(false, 'recorder_error')
                toast.error('Microphone recording failed. Try again.')
            }

            recorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop())
                mediaStreamRef.current = null
                mediaRecorderRef.current = null
                setIsListening(false)
                const wantsSubmit = submitAfterStopRef.current
                submitAfterStopRef.current = false
                measurement.mark('recording_stopped')
                const recordingDurationMs = Date.now() - recordingStartedAtRef.current

                const tooShort = recordingDurationMs < DICTATE_MIN_MS
                const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                if (audio.size === 0 || tooShort) {
                    measurement.end(true, 'skipped_too_short', { recordingDurationMs, audioBytes: audio.size, submitted: wantsSubmit })
                        if (wantsSubmit) handleFormSubmit()
                    return
                }

                setIsTranscribing(true)
                try {
                    measurement.mark('upload_started')
                    const form = new FormData()
                    form.append('audio', audio, recorder.mimeType?.includes('ogg') ? 'orb-dictate.ogg' : 'orb-dictate.webm')
                    const response = await fetch('/api/orb-transcribe', { method: 'POST', body: form })
                    measurement.mark('response_received')
                    const result = await response.json() as { text?: string; error?: string }
                    if (!response.ok || !result.text) throw new Error(result.error || 'Speech transcription failed')
                    const text = result.text.trim()
                    const current = textareaRef.current?.value ?? input
                    const joiner = current && !/\s$/.test(current) ? ' ' : ''
                    const finalValue = text ? current + joiner + text : current
                    if (text) onInputChange(finalValue)
                    if (wantsSubmit) handleFormSubmit(undefined, finalValue)
                    measurement.end(true, null, { recordingDurationMs, audioBytes: audio.size, transcriptLength: text.length, submitted: wantsSubmit })
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Could not transcribe speech. Try again.'
                    measurement.end(false, 'transcription_failed', { recordingDurationMs, audioBytes: audio.size, error: message })
                    toast.error(message)
                } finally {
                    setIsTranscribing(false)
                    }
            }

            measurement.mark('recording_started')
            recordingStartedAtRef.current = Date.now()
            recorder.start()
            setIsListening(true)
        } catch (err: any) {
            setIsListening(false)
            submitAfterStopRef.current = false
            const failureCode = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
                ? 'permission_denied'
                : err?.name === 'NotFoundError' ? 'no_microphone' : 'start_failed'
            measurement.end(false, failureCode, { errorName: err?.name })
            const message = failureCode === 'permission_denied'
                ? 'Microphone access was denied. Check your browser\'s site permissions and try again.'
                : failureCode === 'no_microphone'
                    ? 'No working microphone was found.'
                    : 'Couldn\'t start dictation in this browser.'
            toast.error(message)
        }
    }

    function stopListening(submitAfter = false) {
        submitAfterStopRef.current = submitAfter
        try { mediaRecorderRef.current?.stop() } catch {}
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
            const secondLast = messages.length >= 2 ? messages[messages.length - 2] : null
            // Force scroll when: user just sent a message (could be last or second-to-last
            // if a processing placeholder was appended), or the Orb is streaming
            const forceScroll = lastMsg && (
                lastMsg.type === 'user' ||
                lastMsg.isStreaming ||
                lastMsg.text === 'Processing…' ||
                (secondLast?.type === 'user')
            )
            if (isNearBottom || forceScroll) {
                requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
            }
        }
    }, [messages])

    // Command History
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState<number>(-1)

    const [slashIndex, setSlashIndex] = useState(0)

    const SLASH_COMMANDS: { cmd: string; desc: string; group: string }[] = [
        { cmd: '/add [task]', desc: 'Create a todo in current project', group: 'Todos' },
        { cmd: '/close [task]', desc: 'Mark a todo as done', group: 'Todos' },
        { cmd: '/create [name]', desc: 'Create a new project', group: 'Projects' },
        { cmd: '/drop [project]', desc: 'Delete a project', group: 'Projects' },
        { cmd: '/edit [project]', desc: 'Edit a project', group: 'Projects' },
        { cmd: '/switch [project]', desc: 'Switch to a project', group: 'Projects' },
        { cmd: '/clear', desc: 'Clear the conversation', group: 'Session' },
        { cmd: '/settings', desc: 'Open settings panel', group: 'Session' },
    ]

    const activeSlashCommands = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(input.toLowerCase()))
    const showSlashMenu = inputFocused && input.startsWith('/') && activeSlashCommands.length > 0 && historyIndex === -1 && !slashMenuDismissed

    function handleFormSubmit(e?: React.FormEvent, overrideValue?: string) {
        e?.preventDefault()
        const value = (overrideValue ?? textareaRef.current?.value ?? input).trim()
        if (!value || processing) return

        const newHist = [...history]
        if (newHist[newHist.length - 1] !== value) {
            newHist.push(value)
            setHistory(newHist)
            sessionStorage.setItem('todos_orb_cmd_hist', JSON.stringify(newHist))
        }
        setHistoryIndex(-1)

        onSubmit(value)
    }

    function fillCommand(cmd: string) {
        setSlashMenuDismissed(true)
        onInputChange(cmd)
        setSlashIndex(0)
        const match = cmd.match(/\[([^\]]+)\]/)
        if (match) {
            setTimeout(() => {
                const el = textareaRef.current
                if (!el) return
                el.focus()
                el.setSelectionRange(match.index!, match.index! + match[0].length)
            }, 0)
        } else {
            textareaRef.current?.focus()
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

    const autoResize = () => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const h = Math.min(el.scrollHeight, 120)
        el.style.height = `${h}px`
        el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'
    }

    useEffect(() => {
        autoResize()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input])

    function copyTranscript() {
        const transcript = messages.map(m => {
            const prefix = m.type === 'dev' ? (m.senderLabel ?? 'Developer') : m.type === 'user' ? 'User' : 'Orb'
            const thoughts = m.thoughts?.length ? ` [${m.thoughts.join('; ')}]` : ''
            return `${prefix}:${thoughts} ${m.text}`
        }).join('\n\n')
        navigator.clipboard.writeText(transcript).then(() => {
            setCopiedTranscript(true)
            setTimeout(() => setCopiedTranscript(false), 1500)
        }).catch(e => console.warn('[clipboard]', e))
    }

    async function exportTranscript() {
        const date = new Date().toISOString().slice(0, 10)
        const md = [
            `# Orb Conversation — ${productCode} — ${date}`,
            '',
            ...messages.flatMap(m => {
                const speaker = m.type === 'dev' ? (m.senderLabel ?? 'Developer') : m.type === 'user' ? 'You' : 'Orb'
                const lines: string[] = [`## ${speaker}`, '']
                if (m.thoughts?.length) {
                    lines.push(...m.thoughts.map(t => `> ${t}`), '')
                }
                lines.push(m.text, '')
                return lines
            }),
        ].join('\n')

        const filename = `orb-${productCode.toLowerCase()}-${date}.md`
        const blob = new Blob([md], { type: 'text/markdown' })

        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
                })
                const writable = await handle.createWritable()
                await writable.write(blob)
                await writable.close()
                return
            } catch (e: any) {
                if (e?.name === 'AbortError') return
            }
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="oc-wrap" data-mode={voiceActive ? 'voice' : conversationActive ? 'dialogue' : 'ambient'}>
            {orbElement}
            {conversationActive ? (
                <div ref={threadRef} className="oc-thread">
                    <div className="oc-thread-spacer" />
                    {messages.map(msg => (
                            msg.type === 'dev' ? (
                                <DevCard key={msg.id} msg={msg} />
                            ) : msg.type === 'user' ? (
                                <div
                                    key={msg.id}
                                    style={{ display: 'flex', justifyContent: 'flex-end', margin: '5px 2px' }}
                                >
                                    <div className="oc-user-bubble">
                                        {msg.text}
                                    </div>
                                </div>
                            ) : (
                                <OrbCard key={msg.id} msg={msg} />
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

            <div className="oc-input-wrap" data-tour="conversation-input" style={{ position: 'relative' }}>
                {voiceActive ? (
                    <div className="oc-voice-box">
                        {/* Error field only — no live transcript preview. The user's
                            words already appear as a message in the conversation above
                            the instant they're recognized, so repeating them here would
                            just duplicate it. */}
                        <div className="oc-voice-stt">
                            {voiceError ? <span style={{ color: 'var(--color-danger)' }}>{voiceError}</span> : ' '}
                        </div>

                        {/* Traffic-light indicators + stop button */}
                        <div className="oc-voice-indicators">
                            {/* Green — Speaking (user is talking) */}
                            <div className="oc-voice-ind-wrap">
                                <div
                                    className={`oc-voice-ind oc-voice-ind-green${voiceListening ? ' oc-voice-ind-active' : ''}`}
                                    data-tooltip="You are speaking"
                                    aria-label="Speaking mode"
                                >
                                    {/* Microphone icon */}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                    </svg>
                                </div>
                                <span className="oc-voice-ind-label">Speak</span>
                            </div>

                            {/* Yellow — Listening (user listens, Orb acts) */}
                            <div className="oc-voice-ind-wrap">
                                <div
                                    className={`oc-voice-ind oc-voice-ind-yellow${!voiceListening ? ' oc-voice-ind-active' : ''}`}
                                    data-tooltip="Orb is responding"
                                    aria-label="Listen mode"
                                >
                                    {/* Headphones icon */}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
                                        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                                    </svg>
                                </div>
                                <span className="oc-voice-ind-label">Listen</span>
                            </div>

                        </div>

                        {/* Exit button — far right */}
                        <button
                            type="button"
                            className="oc-voice-exit"
                            onClick={onExitVoiceMode}
                            data-tooltip="End voice mode"
                            aria-label="End voice mode"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                ) : (
                    <>
                        {showSlashMenu && (
                            <div className="oc-slash-menu">
                                {activeSlashCommands.map((c, i) => {
                                    const prevGroup = i > 0 ? activeSlashCommands[i - 1].group : null
                                    const showHeader = c.group !== prevGroup
                                    return (
                                        <div key={c.cmd}>
                                            {showHeader && (
                                                <div className="oc-slash-group-header">{c.group}</div>
                                            )}
                                            <div
                                                className="oc-slash-item"
                                                ref={slashIndex === i ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                                                style={{ background: slashIndex === i ? 'var(--bg2)' : 'transparent' }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault()
                                                    fillCommand(c.cmd)
                                                }}
                                            >
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text)', fontWeight: slashIndex === i ? 'var(--fw-semibold)' : 'var(--fw-normal)' }}>{c.cmd}</span>
                                                <span style={{ fontSize: 'var(--fs-version)', color: 'var(--muted)' }}>{c.desc}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="oc-input-border">
                            <form onSubmit={handleFormSubmit}>
                                {!input && !processing && (
                                    <div className="oc-placeholder">
                                        Type / or ask Orb anything...
                                    </div>
                                )}

                                <textarea
                                    ref={textareaRef}
                                    className="oc-textarea"
                                    rows={1}
                                    value={input}
                                    onChange={e => { setSlashMenuDismissed(false); onInputChange(e.target.value); autoResize() }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            if (isListening) {
                                                stopListening(true)
                                            } else if (showSlashMenu && activeSlashCommands[slashIndex]) {
                                                fillCommand(activeSlashCommands[slashIndex].cmd)
                                            } else if (input.trim() !== '/') {
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
                                                setSlashMenuDismissed(true)
                                                setSlashIndex(0)
                                            }
                                        }
                                    }}
                                    onFocus={() => setInputFocused(true)}
                                    onBlur={() => setInputFocused(false)}
                                    disabled={processing}
                                    placeholder=""
                                />

                                <div className="oc-toolbar">
                                    {/* Cmds — always visible */}
                                    <button
                                        type="button"
                                        className="oc-tool-btn"
                                        onClick={() => {
                                            if (input.startsWith('/')) {
                                                onInputChange('')
                                            } else {
                                                setSlashMenuDismissed(false)
                                                onInputChange('/')
                                            }
                                            textareaRef.current?.focus()
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        data-tooltip="Show commands (/)"
                                        aria-label="Show commands"
                                    >
                                        <span className="oc-tool-btn-icon" style={{ fontWeight: 'var(--fw-semibold)' }}>/</span>
                                        <span className="oc-tool-btn-label">Cmds</span>
                                    </button>

                                    {/* Dictate — removed from the UI (Stan, 2026-07-23) pending the
                                        live-streaming rebuild; DICTATE_ENABLED flips it back on. A
                                        dictation-machine model: records continuously until the user
                                        explicitly stops it (button click, or Return — which also
                                        submits). Transcription only starts after recording stops, so
                                        isListening and isTranscribing never overlap. */}
                                    {DICTATE_ENABLED && (
                                        <button
                                            type="button"
                                            className="oc-tool-btn"
                                            onClick={() => isListening ? stopListening() : startListening()}
                                            onMouseDown={(e) => e.preventDefault()}
                                            disabled={!supportsVoice || processing || isTranscribing}
                                            data-tooltip={isListening ? 'Stop dictation' : isTranscribing ? 'Transcribing…' : 'Dictate into the text field'}
                                            aria-label={isListening ? 'Stop dictation' : isTranscribing ? 'Transcribing' : 'Dictate into the text field'}
                                            style={{
                                                color: isListening ? '#c00' : undefined,
                                                background: isListening ? 'rgba(200,0,0,0.06)' : undefined,
                                                opacity: !supportsVoice || processing || isTranscribing ? 'var(--opacity-disabled)' : 1,
                                            }}
                                        >
                                            <span className="oc-tool-btn-icon">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={isListening || isTranscribing ? { animation: 'voice-pulse 1s ease-in-out infinite' } : undefined}>
                                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                                </svg>
                                            </span>
                                            <span className="oc-tool-btn-label">{isTranscribing ? 'Transcribing' : 'Dictate'}</span>
                                        </button>
                                    )}

                                    {/* Prev/Next — inline on desktop/iPad, hidden on iPhone (in More menu instead) */}
                                    <button
                                        type="button"
                                        className="oc-tool-btn oc-desktop-only"
                                        onClick={() => { handleHistoryUp(); textareaRef.current?.focus() }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={history.length === 0}
                                        data-tooltip="Previous input"
                                        aria-label="Previous input"
                                    >
                                        <span className="oc-tool-btn-icon">↑</span>
                                        <span className="oc-tool-btn-label">Prev</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="oc-tool-btn oc-desktop-only"
                                        onClick={() => { handleHistoryDown(); textareaRef.current?.focus() }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={historyIndex === -1}
                                        data-tooltip="Next input"
                                        aria-label="Next input"
                                    >
                                        <span className="oc-tool-btn-icon">↓</span>
                                        <span className="oc-tool-btn-label">Next</span>
                                    </button>

                                    {/* Overflow menu for infrequent actions */}
                                    <div className="oc-toolbar-overflow" style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className="oc-tool-btn"
                                            onClick={() => {
                                                setMoreMenuOpen(o => !o)
                                                textareaRef.current?.focus()
                                            }}
                                            onMouseDown={(e) => e.preventDefault()}
                                            aria-label="More actions"
                                            aria-expanded={moreMenuOpen}
                                        >
                                            <span className="oc-tool-btn-icon">⋮</span>
                                            <span className="oc-tool-btn-label">More</span>
                                        </button>
                                        {moreMenuOpen && (
                                            <>
                                                <div className="dropdown-backdrop" onClick={() => setMoreMenuOpen(false)} />
                                                <div className="oc-more-menu">
                                                    {/* Prev/Next in More menu — only visible on iPhone */}
                                                    <div className="oc-mobile-only">
                                                        <div className="oc-more-group-header">Input</div>
                                                        <button
                                                            type="button"
                                                            className="oc-more-item"
                                                            onClick={() => { handleHistoryUp(); setMoreMenuOpen(false) }}
                                                            disabled={history.length === 0}
                                                        >
                                                            <span className="oc-more-label">↑ Previous</span>
                                                            <span className="oc-more-desc">Recall last command</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="oc-more-item"
                                                            onClick={() => { handleHistoryDown(); setMoreMenuOpen(false) }}
                                                            disabled={historyIndex === -1}
                                                        >
                                                            <span className="oc-more-label">↓ Next</span>
                                                            <span className="oc-more-desc">Forward in history</span>
                                                        </button>
                                                    </div>
                                                    {supportsVoiceMode && onStartVoiceMode && (
                                                        <>
                                                            <div className="oc-more-group-header">Voice</div>
                                                            <button
                                                                type="button"
                                                                className="oc-more-item"
                                                                onClick={() => { onStartVoiceMode(); setMoreMenuOpen(false) }}
                                                                disabled={processing}
                                                            >
                                                                <span className="oc-more-label">Talk to Orb</span>
                                                                <span className="oc-more-desc">Start voice conversation</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    <div className="oc-more-group-header">Transcript</div>
                                                    <button
                                                        type="button"
                                                        className="oc-more-item"
                                                        onClick={() => {
                                                            input.trim() && navigator.clipboard.writeText(input).then(() => {
                                                                setCopiedInput(true)
                                                                setTimeout(() => setCopiedInput(false), 1500)
                                                            }).catch(e => console.warn('[clipboard]', e))
                                                            setMoreMenuOpen(false)
                                                        }}
                                                        disabled={!input.trim()}
                                                    >
                                                        <span className="oc-more-label">{copiedInput ? '✓ Copied' : 'Copy'}</span>
                                                        <span className="oc-more-desc">Copy input text</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="oc-more-item"
                                                        onClick={() => { copyTranscript(); setMoreMenuOpen(false) }}
                                                        disabled={messages.length === 0}
                                                    >
                                                        <span className="oc-more-label">{copiedTranscript ? '✓ Copied' : 'Copy'}</span>
                                                        <span className="oc-more-desc">Copy full conversation</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="oc-more-item"
                                                        onClick={() => { exportTranscript(); setMoreMenuOpen(false) }}
                                                        disabled={messages.length === 0}
                                                    >
                                                        <span className="oc-more-label">Export</span>
                                                        <span className="oc-more-desc">Download as markdown</span>
                                                    </button>
                                                    {onClearTranscript && (
                                                        <button
                                                            type="button"
                                                            className="oc-more-item"
                                                            onClick={() => { onClearTranscript(); setMoreMenuOpen(false) }}
                                                            disabled={messages.length === 0 || processing}
                                                        >
                                                            <span className="oc-more-label">Clear</span>
                                                            <span className="oc-more-desc">Reset conversation</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex-1" />

                                    {processing ? (
                                        <button
                                            type="button"
                                            className="oc-action-circle oc-stop-btn"
                                            onClick={onStop}
                                            data-tooltip="Stop processing"
                                            aria-label="Stop processing"
                                        >
                                            <span />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            className="oc-action-circle oc-send-btn"
                                            disabled={!input.trim()}
                                            data-tooltip="Send (Enter)"
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
                    </>
                )}
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
