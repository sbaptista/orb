'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { useRouter } from 'next/navigation'
// Link removed — global nav moved to AppNav
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import AddProductModal from './AddProductModal'
import AppNav from './AppNav'
import OrbHelp from './OrbHelp'
import OrbConversation, { type ConversationMessage } from './OrbConversation'
import { OrbDevPanel, DevTestError, type MoodOverride } from './OrbDevPanel'
import { orbConverse, orbGreeting, type OrbResponse } from '@/app/actions/orb-converse'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { checkReminders } from '@/app/actions/reminder-actions'
import { fetchPendingDevMessages, markDevMessageDelivered, processDevMessage, purgeOldDevMessages } from '@/app/actions/dev-channel'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import DistillModal from './DistillModal'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import MuralCanvas from './MuralCanvas'
// HScrollNav removed — project strip eliminated
import { isActive, ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import { computeUrgency, isDueWithinWarning, type Urgency } from '@/lib/orb-state'
// PrintModal moved to AppNav
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import { logAudit } from '@/app/actions/log-audit'
import { updateTicketStatus } from '@/app/actions/ticket-actions'
import DragDivider from './DragDivider'
import TaskListView from './views/TaskListView'
import TaskChecklistView from './views/TaskChecklistView'
import TaskKanbanView from './views/TaskKanbanView'
import ViewSwitcher, { type ViewMode } from './views/ViewSwitcher'

// ── Types ──

type Product = {
  id: string; name: string; code: string | null; description?: string | null
  created_by?: string; color?: string | null; icon?: string | null; view_mode?: ViewMode
}

type Todo = {
  id: string; product_id: string; group_id: string | null; category_id: string | null
  priority_value: number | null; todo_number: number | null; title: string
  description: string | null; resolution_notes: string | null; status: string
  urls: string[]; sort_order: number; created_at: string; closed_at: string | null
  ticket_id: string | null; groups: { name: string } | null; categories: { name: string } | null
  due_at: string | null; reminded_at: string | null
}

type Priority   = { value: number; label: string; color?: string; is_urgent?: boolean }
type StatusDef  = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }
type ResolvedUser = { id: string; email: string; first_name: string; last_name: string }
type AdminProject = { id: string; name: string; code: string | null; owner_name: string }

type Props = {
  initialProducts?: Product[]
  isAdmin?: boolean
  user?: ResolvedUser | null
}

// ── Constants ──

