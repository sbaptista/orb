'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AddProductModal from './AddProductModal'
import QueryResultsModal from './QueryResultsModal'
import OrbHelp from './OrbHelp'
import OrbConversation, { type ConversationMessage } from './OrbConversation'
import { OrbDevPanel, type MoodOverride } from './OrbDevPanel'
import { orbConverse, type OrbResponse } from '@/app/actions/orb-converse'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import DistillModal from './DistillModal'
import { VERSION } from '@/lib/version'
import { useToast } from '@/components/ui/Toast'
import MuralCanvas from './MuralCanvas'

type Product = { id: string; name: string; code: string | null; description: string | null }
type Todo    = { id: string; title: string; status: string; priority_value: number | null }
type Urgency = 'calm' | 'active' | 'urgent'

type Props = { initialProducts?: Product[] }

const LAST_PRODUCT_KEY  = 'todos_last_product_id'
const SS_INPUT          = 'todos_orb_input'
const SS_CONVERSATION   = 'todos_orb_conversation'
const INACTIVITY_MS     = 5 * 60 * 1000

function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function computeUrgency(todos: Todo[]): Urgency {
    const open = todos.filter(t => t.status !== 'done')
    if (open.some(t => t.priority_value === 1)) return 'urgent'
    if (open.length > 5) return 'active'
    return 'calm'
}

const ORB_SPEED: Record<Urgency, string> = {
    calm:   '5.5s',
    active: '3.5s',
    urgent: '3.5s',
}

const ORB_GLOW: Record<Urgency, { inset: string; blur: string }> = {
    calm:   { inset: '-24px', blur: '28px' },
    active: { inset: '-38px', blur: '36px' },
    urgent: { inset: '-56px', blur: '46px' },
}

const ORB_STYLE: Record<Urgency, {
    orbMid: string; orbLo: string; glow: string; countColor: string; labelColor: string
}> = {
    calm: {
        orbMid: '#d4e4d4', orbLo: '#b8d0b8',
        glow: 'rgba(80,130,80,0.38)',
        countColor: '#2d5a2d', labelColor: '#7a9e7a',
    },
    active: {
        orbMid: '#e4daf4', orbLo: '#d0c4ee',
        glow: 'rgba(130,90,200,0.45)',
        countColor: '#5a3090', labelColor: '#9a7ac8',
    },
    urgent: {
        orbMid: '#f8ead8', orbLo: '#f0d4b0',
        glow: 'rgba(230,130,55,0.6)',
        countColor: '#a05010', labelColor: '#c88040',
    },
}

const ORB_ANIMATION: Record<Urgency, string> = {
    calm:   'todos-orb-calm',
    active: 'todos-orb-active',
    urgent: 'todos-orb-urgent',
}

const SOLAR_FLARES = [
    { angle: 14,  width: 24, height: 32, dur: 14, delay: 0    },
    { angle: 41,  width: 18, height: 24, dur: 16, delay: 5.2  },
    { angle: 68,  width: 28, height: 36, dur: 13, delay: 9.6  },
    { angle: 96,  width: 20, height: 28, dur: 17, delay: 2.4  },
    { angle: 124, width: 26, height: 34, dur: 15, delay: 11.3 },
    { angle: 152, width: 22, height: 30, dur: 14, delay: 7.0  },
    { angle: 178, width: 30, height: 38, dur: 16, delay: 4.0  },
    { angle: 206, width: 18, height: 26, dur: 18, delay: 12.4 },
    { angle: 232, width: 24, height: 32, dur: 13, delay: 6.2  },
    { angle: 258, width: 20, height: 28, dur: 15, delay: 10.0 },
    { angle: 284, width: 28, height: 36, dur: 14, delay: 1.7  },
    { angle: 312, width: 22, height: 30, dur: 17, delay: 8.5  },
    { angle: 340, width: 26, height: 34, dur: 15, delay: 13.2 },
]

