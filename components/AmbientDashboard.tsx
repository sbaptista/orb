'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import AddProductModal from './AddProductModal'
import OrbHelp from './OrbHelp'
import OrbConversation, { type ConversationMessage } from './OrbConversation'
import { OrbDevPanel, DevTestError, type MoodOverride } from './OrbDevPanel'
import { orbConverse, orbGreeting, type OrbResponse } from '@/app/actions/orb-converse'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import DistillModal from './DistillModal'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import MuralCanvas from './MuralCanvas'
import HScrollNav from '@/components/ui/HScrollNav'
import { isActive } from '@/lib/status-groups'
import { computeUrgency, isDueWithinWarning, type Urgency } from '@/lib/orb-state'
import PrintModal from './PrintModal'

type Product  = { id: string; name: string; code: string | null; description: string | null; created_by: string }
type Todo     = { id: string; title: string; status: string; priority_value: number | null; due_at: string | null; product_id: string }
type Priority = { value: number; label: string; color: string; is_urgent: boolean }

type Props = { initialProducts?: Product[]; isAdmin?: boolean }

const LAST_PRODUCT_KEY  = 'todos_last_product_id'
const SS_INPUT          = 'todos_orb_input'
const SS_CONVERSATION   = 'todos_orb_conversation'
const INACTIVITY_MS     = 5 * 60 * 1000

function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}


const ORB_SPEED: Record<Urgency, string> = {
    calm:   '5.5s',
    busy:   '3.5s',
    urgent: '3.5s',
}