const LAST_PRODUCT_KEY  = 'todos_last_product_id'
const SS_INPUT          = 'todos_orb_input'
const SS_CONVERSATION   = 'todos_orb_conversation'
const INACTIVITY_MS     = 5 * 60 * 1000
const PAGE_SIZE         = 40

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseLocalDatetime(str: string): Date {
  const [datePart, timePart] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

const ORB_SPEED: Record<Urgency, string> = { calm: '5.5s', busy: '3.5s', urgent: '3.5s' }

const ORB_GLOW: Record<Urgency, { inset: string; blur: string }> = {
  calm:   { inset: '-24px', blur: '28px' },
  busy:   { inset: '-38px', blur: '36px' },
  urgent: { inset: '-56px', blur: '46px' },
}

const ORB_STYLE: Record<Urgency, { orbMid: string; orbLo: string; glow: string; countColor: string; labelColor: string }> = {
  calm:   { orbMid: '#d4e4d4', orbLo: '#b8d0b8', glow: 'rgba(80,130,80,0.38)', countColor: '#2d5a2d', labelColor: '#7a9e7a' },
  busy:   { orbMid: '#e4daf4', orbLo: '#d0c4ee', glow: 'rgba(130,90,200,0.45)', countColor: '#5a3090', labelColor: '#9a7ac8' },
  urgent: { orbMid: '#f8ead8', orbLo: '#f0d4b0', glow: 'rgba(230,130,55,0.6)', countColor: '#a05010', labelColor: '#c88040' },
}

const ORB_ANIMATION: Record<Urgency, string> = { calm: 'todos-orb-calm', busy: 'todos-orb-busy', urgent: 'todos-orb-urgent' }

const NO_PROJECT_STYLE = {
  orbMid: '#d4dce4', orbLo: '#c0ccd8', glow: 'rgba(100,140,180,0.3)', countColor: '#3a5a7a', labelColor: '#7a9aaa',
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

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════

export default function UnifiedDashboard({ initialProducts, isAdmin = false, user }: Props) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const toast    = useToast()

  // ── Shared state ──
  const [products, setProducts]       = useState<Product[]>(initialProducts ?? [])
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [isMobile, setIsMobile]       = useState(false)
  const [daysActive, setDaysActive]   = useState<number>(0)
  const [activeMobileTab, setActiveMobileTab] = useState<'orb' | 'list'>('list')

  // ── Orb / conversation state ──
  const [priorities, setPriorities]             = useState<Priority[]>([])
  const [orbTodos, setOrbTodos]                 = useState<{ id: string; title: string; status: string; priority_value: number | null; due_at: string | null; product_id: string }[]>([])
  const [input, setInput]                       = useState('')
  const [submitting, setSubmitting]             = useState(false)
  const [messages, setMessages]                 = useState<ConversationMessage[]>([])
  const [conversationActive, setConversationActive] = useState(false)
  const [isRestored, setIsRestored]             = useState(false)
  // scopeToProduct removed (ORB-203) — query scope is always global, mutations default to selected project
  const [moodOverride, setMoodOverride]         = useState<MoodOverride>(null)
  const [roleOverride, setRoleOverride]         = useState<'Super Admin' | 'Admin' | 'Owner' | null>(null)
  const [dryRun, setDryRun]                     = useState(false)
  const [isInputFocused, setIsInputFocused]     = useState(false)
  const [userName, setUserName]                 = useState<string>('')
  const [userFullName, setUserFullName]         = useState<string>('')
  const [isNewUser, setIsNewUser]               = useState(false)
  const [urgencyThreshold, setUrgencyThreshold] = useState<number>(0)
  const [releaseStage, setReleaseStage]         = useState<string>('pre-alpha')
  const [orbFading, setOrbFading]               = useState(false)
  const [pulse, setPulse]                       = useState(false)

  // ── List state ──
  const [todos, setTodos]               = useState<Todo[]>([])
  const [statuses, setStatuses]         = useState<StatusDef[]>([])
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showFilters, setShowFilters]   = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showNewTodo, setShowNewTodo]   = useState(false)
  const [selectedIds, setSelectedIds]   = useState<string[]>([])
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [sortAsc, setSortAsc]           = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showListViews, setShowListViews] = useState(false)
  const [page, setPage]                 = useState(0)
  const [hasMore, setHasMore]           = useState(false)
  const [listLoading, setListLoading]   = useState(true)
  const [hoveredId, setHoveredId]       = useState<string | null>(null)

  // ── Modal state ──
  const [showHelp, setShowHelp]             = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showEditProduct, setShowEditProduct] = useState(false)
  const [distillTodo, setDistillTodo]       = useState<any>(null)
  const [devError, setDevError]             = useState(false)

  if (devError) throw new DevTestError()

  // ── Project switcher state ──
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([])
  const [projectsLoadError, setProjectsLoadError] = useState(false)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // commandsModalOpen removed — AppNav handles global commands modal

  // ── Panel visibility ──
  const [orbPaneVisible, setOrbPaneVisible] = useState(true)
  const [listPaneVisible, setListPaneVisible] = useState(true)

  // ── Split pane state ──
  const [orbPaneSize, setOrbPaneSize] = useState<number | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)

  // ── Refs ──
  const inactivityRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSelectedId         = useRef<string | null>(null)
  const greetingFiredRef       = useRef(false)
  const prevUrgencyRef         = useRef<Urgency | null>(null)
  const lastUrgencyMsgRef      = useRef<number>(0)
  const prevOverallUrgencyRef  = useRef<Urgency | null>(null)
  const orbLongPressRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orbPressedRef          = useRef(false)
  const abortConverseRef       = useRef(false)
  const activeProcessingIdRef  = useRef<string | null>(null)
  const welcomeDismissedRef    = useRef(false)
  const orbFadeRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orbSwitchingRef        = useRef(false)
  const projectSwitchingRef    = useRef(false)
  const listInitialLoadDone    = useRef(false)
  const [tick, setTick]        = useState(0)

  // ── Derived ──
  const selected     = products.find(p => p.id === selectedId)
  const noProject    = !selectedId
  const urgentValues = useMemo(() => new Set(priorities.filter(p => p.is_urgent).map(p => p.value)), [priorities])
  const urgency      = moodOverride ?? computeUrgency(orbTodos, urgentValues, urgencyThreshold)
  const style        = ORB_STYLE[urgency]
  const speed        = ORB_SPEED[urgency]
  const activeTodos  = orbTodos.filter(t => isActive(t.status))

  const closedNames  = useMemo(() => new Set(statuses.filter(s => s.is_closed).map(s => s.name)), [statuses])
  const isClosed     = useCallback((status: string) => closedNames.has(status), [closedNames])
  const statusColor  = useCallback((status: string) => `var(--status-${status.replace(/\s+/g, '-')})`, [])
  const productCodeMap = useMemo(() => new Map(products.map(p => [p.id, p.code])), [products])

  const adminSearchResults = useMemo(() => {
    if (!projectSearchQuery.trim()) return adminProjects
    const q = projectSearchQuery.trim().toLowerCase()
    return adminProjects.filter(p =>
      p.name.toLowerCase().includes(q) || (p.code?.toLowerCase().includes(q)) || p.owner_name.toLowerCase().includes(q)
    )
  }, [adminProjects, projectSearchQuery])

  const handleSearchFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setProjectSearchOpen(true)
  }, [])

  const handleSearchBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => setProjectSearchOpen(false), 200)
  }, [])

  const displayUserName = user?.first_name || user?.email || userName || '?'

  // ══════════════════════════════════════════════════════════
  // EFFECTS — Shared
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    setIsMobile(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // Restore split ratio from localStorage
  useEffect(() => {
    try {
      const key = isMobile ? 'orb_split_ratio_mobile' : 'orb_split_ratio'
      const saved = localStorage.getItem(key)
      if (saved) {
        setOrbPaneSize(parseFloat(saved))
      } else {
        setOrbPaneSize(null)
      }
    } catch { /* ignore */ }
  }, [isMobile])

  // Fetch all projects with owner names for search dropdown (retry up to 2×, fallback to props)
  useEffect(() => {
    async function loadAllProjects(attempt = 0): Promise<void> {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, code, is_dormant, users!created_by(first_name, last_name)')
          .eq('is_dormant', false)
          .order('name')
        if (error) throw error
        const list: AdminProject[] = ((data ?? []) as any[]).map(p => ({
          id: p.id, name: p.name, code: p.code,
          owner_name: p.users ? [p.users.first_name, p.users.last_name].filter(Boolean).join(' ') : 'Unknown',
        }))
        if (list.length === 0 && attempt < 2) {
          await new Promise(r => setTimeout(r, 1500))
          return loadAllProjects(attempt + 1)
        }
        if (list.length > 0) {
          setAdminProjects(list)
          setProjectsLoadError(false)
        } else {
          // All retries exhausted — fallback to server-provided products
          const fallback: AdminProject[] = (initialProducts ?? []).map(p => ({
            id: p.id, name: p.name, code: p.code ?? null, owner_name: '',
          }))
          setAdminProjects(fallback)
          setProjectsLoadError(true)
          console.error('[UnifiedDashboard] Project search returned 0 results after retries')
          // Log a ticket
          supabase.from('todos').insert({
            title: '[Auto] Project search returned empty results',
            description: `UnifiedDashboard loadAllProjects returned 0 rows after 3 attempts. User agent: ${navigator.userAgent}. Time: ${new Date().toISOString()}.`,
            product_id: 'f643f732-73b5-4bee-96be-da36197fb41c', // TICKETS project
            status: 'open',
          }).then(({ error: ticketErr }) => {
            if (ticketErr) console.error('[UnifiedDashboard] Failed to create ticket:', ticketErr)
          })
        }
      } catch (err) {
        console.error('[UnifiedDashboard] Load all projects failed:', err)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500))
          return loadAllProjects(attempt + 1)
        }
        // Fallback to server-provided products
        const fallback: AdminProject[] = (initialProducts ?? []).map(p => ({
          id: p.id, name: p.name, code: p.code ?? null, owner_name: '',
        }))
        setAdminProjects(fallback)
        setProjectsLoadError(true)
        // Log a ticket
        supabase.from('todos').insert({
          title: '[Auto] Project search query failed',
          description: `UnifiedDashboard loadAllProjects threw after 3 attempts. Error: ${err}. User agent: ${navigator.userAgent}. Time: ${new Date().toISOString()}.`,
          product_id: 'f643f732-73b5-4bee-96be-da36197fb41c',
          status: 'open',
        }).then(({ error: ticketErr }) => {
          if (ticketErr) console.error('[UnifiedDashboard] Failed to create ticket:', ticketErr)
        })
      }
    }
    loadAllProjects()
  }, [supabase, initialProducts])

  // ══════════════════════════════════════════════════════════
  // EFFECTS — Orb / Conversation
  // ══════════════════════════════════════════════════════════

  function resetInactivity() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(() => setConversationActive(false), INACTIVITY_MS)
  }

  function addOrbMessage(text: string) {
    setMessages(prev => {
      // Deduplicate: don't repeat the same message if it's the last orb message
      const lastOrb = [...prev].reverse().find(m => m.type === 'orb')
      if (lastOrb && lastOrb.text === text) return prev
      return [...prev, { id: genId(), type: 'orb', text }]
    })
    setConversationActive(true)
    resetInactivity()
  }

  const handleStop = useCallback(() => {
    abortConverseRef.current = true
    const activeId = activeProcessingIdRef.current
    if (activeId) {
      setMessages(prev => prev.map(m => {
        if (m.id === activeId) return { ...m, isStreaming: false, text: m.text === 'Processing…' ? 'Stopped.' : m.text }
        return m
      }))
    }
    setSubmitting(false)
  }, [])

  // Restore conversation on mount
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
      } catch { /* ignore */ }
    }
    const savedInput = sessionStorage.getItem(SS_INPUT)
    if (savedInput) setInput(savedInput)
    setIsRestored(true)
  }, [])

  // Persist conversation
  useEffect(() => {
    if (!isRestored) return
    if (messages.length > 0) sessionStorage.setItem(SS_CONVERSATION, JSON.stringify(messages))
    else sessionStorage.removeItem(SS_CONVERSATION)
  }, [messages, isRestored])

  // Orb fade on mode switch
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (orbFadeRef.current) clearTimeout(orbFadeRef.current)
    setOrbFading(true)
    orbFadeRef.current = setTimeout(() => setOrbFading(false), 400)
    return () => { if (orbFadeRef.current) clearTimeout(orbFadeRef.current) }
  }, [conversationActive])

  // Reset conversation on project switch
  useEffect(() => {
    if (prevSelectedId.current !== null && prevSelectedId.current !== selectedId) {
      projectSwitchingRef.current = true
      if (!orbSwitchingRef.current) {
        setMessages([])
        setConversationActive(false)
        sessionStorage.removeItem(SS_CONVERSATION)
        if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
      }
      orbSwitchingRef.current = false
    }
    prevSelectedId.current = selectedId
  }, [selectedId])

  useEffect(() => { return () => { if (inactivityRef.current) clearTimeout(inactivityRef.current) } }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { resetInactivity() }, [input])

  // Load products + profile
  useEffect(() => {
    async function load() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const savedUserId = sessionStorage.getItem('todos_user_id')
          if (!savedUserId || savedUserId !== authUser.id) {
            sessionStorage.removeItem(SS_CONVERSATION)
            sessionStorage.removeItem(SS_INPUT)
            if (savedUserId) { setMessages([]); setConversationActive(false) }
            greetingFiredRef.current = false
          }
          sessionStorage.setItem('todos_user_id', authUser.id)

          const { data: profile } = await supabase
            .from('users')
            .select('first_name, last_name, onboarded_at, urgency_threshold_hours, release_stage, created_at')
            .eq('id', authUser.id)
            .single()
          const userWelcomeKey = `todos_welcome_shown_${authUser.id}`
          if (profile) {
            const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
            setUserName(full || (authUser.email ?? ''))
            setUserFullName(full)
            setUrgencyThreshold(profile.urgency_threshold_hours ?? 0)
            setReleaseStage(profile.release_stage ?? 'pre-alpha')
            if (profile.created_at) {
              const created = new Date(profile.created_at)
              const diffTime = Math.abs(Date.now() - created.getTime())
              const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
              setDaysActive(days)
            }
            if (!profile.onboarded_at && !localStorage.getItem(userWelcomeKey)) setIsNewUser(true)
          } else {
            setUserName(authUser.email?.charAt(0).toUpperCase() ?? '?')
            if (!localStorage.getItem(userWelcomeKey)) setIsNewUser(true)
          }
        }

        if (initialProducts) {
          if (initialProducts.length > 0) {
            const last  = localStorage.getItem(LAST_PRODUCT_KEY)
            const found = initialProducts.find(p => p.id === last)
            setSelectedId(found ? found.id : initialProducts[0].id)
          }
          return
        }

        const q = visibleProjectsQuery(supabase, 'id, name, code, description, created_by, view_mode')
        const { data } = authUser ? await q.eq('created_by', authUser.id) : await q
        const list = (data ?? []) as Product[]
        setProducts(list)
        if (list.length > 0) {
          const last  = localStorage.getItem(LAST_PRODUCT_KEY)
          const found = list.find(p => p.id === last)
          setSelectedId(found ? found.id : list[0].id)
        }
      } catch (err) {
        console.error('[UnifiedDashboard] Load failed:', err)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, initialProducts])

  // Load priorities
  useEffect(() => {
    async function fetchPriorities() {
      try {
        const { data } = await supabase.from('priorities').select('value, label, color, is_urgent').order('value')
        if (data) setPriorities(data)
      } catch (err) {
        console.error('[UnifiedDashboard] Load priorities failed:', err)
      }
    }
    fetchPriorities()
  }, [supabase])

  // Load statuses
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const { data } = await supabase.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order')
        if (data) setStatuses(data as StatusDef[])
      } catch (err) {
        console.error('[UnifiedDashboard] Load statuses failed:', err)
      }
    }
    fetchStatuses()
  }, [supabase])

  // Welcome message
  useEffect(() => {
    if (!isNewUser || welcomeDismissedRef.current) return
    const firstName = userFullName ? (userFullName.split(' ')[0] || 'there') : 'there'
    const welcome = `Hi ${firstName}! I'm Orb. Thanks for joining the ${releaseStage || 'pre-alpha'}. Press Return or tap the send button → to get started.`
    setInput(prev => prev || welcome)
  }, [isNewUser, userFullName, releaseStage])

  // Proactive greeting
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
      console.error('[UnifiedDashboard] Greeting check failed:', err)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isNewUser])

  // Fetch orb todos (lighter query for urgency)
  const fetchOrbTodos = useCallback(async () => {
    if (!selectedId) return
    try {
      const { data } = await supabase
        .from('todos')
        .select('id, title, status, priority_value, due_at, product_id')
        .eq('product_id', selectedId)
        .is('deleted_at', null)
      setOrbTodos((data ?? []) as typeof orbTodos)
    } catch (err) {
      console.error('[UnifiedDashboard] Fetch orb todos failed:', err)
    }
  }, [selectedId, supabase])

  useEffect(() => {
    if (!selectedId) return
    fetchOrbTodos()
    localStorage.setItem(LAST_PRODUCT_KEY, selectedId)
  }, [selectedId, fetchOrbTodos])

  // All-project todos for overall urgency (fetched once, refreshed on tab focus)
  const allTodosRef = useRef<{ status: string; priority_value: number | null; due_at: string | null; product_id: string }[]>([])
  const fetchAllTodos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('todos')
        .select('status, priority_value, due_at, product_id')
        .is('deleted_at', null)
      allTodosRef.current = (data ?? []) as typeof allTodosRef.current
    } catch (err) {
      console.error('[UnifiedDashboard] Fetch all todos failed:', err)
    }
  }, [supabase])

  useEffect(() => { fetchAllTodos() }, [fetchAllTodos])
  useVisibilityRefetch(fetchAllTodos)

  // Dev channel — poll for pending messages on tab focus
  const devPollInFlightRef = useRef(false)
  const pollDevChannel = useCallback(async () => {
    if (devPollInFlightRef.current) return
    devPollInFlightRef.current = true
    try {
      const pending = await fetchPendingDevMessages()
      if (pending.length === 0) return

      for (const msg of pending) {
        const devMsgId = genId()
        const orbMsgId = genId()

        setMessages(prev => [
          ...prev,
          { id: devMsgId, type: 'dev' as const, text: msg.content, senderLabel: msg.sender_label },
          { id: orbMsgId, type: 'orb' as const, text: 'Processing…', isStreaming: true },
        ])
        setConversationActive(true)
        resetInactivity()

        await markDevMessageDelivered(msg.id)

        const orbResponse = await processDevMessage(msg.id)

        setMessages(prev => prev.map(m =>
          m.id === orbMsgId
            ? { ...m, text: orbResponse || 'No response.', isStreaming: false }
            : m
        ))
      }
      // Fire-and-forget purge of old processed messages (knowledge repo has the permanent record)
      purgeOldDevMessages().catch(() => {})
    } catch (err) {
      console.error('[UnifiedDashboard] Dev channel poll failed:', err)
    } finally {
      devPollInFlightRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useVisibilityRefetch(pollDevChannel)
  useEffect(() => { pollDevChannel() }, [pollDevChannel])

  // Sync overall urgency from local data when orbTodos change
  useEffect(() => {
    if (allTodosRef.current.length > 0) {
      prevOverallUrgencyRef.current = computeUrgency(allTodosRef.current, urgentValues, urgencyThreshold)
    }
  }, [orbTodos, urgentValues, urgencyThreshold])

  // Periodic urgency re-evaluation — client-side only, no DB calls
  useEffect(() => {
    const interval = setInterval(async () => {
      setTick(t => t + 1)
      if (allTodosRef.current.length === 0) return
      const currentOverall = computeUrgency(allTodosRef.current, urgentValues, urgencyThreshold)
      if (prevOverallUrgencyRef.current) {
        const SEVERITY: Record<Urgency, number> = { calm: 0, busy: 1, urgent: 2 }
        if (SEVERITY[currentOverall] > SEVERITY[prevOverallUrgencyRef.current]) {
          await notifyIfEscalated(prevOverallUrgencyRef.current)
        }
      }
      prevOverallUrgencyRef.current = currentOverall
    }, 60000)
    return () => clearInterval(interval)
  }, [urgentValues, urgencyThreshold])

  // Project switch summary
  useEffect(() => {
    if (!projectSwitchingRef.current || noProject || (orbTodos.length === 0 && activeTodos.length === 0)) return
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
    addOrbMessage(parts.join('. ') + '.')
    prevUrgencyRef.current = urgency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbTodos])

  // Urgency transition explanation (debounced — ignore transient flickers)
  useEffect(() => {
    if (noProject || prevUrgencyRef.current === null) { prevUrgencyRef.current = urgency; return }
    if (projectSwitchingRef.current) { prevUrgencyRef.current = urgency; return }
    const prev = prevUrgencyRef.current
    if (prev === urgency) return
    prevUrgencyRef.current = urgency
    // Suppress duplicate messages within 10 seconds (transient re-render flicker)
    const now = Date.now()
    if (now - lastUrgencyMsgRef.current < 10_000) return
    lastUrgencyMsgRef.current = now
    const urgentCount = activeTodos.filter(t =>
      (t.priority_value !== null && urgentValues.has(t.priority_value)) ||
      (t.due_at !== null && isDueWithinWarning(t.due_at, urgencyThreshold))
    ).length
    let explanation = ''
    if (prev === 'calm' && urgency === 'busy') explanation = `Orb shifted busy — ${activeTodos.length} active tasks now.`
    else if (prev === 'calm' && urgency === 'urgent') explanation = `Orb shifted urgent — ${urgentCount} urgent task${urgentCount !== 1 ? 's' : ''} detected.`
    else if (prev === 'busy' && urgency === 'urgent') explanation = `Orb shifted urgent — ${urgentCount} urgent task${urgentCount !== 1 ? 's' : ''} in the queue.`
    else if (prev === 'urgent' && urgency === 'busy') explanation = 'Urgent queue cleared. Orb shifted back to busy.'
    else if (prev === 'urgent' && urgency === 'calm') explanation = 'Backlog is light. Orb is calm.'
    else if (prev === 'busy' && urgency === 'calm') explanation = 'Backlog thinned out. Orb is calm.'
    if (explanation) addOrbMessage(explanation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgency, noProject])

  // ══════════════════════════════════════════════════════════
  // EFFECTS — List
  // ══════════════════════════════════════════════════════════

  const fetchTodos = useCallback(async (pageNum = 0, append = false) => {
    if (!selectedId) return
    if (!append && !listInitialLoadDone.current) setListLoading(true)
    try {
      let todoQuery = supabase
        .from('todos')
        .select('*, groups(name), categories(name)')
        .is('deleted_at', null)
        .eq('product_id', selectedId)
        .order('todo_number', { ascending: sortAsc })

      if (filterStatus === 'active') todoQuery = todoQuery.in('status', [...ACTIVE_STATUSES])
      else if (filterStatus === 'inactive') todoQuery = todoQuery.in('status', [...PARKED_STATUSES])
      else if (filterStatus === 'closed') {
        const closedList = closedNames.size > 0 ? [...closedNames] : ['closed']
        todoQuery = todoQuery.in('status', closedList)
      } else if (filterStatus !== 'all') todoQuery = todoQuery.eq('status', filterStatus)

      if (filterPriority !== 'all') todoQuery = todoQuery.eq('priority_value', Number(filterPriority))

      // Kanban needs all todos to populate every column — skip pagination
      if (viewMode !== 'kanban') {
        const fromRange = pageNum * PAGE_SIZE
        const toRange = (pageNum + 1) * PAGE_SIZE
        todoQuery = todoQuery.range(fromRange, toRange)
      }

      const { data } = await todoQuery
      const results = (data as Todo[]) ?? []
      const hasNextPage = viewMode !== 'kanban' && results.length > PAGE_SIZE
      const pageItems = hasNextPage ? results.slice(0, PAGE_SIZE) : results

      setHasMore(hasNextPage)
      setPage(pageNum)

      if (append) {
        setTodos(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          return [...prev, ...pageItems.filter(t => !existingIds.has(t.id))]
        })
      } else {
        setTodos(pageItems)
      }
    } catch (err) {
      console.error('Fetch todos failed:', err)
    } finally {
      if (!append) { setListLoading(false); listInitialLoadDone.current = true }
    }
    checkReminders().catch(err => console.error('Reminder check failed:', err))
  }, [selectedId, supabase, sortAsc, filterStatus, filterPriority, closedNames, viewMode])

  useVisibilityRefetch(fetchTodos)

  useEffect(() => {
    listInitialLoadDone.current = false
    fetchTodos(0, false)
  }, [fetchTodos])

  // Sync view mode from product
  useEffect(() => {
    if (selectedId) {
      const p = products.find(x => x.id === selectedId)
      if (p?.view_mode) setViewMode(p.view_mode)
    }
  }, [selectedId, products])

  // ══════════════════════════════════════════════════════════
  // HANDLERS — Conversation
  // ══════════════════════════════════════════════════════════

  function handleWelcomeSubmit(text: string) {
    welcomeDismissedRef.current = true
    setIsNewUser(false)
    setInput('')
    sessionStorage.removeItem(SS_INPUT)
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        localStorage.setItem(`todos_welcome_shown_${authUser.id}`, '1')
        supabase.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', authUser.id).then(() => {})
      }
    })
    setMessages(prev => [
      ...prev,
      { id: genId(), type: 'user', text },
      { id: genId(), type: 'orb', text: `Welcome to Orb! \n\nUnlike standard todo lists that just store tasks, Orb acts as an **ambient presence** and **strategic planning partner**. The color and motion of the Orb on your screen reflect your real-time workload (Calm, Busy, or Urgent).\n\nTo help you get started, I have created three projects for you. You can select them using the project search bar in the top bar:\n• **Welcome & Guide (WELCOME)** - Checklist view in an **Active** (lavender) state.\n• **Home Maintenance (HOME)** - List view in a **Calm** (green) state.\n• **Urban Compost Initiative (ECO)** - Kanban view in an **Urgent** (orange/solar flare) state.\n\nThese projects contain realistic tasks to let you immediately interact with Orb. Try asking me: *"What should I do next?"* or *"Why am I busy?"*, switch views, or test the Kanban touch drag-and-drop on your phone.\n\n**Note on Privacy & Testing:** Since this is a pre-alpha, task names and chat logs are visible to the developer (Stan) for debugging and optimizing the AI's logic. Please do not store highly sensitive personal information.\n\nType /? anytime for a full command list. Click on "Help" at the top of the screen to read our Pre-Alpha Testing guide. \n\nSelect one of the projects from the search bar at the top to see your onboarding tasks. What would you like to do first?` },
    ])
    setConversationActive(true)
    resetInactivity()
  }

  async function handleSubmit(value?: string) {
    const text = (value ?? input).trim()
    if (!text || submitting) return

    if (isNewUser && !welcomeDismissedRef.current) { handleWelcomeSubmit(text); return }

    if (text === '?' || text === '/?') { setShowHelp(true); setInput(''); return }

    if (text.startsWith('/')) {
      setInput('')
      sessionStorage.removeItem(SS_INPUT)
      const [cmd, ...args] = text.split(' ')
      if (cmd === '/settings') router.push('/settings')
      else if (cmd === '/help' || cmd === '/?') setShowHelp(true)
      else if (cmd === '/clear') { setMessages([]); setConversationActive(false); sessionStorage.removeItem(SS_CONVERSATION); greetingFiredRef.current = false }
      else if (cmd === '/add') {
        const task = args.join(' ').trim()
        if (!task) { toast.neutral('Usage: /add Buy groceries'); return }
        handleSubmit(`Add a todo: ${task}`)
      } else if (cmd === '/close') {
        const task = args.join(' ').trim()
        if (!task) { toast.neutral('Usage: /close ORB-12'); return }
        handleSubmit(`Close ${task}`)
      } else if (cmd === '/create') {
        const name = args.join(' ').trim()
        if (!name) { toast.neutral('Usage: /create Project Name'); return }
        handleSubmit(`Create a project called "${name}"`)
      } else if (cmd === '/drop') {
        const target = args.join(' ').trim()
        if (!target) { toast.neutral('Usage: /drop [project code]'); return }
        const t = products.find(p => p.code?.toUpperCase() === target.toUpperCase() || p.name.toUpperCase() === target.toUpperCase())
        if (!t) { toast.neutral(`Project "${target}" not found.`); return }
        handleSubmit(`Delete the project ${t.code ?? t.name}`)
      } else if (cmd === '/edit') {
        const target = args.join(' ').trim()
        if (target) {
          const t = products.find(p => p.code?.toUpperCase() === target.toUpperCase() || p.name.toUpperCase() === target.toUpperCase())
          if (t) { setSelectedId(t.id); setShowEditProduct(true) }
          else toast.neutral(`Project "${target}" not found.`)
        } else {
          if (!selectedId) { toast.neutral('Add a project first.'); return }
          setShowEditProduct(true)
        }
      } else if (cmd === '/switch') {
        const target = args.join(' ').trim()
        if (!target) { toast.neutral('Usage: /switch [project code]'); return }
        const t = products.find(p => p.code?.toUpperCase() === target.toUpperCase() || p.name.toUpperCase() === target.toUpperCase())
        if (t) setSelectedId(t.id)
        else toast.neutral(`Project "${target}" not found.`)
      } else toast.neutral(`Unknown command: ${cmd}`)
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
      const stream = await orbConverse({ input: text, productId: selectedId, history, dryRun, uiContext: { viewMode, filterStatus, filterPriority, sortAsc, orbPaneVisible, listPaneVisible, isMobile, daysActive } })
      for await (const chunk of readStreamableValue(stream)) {
        if (abortConverseRef.current) break
        if (!chunk) continue
        setMessages(prev => prev.map(m => {
          if (m.id !== processingId) return m
          const newThoughts = m.thoughts ? [...m.thoughts] : []
          if (chunk.thought && !newThoughts.includes(chunk.thought)) newThoughts.push(chunk.thought)
          return { ...m, text: chunk.speech || m.text, thoughts: newThoughts, isStreaming: chunk.isStreaming }
        }))
        if (chunk.refresh) {
          setPulse(true)
          setTimeout(() => setPulse(false), 420)
          if (chunk.mutationType === 'dormancy') {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            const dq = visibleProjectsQuery(supabase, 'id, name, code, description, created_by, view_mode')
            const { data: freshProjects } = authUser ? await dq.eq('created_by', authUser.id) : await dq
            const list = (freshProjects ?? []) as Product[]
            setProducts(list)
            if (list.length > 0 && !list.find(p => p.id === selectedId)) setSelectedId(list[0].id)
          } else if (chunk.mutationType === 'project_create' && chunk.newProject) {
            setProducts(prev => [...prev, chunk.newProject!])
            orbSwitchingRef.current = true
            setSelectedId(chunk.newProject.id)
            toast.success('Project created.')
          } else {
            if (chunk.mutatedProductId === selectedId) { fetchOrbTodos(); fetchTodos() }
            if (chunk.mutationType === 'create') toast.success('Todo created.')
            else if (chunk.mutationType === 'update') toast.success('Todo saved.')
            else if (chunk.mutationType === 'delete') toast.success('Todo deleted.')
            else toast.success('Todo updated.')
          }
        }
        if (chunk.clientAction) {
          const action = chunk.clientAction
          if (action.action === 'switch_project' && action.target) {
            const t = products.find(p => p.code?.toUpperCase() === action.target?.toUpperCase() || p.name.toUpperCase() === action.target?.toUpperCase())
            if (t) { orbSwitchingRef.current = true; setSelectedId(t.id) }
          } else if (action.action === 'open_settings') router.push('/settings')
          else if (action.action === 'open_help') setShowHelp(true)
          else if (action.action === 'check_update') {
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
        if (chunk.suggestedKnowledge) setDistillTodo(chunk.suggestedKnowledge)
      }
    } catch (err) {
      console.error('[orbSubmit]', err)
      if (isAuthError(String(err))) { handleSessionExpired(toast); return }
      if (!abortConverseRef.current) {
        setMessages(prev => prev.map(m => m.id === processingId ? { ...m, text: 'Something went wrong. Try again?' } : m))
      }
    } finally {
      setSubmitting(false)
      activeProcessingIdRef.current = null
      if (abortConverseRef.current) {
        setMessages(prev => prev.map(m => {
          if (m.id === processingId) return { ...m, isStreaming: false, text: m.text === 'Processing…' ? 'Stopped.' : m.text }
          return m
        }))
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // HANDLERS — List
  // ══════════════════════════════════════════════════════════

  async function handleToggleDone(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation()
    let beforeUrgency: Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[UnifiedDashboard] getUrgencySnapshot failed:', err)
    }
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    const openStatus   = statuses.find(s => s.is_open)?.name ?? 'open'
    const newStatus    = isClosed(todo.status) ? openStatus : closedStatus
    const { data, error } = await supabase
      .from('todos')
      .update({ status: newStatus, closed_at: isClosed(newStatus) ? new Date().toISOString() : null })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()
    if (error) {
      if (isAuthError(error.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to update. Try again.')
      return
    }
    if (data) {
      const updated = data as Todo
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
      if (selectedTodo?.id === todo.id) setSelectedTodo(updated)
      logAudit({ action: isClosed(newStatus) ? 'todo_close' : 'todo_reopen', table_name: 'todos', record_id: todo.id, before: { status: todo.status }, after: { status: newStatus, title: todo.title } })
      if (beforeUrgency) {
        try {
          await notifyIfEscalated(beforeUrgency)
        } catch (err) {
          console.error('[UnifiedDashboard] notifyIfEscalated failed:', err)
        }
      }
      if (isClosed(newStatus)) setDistillTodo(updated)
      if (todo.ticket_id && isClosed(newStatus)) {
        updateTicketStatus(todo.ticket_id, 'closed').catch(err => console.error('[UD] ticket propagation failed:', err))
      }
      fetchOrbTodos()
    }
  }

  async function handleStatusChange(todo: Todo, newStatus: string) {
    const isClosing = isClosed(newStatus) && !isClosed(todo.status)
    const { data, error } = await supabase
      .from('todos')
      .update({
        status: newStatus,
        closed_at: isClosed(newStatus) ? new Date().toISOString() : (isClosing ? null : todo.closed_at),
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()
    if (error) {
      if (isAuthError(error.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to move task. Try again.')
      return
    }
    if (data) {
      const updated = data as Todo
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
      if (selectedTodo?.id === todo.id) setSelectedTodo(updated)
      logAudit({ action: isClosing ? 'todo_close' : 'todo_update', table_name: 'todos', record_id: todo.id, before: { status: todo.status }, after: { status: newStatus, title: todo.title } })
      if (isClosing) setDistillTodo(updated)
      if (todo.ticket_id && isClosing) {
        updateTicketStatus(todo.ticket_id, 'closed').catch(err => console.error('[UD] ticket propagation failed:', err))
      }
      fetchOrbTodos()
      toast.success(`Moved to ${newStatus}`)
    }
  }

  async function handleSetViewMode(mode: ViewMode) {
    setViewMode(mode)
    if (selectedId) {
      await supabase.from('projects').update({ view_mode: mode }).eq('id', selectedId)
      setProducts(prev => prev.map(p => p.id === selectedId ? { ...p, view_mode: mode } : p))
    }
  }

  function toggleId(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const all = todos.map(t => t.id)
    setSelectedIds(all.every(id => selectedIds.includes(id)) ? [] : all)
  }

  async function handleBulkMarkDone() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    let beforeUrgency: Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[UnifiedDashboard] getUrgencySnapshot failed:', err)
    }
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    const { error } = await supabase.from('todos').update({ status: closedStatus, closed_at: new Date().toISOString() }).in('id', ids)
    if (error) { if (isAuthError(error.message)) { handleSessionExpired(toast); return }; toast.error('Failed to close items.'); return }
    logAudit({ action: 'todo_bulk_close', table_name: 'todos', after: { count: ids.length, ids } })
    if (beforeUrgency) {
      try {
        await notifyIfEscalated(beforeUrgency)
      } catch (err) {
        console.error('[UnifiedDashboard] notifyIfEscalated failed:', err)
      }
    }
    await fetchTodos()
    fetchOrbTodos()
    todos.filter(t => ids.includes(t.id) && t.ticket_id).forEach(t => {
      updateTicketStatus(t.ticket_id!, 'closed').catch(err => console.error('[UD] ticket propagation failed:', err))
    })
    setSelectedIds([])
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    let beforeUrgency: Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[UnifiedDashboard] getUrgencySnapshot failed:', err)
    }
    const { error } = await supabase.from('todos').delete().in('id', ids)
    if (error) { if (isAuthError(error.message)) { handleSessionExpired(toast); return }; toast.error('Failed to delete items.'); return }
    logAudit({ action: 'todo_bulk_delete', table_name: 'todos', before: { count: ids.length, ids } })
    if (beforeUrgency) {
      try {
        await notifyIfEscalated(beforeUrgency)
      } catch (err) {
        console.error('[UnifiedDashboard] notifyIfEscalated failed:', err)
      }
    }
    setTodos(prev => prev.filter(t => !ids.includes(t.id)))
    if (selectedTodo && ids.includes(selectedTodo.id)) setSelectedTodo(null)
    setSelectedIds([])
    setConfirmBulkDelete(false)
    fetchOrbTodos()
  }

  // ══════════════════════════════════════════════════════════
  // HANDLERS — Split pane
  // ══════════════════════════════════════════════════════════

  const handleDividerResize = useCallback((delta: number) => {
    setOrbPaneSize(prev => {
      const container = splitRef.current
      if (!container) return prev
      const total = isMobile ? container.clientHeight : container.clientWidth
      const minSize = 200
      const current = prev ?? total * 0.5
      const next = Math.max(minSize, Math.min(total - minSize - 28, current + delta))
      return next
    })
  }, [isMobile])

  const handleDividerResizeEnd = useCallback(() => {
    const container = splitRef.current
    if (!container || orbPaneSize === null) return
    const total = isMobile ? container.clientHeight : container.clientWidth
    const ratio = orbPaneSize / total
    // Snap to nearest: 0.3, 0.5, 0.7
    let snapped: number
    if (ratio < 0.35) snapped = 0.3
    else if (ratio > 0.65) snapped = 0.7
    else snapped = 0.5
    const snappedSize = snapped * total
    setOrbPaneSize(snappedSize)
    try {
      const key = isMobile ? 'orb_split_ratio_mobile' : 'orb_split_ratio'
      localStorage.setItem(key, String(snappedSize))
    } catch { /* ignore */ }
  }, [orbPaneSize, isMobile])

  // ══════════════════════════════════════════════════════════
  // RENDER — Orb element
  // ══════════════════════════════════════════════════════════

  const orbScale = (isInputFocused && isMobile) ? 0.45 : 1.0

  const orbElement = (
    <div className="dash-orb-wrap" data-mode={conversationActive ? 'dialogue' : 'ambient'}>
      <div
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
        onPointerUp={() => { if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null } }}
        onPointerCancel={() => { if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null } }}
        title={noProject ? 'Add a project to get started' : 'Hold to return to ambient'}
        style={{
          position: 'relative',
          width: 'clamp(140px, 25vh, 200px)', height: 'clamp(140px, 25vh, 200px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto',
          transform: `scale(${orbScale})`, transformOrigin: 'top center',
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
          opacity: orbFading ? 0 : 1,
          WebkitTouchCallout: 'none', userSelect: 'none',
        }}
        aria-label={noProject ? 'No project selected' : `${activeTodos.length} active todos`}
        role="button" tabIndex={0}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', inset: noProject ? '-18px' : ORB_GLOW[urgency].inset, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${noProject ? NO_PROJECT_STYLE.glow : style.glow}, transparent 70%)`,
          filter: `blur(${noProject ? '20px' : ORB_GLOW[urgency].blur})`,
          animation: noProject ? 'none' : `todos-glow-${urgency} ${speed} ease-in-out infinite`,
          transition: 'inset 0.8s, filter 0.8s, background 0.8s',
        }} />

        {/* Solar flares */}
        {urgency === 'urgent' && SOLAR_FLARES.map((f, i) => (
          <div key={i} aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, transform: `rotate(${f.angle}deg)`, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', bottom: '82px', left: `${-f.width / 2}px`, width: `${f.width}px`, height: `${f.height}px`,
              background: `radial-gradient(ellipse 70% 100% at 50% 100%, rgba(255, 235, 180, 0.95) 0%, rgba(255, 185, 90, 0.6) 30%, rgba(255, 140, 60, 0.28) 60%, transparent 95%)`,
              borderRadius: '50%', transformOrigin: 'bottom center',
              animation: `todos-flare-rise ${f.dur}s ease-in-out infinite`, animationDelay: `${f.delay}s`,
              filter: 'blur(6px)', mixBlendMode: 'screen',
            }} />
          </div>
        ))}

        {/* Sphere */}
        <div style={{
          position: 'relative', width: '100%', height: '100%', borderRadius: '50%',
          background: `radial-gradient(circle at 36% 30%, #ffffff, ${noProject ? NO_PROJECT_STYLE.orbMid : style.orbMid} 45%, ${noProject ? NO_PROJECT_STYLE.orbLo : style.orbLo} 82%)`,
          boxShadow: `0 8px 32px ${noProject ? NO_PROJECT_STYLE.glow : style.glow}, 0 2px 8px rgba(0,0,0,0.06), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 2px 8px rgba(255,255,255,0.9)`,
          animation: noProject ? 'none' : `${ORB_ANIMATION[urgency]} ${speed} ease-in-out infinite`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2px',
          transition: 'background 0.8s, box-shadow 0.8s',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 164 164" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} aria-hidden>
            <defs>
              <path id="ud-orb-name-arc" d="M 24 82 A 58 58 0 0 1 140 82" fill="none" />
              <path id="ud-orb-state-arc" d="M 24 82 A 58 58 0 0 0 140 82" fill="none" />
            </defs>
            <text fontFamily="var(--font-ui)" fontSize="11" fontWeight={600} letterSpacing="3" fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor} style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}>
              <textPath href="#ud-orb-name-arc" startOffset="50%" textAnchor="middle">
                {noProject ? 'WAITING' : (() => { const raw = (selected?.code ?? selected?.name ?? '').toUpperCase(); return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw })()}
              </textPath>
            </text>
            <text fontFamily="var(--font-ui)" fontSize="11" fontWeight={600} letterSpacing="3" fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor} style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}>
              <textPath href="#ud-orb-state-arc" startOffset="50%" textAnchor="middle">
                {noProject ? 'SET UP' : urgency.toUpperCase()}
              </textPath>
            </text>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-orb)', fontWeight: 300, color: noProject ? NO_PROJECT_STYLE.countColor : style.countColor, letterSpacing: '-1px', lineHeight: 1, transition: 'color 0.8s' }}>
            {noProject ? '—' : activeTodos.length}
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', fontWeight: 400, letterSpacing: '0.14em', textTransform: 'uppercase', color: noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor, transition: 'color 0.8s' }}>
            {noProject ? 'no project' : 'active'}
          </span>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // RENDER — List action buttons
  // ══════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const bothPanesVisible = orbPaneVisible && listPaneVisible
  const orbPaneSizeStyle = orbPaneSize !== null
    ? (isMobile ? { height: `${orbPaneSize}px` } : { width: `${orbPaneSize}px` })
    : (isMobile ? { height: '50%' } : { width: '50%' })

  return (
    <>
      <MuralCanvas key={selectedId} urgency={urgency} />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── Global Nav ── */}
        <AppNav
          printContext={{ productId: selectedId, productName: selected?.name ?? null }}
          userInitial={(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
        />

        {/* ── Command Bar (page-specific: panel toggles + project search) ── */}
        <div className="ud-command-bar">
          {/* Panel toggle — Orb */}
          <button className="nav-btn ud-panel-toggle" onClick={isMobile ? () => setActiveMobileTab('orb') : () => setOrbPaneVisible(v => !v)} title={isMobile ? 'Show Orb' : (orbPaneVisible ? 'Hide Orb' : 'Show Orb')} aria-label={isMobile ? 'Show Orb' : (orbPaneVisible ? 'Hide Orb' : 'Show Orb')} aria-pressed={isMobile ? activeMobileTab === 'orb' : undefined} disabled={isMobile && activeMobileTab === 'orb'}>
            <span className="nav-btn-icon">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14.5" fill="url(#orbFavGrad)" />
                <ellipse cx="12" cy="11" rx="5.5" ry="4" fill="rgba(255,255,255,0.55)" />
                <defs><radialGradient id="orbFavGrad" cx="36%" cy="30%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="45%" stopColor="#d4e4d4"/><stop offset="100%" stopColor="#6a9a7a"/></radialGradient></defs>
              </svg>
            </span>
            <span className="nav-btn-label">{isMobile ? 'Orb' : (orbPaneVisible ? 'Hide Orb' : 'Show Orb')}</span>
          </button>

          {/* Project selector — search-based dropdown */}
          <div className="tv-admin-search" style={{ position: 'relative', flex: '0 1 auto', minWidth: 0 }}>
            <div className="admin-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Type to select project or user..."
                value={projectSearchQuery}
                onChange={e => { setProjectSearchQuery(e.target.value); setProjectSearchOpen(true) }}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                aria-label="Search projects"
              />
              {projectSearchQuery && (
                <button type="button" className="admin-search-clear" onClick={() => { setProjectSearchQuery(''); setProjectSearchOpen(false) }} aria-label="Clear search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            {projectSearchOpen && (
              <div className="admin-search-dropdown">
                {projectsLoadError && (
                  <div className="admin-search-empty" style={{ color: 'var(--error)', fontSize: '12px' }}>
                    Projects failed to load.{' '}
                    <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', padding: 0, textDecoration: 'underline' }}
                      onClick={() => window.location.reload()}>
                      Refresh
                    </button>
                  </div>
                )}
                {adminSearchResults.length === 0 && !projectsLoadError ? (
                  <div className="admin-search-empty">No matching projects</div>
                ) : (
                  adminSearchResults.map(p => (
                    <button key={p.id} type="button" className="admin-search-result" data-active={p.id === selectedId ? '' : undefined}
                      onClick={() => { setSelectedId(p.id); listInitialLoadDone.current = false; setProjectSearchOpen(false); setProjectSearchQuery('') }}>
                      <span className="admin-search-result-name">{p.code ? `${p.code} — ${p.name}` : p.name}</span>
                      {isAdmin && p.owner_name && p.owner_name !== 'Unknown' && (
                        <span className="admin-search-result-owner">{p.owner_name}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="ud-spacer" style={{ flex: 1 }} />

          {/* Global nav (Print, Help, Settings, Account) moved to AppNav above */}

          {/* Panel toggle — List (far right) */}
          <button className="nav-btn ud-panel-toggle" onClick={isMobile ? () => setActiveMobileTab('list') : () => setListPaneVisible(v => !v)} title={isMobile ? 'Show List' : (listPaneVisible ? 'Hide List' : 'Show List')} aria-label={isMobile ? 'Show List' : (listPaneVisible ? 'Hide List' : 'Show List')} aria-pressed={isMobile ? activeMobileTab === 'list' : undefined} disabled={isMobile && activeMobileTab === 'list'}>
            <span className="nav-btn-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </span>
            <span className="nav-btn-label">{isMobile ? 'List' : (listPaneVisible ? 'Hide List' : 'Show List')}</span>
          </button>
        </div>

        {/* ── Split Container ── */}
        <div ref={splitRef} className="ud-split" data-active-tab={activeMobileTab}>
          {/* Orb pane */}
          {(orbPaneVisible || isMobile) && (
          <div className="ud-orb-pane" style={bothPanesVisible && !isMobile ? orbPaneSizeStyle : { flex: 1, width: '100%' }}>
            <OrbConversation
              orbElement={orbElement}
              messages={messages}
              input={input}
              submitting={submitting}
              productCode={selected?.code ?? selected?.name ?? ''}
              products={products}
              conversationActive={conversationActive}
              onRestoreConversation={() => setConversationActive(true)}
              onClearTranscript={() => { setMessages([]); setConversationActive(false); sessionStorage.removeItem(SS_CONVERSATION) }}
              onInputChange={v => { setInput(v); sessionStorage.setItem(SS_INPUT, v) }}
              onSubmit={handleSubmit}
              onStop={handleStop}
              onFocusChange={setIsInputFocused}
              onSelectProject={id => { setSelectedId(id) }}
              selectedProjectId={selectedId}
              onShowEditProject={() => setShowEditProduct(true)}
              onShowAddProject={() => setShowAddProduct(true)}
            />
          </div>
          )}

          {/* Divider — only when both panes visible on desktop */}
          {bothPanesVisible && !isMobile && (
            <DragDivider
              direction="horizontal"
              onResize={handleDividerResize}
              onResizeEnd={handleDividerResizeEnd}
            />
          )}

          {/* List pane */}
          {(listPaneVisible || isMobile) && (
          <div className="ud-list-pane" style={!bothPanesVisible && !isMobile ? { flex: 1, width: '100%' } : undefined}>
            {/* List toolbar */}
            <div className="ud-list-toolbar">
              {selected && <h2 className="ud-list-title">{selected.name}</h2>}
              <div style={{ flex: 1 }} />
              <div className="tv-toolbar">
                <button className="tv-toolbar-btn" onClick={() => setSortAsc(v => !v)} aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'} title={sortAsc ? 'Oldest first' : 'Newest first'}>
                  Sort
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {sortAsc ? <path d="M12 19V5M5 12l7-7 7 7"/> : <path d="M12 5v14M5 12l7 7 7-7"/>}
                  </svg>
                </button>
                <button className="tv-toolbar-btn" aria-pressed={showFilters} onClick={() => { setShowFilters(f => !f); setShowListViews(false) }} aria-label="Toggle filters">
                  Filter <span className="tv-badge">{todos.length}</span>
                </button>
                <button className="tv-toolbar-btn" aria-pressed={showListViews} onClick={() => { setShowListViews(v => !v); setShowFilters(false) }} title="List views">
                  Views
                </button>
                <button className="tv-toolbar-primary" onClick={() => setShowNewTodo(true)}>+ New</button>
              </div>
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div className="tv-filterbar">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="tv-select" aria-label="Filter by status">
                  <option value="all">All</option>
                  <option value="active">Active (Open + In Progress)</option>
                  <option value="inactive">Parked (Deferred + On Hold)</option>
                  <option value="open">Open</option>
                  <option value="in progress">In Progress</option>
                  <option value="deferred">Deferred</option>
                  <option value="on hold">On Hold</option>
                  <option value="closed">Closed</option>
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="tv-select" aria-label="Filter by priority">
                  <option value="all">All priorities</option>
                  {priorities.map(p => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
                </select>
                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{todos.length} todo{todos.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* View switcher */}
            {showListViews && (
              <ViewSwitcher current={viewMode} onSwitch={handleSetViewMode} onClose={() => setShowListViews(false)} />
            )}

            {/* Bulk actions */}
            {selectedIds.length > 0 && (
              <div className="tv-bulk-bar-top">
                {confirmBulkDelete ? (
                  <>
                    <span className="text-error" style={{ fontSize: '13px', fontWeight: 500 }}>Delete {selectedIds.length} todo{selectedIds.length !== 1 ? 's' : ''}?</span>
                    <button className="tv-bulk-confirm" onClick={handleBulkDelete}>Confirm</button>
                    <button className="tv-bulk-btn text-muted" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text2)', fontWeight: 500, fontSize: '13px' }}>{selectedIds.length} selected</span>
                    <button className="tv-bulk-btn text-muted" onClick={toggleSelectAll}>{todos.every(t => selectedIds.includes(t.id)) ? 'Deselect all' : 'Select all'}</button>
                    <button className="tv-toolbar-btn" onClick={handleBulkMarkDone}>Mark done</button>
                    <button className="tv-bulk-btn" onClick={() => setConfirmBulkDelete(true)} style={{ color: 'var(--error)' }}>Delete</button>
                    <button className="tv-bulk-btn text-muted" onClick={() => setSelectedIds([])}>Clear</button>
                  </>
                )}
              </div>
            )}

            {/* Todo list */}
            <div className="ud-list-content">
              {listLoading ? (
                <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>Loading…</p>
              ) : viewMode === 'checklist' ? (
                <TaskChecklistView
                  todos={todos}
                  priorities={priorities}
                  isClosed={isClosed}
                  statusColor={statusColor}
                  productCodeMap={productCodeMap}
                  onSelectTodo={setSelectedTodo}
                  onToggleDone={handleToggleDone}
                  selectedTodo={selectedTodo}
                  selectedIds={selectedIds}
                  onToggleId={toggleId}
                  onToggleAll={toggleSelectAll}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                />
              ) : viewMode === 'kanban' ? (
                <TaskKanbanView
                  todos={todos}
                  priorities={priorities}
                  isClosed={isClosed}
                  statusColor={statusColor}
                  productCodeMap={productCodeMap}
                  onSelectTodo={setSelectedTodo}
                  onToggleDone={handleToggleDone}
                  onStatusChange={handleStatusChange}
                  selectedTodo={selectedTodo}
                  selectedIds={selectedIds}
                  onToggleId={toggleId}
                  onToggleAll={toggleSelectAll}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                />
              ) : (
                <TaskListView
                  todos={todos}
                  priorities={priorities}
                  isClosed={isClosed}
                  statusColor={statusColor}
                  productCodeMap={productCodeMap}
                  onSelectTodo={setSelectedTodo}
                  onToggleDone={handleToggleDone}
                  selectedTodo={selectedTodo}
                  selectedIds={selectedIds}
                  onToggleId={toggleId}
                  onToggleAll={toggleSelectAll}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                />
              )}

              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--sp-xl) 0' }}>
                  <button onClick={() => fetchTodos(page + 1, true)} className="tv-toolbar-btn" style={{ padding: '8px 24px', fontSize: 'var(--fs-sm)', borderRadius: 'var(--r-lg)' }}>
                    Load more tasks
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </div>



        {/* Version */}
        <OrbVersionLabel as="div" className="dash-version" />
      </div>

      {/* ── Modals ── */}
      {selectedTodo && (
        <TodoPanel todo={selectedTodo} products={products as any} priorities={priorities as any} statuses={statuses} isAll={false}
          onClose={() => setSelectedTodo(null)}
          onSave={updated => { setTodos(prev => prev.map(t => t.id === updated.id ? updated : t)); setSelectedTodo(updated); fetchOrbTodos() }}
          onDelete={id => { setTodos(prev => prev.filter(t => t.id !== id)); setSelectedTodo(null); fetchOrbTodos() }}
        />
      )}

      {showNewTodo && (
        <TodoForm productId={selectedId ?? undefined} products={products as any} priorities={priorities as any}
          onClose={() => setShowNewTodo(false)}
          onCreate={todo => { setTodos(prev => [...prev, todo]); setShowNewTodo(false); fetchOrbTodos() }}
        />
      )}

      {showHelp && <OrbHelp onClose={() => setShowHelp(false)} />}

      {showAddProduct && (
        <AddProductModal ownerId={null} onClose={() => setShowAddProduct(false)}
          onCreated={project => { setProducts(prev => [...prev, project]); setSelectedId(project.id); setShowAddProduct(false) }}
        />
      )}

      {showEditProduct && selected && (
        <AddProductModal project={selected as any} onClose={() => setShowEditProduct(false)}
          onUpdated={updated => { setProducts(prev => prev.map(p => p.id === updated.id ? updated : p)); setShowEditProduct(false) }}
          onDeleted={id => { setProducts(prev => prev.filter(p => p.id !== id)); setSelectedId(prev => prev === id ? (products.find(p => p.id !== id)?.id ?? null) : prev); setShowEditProduct(false) }}
        />
      )}

      {distillTodo && (
        <DistillModal
          todoId={distillTodo.id ?? distillTodo.id}
          productId={distillTodo.product_id ?? distillTodo.productId}
          initialTitle={distillTodo.suggestion?.title ?? `Lesson: ${distillTodo.title}`}
          initialContent={distillTodo.suggestion?.content ?? distillTodo.resolution_notes ?? distillTodo.description ?? ''}
          onClose={() => setDistillTodo(null)}
          onSaved={() => { setDistillTodo(null); setPulse(true); setTimeout(() => setPulse(false), 500) }}
        />
      )}

      <OrbDevPanel
        override={moodOverride} onChange={setMoodOverride}
        roleOverride={roleOverride} onRoleOverrideChange={setRoleOverride}
        onSpeak={speech => { if (speech) addOrbMessage(speech.text) }}
        onSubmit={handleSubmit} dryRun={dryRun} onDryRunChange={setDryRun}
        messages={messages} onForceQuiet={() => setConversationActive(false)}
        onErrorTest={() => setDevError(true)}
      />

      {/* Orb animations */}
      <style>{`
        @keyframes todos-orb-calm { 0%, 100% { transform: scale(1); border-radius: 50%; } 50% { transform: scale(1.025); border-radius: 50%; } }
        @keyframes todos-glow-calm { 0%, 100% { transform: scale(1); opacity: 0.92; } 50% { transform: scale(1.05); opacity: 1; } }
        @keyframes todos-orb-busy { 0%, 100% { transform: scale(1); border-radius: 50% 50% 50% 50%; } 33% { transform: scale(1.04); border-radius: 48% 52% 51% 49%; } 66% { transform: scale(1.025); border-radius: 51% 49% 48% 52%; } }
        @keyframes todos-glow-busy { 0%, 100% { transform: scale(1); opacity: 0.88; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes todos-orb-urgent { 0%, 100% { transform: scale(1); border-radius: 50%; } 50% { transform: scale(1.045); border-radius: 50%; } }
        @keyframes todos-glow-urgent { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.18); opacity: 1; } }
        @keyframes todos-flare-rise { 0%, 55% { transform: scaleY(0) scaleX(0.5) skewX(0deg); opacity: 0; } 68% { transform: scaleY(0.5) scaleX(1) skewX(-2deg); opacity: 0.85; } 78% { transform: scaleY(1) scaleX(1.1) skewX(2deg); opacity: 1; } 88% { transform: scaleY(1.15) scaleX(0.7) skewX(-3deg); opacity: 0.55; } 96% { transform: scaleY(1.3) scaleX(0.3) skewX(3deg); opacity: 0.15; } 100% { transform: scaleY(1.4) scaleX(0.1) skewX(0deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [data-todos-orb], [data-todos-glow], [data-todos-flare] { animation: none !important; } [data-todos-flare] { opacity: 0; } }
      `}</style>
    </>
  )
}