export default function AmbientDashboard({ initialProducts }: Props) {
    const router   = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const toast    = useToast()

    const [products, setProducts]               = useState<Product[]>(initialProducts ?? [])
    const [selectedId, setSelectedId]           = useState<string | null>(null)
    const [todos, setTodos]                     = useState<Todo[]>([])
    const [input, setInput]                     = useState('')
    const [loading, setLoading]                 = useState(!initialProducts)
    const [submitting, setSubmitting]           = useState(false)
    const [showAddProduct, setShowAddProduct]   = useState(false)
    const [showEditProduct, setShowEditProduct] = useState(false)
    const [pulse, setPulse]                     = useState(false)
    const [moodOverride, setMoodOverride]       = useState<MoodOverride>(null)
    const [dryRun, setDryRun]                   = useState(false)
    const [showHelp, setShowHelp]               = useState(false)
    const [messages, setMessages]               = useState<ConversationMessage[]>([])
    const [conversationActive, setConversationActive] = useState(false)
    const [queryResults, setQueryResults]       = useState<OrbResponse['results']>(undefined)
    const [queryLabel, setQueryLabel]           = useState('')
    const [showQueryResults, setShowQueryResults] = useState(false)
    const [scopeToProduct, setScopeToProduct]     = useState(true)
    const [distillTodo, setDistillTodo]           = useState<{ id: string; productId: string; title: string; suggestion: { title: string; content: string } } | null>(null)
    const [isInputFocused, setIsInputFocused]     = useState(false)
    const [isMobile, setIsMobile]                 = useState(false)
    const [canScrollLeft, setCanScrollLeft]       = useState(false)
    const [canScrollRight, setCanScrollRight]     = useState(false)

    useEffect(() => {
        setIsMobile(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
    }, [])

    const inactivityRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevSelectedId     = useRef<string | null>(null)
    const projectScrollRef   = useRef<HTMLDivElement>(null)
    const prevProductLen     = useRef(products.length)

    function updateProjectScrollState() {
        const el = projectScrollRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 2)
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    }

    function scrollProjects(dir: 'left' | 'right') {
        const el = projectScrollRef.current
        if (!el) return
        el.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
    }

    // Auto-scroll to end when a project is added
    useEffect(() => {
        const el = projectScrollRef.current
        if (products.length > prevProductLen.current && el) {
            el.scrollLeft = el.scrollWidth
        }
        prevProductLen.current = products.length
        updateProjectScrollState()
    }, [products.length])

    function resetInactivity() {
        if (inactivityRef.current) clearTimeout(inactivityRef.current)
        inactivityRef.current = setTimeout(() => {
            setMessages([])
            setConversationActive(false)
            sessionStorage.removeItem(SS_CONVERSATION)
        }, INACTIVITY_MS)
    }

    function addOrbMessage(text: string) {
        setMessages(prev => [...prev, { id: genId(), type: 'orb', text }])
        setConversationActive(true)
        resetInactivity()
    }


    // Restore input and conversation from sessionStorage on mount
    useEffect(() => {
        const savedInput = sessionStorage.getItem(SS_INPUT)
        const savedConvo = sessionStorage.getItem(SS_CONVERSATION)
        if (savedInput) setInput(savedInput)
        if (savedConvo) {
            try {
                const msgs = JSON.parse(savedConvo) as ConversationMessage[]
                if (msgs.length > 0) {
                    setMessages(msgs)
                    setConversationActive(true)
                }
            } catch { /* ignore corrupted storage */ }
        }
    }, [])

    // Persist conversation to sessionStorage
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem(SS_CONVERSATION, JSON.stringify(messages))
        } else {
            sessionStorage.removeItem(SS_CONVERSATION)
        }
    }, [messages])

    const orbSwitchingRef = useRef(false)

    // Reset conversation on project switch (not on initial mount)
    useEffect(() => {
        if (prevSelectedId.current !== null && prevSelectedId.current !== selectedId) {
            if (!orbSwitchingRef.current) {
                setMessages([])
                setConversationActive(false)
                sessionStorage.removeItem(SS_CONVERSATION)
                if (inactivityRef.current) {
                    clearTimeout(inactivityRef.current)
                    inactivityRef.current = null
                }
            }
            orbSwitchingRef.current = false
        }
        prevSelectedId.current = selectedId
    }, [selectedId])

    // Clean up all timers on unmount
    useEffect(() => {
        return () => {
            if (inactivityRef.current) clearTimeout(inactivityRef.current)
        }
    }, [])

    // Reset idle hint when input changes
    useEffect(() => {
        resetInactivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input])

    // Load products, restore last selected
    useEffect(() => {
        async function load() {
            if (initialProducts) {
                // Data already available from server — just restore last-selected
                if (initialProducts.length > 0) {
                    const last  = localStorage.getItem(LAST_PRODUCT_KEY)
                    const found = initialProducts.find(p => p.id === last)
                    setSelectedId(found ? found.id : initialProducts[0].id)
                }
                return
            }
            const { data } = await supabase.from('projects').select('id, name, code, description').order('sort_order')
            const list = (data ?? []) as Product[]
            setProducts(list)
            if (list.length > 0) {
                const last  = localStorage.getItem(LAST_PRODUCT_KEY)
                const found = list.find(p => p.id === last)
                setSelectedId(found ? found.id : list[0].id)
            }
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase])

    const fetchTodos = useCallback(async () => {
        if (!selectedId) return
        const { data } = await supabase
            .from('todos')
            .select('id, title, status, priority_value')
            .eq('product_id', selectedId)
            .is('deleted_at', null)
        setTodos((data ?? []) as Todo[])
    }, [selectedId, supabase])

    useVisibilityRefetch(fetchTodos)

    useEffect(() => {
        if (!selectedId) return

        fetchTodos()
        localStorage.setItem(LAST_PRODUCT_KEY, selectedId)

        const channel = supabase
            .channel(`todos:${selectedId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'todos', filter: `product_id=eq.${selectedId}` },
                () => fetchTodos(),
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [selectedId, supabase, fetchTodos])

    const openTodos = todos.filter(t => t.status !== 'done')
    const urgency   = moodOverride ?? computeUrgency(todos)
    const style     = ORB_STYLE[urgency]
    const speed     = ORB_SPEED[urgency]
    const selected  = products.find(p => p.id === selectedId)

    // Global keyboard shortcuts
    useEffect(() => {
        const HINT_KEY = 'todos_keyboard_hint_shown'
        let hintShown  = !!localStorage.getItem(HINT_KEY)

        function onKey(e: KeyboardEvent) {
            const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)

            if (e.key === '?' && !inInput) {
                e.preventDefault()
                setShowHelp(s => !s)
                return
            }
            if (e.key === 'Escape') {
                setShowHelp(false)
                return
            }
            if (e.key === 'Tab' && !hintShown) {
                hintShown = true
                localStorage.setItem(HINT_KEY, '1')
                addOrbMessage('Keyboard mode — Tab to navigate, arrows to switch products, ? for help.')
                return
            }
            if (!inInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault()
                setSelectedId(current => {
                    if (!current || products.length <= 1) return current
                    const idx  = products.findIndex(p => p.id === current)
                    if (idx === -1) return current
                    const next = e.key === 'ArrowLeft'
                        ? (idx - 1 + products.length) % products.length
                        : (idx + 1) % products.length
                    return products[next].id
                })
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [products])

    async function handleSubmit(value?: string) {
        const text = (value ?? input).trim()
        if (!text || !selectedId || submitting) return

        if (text === '?') {
            setShowHelp(true)
            setInput('')
            return
        }

        if (text.startsWith('/')) {
            setInput('')
            sessionStorage.removeItem(SS_INPUT)
            
            const [cmd, ...args] = text.split(' ')
            if (cmd === '/settings') {
                router.push('/settings')
            } else if (cmd === '/help') {
                setShowHelp(true)
            } else if (cmd === '/switch') {
                const target = args.join(' ')
                const t = products.find(p => 
                    p.code?.toUpperCase() === target.toUpperCase() || 
                    p.name.toUpperCase() === target.toUpperCase()
                )
                if (t) setSelectedId(t.id)
            } else if (cmd === '/edit') {
                const target = args.join(' ')
                if (target) {
                    const t = products.find(p =>
                        p.code?.toUpperCase() === target.toUpperCase() ||
                        p.name.toUpperCase() === target.toUpperCase()
                    )
                    if (t) {
                        setSelectedId(t.id)
                        setShowEditProduct(true)
                    }
                } else {
                    setShowEditProduct(true)
                }
            } else if (cmd === '/orb') {
                setMessages(prev => [
                    ...prev,
                    { id: genId(), type: 'user', text },
                    { id: genId(), type: 'orb', text: 'I\'m the orb — your conversational interface to Orb.\n• Create: "Add a high priority todo to [project]"\n• Query: "What\'s most urgent?"\n• Update: "Mark the invoice task as done"\n• Navigate: "Switch to [project]" or "Open settings"\nType ? for full help.' },
                ])
                setConversationActive(true)
                resetInactivity()
            }
            return
        }

        if (text.toLowerCase() === 'explain') {
            setInput('')
            sessionStorage.removeItem(SS_INPUT)
            setMessages(prev => [
                ...prev,
                { id: genId(), type: 'user', text },
                { id: genId(), type: 'orb', text: 'Create, query, update, delete, or archive todos.\nTap the orb to list. Type \'?\' for more.' },
            ])
            setConversationActive(true)
            resetInactivity()
            return
        }

        const history = messages
            .filter(m => m.text !== 'Processing…')
            .map(m => ({ role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', text: m.text }))

        const processingId = genId()
        setMessages(prev => [
            ...prev,
            { id: genId(), type: 'user', text },
            { id: processingId, type: 'orb', text: 'Processing…' },
        ])
        setConversationActive(true)
        setInput('')
        sessionStorage.removeItem(SS_INPUT)
        setSubmitting(true)
        resetInactivity()

        try {
            const stream = await orbConverse({ input: text, productId: selectedId, scopeToProduct, history, dryRun })
            
            for await (const chunk of readStreamableValue(stream)) {
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
                        results: chunk.results?.length ? chunk.results : m.results,
                        queryLabel: chunk.queryLabel ?? m.queryLabel ?? text,
                        isStreaming: chunk.isStreaming,
                    }
                }))

                if (chunk.refresh) {
                    setPulse(true)
                    setTimeout(() => setPulse(false), 420)
                    if (chunk.mutatedProductId === selectedId) fetchTodos()
                    if (chunk.mutationType === 'create') toast.success('Todo created.')
                    else if (chunk.mutationType === 'update') toast.success('Todo saved.')
                    else if (chunk.mutationType === 'delete') toast.success('Todo deleted.')
                    else toast.success('Todo updated.')
                }

                if (chunk.clientAction) {
                    const action = chunk.clientAction
                    if (action.action === 'switch_project' && action.target) {
                        const t = products.find(p => 
                            p.code?.toUpperCase() === action.target?.toUpperCase() || 
                            p.name.toUpperCase() === action.target?.toUpperCase()
                        )
                        if (t) {
                            orbSwitchingRef.current = true
                            setSelectedId(t.id)
                        }
                    } else if (action.action === 'open_settings') {
                        router.push('/settings')
                    } else if (action.action === 'open_help') {
                        setShowHelp(true)
                    }
                }

                if (chunk.suggestedKnowledge) {
                    setDistillTodo(chunk.suggestedKnowledge)
                }
            }
        } catch (err) {
            console.error('[orbSubmit]', err)
            setMessages(prev => prev.map(m => m.id === processingId
                ? { ...m, text: 'Something went wrong. Try again?' }
                : m
            ))
        } finally {
            setSubmitting(false)
        }
    }

    function handleShowResults(results: NonNullable<OrbResponse['results']>, label: string) {
        setQueryResults(results)
        setQueryLabel(label)
        setShowQueryResults(true)
    }

    const lastOrbResponse = [...messages].reverse().find(m => m.type === 'orb')?.text

    const orbScale     = (isInputFocused && isMobile) ? 0.45 : 1.0

    if (loading) return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Loading…</p>
        </div>
    )

    if (products.length === 0) return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
        }}>
            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text2)' }}>No projects yet.</p>
            <Link href="/dashboard/classic" style={{
                fontSize: 'var(--fs-sm)',
                color: 'var(--pill-active-color)',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
            }}>
                Go to classic view to create one
            </Link>
        </div>
    )

    return (
        <>
        <MuralCanvas key={selectedId} urgency={urgency} />
        <div style={{
            height: '100dvh',
            overflow: 'hidden',
            position: 'relative',
        }}>

            {/* ── Star Wars fade mask ── */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: 'clamp(160px, 28vh, 220px)',
                background: 'linear-gradient(to bottom, var(--bg) 0%, var(--bg) 20%, transparent 100%)',
                zIndex: 9,
                pointerEvents: 'none',
            }} />

            {/* ── Orb ── */}
            <div style={{
                position: 'fixed',
                top: 'clamp(20px, 5vh, 44px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
            }}>
                <div
                    onClick={() => selectedId && router.push(`/dashboard/${selectedId}`)}
                    title="View todo list"
                    style={{
                        position: 'relative',
                        width: 'clamp(140px, 25vh, 200px)',
                        height: 'clamp(140px, 25vh, 200px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        transform: `scale(${orbScale})`,
                        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    aria-label={`${openTodos.length} open todos — tap to view list`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && selectedId && router.push(`/dashboard/${selectedId}`)}
                >
                    {/* Glow */}
                    <div data-todos-glow style={{
                        position: 'absolute',
                        inset: ORB_GLOW[urgency].inset,
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 40% 35%, ${style.glow}, transparent 70%)`,
                        filter: `blur(${ORB_GLOW[urgency].blur})`,
                        animation: `todos-glow-${urgency} ${speed} ease-in-out infinite`,
                        transition: 'inset 0.8s, filter 0.8s, background 0.8s',
                    }} />

                    {/* Solar flares (urgent only) */}
                    {urgency === 'urgent' && SOLAR_FLARES.map((f, i) => (
                        <div
                            key={i}
                            aria-hidden
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: 0,
                                height: 0,
                                transform: `rotate(${f.angle}deg)`,
                                pointerEvents: 'none',
                            }}
                        >
                            <div
                                data-todos-flare
                                style={{
                                    position: 'absolute',
                                    bottom: '82px',
                                    left: `${-f.width / 2}px`,
                                    width: `${f.width}px`,
                                    height: `${f.height}px`,
                                    background: `radial-gradient(ellipse 70% 100% at 50% 100%,
                    rgba(255, 235, 180, 0.95) 0%,
                    rgba(255, 185, 90, 0.6) 30%,
                    rgba(255, 140, 60, 0.28) 60%,
                    transparent 95%)`,
                                    borderRadius: '50% 50% 50% 50%',
                                    transformOrigin: 'bottom center',
                                    animation: `todos-flare-rise ${f.dur}s ease-in-out infinite`,
                                    animationDelay: `${f.delay}s`,
                                    filter: 'blur(6px)',
                                    mixBlendMode: 'screen',
                                }}
                            />
                        </div>
                    ))}

                    {/* Sphere */}
                    <div data-todos-orb style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 36% 30%, #ffffff, ${style.orbMid} 45%, ${style.orbLo} 82%)`,
                        boxShadow: `0 8px 32px ${style.glow}, 0 2px 8px rgba(0,0,0,0.06), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 2px 8px rgba(255,255,255,0.9)`,
                        animation: `${ORB_ANIMATION[urgency]} ${speed} ease-in-out infinite`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'background 0.8s, box-shadow 0.8s',
                    }}>
                        <svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 164 164"
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                            aria-hidden
                        >
                            <defs>
                                <path id="todos-orb-name-arc"  d="M 24 82 A 58 58 0 0 1 140 82" fill="none" />
                                <path id="todos-orb-state-arc" d="M 24 82 A 58 58 0 0 0 140 82" fill="none" />
                            </defs>
                            <text
                                fontFamily="var(--font-ui)"
                                fontSize="11"
                                fontWeight={600}
                                letterSpacing="3"
                                fill={style.labelColor}
                                style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
                            >
                                <textPath href="#todos-orb-name-arc" startOffset="50%" textAnchor="middle">
                                    {(() => {
                                        const raw = (selected?.code ?? selected?.name ?? '').toUpperCase()
                                        return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw
                                    })()}
                                </textPath>
                            </text>
                            <text
                                fontFamily="var(--font-ui)"
                                fontSize="11"
                                fontWeight={600}
                                letterSpacing="3"
                                fill={style.labelColor}
                                style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
                            >
                                <textPath href="#todos-orb-state-arc" startOffset="50%" textAnchor="middle">
                                    {urgency.toUpperCase()}
                                </textPath>
                            </text>
                        </svg>
                        <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'var(--fs-orb)',
                            fontWeight: 300,
                            color: style.countColor,
                            letterSpacing: '-1px',
                            lineHeight: 1,
                            transition: 'color 0.8s',
                        }}>
                            {openTodos.length}
                        </span>
                        <span style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 400,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: style.labelColor,
                            transition: 'color 0.8s',
                        }}>
                            open
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Conversation outer ── */}
            <div style={{
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                paddingBottom: 'clamp(100px, 14vh, 140px)',
            }}>
                <OrbConversation
                    messages={messages}
                    input={input}
                    submitting={submitting}
                    productCode={selected?.code ?? selected?.name ?? ''}
                    products={products}
                    scopeToProduct={scopeToProduct}
                    onInputChange={v => { setInput(v); sessionStorage.setItem(SS_INPUT, v) }}
                    onSubmit={handleSubmit}
                    onShowResults={handleShowResults}
                    onScopeChange={v => setScopeToProduct(v)}
                    onFocusChange={setIsInputFocused}
                    onSelectProject={id => { setSelectedId(id); setScopeToProduct(true) }}
                    selectedProjectId={selectedId}
                    onShowEditProject={() => setShowEditProduct(true)}
                    onShowAddProject={() => setShowAddProduct(true)}
                />
            </div>

            {/* ── Project strip ── */}
            <div style={{
                position: 'fixed',
                bottom: 'calc(clamp(100px, 14vh, 140px) - 54px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                display: 'flex',
                justifyContent: 'center',
            }}>
                <div style={{
                    maxWidth: '420px',
                    width: '100%',
                    display: 'flex',
                    background: 'rgba(255, 255, 255, 0.96)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-xl)',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        flex: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                    }}>
                        {canScrollLeft && (
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                zIndex: 3,
                                pointerEvents: 'none',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => scrollProjects('left')}
                                    style={{
                                        pointerEvents: 'auto',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: '1.5px solid var(--border)',
                                        background: 'rgba(255,255,255,0.9)',
                                        color: 'var(--muted)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    }}
                                    aria-label="Scroll left"
                                >
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M15 18l-6-6 6-6"/>
                                    </svg>
                                </button>
                            </div>
                        )}
                        <div
                            ref={projectScrollRef}
                            onScroll={updateProjectScrollState}
                            style={{
                                flex: 1,
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                display: 'flex',
                                gap: '4px',
                                padding: '6px 0 6px 8px',
                                maskImage: 'linear-gradient(to right, transparent 0, black 8px, black calc(100% - 8px), transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 8px, black calc(100% - 8px), transparent 100%)',
                            }}
                        >
                            {products.map(p => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedId(p.id); setScopeToProduct(true) }}
                                        title={`Switch to ${p.code ?? p.name}`}
                                        style={{
                                            fontFamily: 'var(--font-ui)',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            letterSpacing: '0.04em',
                                            padding: '5px 14px',
                                            borderRadius: '7px',
                                            border: '1.5px solid var(--pill-active-border)',
                                            color: p.id === selectedId ? 'var(--pill-active-color)' : 'var(--text2)',
                                            background: p.id === selectedId ? 'var(--pill-active-bg)' : 'transparent',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all var(--transition)',
                                        }}
                                    >
                                        {p.code ?? p.name}
                                    </button>
                                    {p.id === selectedId && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setShowEditProduct(true) }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                border: '1.5px solid var(--border)',
                                                background: 'transparent',
                                                color: 'var(--muted)',
                                                cursor: 'pointer',
                                                padding: 0,
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {canScrollRight && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                zIndex: 3,
                                pointerEvents: 'none',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => scrollProjects('right')}
                                    style={{
                                        pointerEvents: 'auto',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        border: '1.5px solid var(--border)',
                                        background: 'rgba(255,255,255,0.9)',
                                        color: 'var(--muted)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    }}
                                    aria-label="Scroll right"
                                >
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M9 18l6-6-6-6"/>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        padding: '0 6px',
                    }}>
                        <button
                            type="button"
                            onClick={() => setShowAddProduct(true)}
                            style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '5px 14px',
                                borderRadius: '7px',
                                border: '1.5px dashed var(--border)',
                                color: 'var(--muted)',
                                background: 'transparent',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            + project
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Top right — help + settings + sign out ── */}
            <div style={{
                position: 'fixed',
                top: 'calc(var(--sp-lg) + var(--sat))',
                right: 'var(--sp-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-md)',
                zIndex: 20,
            }}>
                <button
                    onClick={() => setShowHelp(true)}
                    title="Help"
                    aria-label="Help"
                    style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(60,110,60,0.25)', borderRadius: '50%', cursor: 'pointer', color: 'var(--muted)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.5)'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.25)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.7)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </button>
                <Link
                    href="/settings"
                    title="Settings"
                    aria-label="Settings"
                    style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(60,110,60,0.25)', borderRadius: '50%', color: 'var(--muted)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.5)'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.25)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.7)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </Link>
                <button
                    onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/auth/login')
                    }}
                    title="Sign out"
                    aria-label="Sign out"
                    style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(60,110,60,0.25)', borderRadius: '50%', cursor: 'pointer', color: 'var(--muted)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.5)'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(60,110,60,0.25)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.7)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </button>
            </div>

            {/* ── Version ── */}
            <div style={{
                position: 'fixed',
                bottom: '14px',
                left: '20px',
                zIndex: 20,
                fontSize: 'var(--fs-version)',
                color: 'var(--muted)',
                pointerEvents: 'none',
            }}>
                Orb {VERSION}
            </div>

            {/* ── Modals ── */}
            {showHelp && <OrbHelp onClose={() => setShowHelp(false)} />}

            {showQueryResults && queryResults && (
                <QueryResultsModal
                    results={queryResults}
                    queryLabel={queryLabel}
                    onClose={() => setShowQueryResults(false)}
                    fullText={queryResults[0]?.id === 'full-text' ? lastOrbResponse : undefined}
                />
            )}

            <OrbDevPanel
                override={moodOverride}
                onChange={setMoodOverride}
                onSpeak={speech => { if (speech) addOrbMessage(speech.text) }}
                onSubmit={handleSubmit}
                dryRun={dryRun}
                onDryRunChange={setDryRun}
                messages={messages}
            />

            {showAddProduct && (
                <AddProductModal
                    onClose={() => setShowAddProduct(false)}
                    onCreated={project => {
                        setProducts(prev => [...prev, project])
                        setSelectedId(project.id)
                        setShowAddProduct(false)
                    }}
                />
            )}

            {showEditProduct && selected && (
                <AddProductModal
                    project={selected}
                    onClose={() => setShowEditProduct(false)}
                    onUpdated={updated => {
                        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
                        setShowEditProduct(false)
                    }}
                    onDeleted={id => {
                        setProducts(prev => prev.filter(p => p.id !== id))
                        setSelectedId(prev => prev === id ? (products.find(p => p.id !== id)?.id ?? null) : prev)
                        setShowEditProduct(false)
                    }}
                />
            )}

            {distillTodo && (
                <DistillModal 
                    todoId={distillTodo.id}
                    productId={distillTodo.productId}
                    initialTitle={distillTodo.suggestion.title}
                    initialContent={distillTodo.suggestion.content}
                    onClose={() => setDistillTodo(null)}
                    onSaved={() => {
                        setDistillTodo(null)
                        setPulse(true)
                        setTimeout(() => setPulse(false), 500)
                    }}
                />
            )}

            <style>{`
        @keyframes todos-orb-calm {
          0%, 100% { transform: scale(1);     border-radius: 50%; }
          50%      { transform: scale(1.025); border-radius: 50%; }
        }
        @keyframes todos-glow-calm {
          0%, 100% { transform: scale(1);    opacity: 0.92; }
          50%      { transform: scale(1.05); opacity: 1; }
        }
        @keyframes todos-orb-active {
          0%, 100% { transform: scale(1);     border-radius: 50% 50% 50% 50%; }
          33%      { transform: scale(1.04);  border-radius: 48% 52% 51% 49%; }
          66%      { transform: scale(1.025); border-radius: 51% 49% 48% 52%; }
        }
        @keyframes todos-glow-active {
          0%, 100% { transform: scale(1);    opacity: 0.88; }
          50%      { transform: scale(1.12); opacity: 1; }
        }
        @keyframes todos-orb-urgent {
          0%, 100% { transform: scale(1);     border-radius: 50%; }
          50%      { transform: scale(1.045); border-radius: 50%; }
        }
        @keyframes todos-glow-urgent {
          0%, 100% { transform: scale(1);    opacity: 0.85; }
          50%      { transform: scale(1.18); opacity: 1; }
        }
        @keyframes todos-flare-rise {
          0%, 55%  { transform: scaleY(0)    scaleX(0.5) skewX(0deg);   opacity: 0;    }
          68%      { transform: scaleY(0.5)  scaleX(1)   skewX(-2deg);  opacity: 0.85; }
          78%      { transform: scaleY(1)    scaleX(1.1) skewX(2deg);   opacity: 1;    }
          88%      { transform: scaleY(1.15) scaleX(0.7) skewX(-3deg);  opacity: 0.55; }
          96%      { transform: scaleY(1.3)  scaleX(0.3) skewX(3deg);   opacity: 0.15; }
          100%     { transform: scaleY(1.4)  scaleX(0.1) skewX(0deg);   opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-todos-orb], [data-todos-glow], [data-todos-flare] {
            animation: none !important;
          }
          [data-todos-flare] { opacity: 0; }
        }
      `}</style>
        </div>
        </>
    )
}
