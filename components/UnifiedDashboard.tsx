'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { useRouter } from 'next/navigation'
// Link removed — global nav moved to AppNav
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery, clampProjectName } from '@/lib/projects'
import { fuzzyMatch } from '@/lib/fuzzy-search'
import AddProductModal from './AddProductModal'
import AppNav from './AppNav'
import SearchModal from './ui/SearchModal'
import EmptyState from './ui/EmptyState'
import OrbConversation, { type ConversationMessage } from './OrbConversation'
import { registerOrbTour, unregisterOrbTour, runOrbTour, launchOrbTour } from './OrbTour'
import { OrbDevPanel, DevTestError, type MoodOverride, type SimulateError } from './OrbDevPanel'
import { orbConverse, type ActionSet, type OrbResponse, type PendingMutation } from '@/app/actions/orb-converse'
import { collectSystemInfo, type SystemInfo } from '@/lib/system-info'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { checkReminders } from '@/app/actions/reminder-actions'
import { fetchPendingDevMessages, markDevMessageDelivered, processDevMessage, purgeOldDevMessages } from '@/app/actions/dev-channel'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import DistillModal from './DistillModal'

import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import MuralCanvas from './MuralCanvas'
import SkeletonRows from './ui/SkeletonRows'
import FilterKebab from './ui/FilterKebab'
// HScrollNav removed — project strip eliminated
import { isActive, ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import { computeUrgency, isDueWithinWarning, type Urgency } from '@/lib/orb-state'
// PrintModal moved to AppNav
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import { logAudit } from '@/app/actions/log-audit'
import { deleteProject } from '@/app/actions/manage-project'
import DragDivider from './DragDivider'
import { useVoiceMode, type TtsConfig } from '@/lib/hooks/useVoiceMode'
import { getTtsConfig } from '@/app/actions/orb-ai-settings'
// useDoubleTap no longer needed — voice bar has explicit controls
import TaskListView from './views/TaskListView'
import TaskChecklistView from './views/TaskChecklistView'
import TaskKanbanView from './views/TaskKanbanView'
import ViewSwitcher, { type ViewMode } from './views/ViewSwitcher'
import { useSystemState } from '@/components/SystemStateProvider'

const TTS_CONFIG_CHANGED_EVENT = 'orb:tts-config-changed'

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
const SS_ACTION_SETS    = 'todos_orb_action_sets'
const INACTIVITY_MS     = 5 * 60 * 1000
const DEV_CHANNEL_POLL_INTERVAL = 15_000
const PAGE_SIZE         = 40

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// Resolves a user-typed or Orb-spoken project reference to exactly one
// project. Priority mirrors the server's resolveProjectReference (exact
// name → exact code → fuzzy/partial name), so "Stokely" and "Mr. Stokely
// from Boston" both resolve to the same project. A tier is used only if it
// yields exactly one match — ambiguous or empty tiers fall through rather
// than guessing, since a misfire here silently switches the user's project.
function resolveProjectByReference<T extends { name: string; code?: string | null }>(
  products: T[],
  reference: string,
): T | null {
  const ref = reference.trim().toUpperCase()
  if (!ref) return null

  const byName = products.filter(p => p.name.toUpperCase() === ref)
  if (byName.length === 1) return byName[0]

  const byCode = products.filter(p => (p.code ?? '').toUpperCase() === ref)
  if (byCode.length === 1) return byCode[0]

  const byFuzzy = products.filter(p => fuzzyMatch(reference, p.name))
  if (byFuzzy.length === 1) return byFuzzy[0]

  return null
}

function makeOrbGreeting(firstName: string | undefined | null) {
  const name = firstName || ''
  const hour = new Date().getHours()
  const greetings = hour < 12
    ? [
      `Morning${name ? `, ${name}` : ''}. What's on your mind?`,
      `Good morning. What can I do?`,
      `Morning${name ? `, ${name}` : ''}. Where should we start?`,
      `Good morning${name ? `, ${name}` : ''}. What's first?`,
    ]
    : hour < 17
      ? [
        `Hey${name ? ` ${name}` : ''}. What's on your mind?`,
        `What can I help with?`,
        `Hey${name ? ` ${name}` : ''}. What are we looking at?`,
        `I'm here. What's next?`,
      ]
      : [
        `Evening${name ? `, ${name}` : ''}. What's on your mind?`,
        `Hey. What's up?`,
        `Evening${name ? `, ${name}` : ''}. Where should we pick up?`,
        `I'm here. What should we tackle?`,
      ]
  return greetings[Math.floor(Math.random() * greetings.length)]
}

function isOpeningGreetingText(text: string) {
  return /(?:what's on your mind|what can i do|what can i help with|what's up|where should we start|what's first|what are we looking at|what's next|where should we pick up|what should we tackle)\??$/i.test(text.trim())
}

function stripVoiceMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstSentences(text: string, maxChars: number, maxSentences: number) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text.slice(0, maxChars).trim()
  let result = ''
  for (const sentence of sentences.slice(0, maxSentences)) {
    if ((result + sentence).length > maxChars && result) break
    result += sentence
  }
  return (result.trim() || sentences[0].slice(0, maxChars).trim())
}