const ORB_GLOW: Record<Urgency, { inset: string; blur: string }> = {
    calm:   { inset: '-24px', blur: '28px' },
    busy:   { inset: '-38px', blur: '36px' },
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
    busy: {
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
    busy:   'todos-orb-busy',
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

export default function AmbientDashboard({ initialProducts, isAdmin = false }: Props) {
    const router   = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const toast    = useToast()

    const [priorities, setPriorities]             = useState<Priority[]>([])
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
    const [roleOverride, setRoleOverride]       = useState<'Super Admin' | 'Admin' | 'Owner' | null>(null)
    const [dryRun, setDryRun]                   = useState(false)
    const [showHelp, setShowHelp]               = useState(false)
    const [messages, setMessages]               = useState<ConversationMessage[]>([])
    const [conversationActive, setConversationActive] = useState(false)
    const [isRestored, setIsRestored]           = useState(false)
    const [scopeToProduct, setScopeToProduct]     = useState(true)
    const [distillTodo, setDistillTodo]           = useState<{ id: string; productId: string; title: string; suggestion: { title: string; content: string } } | null>(null)
    const [showPrint, setShowPrint]               = useState(false)
    const [devError, setDevError]                 = useState(false)
    const [isInputFocused, setIsInputFocused]     = useState(false)
    const [isMobile, setIsMobile]                 = useState(false)
    const [userName, setUserName]                 = useState<string>('')
    const [userFullName, setUserFullName]         = useState<string>('')
    const [isNewUser, setIsNewUser]               = useState(false)
    const [urgencyThreshold, setUrgencyThreshold] = useState<number>(0)
    const [releaseStage, setReleaseStage]         = useState<string>('pre-alpha')
    const welcomeDismissedRef                     = useRef(false)
    const [tick, setTick]                         = useState(0)
    const prevOverallUrgencyRef                   = useRef<Urgency | null>(null)
    const [orbFading,  setOrbFading]              = useState(false)
    const orbFadeRef                              = useRef<ReturnType<typeof setTimeout> | null>(null)

    if (devError) throw new DevTestError()

    useEffect(() => {
        setIsMobile(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
    }, [])

    // Fade the orb out briefly on mode switch to mask the transform-origin snap (ORB-156)
    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return }
        if (orbFadeRef.current) clearTimeout(orbFadeRef.current)
        setOrbFading(true)
        orbFadeRef.current = setTimeout(() => setOrbFading(false), 400)
        return () => { if (orbFadeRef.current) clearTimeout(orbFadeRef.current) }
    }, [conversationActive])

    const inactivityRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevSelectedId     = useRef<string | null>(null)
    const projectScrollRef   = useRef<HTMLDivElement>(null)
    const greetingFiredRef   = useRef(false)
    const prevUrgencyRef     = useRef<Urgency | null>(null)
    const orbLongPressRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
    const orbPressedRef      = useRef(false)
    const abortConverseRef      = useRef(false)
    const activeProcessingIdRef = useRef<string | null>(null)

    function resetInactivity() {
        if (inactivityRef.current) clearTimeout(inactivityRef.current)
        inactivityRef.current = setTimeout(() => {
            setConversationActive(false)
        }, INACTIVITY_MS)
    }

    const handleStop = useCallback(() => {
        abortConverseRef.current = true
        const activeId = activeProcessingIdRef.current
        if (activeId) {
            setMessages(prev => prev.map(m => {
                if (m.id === activeId) {
                    return {
                        ...m,
                        isStreaming: false,
                        text: m.text === 'Processing…' ? 'Stopped.' : m.text
                    }
                }
                return m
            }))
        }
        setSubmitting(false)
    }, [])

    function addOrbMessage(text: string) {
        setMessages(prev => [...prev, { id: genId(), type: 'orb', text }])
        setConversationActive(true)
        resetInactivity()
    }


    // Restore input and conversation on mount to prevent losing the session on navigation
    useEffect(() => {
        const savedConv = sessionStorage.getItem(SS_CONVERSATION)
        if (savedConv) {
            try {
                const parsed = JSON.parse(savedConv)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed)
                    setConversationActive(true)
                    greetingFiredRef.current = true
                }
            } catch (e) {
                console.error('Failed to restore conversation', e)
            }
        }
        const savedInput = sessionStorage.getItem(SS_INPUT)
        if (savedInput) setInput(savedInput)
        setIsRestored(true)
    }, [])

    // Persist conversation to sessionStorage
    useEffect(() => {
        if (!isRestored) return
        if (messages.length > 0) {
            sessionStorage.setItem(SS_CONVERSATION, JSON.stringify(messages))
        } else {
            sessionStorage.removeItem(SS_CONVERSATION)
        }
    }, [messages, isRestored])

    const orbSwitchingRef = useRef(false)
    const projectSwitchingRef = useRef(false)

    // Reset conversation on project switch (not on initial mount) + project summary
    useEffect(() => {
        if (prevSelectedId.current !== null && prevSelectedId.current !== selectedId) {
            projectSwitchingRef.current = true
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

    // Load products, restore last selected, and fetch profile + onboarding state sequentially
    useEffect(() => {
        async function load() {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (user) {
                    // Clear session storage if user changed or fresh login — prevents crossover and resets greeting
                    const savedUserId = sessionStorage.getItem('todos_user_id')
                    if (!savedUserId || savedUserId !== user.id) {
                        sessionStorage.removeItem(SS_CONVERSATION)
                        sessionStorage.removeItem(SS_INPUT)
                        if (savedUserId) {
                            setMessages([])
                            setConversationActive(false)
                        }
                        greetingFiredRef.current = false
                    }
                    sessionStorage.setItem('todos_user_id', user.id)

                    const { data: profile } = await supabase
                        .from('users')
                        .select('first_name, last_name, onboarded_at, urgency_threshold_hours, release_stage')
                        .eq('id', user.id)
                        .single()
                    const userWelcomeKey = `todos_welcome_shown_${user.id}`
                    if (profile) {
                        const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
                        setUserName(full || (user.email ?? ''))
                        setUserFullName(full)
                        setUrgencyThreshold(profile.urgency_threshold_hours ?? 0)
                        setReleaseStage(profile.release_stage ?? 'pre-alpha')
                        if (!profile.onboarded_at && !localStorage.getItem(userWelcomeKey)) {
                            setIsNewUser(true)
                        }
                    } else {
                        setUserName(user.email?.charAt(0).toUpperCase() ?? '?')
                        if (!localStorage.getItem(userWelcomeKey)) {
                            setIsNewUser(true)
                        }
                    }
                }

                if (initialProducts) {
                    // Data already available from server — just restore last-selected
                    if (initialProducts.length > 0) {
                        const last  = localStorage.getItem(LAST_PRODUCT_KEY)
                        const found = initialProducts.find(p => p.id === last)
                        setSelectedId(found ? found.id : initialProducts[0].id)
                    }
                    return
                }

                const q = visibleProjectsQuery(supabase, 'id, name, code, description, created_by')
                const { data } = user ? await q.eq('created_by', user.id) : await q
                const list = (data ?? []) as Product[]
                setProducts(list)
                if (list.length > 0) {
                    const last  = localStorage.getItem(LAST_PRODUCT_KEY)
                    const found = list.find(p => p.id === last)
                    setSelectedId(found ? found.id : list[0].id)
                }
            } catch (err) {
                console.error('[AmbientDashboard] Load failed:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, initialProducts])

    // Pre-fill welcome message once we have the user's first name
    useEffect(() => {
        if (!isNewUser || welcomeDismissedRef.current) return
        const firstName = userFullName ? (userFullName.split(' ')[0] || 'there') : 'there'
        const welcome = `Hi ${firstName}! I'm Orb. Thanks for joining the ${releaseStage || 'pre-alpha'}. Press Return or tap the send button → to get started.`
        setInput(prev => prev || welcome)
    }, [isNewUser, userFullName, releaseStage])

    useEffect(() => {
        async function fetchPriorities() {
            try {
                const { data } = await supabase.from('priorities').select('value, label, color, is_urgent').order('value')
                if (data) setPriorities(data)
            } catch (err) {
                console.error('[AmbientDashboard] Fetch priorities failed:', err)
            }
        }
        fetchPriorities()
    }, [supabase])

    const urgentValues = useMemo(() => new Set(priorities.filter(p => p.is_urgent).map(p => p.value)), [priorities])
    const priorityColorMap = useMemo(() => new Map(priorities.map(p => [p.value, p.color])), [priorities])

    // ── Proactive greeting on login (cross-project, once per mount) ──
    useEffect(() => {
        if (greetingFiredRef.current || !selectedId || isNewUser || messages.length > 0) return
        greetingFiredRef.current = true

        orbGreeting(null).then(text => {
            if (text) {
                setMessages([{ id: genId(), type: 'orb', text }])
                setConversationActive(true)
                resetInactivity()
            }
        }).catch(err => {
            console.error('[AmbientDashboard] Greeting check failed:', err)
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, isNewUser])

    // Derive display products based on owner filter
    const displayProducts = products

    // Reset selection when current project is hidden by filter
    useEffect(() => {
        if (selectedId && !displayProducts.find(p => p.id === selectedId)) {
            setSelectedId(displayProducts.length > 0 ? displayProducts[0].id : null)
        }
    }, [displayProducts, selectedId])

    const prevDisplayProductLen = useRef(displayProducts.length)
    const displayProductsRef = useRef(displayProducts)
    displayProductsRef.current = displayProducts

    // Auto-scroll to end when a project is added
    useEffect(() => {
        const el = projectScrollRef.current
        if (displayProducts.length > prevDisplayProductLen.current && el) {
            el.scrollLeft = el.scrollWidth
        }
        prevDisplayProductLen.current = displayProducts.length
    }, [displayProducts.length])

    const fetchTodos = useCallback(async () => {
        if (!selectedId) return
        try {
            const { data } = await supabase
                .from('todos')
                .select('id, title, status, priority_value, due_at')
                .eq('product_id', selectedId)
                .is('deleted_at', null)
            setTodos((data ?? []) as Todo[])
        } catch (err) {
            console.error('[AmbientDashboard] Fetch todos failed:', err)
        }
    }, [selectedId, supabase])

    useVisibilityRefetch(fetchTodos)

    useEffect(() => {
        if (!selectedId) return

        fetchTodos()
        localStorage.setItem(LAST_PRODUCT_KEY, selectedId)

        // ORB-132 fix: Removed postgres_changes Realtime subscription.
        // WAL reader was consuming 80%+ of DB query time (1M+ calls/day).
        // useVisibilityRefetch handles polling + tab-focus refetch instead.
    }, [selectedId, fetchTodos])

    // Sync the overall urgency ref when todos list updates or project switches
    useEffect(() => {
        getUrgencySnapshot().then(val => {
            if (val) prevOverallUrgencyRef.current = val
        }).catch(err => {
            console.error('[AmbientDashboard] Urgency snapshot failed:', err)
        })
    }, [todos])

    // Periodic check for time-based urgency transitions and push notifications
    useEffect(() => {
        const interval = setInterval(async () => {
            // Force a re-render to update the local selected project's urgency based on current time
            setTick(t => t + 1)

            try {
                // Check overall urgency escalation
                const currentOverall = await getUrgencySnapshot()
                if (!currentOverall) return // auth expired — skip silently
                if (prevOverallUrgencyRef.current) {
                    const SEVERITY: Record<Urgency, number> = { calm: 0, busy: 1, urgent: 2 }
                    const prevSev = SEVERITY[prevOverallUrgencyRef.current]
                    const currSev = SEVERITY[currentOverall]
                    if (currSev > prevSev) {
                        await notifyIfEscalated(prevOverallUrgencyRef.current)
                    }
                }
                prevOverallUrgencyRef.current = currentOverall
            } catch (err) {
                console.error('[AmbientDashboard] Urgency check failed:', err)
            }
        }, 60000) // every 60 seconds

        return () => clearInterval(interval)
    }, [])

    const activeTodos = todos.filter(t => isActive(t.status))
    const urgency   = moodOverride ?? computeUrgency(todos, urgentValues, urgencyThreshold)
    const style     = ORB_STYLE[urgency]
    const speed     = ORB_SPEED[urgency]
    const selected  = products.find(p => p.id === selectedId)
    const noProject = !selectedId

    // ── Project switch summary (client-side, no AI call) ──
    // Depends only on `todos` — NOT `selectedId`. The selectedId effect sets
    // projectSwitchingRef=true, then fetchTodos runs async. When the fetch
    // completes and todos updates, this effect fires with the correct data.
    // Including selectedId would fire this with stale todos from the previous project.
    useEffect(() => {
        if (!projectSwitchingRef.current || noProject || todos.length === 0 && activeTodos.length === 0) return
        if (!selected) return
        projectSwitchingRef.current = false

        const active = activeTodos
        const urgentCount = active.filter(t => 
            (t.priority_value !== null && urgentValues.has(t.priority_value)) ||
            (t.due_at !== null && isDueWithinWarning(t.due_at, urgencyThreshold))
        ).length
        const inProgressCount = active.filter(t => t.status === 'in progress').length

        const parts: string[] = []
        parts.push(`${selected.code ?? selected.name} — ${active.length} active`)
        if (urgentCount > 0) parts.push(`${urgentCount} urgent`)
        if (inProgressCount > 0) parts.push(`${inProgressCount} in progress`)
        else if (active.length >= 3) parts.push('nothing in progress')

        const summary = parts.join('. ') + '.'
        addOrbMessage(summary)
        prevUrgencyRef.current = urgency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todos])

    // ── Urgency transition explanation (suppressed during project switch) ──
    useEffect(() => {
        if (noProject || prevUrgencyRef.current === null) {
            prevUrgencyRef.current = urgency
            return
        }
        if (projectSwitchingRef.current) {
            prevUrgencyRef.current = urgency
            return
        }
        const prev = prevUrgencyRef.current
        if (prev === urgency) return
        prevUrgencyRef.current = urgency

        const urgentCount = activeTodos.filter(t => 
            (t.priority_value !== null && urgentValues.has(t.priority_value)) ||
            (t.due_at !== null && isDueWithinWarning(t.due_at, urgencyThreshold))
        ).length
        let explanation = ''
        if (prev === 'calm' && urgency === 'busy') {
            explanation = `Orb shifted busy — ${activeTodos.length} active tasks now.`
        } else if (prev === 'calm' && urgency === 'urgent') {
            explanation = `Orb shifted urgent — ${urgentCount} urgent task${urgentCount !== 1 ? 's' : ''} detected.`
        } else if (prev === 'busy' && urgency === 'urgent') {
            explanation = `Orb shifted urgent — ${urgentCount} urgent task${urgentCount !== 1 ? 's' : ''} in the queue.`
        } else if (prev === 'urgent' && urgency === 'busy') {
            explanation = 'Urgent queue cleared. Orb shifted back to busy.'
        } else if (prev === 'urgent' && urgency === 'calm') {
            explanation = 'Backlog is light. Orb is calm.'
        } else if (prev === 'busy' && urgency === 'calm') {
            explanation = 'Backlog thinned out. Orb is calm.'
        }

        if (explanation) {
            addOrbMessage(explanation)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urgency, noProject])

    const NO_PROJECT_STYLE = {
        orbMid: '#d4dce4', orbLo: '#c0ccd8',
        glow: 'rgba(100,140,180,0.3)',
        countColor: '#3a5a7a', labelColor: '#7a9aaa',
    }

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
                const list = displayProductsRef.current
                setSelectedId(current => {
                    if (!current || list.length <= 1) return current
                    const idx  = list.findIndex(p => p.id === current)
                    if (idx === -1) return list[0]?.id ?? current
                    const next = e.key === 'ArrowLeft'
                        ? (idx - 1 + list.length) % list.length
                        : (idx + 1) % list.length
                    return list[next].id
                })
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [products])

    // Handle welcome submission — fires hardcoded onboarding reply, free (no Claude call)
    function handleWelcomeSubmit(text: string) {
        welcomeDismissedRef.current = true
        setIsNewUser(false)
        setInput('')
        sessionStorage.removeItem(SS_INPUT)
        // Mark onboarding complete in DB and set user-specific welcome key
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                localStorage.setItem(`todos_welcome_shown_${user.id}`, '1')
                supabase.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id).then(() => {})
            }
        })
        setMessages(prev => [
            ...prev,
            { id: genId(), type: 'user', text },
            { id: genId(), type: 'orb', text: `Here's how to get started:

• Add a task: "Add task: review the onboarding flow"
• See your list: "Show my active tasks"
• Create a project: "Create a project called Work"

A couple of things to be aware of: your projects and tasks are visible to the developer (Stan) for troubleshooting and improvement purposes — please don't store anything confidential here. Also, Orb is under active development, so features may change and access isn't guaranteed long-term.

If you run into a bug or have a suggestion, just tell me — I'll log it automatically. You can also say things like "I have a suggestion" or "something's broken" and I'll capture it.

Type /? anytime for a full command list. What would you like to work on?` },
        ])
        setConversationActive(true)
        resetInactivity()
    }

    async function handleSubmit(value?: string) {
        const text = (value ?? input).trim()
        if (!text || submitting) return

        // Intercept the welcome message before anything else
        if (isNewUser && !welcomeDismissedRef.current) {
            handleWelcomeSubmit(text)
            return
        }

        if (text === '?' || text === '/?') {
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
            } else if (cmd === '/help' || cmd === '/?') {
                setShowHelp(true)
            } else if (cmd === '/clear') {
                setMessages([])
                setConversationActive(false)
                sessionStorage.removeItem(SS_CONVERSATION)
            } else if (cmd === '/add') {
                const task = args.join(' ').trim()
                if (!task) {
                    toast.neutral('Usage: /add Buy groceries')
                    return
                }
                handleSubmit(`Add a todo: ${task}`)
            } else if (cmd === '/close') {
                const task = args.join(' ').trim()
                if (!task) {
                    toast.neutral('Usage: /close ORB-12')
                    return
                }
                handleSubmit(`Close ${task}`)
            } else if (cmd === '/create') {
                const name = args.join(' ').trim()
                if (!name) {
                    toast.neutral('Usage: /create Project Name')
                    return
                }
                handleSubmit(`Create a project called "${name}"`)
            } else if (cmd === '/drop') {
                const target = args.join(' ').trim()
                if (!target) {
                    toast.neutral('Usage: /drop [project code]')
                    return
                }
                const t = products.find(p =>
                    p.code?.toUpperCase() === target.toUpperCase() ||
                    p.name.toUpperCase() === target.toUpperCase()
                )
                if (!t) {
                    toast.neutral(`Project "${target}" not found.`)
                    return
                }
                handleSubmit(`Delete the project ${t.code ?? t.name}`)
            } else if (cmd === '/edit') {
                const target = args.join(' ').trim()
                if (target) {
                    const t = products.find(p =>
                        p.code?.toUpperCase() === target.toUpperCase() ||
                        p.name.toUpperCase() === target.toUpperCase()
                    )
                    if (t) {
                        setSelectedId(t.id)
                        setShowEditProduct(true)
                    } else {
                        toast.neutral(`Project "${target}" not found.`)
                    }
                } else {
                    if (!selectedId) {
                        toast.neutral('Add a project first.')
                        return
                    }
                    setShowEditProduct(true)
                }
            } else if (cmd === '/switch') {
                const target = args.join(' ').trim()
                if (!target) {
                    toast.neutral('Usage: /switch [project code]')
                    return
                }
                const t = products.find(p =>
                    p.code?.toUpperCase() === target.toUpperCase() ||
                    p.name.toUpperCase() === target.toUpperCase()
                )
                if (t) setSelectedId(t.id)
                else toast.neutral(`Project "${target}" not found.`)
            } else {
                toast.neutral(`Unknown command: ${cmd}`)
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

        abortConverseRef.current = false
        activeProcessingIdRef.current = processingId

        try {
            const stream = await orbConverse({ input: text, productId: selectedId, scopeToProduct, history, dryRun })
            
            for await (const chunk of readStreamableValue(stream)) {
                if (abortConverseRef.current) break
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

                if (chunk.refresh) {
                    setPulse(true)
                    setTimeout(() => setPulse(false), 420)
                    if (chunk.mutationType === 'dormancy') {
                        const { data: { user: authUser } } = await supabase.auth.getUser()
                        const dq = visibleProjectsQuery(supabase, 'id, name, code, description, created_by')
                        const { data: freshProjects } = authUser ? await dq.eq('created_by', authUser.id) : await dq
                        const list = (freshProjects ?? []) as Product[]
                        setProducts(list)
                        if (list.length > 0 && !list.find(p => p.id === selectedId)) {
                            setSelectedId(list[0].id)
                        }
                    } else if (chunk.mutationType === 'project_create' && chunk.newProject) {
                        setProducts(prev => [...prev, chunk.newProject!])
                        orbSwitchingRef.current = true
                        setSelectedId(chunk.newProject.id)
                        toast.success('Project created.')
                    } else {
                        if (chunk.mutatedProductId === selectedId) fetchTodos()
                        if (chunk.mutationType === 'create') toast.success('Todo created.')
                        else if (chunk.mutationType === 'update') toast.success('Todo saved.')
                        else if (chunk.mutationType === 'delete') toast.success('Todo deleted.')
                        else toast.success('Todo updated.')
                    }
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
                    } else if (action.action === 'check_update') {
                        try {
                            const res = await fetch('/api/version')
                            const data = await res.json()
                            const { VERSION } = await import('@/lib/version')
                            if (data.version && data.version !== VERSION) {
                                toast.success(`Update available: ${data.version} (you have ${VERSION})`)
                            } else {
                                toast.success(`You're up to date (${VERSION})`)
                            }
                        } catch {
                            toast.error('Could not check for updates')
                        }
                    } else if (action.action === 'apply_update') {
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(regs => { for (const r of regs) r.update() })
                        }
                        window.location.reload()
                    }
                }

                if (chunk.suggestedKnowledge) {
                    setDistillTodo(chunk.suggestedKnowledge)
                }
            }
        } catch (err) {
            console.error('[orbSubmit]', err)
            if (isAuthError(String(err))) {
                handleSessionExpired(toast)
                return
            }
            if (!abortConverseRef.current) {
                setMessages(prev => prev.map(m => m.id === processingId
                    ? { ...m, text: 'Something went wrong. Try again?' }
                    : m
                ))
            }
        } finally {
            setSubmitting(false)
            activeProcessingIdRef.current = null
            if (abortConverseRef.current) {
                setMessages(prev => prev.map(m => {
                    if (m.id === processingId) {
                        return {
                            ...m,
                            isStreaming: false,
                            text: m.text === 'Processing…' ? 'Stopped.' : m.text
                        }
                    }
                    return m
                }))
            }
        }
    }

    const orbScale     = (isInputFocused && isMobile) ? 0.45 : 1.0

    if (loading) return (
        <div className="dash-loading">
            <p className="text-sm text-muted">Loading…</p>
        </div>
    )



    const orbElement = (
            <div className="dash-orb-wrap" data-mode={conversationActive ? 'dialogue' : 'ambient'}>
                <div
                    onClick={() => {
                        if (orbPressedRef.current) return
                        if (noProject) {
                            toast.neutral('Add a project to get started.')
                        } else {
                            router.push(`/dashboard/${selectedId}`)
                        }
                    }}
                    onPointerDown={() => {
                        orbPressedRef.current = false
                        orbLongPressRef.current = setTimeout(() => {
                            orbPressedRef.current = true
                            if (conversationActive) {
                                setConversationActive(false)
                                if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
                            }
                        }, 500)
                    }}
                    onPointerUp={() => {
                        if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null }
                    }}
                    onPointerCancel={() => {
                        if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null }
                    }}
                    title={noProject ? 'Add a project to get started' : 'Tap to view list · hold to return to ambient'}
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
                        transformOrigin: 'top center',
                        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
                        opacity: orbFading ? 0 : 1,
                        WebkitTouchCallout: 'none',
                        userSelect: 'none',
                    }}
                    aria-label={noProject ? 'No project selected — add a project to get started' : `${activeTodos.length} active todos — tap to view list, long press to return to ambient`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (noProject) {
                                toast.neutral('Add a project to get started.')
                            } else {
                                router.push(`/dashboard/${selectedId}`)
                            }
                        }
                    }}
                >
                    {/* Glow */}
                    <div data-todos-glow style={{
                        position: 'absolute',
                        inset: noProject ? '-18px' : ORB_GLOW[urgency].inset,
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 40% 35%, ${noProject ? NO_PROJECT_STYLE.glow : style.glow}, transparent 70%)`,
                        filter: `blur(${noProject ? '20px' : ORB_GLOW[urgency].blur})`,
                        animation: noProject ? 'none' : `todos-glow-${urgency} ${speed} ease-in-out infinite`,
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
                        background: `radial-gradient(circle at 36% 30%, #ffffff, ${noProject ? NO_PROJECT_STYLE.orbMid : style.orbMid} 45%, ${noProject ? NO_PROJECT_STYLE.orbLo : style.orbLo} 82%)`,
                        boxShadow: `0 8px 32px ${noProject ? NO_PROJECT_STYLE.glow : style.glow}, 0 2px 8px rgba(0,0,0,0.06), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 2px 8px rgba(255,255,255,0.9)`,
                        animation: noProject ? 'none' : `${ORB_ANIMATION[urgency]} ${speed} ease-in-out infinite`,
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
                                fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor}
                                style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
                            >
                                <textPath href="#todos-orb-name-arc" startOffset="50%" textAnchor="middle">
                                    {noProject ? 'WAITING' : (() => {
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
                                fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor}
                                style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
                            >
                                <textPath href="#todos-orb-state-arc" startOffset="50%" textAnchor="middle">
                                    {noProject ? 'SET UP' : urgency.toUpperCase()}
                                </textPath>
                            </text>
                        </svg>
                        <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'var(--fs-orb)',
                            fontWeight: 300,
                            color: noProject ? NO_PROJECT_STYLE.countColor : style.countColor,
                            letterSpacing: '-1px',
                            lineHeight: 1,
                            transition: 'color 0.8s',
                        }}>
                            {noProject ? '—' : activeTodos.length}
                        </span>
                        <span style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 400,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor,
                            transition: 'color 0.8s',
                        }}>
                            {noProject ? 'no project' : 'active'}
                        </span>
                    </div>
                </div>
            </div>
    )

    return (
        <>
        <MuralCanvas key={selectedId} urgency={urgency} />
        <div className="dash-main">

            {/* ── Star Wars fade mask ── */}
            <div className="dash-fade" />

            {/* ── Conversation outer ── */}
            <div className="dash-conversation">
                <OrbConversation
                    orbElement={orbElement}
                    messages={messages}
                    input={input}
                    submitting={submitting}
                    productCode={selected?.code ?? selected?.name ?? ''}
                    products={products}
                    scopeToProduct={scopeToProduct}
                    conversationActive={conversationActive}
                    onRestoreConversation={() => setConversationActive(true)}
                    onClearTranscript={() => { setMessages([]); setConversationActive(false); sessionStorage.removeItem(SS_CONVERSATION) }}
                    onInputChange={v => { setInput(v); sessionStorage.setItem(SS_INPUT, v) }}
                    onSubmit={handleSubmit}
                    onStop={handleStop}
                    onScopeChange={v => setScopeToProduct(v)}
                    onFocusChange={setIsInputFocused}
                    onSelectProject={id => { setSelectedId(id); setScopeToProduct(true) }}
                    selectedProjectId={selectedId}
                    onShowEditProject={() => setShowEditProduct(true)}
                    onShowAddProject={() => setShowAddProduct(true)}
                    projectStrip={
                        <div className="dash-strip">
                            <div className="dash-strip-inner" style={displayProducts.length === 0 ? { justifyContent: 'center' } : undefined}>
                                {displayProducts.length > 0 && (
                                    <HScrollNav scrollRef={projectScrollRef as React.RefObject<HTMLElement>}>
                                        <div
                                            ref={projectScrollRef}
                                            onScroll={() => {}}
                                            className="dash-strip-scroll"
                                        >
                                            {displayProducts.map(p => (
                                                <div key={p.id} className="dash-strip-item">
                                                    <button
                                                        type="button"
                                                        className="dash-strip-pill"
                                                        aria-current={p.id === selectedId ? 'true' : undefined}
                                                        onClick={() => { setSelectedId(p.id); setScopeToProduct(true) }}
                                                        title={`Switch to ${p.code ?? p.name}`}
                                                    >
                                                        {p.code ?? p.name}
                                                    </button>
                                                    {p.id === selectedId && (
                                                        <button
                                                            type="button"
                                                            className="edit-btn"
                                                            onClick={(e) => { e.stopPropagation(); setShowEditProduct(true) }}
                                                            title="Edit project"
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </HScrollNav>
                                )}
                                <div className="dash-strip-actions">
                                    <button
                                        type="button"
                                        className="edit-btn"
                                        onClick={() => setShowAddProduct(true)}
                                        title="Add a new project"
                                        aria-label="Add a new project"
                                        style={displayProducts.length === 0 ? { borderColor: '#ED7654', color: '#ED7654' } : undefined}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    }
                />
            </div>

            {/* ── Top right — help + settings + account ── */}
            <div className="dash-nav" data-mode={conversationActive ? 'dialogue' : 'ambient'}>
                {noProject ? (
                    <button
                        className="nav-btn"
                        disabled
                        title="List"
                        aria-label="List"
                    >
                        <span className="nav-btn-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <line x1="15" y1="3" x2="15" y2="21" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                            </svg>
                        </span>
                        <span className="nav-btn-label">List</span>
                    </button>
                ) : (
                    <Link
                        href={`/dashboard/${selectedId}`}
                        className="nav-btn"
                        title="List"
                        aria-label="List"
                    >
                        <span className="nav-btn-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <line x1="15" y1="3" x2="15" y2="21" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                            </svg>
                        </span>
                        <span className="nav-btn-label">List</span>
                    </Link>
                )}
                <button
                    className="nav-btn"
                    onClick={() => setShowPrint(true)}
                    title="Print"
                    aria-label="Print"
                >
                    <span className="nav-btn-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                    </span>
                    <span className="nav-btn-label">Print</span>
                </button>
                <button
                    className="nav-btn"
                    onClick={() => setShowHelp(true)}
                    title="Help"
                    aria-label="Help"
                >
                    <span className="nav-btn-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </span>
                    <span className="nav-btn-label">Help</span>
                </button>
                <Link
                    href="/settings"
                    className="nav-btn"
                    title="Settings"
                    aria-label="Settings"
                >
                    <span className="nav-btn-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </span>
                    <span className="nav-btn-label">Settings</span>
                </Link>
                <button
                    className="nav-btn"
                    onClick={() => router.push('/account')}
                    title="Account"
                    aria-label="Account"
                >
                    <span className="nav-btn-icon" style={{ fontWeight: 600, fontSize: '14px' }}>{userName.charAt(0).toUpperCase()}</span>
                    <span className="nav-btn-label">Account</span>
                </button>
            </div>

            {/* ── Version ── */}
            <OrbVersionLabel as="div" className="dash-version" />

            {/* ── Modals ── */}
            {showHelp && <OrbHelp onClose={() => setShowHelp(false)} />}

            {showPrint && (
                <PrintModal
                    onClose={() => setShowPrint(false)}
                    selectedProductId={selectedId}
                    selectedProductName={selected?.name ?? null}
                />
            )}

            <OrbDevPanel
                override={moodOverride}
                onChange={setMoodOverride}
                roleOverride={roleOverride}
                onRoleOverrideChange={setRoleOverride}
                onSpeak={speech => { if (speech) addOrbMessage(speech.text) }}
                onSubmit={handleSubmit}
                dryRun={dryRun}
                onDryRunChange={setDryRun}
                messages={messages}
                onForceQuiet={() => setConversationActive(false)}
                onErrorTest={() => setDevError(true)}
            />

            {showAddProduct && (
                <AddProductModal
                    ownerId={null}
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
        @keyframes todos-orb-busy {
          0%, 100% { transform: scale(1);     border-radius: 50% 50% 50% 50%; }
          33%      { transform: scale(1.04);  border-radius: 48% 52% 51% 49%; }
          66%      { transform: scale(1.025); border-radius: 51% 49% 48% 52%; }
        }
        @keyframes todos-glow-busy {
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