function toVoiceSpokenText(text: string) {
  const plain = stripVoiceMarkdown(text)
  if (!plain) return plain

  const bulkConfirm = plain.match(/\bconfirm:?\s+(.+?\b(?:\d+|all)\s+(?:todos|tasks|items)\b.*?)(?:\?|$)/i)
  if (bulkConfirm) {
    const summary = bulkConfirm[1].replace(/\s+/g, ' ').trim()
    return `Confirm ${summary}. See the transcript for the exact items. Confirm?`
  }

  const lead = firstSentences(plain.split('\n\n')[0], 320, 2)
  const hasMore = plain.length > lead.length + 30 || plain.includes('\n-') || plain.includes('\n\n')
  return hasMore ? `${lead} I put the details on screen.` : lead
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
  const systemState = useSystemState()
  const systemUpdateActiveRef = useRef(false)
  systemUpdateActiveRef.current = systemState.updateAvailable || systemState.isApplyingUpdate

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
  const [simulateError, setSimulateError]       = useState<SimulateError>(null)
  const [isInputFocused, setIsInputFocused]     = useState(false)
  const [userName, setUserName]                 = useState<string>('')
  const [userFullName, setUserFullName]         = useState<string>('')
  const [isNewUser, setIsNewUser]               = useState(false)
  const [urgencyThreshold, setUrgencyThreshold] = useState<number>(0)
  const [releaseStage, setReleaseStage]         = useState<string>('alpha')
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
  const openHelp = () => router.push('/help')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showEditProduct, setShowEditProduct] = useState(false)
  const [distillTodo, setDistillTodo]       = useState<any>(null)
  const [devError, setDevError]             = useState(false)

  if (devError) throw new DevTestError()

  // ── Voice mode ──
  const [ttsConfig, setTtsConfig] = useState<TtsConfig | undefined>(undefined)
  const voice = useVoiceMode(ttsConfig)
  const [voiceStarting, setVoiceStarting] = useState(false)
  const updateTtsConfigRef = useRef(voice.updateTtsConfig)
  updateTtsConfigRef.current = voice.updateTtsConfig
  const refreshTtsConfig = useCallback(async (): Promise<TtsConfig | null> => {
    try {
      const cfg = await getTtsConfig()
      setTtsConfig(cfg)
      updateTtsConfigRef.current(cfg)
      return cfg
    } catch (err) {
      console.error('[tts] config load failed:', err)
      return null
    }
  }, [])
  useEffect(() => {
    refreshTtsConfig()
  }, [refreshTtsConfig])
  useEffect(() => {
    const handleTtsConfigChanged = () => { refreshTtsConfig() }
    window.addEventListener(TTS_CONFIG_CHANGED_EVENT, handleTtsConfigChanged)
    return () => window.removeEventListener(TTS_CONFIG_CHANGED_EVENT, handleTtsConfigChanged)
  }, [refreshTtsConfig])
  const voiceActiveRef = useRef(false)
  voiceActiveRef.current = voice.voiceActive

  // ── Mutation gate ──
  const pendingMutationRef = useRef<PendingMutation | null>(null)
  const actionSetsRef = useRef<ActionSet[]>([])
  const clearActionSets = useCallback(() => {
    actionSetsRef.current = []
    try { sessionStorage.removeItem(SS_ACTION_SETS) } catch {}
  }, [])
  const rememberActionSet = useCallback((actionSet: ActionSet) => {
    const next = [...actionSetsRef.current, { ...actionSet, ordinal: actionSetsRef.current.length + 1 }].slice(-12)
    actionSetsRef.current = next
    try { sessionStorage.setItem(SS_ACTION_SETS, JSON.stringify(next)) } catch {}
  }, [])

  // ── Project switcher state ──
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  // projectSearchQuery removed — SearchModal handles its own query state
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([])
  const [projectsLoadError, setProjectsLoadError] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false)
  // blurTimeoutRef removed — inline search replaced by SearchModal
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
  const systemInfoRef          = useRef<SystemInfo | null>(null)
  const conversationRequestSequenceRef = useRef(0)
  const activeConversationRequestRef = useRef<{
    id: number
    processingId: string
    aborted: boolean
  } | null>(null)
  const cancelledConversationRequestIdsRef = useRef<Set<number>>(new Set())
  const messagesRef            = useRef<ConversationMessage[]>([])
  messagesRef.current = messages
  const lastSpokenVoiceMessageRef = useRef<{ id: string; text: string } | null>(null)
  const stoppedVoiceMessageIdsRef = useRef<Set<string>>(new Set())
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
  const voiceStyle   = voice.isListening
    ? { orbMid: '#c8e8e8', orbLo: '#a0d0d0', glow: 'rgba(60,180,180,0.5)', countColor: '#1a6060', labelColor: '#5aa0a0' }
    : voice.isSpeaking
    ? { orbMid: '#f0e8d0', orbLo: '#e8d8b0', glow: 'rgba(200,170,80,0.5)', countColor: '#8a6a20', labelColor: '#b8a050' }
    : null
  const style        = voiceStyle ?? ORB_STYLE[urgency]
  const speed        = voice.isListening ? '3s' : voice.isSpeaking ? '2.5s' : ORB_SPEED[urgency]
  const activeTodos  = orbTodos.filter(t => isActive(t.status))

  const closedNames  = useMemo(() => new Set(statuses.filter(s => s.is_closed).map(s => s.name)), [statuses])
  const isClosed     = useCallback((status: string) => closedNames.has(status), [closedNames])
  const statusColor  = useCallback((status: string) => `var(--status-${status.replace(/\s+/g, '-')})`, [])
  const productCodeMap = useMemo(() => new Map(products.map(p => [p.id, p.code])), [products])

  // adminSearchResults removed — SearchModal handles its own filtering

  async function refreshProjects() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const dq = visibleProjectsQuery(supabase, 'id, name, code, description, created_by, view_mode')
    const { data: freshProducts } = (authUser && !isAdmin) ? await dq.eq('created_by', authUser.id) : await dq
    const list = (freshProducts ?? []) as Product[]
    setProducts(list)
    if (isAdmin) {
      const { data } = await supabase
        .from('projects')
        .select('id, name, code, is_dormant, users!created_by(first_name, last_name)')
        .eq('is_dormant', false)
        .order('name')
      if (data) {
        setAdminProjects((data as any[]).map(p => ({
          id: p.id, name: p.name, code: p.code,
          owner_name: p.users ? [p.users.first_name, p.users.last_name].filter(Boolean).join(' ') : 'Unknown',
        })))
      }
    } else {
      setAdminProjects(list.map(p => ({ id: p.id, name: p.name, code: p.code ?? null, owner_name: '' })))
    }
    return list
  }

  // handleSearchFocus/Blur removed — SearchModal handles open/close

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

  // Fetch all projects with owner names for search dropdown
  // Admins: cross-user query with retry. Non-admins: use server-provided initialProducts.
  useEffect(() => {
    if (!isAdmin) {
      const fallback: AdminProject[] = (initialProducts ?? []).map(p => ({
        id: p.id, name: p.name, code: p.code ?? null, owner_name: '',
      }))
      setAdminProjects(fallback)
      return
    }

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
          const fallback: AdminProject[] = (initialProducts ?? []).map(p => ({
            id: p.id, name: p.name, code: p.code ?? null, owner_name: '',
          }))
          setAdminProjects(fallback)
          setProjectsLoadError(true)
          console.error('[UnifiedDashboard] Project search returned 0 results after retries')
          supabase.from('todos').insert({
            title: '[Auto] Project search returned empty results',
            description: `UnifiedDashboard loadAllProjects returned 0 rows after 3 attempts. User agent: ${navigator.userAgent}. Time: ${new Date().toISOString()}.`,
            product_id: 'f643f732-73b5-4bee-96be-da36197fb41c',
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
        const fallback: AdminProject[] = (initialProducts ?? []).map(p => ({
          id: p.id, name: p.name, code: p.code ?? null, owner_name: '',
        }))
        setAdminProjects(fallback)
        setProjectsLoadError(true)
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
  }, [supabase, initialProducts, isAdmin])

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

  const cancelSpeechRef = useRef(voice.cancelSpeech)
  cancelSpeechRef.current = voice.cancelSpeech
  const resumeListeningRef = useRef(voice.resumeListening)
  resumeListeningRef.current = voice.resumeListening
  const speakRef = useRef(voice.speak)
  speakRef.current = voice.speak

  const handleStop = useCallback(() => {
    const lastOrb = [...messagesRef.current].reverse().find(m => m.type === 'orb')
    if (lastOrb) stoppedVoiceMessageIdsRef.current.add(lastOrb.id)
    cancelSpeechRef.current()

    const request = activeConversationRequestRef.current
    if (request) {
      request.aborted = true
      cancelledConversationRequestIdsRef.current.add(request.id)
      activeConversationRequestRef.current = null
    }
    setMessages(prev => prev.map(m => {
      if (request && m.id === request.processingId) {
        return { ...m, isStreaming: false, text: m.text === 'Processing…' ? 'Stopped.' : m.text }
      }
      if (m.type === 'orb' && m.isStreaming) return { ...m, isStreaming: false }
      return m
    }))
    setSubmitting(false)
    window.setTimeout(() => {
      if (voiceActiveRef.current) resumeListeningRef.current()
    }, 80)
  }, [])

  // ── Voice mode handlers ──
  // Register the send callback so the hook can submit after recognition ends.
  // Ref indirection ensures the callback always uses the latest handleSubmit
  // and voice methods, not stale closures from the initial render.
  const voiceSendRef = useRef<(text: string) => void>(() => {})
  voiceSendRef.current = (text: string) => {
    handleSubmit(text)
  }
  useEffect(() => {
    voice.setOnSend((text: string) => voiceSendRef.current(text))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOrbTap = useCallback(async () => {
    if (noProject) return
    if (!voice.supportsVoice) return

    if (voice.voiceActive) return

    messagesRef.current
      .filter(m => m.type === 'orb')
      .forEach(m => stoppedVoiceMessageIdsRef.current.add(m.id))
    setVoiceStarting(true)
    voice.startConversation()
    setConversationActive(true)
    resetInactivity()
    const cfg = await refreshTtsConfig()
    if (!cfg) {
      const msg = 'I could not load voice settings, so I did not start voice playback. Check your connection and try again.'
      setMessages(prev => [...prev, { id: genId(), type: 'orb', text: msg }])
      setConversationActive(true)
      voice.exitVoiceMode()
      setVoiceStarting(false)
      return
    }

    const existingOpening = messagesRef.current.length === 1 ? messagesRef.current[0] : null
    if (existingOpening?.type === 'orb' && isOpeningGreetingText(existingOpening.text)) {
      lastSpokenVoiceMessageRef.current = { id: existingOpening.id, text: existingOpening.text }
      voice.speak(existingOpening.text)
      return
    }

    const greeting = makeOrbGreeting(user?.first_name)
    const greetingId = genId()
    greetingFiredRef.current = true
    lastSpokenVoiceMessageRef.current = { id: greetingId, text: greeting }
    setMessages(prev => [...prev, { id: greetingId, type: 'orb', text: greeting }])
    voice.speak(greeting)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noProject, voice.voiceActive, voice.supportsVoice, user?.first_name, refreshTtsConfig])

  useEffect(() => {
    if (!voiceStarting) return
    if (voice.isSpeaking || voice.isListening || voice.ttsError || voice.wasInterrupted || !voice.voiceActive) {
      setVoiceStarting(false)
    }
  }, [voice.isListening, voice.isSpeaking, voice.ttsError, voice.voiceActive, voice.wasInterrupted, voiceStarting])

  // Auto-TTS: speak each Orb response exactly once, when its turn completes.
  // Voice never chases the stream — the screen shows streaming progress, and
  // the spoken text is derived once from the final response. This is what
  // keeps voice from repeating itself when the server replaces streamed
  // narration with deterministic text (confirmations, corrections).
  useEffect(() => {
    if (!voice.voiceActive) return
    const lastOrb = [...messages].reverse().find(m => m.type === 'orb')
    if (!lastOrb) return
    if (lastOrb.isStreaming) return
    if (stoppedVoiceMessageIdsRef.current.has(lastOrb.id)) return

    const spokenText = lastOrb.spokenText ?? lastOrb.text
    if (!spokenText) return
    if (lastOrb.text === 'Processing…' || lastOrb.text === 'Stopped.') return
    if (activeConversationRequestRef.current?.aborted) return

    const lastSpoken = lastSpokenVoiceMessageRef.current
    if (lastSpoken?.id === lastOrb.id && lastSpoken.text === spokenText) return
    lastSpokenVoiceMessageRef.current = { id: lastOrb.id, text: spokenText }
    speakRef.current(spokenText)
  }, [messages, voice.voiceActive])

  // Keyboard shortcut: Cmd+Shift+O toggles voice mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'o' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        if (voice.voiceActive) {
          voice.exitVoiceMode()
        } else {
          handleOrbTap()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleOrbTap, voice])

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
    const savedActionSets = sessionStorage.getItem(SS_ACTION_SETS)
    if (savedActionSets) {
      try {
        const parsed = JSON.parse(savedActionSets)
        if (Array.isArray(parsed)) actionSetsRef.current = parsed.slice(-12)
      } catch { /* ignore */ }
    }
    setIsRestored(true)
  }, [])

  // Persist conversation
  useEffect(() => {
    if (!isRestored) return
    if (messages.length > 0) sessionStorage.setItem(SS_CONVERSATION, JSON.stringify(messages))
    else {
      sessionStorage.removeItem(SS_CONVERSATION)
      sessionStorage.removeItem(SS_ACTION_SETS)
      actionSetsRef.current = []
    }
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
      setProjectMenuOpen(false)
      setConfirmProjectDelete(false)
      if (!orbSwitchingRef.current) {
        setMessages([])
        clearActionSets()
        setConversationActive(false)
        sessionStorage.removeItem(SS_CONVERSATION)
        if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
      }
      orbSwitchingRef.current = false
    }
    prevSelectedId.current = selectedId
  }, [selectedId, clearActionSets])

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
        const { data } = (authUser && !isAdmin) ? await q.eq('created_by', authUser.id) : await q
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

  // Welcome modal — shown on first login, offers the guided tour
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  useEffect(() => {
    if (!isNewUser || welcomeDismissedRef.current) return
    welcomeDismissedRef.current = true
    setIsNewUser(false)
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        localStorage.setItem(`todos_welcome_shown_${authUser.id}`, '1')
        supabase.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', authUser.id).then(() => {})
      }
    })
    setShowWelcomeModal(true)
  }, [isNewUser])

  // Register the guided tour runner so the conversation nudge button and the
  // Help modal can launch it (via launchOrbTour) without prop-drilling. The
  // runner captures the live mobile state + pane switchers and best-effort
  // selects the Welcome project so the tour's anchors exist on screen.
  useEffect(() => {
    registerOrbTour(() => runOrbTour({
      isMobile,
      showOrbPane: () => { if (isMobile) setActiveMobileTab('orb'); else setOrbPaneVisible(true) },
      showListPane: () => { if (isMobile) setActiveMobileTab('list'); else setListPaneVisible(true) },
      selectWelcomeProject: () => {
        const welcome = products.find(p => p.code?.toUpperCase() === 'WELCOME')
        if (welcome) setSelectedId(welcome.id)
      },
    }))
    return () => unregisterOrbTour()
  }, [isMobile, products])

  // Initial greeting: start the conversation without an automatic backlog summary.
  useEffect(() => {
    if (greetingFiredRef.current || !selectedId || isNewUser || messages.length > 0) return
    greetingFiredRef.current = true
    setMessages([{ id: genId(), type: 'orb', text: makeOrbGreeting(user?.first_name) }])
    setConversationActive(true)
    resetInactivity()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isNewUser, user?.first_name])

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

  // Dev channel — lightweight polling while the page is visible (admin-only)
  const devPollInFlightRef = useRef(false)
  const devPollDisabledRef = useRef(false)
  const devPollMismatchLoggedRef = useRef(false)
  const pollDevChannel = useCallback(async () => {
    if (!isAdmin) return
    if (devPollDisabledRef.current) return
    if (systemUpdateActiveRef.current) return
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
      purgeOldDevMessages().catch(e => console.warn('[dashboard] purge old dev messages failed:', e))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Server Action') && message.includes('was not found on the server')) {
        devPollDisabledRef.current = true
        if (!devPollMismatchLoggedRef.current) {
          devPollMismatchLoggedRef.current = true
          console.info('[UnifiedDashboard] Dev channel poll paused after a dev-server action refresh. Hard refresh to resume polling.')
        }
        return
      }
      if (message.includes('An unexpected response was received from the server')) {
        devPollDisabledRef.current = true
        if (!devPollMismatchLoggedRef.current) {
          devPollMismatchLoggedRef.current = true
          console.info('[UnifiedDashboard] Dev channel poll paused during a dev-server restart. The release coordinator will refresh the tab.')
        }
        return
      }
      console.error('[UnifiedDashboard] Dev channel poll failed:', err)
    } finally {
      devPollInFlightRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    function pollIfVisible() {
      if (document.visibilityState === 'visible') pollDevChannel()
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) pollIfVisible()
    }

    pollIfVisible()
    window.addEventListener('focus', pollIfVisible)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', pollIfVisible)
    const interval = window.setInterval(pollIfVisible, DEV_CHANNEL_POLL_INTERVAL)

    return () => {
      window.removeEventListener('focus', pollIfVisible)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', pollIfVisible)
      window.clearInterval(interval)
    }
  }, [pollDevChannel])

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
    parts.push(`${selected.name} — ${active.length} active`)
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
    if (voiceActiveRef.current) { prevUrgencyRef.current = urgency; return }
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

  async function handleSubmit(value?: string) {
    const text = (value ?? input).trim()
    if (!text || activeConversationRequestRef.current) return

    if (text === '?' || text === '/?') { openHelp(); setInput(''); return }

    if (text.startsWith('/')) {
      setInput('')
      sessionStorage.removeItem(SS_INPUT)
      const [cmd, ...args] = text.split(' ')
      if (cmd === '/settings') router.push('/settings')
      else if (cmd === '/help' || cmd === '/?') openHelp()
      else if (cmd === '/clear') { setMessages([]); clearActionSets(); setConversationActive(false); sessionStorage.removeItem(SS_CONVERSATION); greetingFiredRef.current = false }
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
        if (!target) { toast.neutral('Usage: /drop [project name]'); return }
        const t = resolveProjectByReference(products, target)
        if (!t) { toast.neutral(`Project "${target}" not found.`); return }
        handleSubmit(`Delete the project ${t.name}`)
      } else if (cmd === '/edit') {
        const target = args.join(' ').trim()
        if (target) {
          const t = resolveProjectByReference(products, target)
          if (t) { setSelectedId(t.id); setShowEditProduct(true) }
          else toast.neutral(`Project "${target}" not found.`)
        } else {
          if (!selectedId) { toast.neutral('Add a project first.'); return }
          setShowEditProduct(true)
        }
      } else if (cmd === '/switch') {
        const target = args.join(' ').trim()
        if (!target) { toast.neutral('Usage: /switch [project name]'); return }
        const t = resolveProjectByReference(products, target)
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
    const request = {
      id: ++conversationRequestSequenceRef.current,
      processingId,
      aborted: false,
    }
    activeConversationRequestRef.current = request

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
      if (!systemInfoRef.current) systemInfoRef.current = collectSystemInfo()
      const outgoingMutation = pendingMutationRef.current
      pendingMutationRef.current = null
      const stream = await orbConverse({ input: text, productId: selectedId, history, dryRun, simulateError, systemInfo: systemInfoRef.current, pendingMutation: outgoingMutation ?? undefined, actionSets: actionSetsRef.current, uiContext: { viewMode, filterStatus, filterPriority, sortAsc, orbPaneVisible, listPaneVisible, isMobile, daysActive, voiceMode: voice.voiceActive, availableVoices: voice.voiceActive ? voice.availableVoices.map(v => v.name) : undefined, currentVoice: voice.voiceActive ? voice.selectedVoiceName || undefined : undefined, ttsProvider: voice.voiceActive ? ttsConfig?.provider : undefined, ttsModel: voice.voiceActive ? ttsConfig?.model : undefined, ttsVoiceId: voice.voiceActive ? ttsConfig?.voiceId : undefined } })
      for await (const chunk of readStreamableValue(stream)) {
        if (request.aborted || cancelledConversationRequestIdsRef.current.has(request.id)) break
        if (!chunk) continue
        setMessages(prev => prev.map(m => {
          if (m.id !== processingId) return m
          const newThoughts = m.thoughts ? [...m.thoughts] : []
          if (chunk.thought && !newThoughts.includes(chunk.thought)) newThoughts.push(chunk.thought)
          const displayText = chunk.speech || m.text
          return {
            ...m,
            text: displayText,
            // Derived once, at turn end — mid-stream text is display-only.
            spokenText: voice.voiceActive && !chunk.isStreaming ? toVoiceSpokenText(displayText) : undefined,
            insight: chunk.insight || m.insight,
            thoughts: newThoughts,
            isStreaming: chunk.isStreaming,
            isServiceError: chunk.isServiceError || m.isServiceError,
          }
        }))
        if (chunk.refresh) {
          setPulse(true)
          setTimeout(() => setPulse(false), 420)
          const isProjectMutation = chunk.mutationType === 'dormancy' || chunk.mutationType === 'project_create' || chunk.mutationType === 'project_update' || chunk.mutationType === 'project_delete'
          if (isProjectMutation) {
            const list = await refreshProjects()
            if (chunk.mutationType === 'project_create' && chunk.newProject) {
              orbSwitchingRef.current = true
              setSelectedId(chunk.newProject.id)
              toast.success('Project created.')
            } else if (list.length > 0 && !list.find(p => p.id === selectedId)) {
              setSelectedId(list[0].id)
            }
          } else {
            if (chunk.mutatedProductId === selectedId) { fetchOrbTodos(); fetchTodos() }
            if (!chunk.isStreaming) {
              if (chunk.actionSet) toast.success(chunk.actionSet.summary)
              else if (chunk.mutationType === 'create') toast.success('Todo created.')
              else if (chunk.mutationType === 'update') toast.success('Todo saved.')
              else if (chunk.mutationType === 'delete') toast.success('Todo deleted.')
              else toast.success('Todo updated.')
            }
          }
        }
        if (chunk.clientAction) {
          const action = chunk.clientAction
          if (action.action === 'switch_project' && action.target) {
            const t = resolveProjectByReference(products, action.target)
            if (t) { orbSwitchingRef.current = true; setSelectedId(t.id) }
          } else if (action.action === 'open_settings') router.push('/settings')
          else if (action.action === 'open_help') openHelp()
          else if (action.action === 'check_update') {
            try {
              systemState.refresh()
              const res = await fetch(`/api/version?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'cache-control': 'no-cache' },
              })
              const data = await res.json()
              if (data.version && data.version !== systemState.clientVersion) {
                toast.success(`Update available: ${data.version} (you have ${systemState.clientVersion})`)
              } else {
                toast.success(`You're up to date (${systemState.clientVersion})`)
              }
            } catch {
              toast.error('Could not check for updates')
            }
          } else if (action.action === 'apply_update') {
            await systemState.applyUpdate()
          } else if (action.action === 'set_voice' && action.target) {
            voice.setVoice(action.target)
          } else if (action.action === 'exit_voice') {
            voice.exitVoiceMode()
          }
        }
        if (chunk.suggestedKnowledge) setDistillTodo(chunk.suggestedKnowledge)
        if (chunk.pendingMutation) pendingMutationRef.current = chunk.pendingMutation
        if (chunk.actionSet) rememberActionSet(chunk.actionSet)
      }
    } catch (err: any) {
      console.error('[orbSubmit]', err)
      if (isAuthError(String(err))) { handleSessionExpired(toast); return }
      if (!request.aborted && !cancelledConversationRequestIdsRef.current.has(request.id)) {
        const msg = err instanceof TypeError && /(fetch|load failed|network)/i.test(err.message)
          ? 'Lost connection. Check your network and try again.'
          : err?.name === 'AbortError' || err?.name === 'TimeoutError'
            ? 'Request took too long. Try again.'
            : 'Something went wrong. Try again?'
        setMessages(prev => prev.map(m => m.id === processingId ? { ...m, text: msg, spokenText: voice.voiceActive ? msg : undefined } : m))
      }
    } finally {
      const wasCancelled = request.aborted || cancelledConversationRequestIdsRef.current.has(request.id)
      if (activeConversationRequestRef.current?.id === request.id) {
        activeConversationRequestRef.current = null
        setSubmitting(false)
      }
      setMessages(prev => prev.map(m => {
        if (m.id !== processingId) return m
        if (wasCancelled) {
          const text = m.text === 'Processing…' ? 'Stopped.' : m.text
          return { ...m, isStreaming: false, text, spokenText: voice.voiceActive ? text : m.spokenText }
        }
        const text = m.text === 'Processing…' ? 'Orb could not complete that request. Please try again.' : m.text
        return {
          ...m,
          isStreaming: false,
          text,
          spokenText: voice.voiceActive ? toVoiceSpokenText(text) : m.spokenText,
        }
      }))
      cancelledConversationRequestIdsRef.current.delete(request.id)
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
      if (!systemInfoRef.current) systemInfoRef.current = collectSystemInfo()
      logAudit({ action: isClosed(newStatus) ? 'todo_close' : 'todo_reopen', table_name: 'todos', record_id: todo.id, before: { status: todo.status }, after: { status: newStatus, title: todo.title }, system_info: systemInfoRef.current })
      if (beforeUrgency) {
        try {
          await notifyIfEscalated(beforeUrgency)
        } catch (err) {
          console.error('[UnifiedDashboard] notifyIfEscalated failed:', err)
        }
      }
      if (isClosed(newStatus)) setDistillTodo(updated)

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
      if (!systemInfoRef.current) systemInfoRef.current = collectSystemInfo()
      logAudit({ action: isClosing ? 'todo_close' : 'todo_update', table_name: 'todos', record_id: todo.id, before: { status: todo.status }, after: { status: newStatus, title: todo.title }, system_info: systemInfoRef.current })
      if (isClosing) setDistillTodo(updated)

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
    if (!systemInfoRef.current) systemInfoRef.current = collectSystemInfo()
    logAudit({ action: 'todo_bulk_close', table_name: 'todos', after: { count: ids.length, ids }, system_info: systemInfoRef.current })
    if (beforeUrgency) {
      try {
        await notifyIfEscalated(beforeUrgency)
      } catch (err) {
        console.error('[UnifiedDashboard] notifyIfEscalated failed:', err)
      }
    }
    await fetchTodos()
    fetchOrbTodos()

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
    if (!systemInfoRef.current) systemInfoRef.current = collectSystemInfo()
    logAudit({ action: 'todo_bulk_delete', table_name: 'todos', before: { count: ids.length, ids }, system_info: systemInfoRef.current })
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
      const minSize = 360
      const current = prev ?? total * 0.5
      const next = Math.max(minSize, Math.min(total - minSize - 28, current + delta))
      return next
    })
  }, [isMobile])

  const handleDividerResizeEnd = useCallback(() => {
    const container = splitRef.current
    if (!container || orbPaneSize === null) return
    try {
      const key = isMobile ? 'orb_split_ratio_mobile' : 'orb_split_ratio'
      localStorage.setItem(key, String(orbPaneSize))
    } catch { /* ignore */ }
  }, [orbPaneSize, isMobile])

  // ══════════════════════════════════════════════════════════
  // RENDER — Orb element
  // ══════════════════════════════════════════════════════════

  const orbScale = (isInputFocused && isMobile) ? 0.45 : 1.0
  const voiceBusy = submitting || messages.some(m => m.isStreaming)
  const voiceGathering = voice.voiceActive && !voice.isListening && !voice.isSpeaking && voiceBusy

  const orbElement = (
    <div className="dash-orb-wrap" data-tour="orb" data-mode={voice.voiceActive ? 'voice' : conversationActive ? 'dialogue' : 'ambient'}>
      <div
        onPointerDown={() => {
          orbPressedRef.current = false
          orbLongPressRef.current = setTimeout(() => {
            orbPressedRef.current = true
            if (voice.voiceActive) {
              voice.exitVoiceMode()
            } else if (conversationActive) {
              setConversationActive(false)
              if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null }
            }
          }, 500)
        }}
        onPointerUp={() => { if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null } }}
        onPointerCancel={() => { if (orbLongPressRef.current) { clearTimeout(orbLongPressRef.current); orbLongPressRef.current = null } }}
        onClick={() => {
          if (orbPressedRef.current) return
          handleOrbTap()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOrbTap()
          }
        }}
        data-tooltip={voice.voiceActive ? (voice.isListening ? 'Listening...' : voice.isSpeaking ? 'Speaking...' : 'Voice active') : noProject ? 'Select a project first' : 'Tap to talk'}
        style={{
          position: 'relative',
          width: voice.voiceActive ? 'clamp(150px, 24vh, 215px)' : 'clamp(140px, 25vh, 200px)',
          height: voice.voiceActive ? 'clamp(150px, 24vh, 215px)' : 'clamp(140px, 25vh, 200px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto',
          transform: `scale(${orbScale})`, transformOrigin: 'top center',
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
          opacity: orbFading ? 0 : 1,
          WebkitTouchCallout: 'none', userSelect: 'none',
        }}
        aria-label={voice.voiceActive ? 'Voice conversation active' : `${activeTodos.length} active todos`}
        role="button" tabIndex={0}
      >
        {/* Glow */}
        {/* Voice mode ring */}
        {voice.voiceActive && (
          <div style={{
            position: 'absolute', inset: '-6px', borderRadius: '50%',
            border: `2px solid ${voice.isListening ? 'rgba(60,180,180,0.6)' : voice.isSpeaking ? 'rgba(200,170,80,0.6)' : 'rgba(120,160,120,0.3)'}`,
            animation: voice.isListening || voice.isSpeaking ? `orb-voice-ring ${speed} ease-in-out infinite` : 'none',
            transition: 'border-color 0.5s',
            pointerEvents: 'none',
          }} />
        )}

        {/* Glow */}
        <div style={{
          position: 'absolute', inset: noProject ? '-18px' : voice.isListening ? '-42px' : voice.isSpeaking ? '-48px' : ORB_GLOW[urgency].inset, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${noProject ? NO_PROJECT_STYLE.glow : style.glow}, transparent 70%)`,
          filter: `blur(${noProject ? '20px' : voice.isListening ? '32px' : voice.isSpeaking ? '36px' : ORB_GLOW[urgency].blur})`,
          animation: noProject ? 'none' : voice.isListening ? `orb-glow-listening ${speed} ease-in-out infinite` : voice.isSpeaking ? `orb-glow-speaking ${speed} ease-in-out infinite` : `todos-glow-${urgency} ${speed} ease-in-out infinite`,
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
          animation: noProject ? 'none' : voice.isListening ? `orb-listening ${speed} ease-in-out infinite` : voice.isSpeaking ? `orb-speaking ${speed} ease-in-out infinite` : `${ORB_ANIMATION[urgency]} ${speed} ease-in-out infinite`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2px',
          transition: 'background 0.8s, box-shadow 0.8s',
        }}>
          {voice.voiceActive ? (
            <>
              {/* Voice state icon */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative', zIndex: 1 }}>
                {voiceGathering && (
                  <div className="ud-voice-progress" aria-hidden="true">
                    <span />
                  </div>
                )}
                {voiceStarting ? (
                  /* Sound waves — starting */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.labelColor} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.8s' }}>
                    <line x1="4" y1="8" x2="4" y2="16"/>
                    <line x1="8" y1="5" x2="8" y2="19"/>
                    <line x1="12" y1="3" x2="12" y2="21"/>
                    <line x1="16" y1="5" x2="16" y2="19"/>
                    <line x1="20" y1="8" x2="20" y2="16"/>
                  </svg>
                ) : voice.isListening ? (
                  /* Sound waves — listening */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.labelColor} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.8s' }}>
                    <line x1="4" y1="8" x2="4" y2="16"/>
                    <line x1="8" y1="5" x2="8" y2="19"/>
                    <line x1="12" y1="3" x2="12" y2="21"/>
                    <line x1="16" y1="5" x2="16" y2="19"/>
                    <line x1="20" y1="8" x2="20" y2="16"/>
                  </svg>
                ) : voice.isSpeaking ? (
                  /* Sound waves — speaking (bolder) */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.labelColor} strokeWidth="2" strokeLinecap="round" style={{ transition: 'stroke 0.8s' }}>
                    <line x1="4" y1="8" x2="4" y2="16"/>
                    <line x1="8" y1="4" x2="8" y2="20"/>
                    <line x1="12" y1="2" x2="12" y2="22"/>
                    <line x1="16" y1="4" x2="16" y2="20"/>
                    <line x1="20" y1="8" x2="20" y2="16"/>
                  </svg>
                ) : voiceBusy ? (
                  /* Lightbulb — thinking */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.labelColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.8s' }}>
                    <path d="M9 18h6"/>
                    <path d="M10 22h4"/>
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>
                  </svg>
                ) : (
                  /* Ready — transient state while recognition restarts */
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={style.labelColor} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.8s' }}>
                    <line x1="4" y1="8" x2="4" y2="16"/>
                    <line x1="8" y1="5" x2="8" y2="19"/>
                    <line x1="12" y1="3" x2="12" y2="21"/>
                    <line x1="16" y1="5" x2="16" y2="19"/>
                    <line x1="20" y1="8" x2="20" y2="16"/>
                  </svg>
                )}
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', letterSpacing: 'var(--ls-wide)', color: style.labelColor, transition: 'color 0.8s' }}>
                  {voiceStarting ? 'Starting…' : voice.isListening ? 'Listening…' : voice.isSpeaking ? 'Speaking…' : voiceGathering ? 'Gathering data…' : voice.wasInterrupted ? 'Stopped' : 'Ready'}
                </span>
                {/* Thinking progress line */}
                {voiceGathering && (() => {
                  const lastThought = [...messages].reverse().find(m => m.type === 'orb' && m.thoughts?.length)
                  const thought = lastThought?.thoughts?.[lastThought.thoughts.length - 1]
                  return thought ? (
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: style.labelColor, opacity: 0.7, maxWidth: '80%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.8s' }}>
                      {thought}
                    </span>
                  ) : null
                })()}
              </div>
            </>
          ) : (
            <>
              <svg width="100%" height="100%" viewBox="0 0 164 164" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} aria-hidden>
                <defs>
                  <path id="ud-orb-name-arc" d="M 24 82 A 58 58 0 0 1 140 82" fill="none" />
                  <path id="ud-orb-state-arc" d="M 24 82 A 58 58 0 0 0 140 82" fill="none" />
                </defs>
                <text fontFamily="var(--font-ui)" fontSize="11" fontWeight={600} letterSpacing="3" fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor} style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}>
                  <textPath href="#ud-orb-name-arc" startOffset="50%" textAnchor="middle">
                    {noProject ? 'WAITING' : clampProjectName(selected?.name ?? '')}
                  </textPath>
                </text>
                <text fontFamily="var(--font-ui)" fontSize="11" fontWeight={600} letterSpacing="3" fill={noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor} style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}>
                  <textPath href="#ud-orb-state-arc" startOffset="50%" textAnchor="middle">
                    {noProject ? 'SET UP' : urgency.toUpperCase()}
                  </textPath>
                </text>
              </svg>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-orb)', fontWeight: 'var(--fw-light)', color: noProject ? NO_PROJECT_STYLE.countColor : style.countColor, letterSpacing: 'var(--ls-tight)', lineHeight: 'var(--lh-none)', transition: 'color 0.8s' }}>
                {noProject ? '—' : activeTodos.length}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-normal)', letterSpacing: 'var(--ls-widest)', textTransform: 'uppercase', color: noProject ? NO_PROJECT_STYLE.labelColor : style.labelColor, transition: 'color 0.8s' }}>
                {noProject ? 'no project' : 'active'}
              </span>
            </>
          )}
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

        {/* ── Unified Nav ── */}
        <AppNav
          printContext={{ productId: selectedId, productName: selected?.name ?? null }}
          userInitial={(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
          userName={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || undefined}
          onSearchProjects={() => setProjectSearchOpen(true)}
          onAddProject={() => setShowAddProduct(true)}
          orbToggle={
            <button
              className="appnav-btn appnav-edge"
              data-tour="orb-toggle"
              onClick={isMobile ? () => setActiveMobileTab('orb') : () => setOrbPaneVisible(v => !v)}
              data-tooltip={isMobile ? (activeMobileTab === 'orb' ? 'Viewing Orb' : 'Show Orb') : (orbPaneVisible ? 'Hide Orb' : 'Show Orb')}
              aria-label={isMobile ? (activeMobileTab === 'orb' ? 'Viewing Orb' : 'Show Orb') : (orbPaneVisible ? 'Hide Orb' : 'Show Orb')}
              aria-pressed={isMobile ? activeMobileTab === 'orb' : orbPaneVisible}
              disabled={isMobile && activeMobileTab === 'orb'}
            >
              <span className="appnav-btn-icon">
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14.5" fill="url(#orbFavGrad)" />
                  <ellipse cx="12" cy="11" rx="5.5" ry="4" fill="rgba(255,255,255,0.55)" />
                  <defs><radialGradient id="orbFavGrad" cx="36%" cy="30%" r="60%"><stop offset="0%" stopColor="#ffffff"/><stop offset="45%" stopColor="#d4e4d4"/><stop offset="100%" stopColor="#6a9a7a"/></radialGradient></defs>
                </svg>
              </span>
              <span className="appnav-btn-label">{isMobile ? 'Orb' : (orbPaneVisible ? 'Hide' : 'Show')}</span>
            </button>
          }
          listToggle={
            <button
              className="appnav-btn appnav-edge"
              onClick={isMobile ? () => setActiveMobileTab('list') : () => setListPaneVisible(v => !v)}
              data-tooltip={isMobile ? (activeMobileTab === 'list' ? 'Viewing List' : 'Show List') : (listPaneVisible ? 'Hide List' : 'Show List')}
              aria-label={isMobile ? (activeMobileTab === 'list' ? 'Viewing List' : 'Show List') : (listPaneVisible ? 'Hide List' : 'Show List')}
              aria-pressed={isMobile ? activeMobileTab === 'list' : listPaneVisible}
              disabled={isMobile && activeMobileTab === 'list'}
            >
              <span className="appnav-btn-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </span>
              <span className="appnav-btn-label">{isMobile ? 'List' : (listPaneVisible ? 'Hide' : 'Show')}</span>
            </button>
          }
        />

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
              onClearTranscript={() => { setMessages([]); clearActionSets(); setConversationActive(false); sessionStorage.removeItem(SS_CONVERSATION) }}
              onInputChange={v => { setInput(v); sessionStorage.setItem(SS_INPUT, v) }}
              onSubmit={handleSubmit}
              onStop={handleStop}
              onFocusChange={setIsInputFocused}
              onSelectProject={id => { setSelectedId(id) }}
              selectedProjectId={selectedId}
              onShowEditProject={() => setShowEditProduct(true)}
              onShowAddProject={() => setShowAddProduct(true)}
              voiceActive={voice.voiceActive}
              voiceListening={voice.isListening}
              voiceSpeaking={voice.isSpeaking}
              voiceTranscript={voice.transcript}
              voiceInterrupted={voice.wasInterrupted}
              voiceError={voice.ttsError}
              voiceWarnings={voice.capabilities.warnings}
              supportsVoiceMode={voice.supportsVoice && !noProject}
              onStartVoiceMode={handleOrbTap}
              onVoiceContinue={voice.resumeListening}
              onVoiceStop={handleStop}
              onExitVoiceMode={() => { handleStop(); voice.exitVoiceMode() }}
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
              {selected && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn-overflow"
                    aria-label="Project actions"
                    data-tooltip="Project actions"
                    onClick={() => { setProjectMenuOpen(v => !v); setConfirmProjectDelete(false) }}
                  >
                    &#x22EE;
                  </button>
                  {projectMenuOpen && (
                    <>
                      <div className="dropdown-backdrop" onClick={e => { e.stopPropagation(); setProjectMenuOpen(false); setConfirmProjectDelete(false) }} />
                      <div className="dropdown-menu" style={{ top: '100%', bottom: 'auto', marginTop: '2px', left: 0, right: 'auto' }}>
                        <button className="dropdown-item" onClick={() => { setProjectMenuOpen(false); setShowEditProduct(true) }}>
                          Edit Project
                        </button>
                        <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                        {confirmProjectDelete ? (
                          <button
                            className="dropdown-item"
                            style={{ color: 'var(--error)', fontWeight: 'var(--fw-medium)' } as React.CSSProperties}
                            onClick={async () => {
                              const result = await deleteProject(selected.id)
                              if (result.error) { toast.error('Failed to delete project.'); return }
                              toast.success('Project deleted.')
                              const list = await refreshProjects()
                              setSelectedId(list.find(p => p.id !== selected.id)?.id ?? null)
                              setProjectMenuOpen(false)
                              setConfirmProjectDelete(false)
                            }}
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button className="dropdown-item" style={{ color: 'var(--error)' }} onClick={() => setConfirmProjectDelete(true)}>
                            Delete Project
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={{ flex: 1 }} />
              <div className="tv-toolbar">
                <button className="tv-toolbar-btn" onClick={() => setSortAsc(v => !v)} aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'} data-tooltip={sortAsc ? 'Oldest first' : 'Newest first'}>
                  Sort
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {sortAsc ? <path d="M12 19V5M5 12l7-7 7 7"/> : <path d="M12 5v14M5 12l7 7 7-7"/>}
                  </svg>
                </button>
                <button className="tv-toolbar-btn" aria-pressed={showFilters} onClick={() => { setShowFilters(f => !f); setShowListViews(false) }} aria-label="Toggle filters" data-tooltip="Filter tasks">
                  Filter <span className="tv-badge">{todos.length}</span>
                </button>
                <button className="tv-toolbar-btn" data-tour="views" aria-pressed={showListViews} onClick={() => { setShowListViews(v => !v); setShowFilters(false) }} data-tooltip="List views">
                  Views
                </button>
                <button
                  className="tv-toolbar-primary"
                  onClick={() => {
                    if (products.length === 0) {
                      toast.neutral('Please create a project first.')
                    } else {
                      setShowNewTodo(true)
                    }
                  }}
                  style={products.length === 0 ? { opacity: 'var(--opacity-disabled)', cursor: 'not-allowed' } : undefined}
                  data-tooltip="Create a new task"
                >
                  + New
                </button>
              </div>
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div className="tv-filterbar">
                <FilterKebab
                  value={filterStatus}
                  onChange={setFilterStatus}
                  ariaLabel="Filter by status"
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'active', label: 'Active (Open + In Progress)' },
                    { value: 'inactive', label: 'Parked (Deferred + On Hold)' },
                    { value: 'open', label: 'Open' },
                    { value: 'in progress', label: 'In Progress' },
                    { value: 'deferred', label: 'Deferred' },
                    { value: 'on hold', label: 'On Hold' },
                    { value: 'closed', label: 'Closed' },
                  ]}
                />
                <FilterKebab
                  value={filterPriority}
                  onChange={setFilterPriority}
                  ariaLabel="Filter by priority"
                  options={[
                    { value: 'all', label: 'All priorities' },
                    ...priorities.map(p => ({ value: String(p.value), label: p.label })),
                  ]}
                />
                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>{todos.length} todo{todos.length !== 1 ? 's' : ''}</span>
                <button className="nav-circle-btn" onClick={() => setShowFilters(false)} aria-label="Close filters" data-tooltip="Close filters">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
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
                    <span className="text-error" style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>Delete {selectedIds.length} todo{selectedIds.length !== 1 ? 's' : ''}?</span>
                    <button className="tv-bulk-confirm" onClick={handleBulkDelete}>Confirm</button>
                    <button className="tv-bulk-btn text-muted" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--text2)', fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>{selectedIds.length} selected</span>
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
              {products.length === 0 ? (
                <EmptyState variant="no-projects" action={{ label: '+ Create Project', onClick: () => setShowAddProduct(true) }} />
              ) : listLoading ? (
                <SkeletonRows />
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
                  <button onClick={() => fetchTodos(page + 1, true)} className="tv-toolbar-btn">
                    Load more tasks
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
        </div>


      </div>

      {/* ── Modals ── */}
      {selectedTodo && (
        <TodoPanel key={selectedTodo.id} todo={selectedTodo} products={products as any} priorities={priorities as any} statuses={statuses} isAll={false}
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


      {showAddProduct && (
        <AddProductModal ownerId={null} onClose={() => setShowAddProduct(false)}
          onCreated={project => { refreshProjects(); setSelectedId(project.id); setShowAddProduct(false) }}
        />
      )}

      {showEditProduct && selected && (
        <AddProductModal project={selected as any} onClose={() => setShowEditProduct(false)}
          onUpdated={() => { refreshProjects(); setShowEditProduct(false) }}
          onDeleted={id => { refreshProjects().then(list => { if (selectedId === id) setSelectedId(list[0]?.id ?? null) }); setShowEditProduct(false) }}
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

      {projectSearchOpen && (
        <SearchModal
          title="Change Project"
          placeholder="Search projects…"
          items={adminProjects.map(p => ({
            id: p.id,
            label: p.name,
            detail: isAdmin && p.owner_name && p.owner_name !== 'Unknown' ? p.owner_name : undefined,
            active: p.id === selectedId,
          }))}
          onSelect={id => { setSelectedId(id); listInitialLoadDone.current = false }}
          onClose={() => setProjectSearchOpen(false)}
          emptyMessage="No matching projects"
          errorMessage={projectsLoadError ? 'Projects failed to load.' : undefined}
        />
      )}

      {/* ── Welcome modal (new users) ── */}
      {showWelcomeModal && (
        <div className="modal-overlay" onClick={() => setShowWelcomeModal(false)}>
          <div
            className="modal-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-dialog-title"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <div style={{ padding: 'var(--sp-2xl) var(--sp-xl) var(--sp-xl)' }}>
              <h2 id="welcome-dialog-title" style={{ margin: '0 0 var(--sp-md)', fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)' }}>
                {user?.first_name ? `Hi ${user.first_name}, welcome to Orb` : 'Welcome to Orb'}
              </h2>
              <p style={{ margin: '0 0 var(--sp-lg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)' }}>
                Want a quick tour? It takes about a minute.
                <br />
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.7 }}>You can always start it later from Menu → Help.</span>
              </p>
              <div className="modal-footer" style={{ justifyContent: 'center', gap: 'var(--sp-md)', padding: 0, borderTop: 'none' }}>
                <button
                  className="btn-cancel"
                  onClick={() => setShowWelcomeModal(false)}
                >
                  Maybe later
                </button>
                <button
                  className="btn-primary"
                  onClick={() => { setShowWelcomeModal(false); launchOrbTour() }}
                >
                  Yes, show me around
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OrbDevPanel
        override={moodOverride} onChange={setMoodOverride}
        roleOverride={roleOverride} onRoleOverrideChange={setRoleOverride}
        onSpeak={speech => { if (speech) addOrbMessage(speech.text) }}
        onSubmit={handleSubmit} dryRun={dryRun} onDryRunChange={setDryRun}
        messages={messages} onForceQuiet={() => setConversationActive(false)}
        onErrorTest={() => setDevError(true)}
        simulateError={simulateError} onSimulateErrorChange={setSimulateError}
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
        @keyframes orb-listening { 0%, 100% { transform: scale(1); border-radius: 50%; } 50% { transform: scale(1.03); border-radius: 50%; } }
        @keyframes orb-glow-listening { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.15); opacity: 1; } }
        @keyframes orb-speaking { 0%, 100% { transform: scale(1); border-radius: 50%; } 25% { transform: scale(1.02); border-radius: 49% 51% 50% 50%; } 50% { transform: scale(1.035); border-radius: 50%; } 75% { transform: scale(1.015); border-radius: 51% 49% 50% 50%; } }
        @keyframes orb-glow-speaking { 0%, 100% { transform: scale(1); opacity: 0.88; } 30% { transform: scale(1.12); opacity: 1; } 60% { transform: scale(1.05); opacity: 0.95; } 80% { transform: scale(1.1); opacity: 1; } }
        @keyframes orb-voice-ring { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.04); opacity: 1; } }
        @keyframes ud-voice-progress-sweep { 0% { transform: translateX(-120%); } 50% { transform: translateX(70%); } 100% { transform: translateX(240%); } }
        @media (prefers-reduced-motion: reduce) { [data-todos-orb], [data-todos-glow], [data-todos-flare] { animation: none !important; } [data-todos-flare] { opacity: 0; } }
      `}</style>
    </>
  )
}
