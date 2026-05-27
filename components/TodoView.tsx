'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import HScrollNav from '@/components/ui/HScrollNav'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import InlineEditPopover from './InlineEditPopover'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { checkReminders } from '@/app/actions/reminder-actions'
import { ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import { updateTicketStatus } from '@/app/actions/ticket-actions'

export type Todo = {
  id: string
  product_id: string
  group_id: string | null
  category_id: string | null
  priority_value: number | null
  todo_number: number | null
  title: string
  description: string | null
  resolution_notes: string | null
  status: string
  urls: string[]
  sort_order: number
  created_at: string
  closed_at: string | null
  ticket_id: string | null
  groups: { name: string } | null
  categories: { name: string } | null
  due_at: string | null
  reminded_at: string | null
}

export type Product  = { id: string; name: string; color: string | null; icon: string | null; code: string | null; view_mode: 'list' | 'checklist' }
export type Priority = { value: number; label: string }
export type StatusDef = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }

function parseLocalDatetime(str: string): Date {
  const [datePart, timePart] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

const PRIORITY_DOT: Record<number, string> = {
  1: '#a05010',  // high — amber
  2: '#5a3090',  // medium — purple
  3: 'var(--muted)',  // low — muted
}

type AdminProject = { id: string; name: string; code: string | null; owner_name: string }

export default function TodoView({ productId, isAdmin = false }: { productId: string; isAdmin?: boolean }) {
  const isAll = productId === 'all'
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const toast = useToast()

  const [todos, setTodos]       = useState<Todo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<StatusDef[]>([])
  const [loading, setLoading]   = useState(true)

  const [filterStatus,   setFilterStatus]   = useState('active') // 'active' = open + in progress
  const [filterPriority, setFilterPriority] = useState('all')
  const [showFilters,    setShowFilters]    = useState(false)

  const [selectedTodo,      setSelectedTodo]      = useState<Todo | null>(null)
  const [showNewTodo,       setShowNewTodo]        = useState(false)
  const [hoveredId,         setHoveredId]          = useState<string | null>(null)
  const [selectedIds,       setSelectedIds]        = useState<string[]>([])
  const [confirmBulkDelete, setConfirmBulkDelete]  = useState(false)
  const [distillTodo,       setDistillTodo]       = useState<Todo | null>(null)
  const [sortAsc,           setSortAsc]           = useState(true)
  const [inlineEdit,        setInlineEdit]        = useState<{ todo: Todo; rect: DOMRect } | null>(null)
  const [checklistMode,     setChecklistMode]     = useState(false)
  const [showListViews,     setShowListViews]     = useState(false)

  // Pagination states
  const [page,              setPage]              = useState(0)
  const [hasMore,           setHasMore]           = useState(false)
  const PAGE_SIZE = 40

  // Admin/Owner project search
  const [adminSearch,       setAdminSearch]       = useState('')
  const [adminProjects,     setAdminProjects]     = useState<AdminProject[]>([])
  const [adminSearchOpen,   setAdminSearchOpen]   = useState(false)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isMobile,          setIsMobile]          = useState(false)
  const [mobileSearchActive, setMobileSearchActive] = useState(false)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    setIsMobile(media.matches)
    const listener = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      if (!e.matches) {
        setMobileSearchActive(false)
      }
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const handleSearchFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    setAdminSearchOpen(true)
  }

  const handleSearchBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setAdminSearchOpen(false)
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  const closedNames    = useMemo(() => new Set(statuses.filter(s => s.is_closed).map(s => s.name)), [statuses])
  const isClosed       = useCallback((status: string) => closedNames.has(status), [closedNames])
  const statusColor    = useCallback((status: string) => `var(--status-${status.replace(/\s+/g, '-')})`, [])

  const initialLoadDone = useRef(false)

  const fetchTodos = useCallback(async (pageNum = 0, append = false) => {
    if (!append && !initialLoadDone.current) {
      setLoading(true)
    }
    try {
      let todoQuery = supabase
        .from('todos')
        .select('*, groups(name), categories(name)')
        .is('deleted_at', null)
      
      todoQuery = todoQuery.order('todo_number', { ascending: sortAsc })
      if (!isAll) todoQuery = todoQuery.eq('product_id', productId)

      // Push status filter to the query — don't fetch rows we won't display
      if (filterStatus === 'active') {
        todoQuery = todoQuery.in('status', [...ACTIVE_STATUSES])
      } else if (filterStatus === 'inactive') {
        todoQuery = todoQuery.in('status', [...PARKED_STATUSES])
      } else if (filterStatus === 'closed') {
        const closedList = closedNames.size > 0 ? [...closedNames] : ['closed']
        todoQuery = todoQuery.in('status', closedList)
      } else if (filterStatus !== 'all') {
        todoQuery = todoQuery.eq('status', filterStatus)
      }

      if (filterPriority !== 'all') {
        todoQuery = todoQuery.eq('priority_value', Number(filterPriority))
      }

      // Range for pagination (PAGE_SIZE + 1 items to check hasMore)
      const fromRange = pageNum * PAGE_SIZE
      const toRange = (pageNum + 1) * PAGE_SIZE
      todoQuery = todoQuery.range(fromRange, toRange)

      const { data } = await todoQuery
      const results = (data as Todo[]) ?? []

      const hasNextPage = results.length > PAGE_SIZE
      const pageItems = hasNextPage ? results.slice(0, PAGE_SIZE) : results

      setHasMore(hasNextPage)
      setPage(pageNum)

      if (append) {
        setTodos(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          const newItems = pageItems.filter(t => !existingIds.has(t.id))
          return [...prev, ...newItems]
        })
      } else {
        setTodos(pageItems)
      }
    } catch (err) {
      console.error('Fetch todos failed:', err)
    } finally {
      if (!append) {
        setLoading(false)
        initialLoadDone.current = true
      }
    }

    // Check and trigger email reminders in the background
    checkReminders().catch(err => console.error('Reminder check failed:', err))
  }, [productId, isAll, supabase, sortAsc, filterStatus, filterPriority, closedNames])

  useVisibilityRefetch(fetchTodos)

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [productsRes, prioritiesRes, statusesRes] = await Promise.all([
          visibleProjectsQuery(supabase, 'id, name, color, icon, code, view_mode'),
          supabase.from('priorities').select('value, label').order('value'),
          supabase.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order'),
        ])

        const prods = productsRes.data ?? []
        setProducts(prods)
        setPriorities(prioritiesRes.data ?? [])
        setStatuses(statusesRes.data ?? [])

        // Sync checklist mode from the fetched product
        if (!isAll) {
          const p = (prods as Product[]).find(x => x.id === productId)
          if (p) setChecklistMode(p.view_mode === 'checklist')
        }
      } catch (err) {
        console.error('[TodoView] loadMetadata failed:', err)
      }
    }

    loadMetadata()

    // No Realtime subscription — useVisibilityRefetch handles refetch on tab focus.
    // The postgres_changes WAL reader was consuming 80% of all DB query time (1M+ calls).
  }, [productId, isAll, supabase])

  // Fetch todos when fetchTodos changes (e.g. filters, closedNames)
  useEffect(() => {
    fetchTodos(0, false)
  }, [fetchTodos])

  // Fetch projects with owner names for search
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await supabase
          .from('projects')
          .select('id, name, code, is_dormant, users!created_by(first_name, last_name)')
          .eq('is_dormant', false)
          .order('name')
        const list: AdminProject[] = ((data ?? []) as any[]).map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          owner_name: p.users
            ? [p.users.first_name, p.users.last_name].filter(Boolean).join(' ')
            : 'Unknown',
        }))
        setAdminProjects(list)
      } catch (err) {
        console.error('[TodoView] loadProjects failed:', err)
      }
    }
    loadProjects()
  }, [supabase])

  useEffect(() => {
    async function updateTimezone() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (!tz) return

        const { data: profile } = await supabase
          .from('users')
          .select('timezone')
          .eq('id', user.id)
          .maybeSingle()

        if (profile && profile.timezone !== tz) {
          await supabase
            .from('users')
            .update({ timezone: tz })
            .eq('id', user.id)
        }
      } catch (err) {
        console.error('[TodoView] updateTimezone failed:', err)
      }
    }
    updateTimezone()
  }, [supabase])

  async function handleToggleDone(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation()
    let beforeUrgency: import('@/lib/orb-state').Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[TodoView] getUrgencySnapshot failed:', err)
    }
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    const openStatus = statuses.find(s => s.is_open)?.name ?? 'open'
    const newStatus = isClosed(todo.status) ? openStatus : closedStatus
    const { data, error } = await supabase
      .from('todos')
      .update({
        status: newStatus,
        closed_at: isClosed(newStatus) ? new Date().toISOString() : null,
      })
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
      logAudit({
        action: isClosed(newStatus) ? 'todo_close' : 'todo_reopen',
        table_name: 'todos',
        record_id: todo.id,
        before: { status: todo.status },
        after: { status: newStatus, title: todo.title }
      })
      if (beforeUrgency) {
        try {
          await notifyIfEscalated(beforeUrgency)
        } catch (err) {
          console.error('[TodoView] notifyIfEscalated failed:', err)
        }
      }

      if (isClosed(newStatus)) {
        setDistillTodo(updated)
      }

      // Propagate to linked ticket (fire-and-forget)
      if (todo.ticket_id) {
        const ticketStatus = isClosed(newStatus) ? 'closed' : null
        if (ticketStatus) {
          updateTicketStatus(todo.ticket_id, ticketStatus).catch(err =>
            console.error('[TodoView] ticket propagation failed:', err)
          )
        }
      }
    }
  }

  async function handleSetViewMode(mode: 'list' | 'checklist') {
    setChecklistMode(mode === 'checklist')
    if (!isAll) {
      await supabase.from('projects').update({ view_mode: mode }).eq('id', productId)
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, view_mode: mode } : p))
    }
  }

  function toggleId(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const all = filtered.map(t => t.id)
    const allSelected = all.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : all)
  }

  async function handleBulkMarkDone() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    let beforeUrgency: import('@/lib/orb-state').Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[TodoView] getUrgencySnapshot failed:', err)
    }
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    const { error } = await supabase.from('todos').update({
      status: closedStatus,
      closed_at: new Date().toISOString(),
    }).in('id', ids)
    if (error) {
      if (isAuthError(error.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to close items. Try again.')
      return
    }
    logAudit({
      action: 'todo_bulk_close',
      table_name: 'todos',
      after: { count: ids.length, ids }
    })
    if (beforeUrgency) {
      try {
        await notifyIfEscalated(beforeUrgency)
      } catch (err) {
        console.error('[TodoView] notifyIfEscalated failed:', err)
      }
    }
    await fetchTodos()

    // Propagate to linked tickets (fire-and-forget)
    const affectedTodos = todos.filter(t => ids.includes(t.id) && t.ticket_id)
    affectedTodos.forEach(t => {
      updateTicketStatus(t.ticket_id!, 'closed').catch(err =>
        console.error('[TodoView] ticket propagation failed:', err)
      )
    })

    setSelectedIds([])
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    let beforeUrgency: import('@/lib/orb-state').Urgency | null = null
    try {
      beforeUrgency = await getUrgencySnapshot()
    } catch (err) {
      console.error('[TodoView] getUrgencySnapshot failed:', err)
    }
    const { error } = await supabase.from('todos').delete().in('id', ids)
    if (error) {
      if (isAuthError(error.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to delete items. Try again.')
      return
    }
    logAudit({
      action: 'todo_bulk_delete',
      table_name: 'todos',
      before: { count: ids.length, ids }
    })
    if (beforeUrgency) {
      try {
        await notifyIfEscalated(beforeUrgency)
      } catch (err) {
        console.error('[TodoView] notifyIfEscalated failed:', err)
      }
    }
    setTodos(prev => prev.filter(t => !ids.includes(t.id)))
    if (selectedTodo && ids.includes(selectedTodo.id)) setSelectedTodo(null)
    setSelectedIds([])
    setConfirmBulkDelete(false)
  }

  const priorityMap    = useMemo(() => new Map(priorities.map(p => [p.value, p.label])), [priorities])
  const productCodeMap = useMemo(() => new Map(products.map(p => [p.id, p.code])), [products])
  const activeStatuses   = ACTIVE_STATUSES
  const inactiveStatuses = PARKED_STATUSES

  const filtered = todos

  const currentProduct = products.find(p => p.id === productId)

  // Admin/Owner search results — filter by name, code, or owner
  const adminSearchResults = useMemo(() => {
    if (!adminSearch.trim()) return adminProjects
    const q = adminSearch.trim().toLowerCase()
    return adminProjects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code?.toLowerCase().includes(q)) ||
      (isAdmin && p.owner_name.toLowerCase().includes(q))
    )
  }, [adminProjects, adminSearch, isAdmin])

  const renderToolbar = () => {
    return (
      <div className="tv-toolbar">

        {/* Sort toggle: asc ↔ desc by todo number */}
        <button
          className="tv-toolbar-btn"
          onClick={() => setSortAsc(v => !v)}
          aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'}
          title={sortAsc ? 'Oldest first' : 'Newest first'}
        >
          Sort
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {sortAsc
              ? <path d="M12 19V5M5 12l7-7 7 7"/>
              : <path d="M12 5v14M5 12l7 7 7-7"/>
            }
          </svg>
        </button>

        {/* Filter toggle */}
        <button
          className="tv-toolbar-btn"
          aria-pressed={showFilters}
          onClick={() => {
            setShowFilters(f => !f)
            setShowListViews(false)
          }}
          aria-label="Toggle filters"
        >
          Filter
          <span className="tv-badge">{filtered.length}</span>
        </button>

        {/* List views toggle — product only */}
        {!isAll && (
          <button
            className="tv-toolbar-btn tv-toolbar-btn--vertical"
            aria-pressed={showListViews}
            onClick={() => {
              setShowListViews(v => !v)
              setShowFilters(false)
            }}
            title="Configure dashboard view layout"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            <span className="tv-toolbar-btn-label" style={{ fontSize: '10px', marginTop: '2px', display: 'block' }}>
              List Views
            </span>
          </button>
        )}

        {/* New todo */}
        <button
          className="tv-toolbar-primary"
          onClick={() => setShowNewTodo(true)}
        >
          + New
        </button>
      </div>
    )
  }

  const renderSearchInput = () => {
    return (
      <div className="tv-admin-search" style={{ position: 'relative' }}>
        <div className="admin-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="admin-search-input"
            placeholder={isAdmin ? "Search projects or owners..." : "Search projects..."}
            value={adminSearch}
            onChange={e => { setAdminSearch(e.target.value); setAdminSearchOpen(true) }}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            aria-label="Search projects by name or owner"
          />
          {adminSearch && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => { setAdminSearch(''); setAdminSearchOpen(false) }}
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        {adminSearchOpen && (
          <div className="admin-search-dropdown">
            {adminSearchResults.length === 0 ? (
              <div className="admin-search-empty">No projects found</div>
            ) : (
              adminSearchResults.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="admin-search-result"
                  data-active={p.id === productId ? '' : undefined}
                  onClick={() => {
                    router.push(`/dashboard/${p.id}`)
                    setAdminSearchOpen(false)
                    setAdminSearch('')
                  }}
                >
                  <span className="admin-search-result-name">
                    {p.code ? `${p.code} — ${p.name}` : p.name}
                  </span>
                  {isAdmin && p.owner_name && p.owner_name !== 'Unknown' && (
                    <span className="admin-search-result-owner">{p.owner_name}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="main-content" className="tv-page">

      {/* Top bar: Back and Title are pinned; everything else scrolls on mobile */}
      <div className="tv-topbar">
        <div className="tv-topbar-header">
          <Link href="/dashboard" className="tv-back">
            ← Back
          </Link>
        </div>

        {/* Desktop actions: flat flex row children, pushed right by spacer */}
        {!isMobile && <div style={{ flex: 1 }} />}
        {!isMobile && renderSearchInput()}
        {!isMobile && renderToolbar()}

        {/* Mobile search row: permanently rendered on iPhone */}
        {isMobile && (
          <div className="tv-topbar-mobile-search-row">
            {renderSearchInput()}
          </div>
        )}

        {/* Mobile normal layout: HScrollNav scrollable toolbar */}
        {isMobile && (
          <HScrollNav className="tv-topbar-nav">
            <div className="tv-topbar-scrollable">
              {renderToolbar()}
            </div>
          </HScrollNav>
        )}
      </div>{/* tv-topbar */}

      {/* Filter bar — collapsed by default */}
      {showFilters && (
        <div className="tv-filterbar">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="tv-select"
            aria-label="Filter by status"
          >
            <option value="all">All</option>
            <option value="active">Active (Open + In Progress)</option>
            <option value="inactive">Parked (Deferred + On Hold)</option>
            <option value="open">Open</option>
            <option value="in progress">In Progress</option>
            <option value="deferred">Deferred</option>
            <option value="on hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="tv-select"
            aria-label="Filter by priority"
          >
            <option value="all">All priorities</option>
            {priorities.map(p => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
          </select>

          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            {filtered.length} todo{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {showListViews && !isAll && (
        <div className="tv-filterbar" style={{ borderTop: 'none', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>AVAILABLE VIEWS:</span>
          <button
            className="tv-toolbar-btn"
            aria-pressed={!checklistMode}
            onClick={() => handleSetViewMode('list')}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            List
          </button>
          <button
            className="tv-toolbar-btn"
            aria-pressed={checklistMode}
            onClick={() => handleSetViewMode('checklist')}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Checklist
          </button>
        </div>
      )}

      {/* List / Checklist */}
      <div className="tv-list-wrap">
        {!isAll && currentProduct && (
          <h2 className="tv-project-name">{currentProduct.name}</h2>
        )}
        {isAll && (
          <h2 className="tv-project-name">All Products</h2>
        )}

        {selectedIds.length > 0 && (
          <div className="tv-bulk-bar-top">
            {confirmBulkDelete ? (
              <>
                <span className="text-error" style={{ fontSize: '13px', fontWeight: 500 }}>
                  Delete {selectedIds.length} todo{selectedIds.length !== 1 ? 's' : ''}?
                </span>
                <button className="tv-bulk-confirm" onClick={handleBulkDelete}>
                  Confirm
                </button>
                <button className="tv-bulk-btn text-muted" onClick={() => setConfirmBulkDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--text2)', fontWeight: 500, fontSize: '13px' }}>
                  {selectedIds.length} selected
                </span>
                <button className="tv-bulk-btn text-muted" onClick={toggleSelectAll}>
                  {filtered.every(t => selectedIds.includes(t.id))
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
                <button
                  className="tv-toolbar-btn"
                  onClick={handleBulkMarkDone}
                >
                  Mark done
                </button>
                <button
                  className="tv-bulk-btn"
                  onClick={() => setConfirmBulkDelete(true)}
                  style={{ color: 'var(--error)' }}
                >
                  Delete
                </button>
                <button className="tv-bulk-btn text-muted" onClick={() => setSelectedIds([])}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            Loading…
          </p>
        ) : checklistMode ? (
          /* ── Checklist skin ── */
          (() => {
            const allItems = [...todos].filter(t => {
              if (filterPriority !== 'all' && String(t.priority_value) !== filterPriority) return false
              return true
            })
            const open   = allItems.filter(t => !isClosed(t.status))
            const closed = allItems.filter(t =>  isClosed(t.status))
            const sorted = [...open, ...closed]
            return sorted.length === 0 ? (
              <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
                Nothing here yet.
              </p>
            ) : (
              <div className="tv-list-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tv-table tv-table--checklist">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }} />
                      <th>Task</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(todo => {
                      const isDone = isClosed(todo.status)
                      return (
                        <tr
                          key={todo.id}
                          onClick={() => setSelectedTodo(todo)}
                        >
                          <td style={{ width: '36px', textAlign: 'center' }}>
                            <button
                              className="tv-cl-check"
                              onClick={e => { e.stopPropagation(); handleToggleDone(e, todo) }}
                              aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                              style={{
                                border: `2px solid ${isDone ? 'var(--pill-active-color)' : 'var(--muted)'}`,
                                background: isDone ? 'var(--pill-active-color)' : 'transparent',
                              }}
                            >
                              {isDone && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          </td>
                          <td>
                            <span style={{
                              color: isDone ? 'var(--muted)' : 'var(--text)',
                              textDecoration: isDone ? 'line-through' : 'none',
                              cursor: 'pointer',
                            }}>
                              {todo.title}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            {filterStatus === 'active' ? 'Nothing active — you\'re clear.' : 'No todos found.'}
          </p>
        ) : (
          <div className="tv-list-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tv-table">
              <thead>
                <tr>
                  <th className="tv-th-checkbox" style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(t => selectedIds.includes(t.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th className="tv-th-title">Title</th>
                  <th className="tv-th-actions" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(todo => {
                  const isHovered   = hoveredId === todo.id
                  const isSelected  = selectedTodo?.id === todo.id
                  const isChecked   = selectedIds.includes(todo.id)
                  const isDone      = isClosed(todo.status)
                  const todoRef     = productCodeMap.get(todo.product_id) && todo.todo_number != null
                    ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}`
                    : null

                  const actionButtons = (
                    <div className="tv-row-actions">
                      {!isDone && (
                        <>
                          <button
                            className="tv-action-btn"
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedTodo(todo)
                            }}
                            aria-label="Edit task"
                            title="Edit task"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                            Edit
                          </button>
                          <button
                            className="tv-action-btn"
                            onClick={e => {
                              e.stopPropagation()
                              const row = (e.currentTarget as HTMLElement).closest('tr')
                              if (row) setInlineEdit({ todo, rect: row.getBoundingClientRect() })
                            }}
                            aria-label="Quick edit"
                            title="Edit status, priority, and due date"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>
                            Quick
                          </button>
                        </>
                      )}
                      <button
                        className="tv-action-btn"
                        onClick={e => handleToggleDone(e, todo)}
                        aria-label={isDone ? 'Reopen' : 'Done'}
                        title={isDone ? 'Reopen task' : 'Mark as done'}
                      >
                        <span className="tv-done-toggle" style={{
                          border: `2px solid ${isDone ? statusColor(todo.status) : 'var(--muted)'}`,
                          background: isDone ? statusColor(todo.status) : 'transparent',
                        }}>
                          {isDone && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        {isDone ? 'Reopen' : 'Done'}
                      </button>
                    </div>
                  )

                  return (
                    <tr
                      key={todo.id}
                      onClick={() => setSelectedTodo(todo)}
                      onContextMenu={e => {
                        if (isDone) return
                        e.preventDefault()
                        const row = e.currentTarget as HTMLElement
                        setInlineEdit({ todo, rect: row.getBoundingClientRect() })
                      }}
                      onMouseEnter={() => setHoveredId(todo.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      tabIndex={0}
                      aria-label={`${todo.title}, ${todo.status}`}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedTodo(todo)
                      }}
                      style={{
                        background: isChecked || isSelected
                          ? 'var(--pill-active-bg)'
                          : isHovered ? 'var(--bg3)' : 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center', width: '36px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleId(todo.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Title + metadata + actions (mobile) */}
                      <td className="tv-td-content">
                        <p className="tv-todo-title" style={{
                          fontSize: 'var(--fs-base)',
                          color: isDone ? 'var(--muted)' : 'var(--text)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          margin: 0,
                        }}>
                          {todo.title}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                          {todoRef && (
                            <span className="text-xs text-muted">
                              {todoRef}
                            </span>
                          )}

                          {todo.due_at && (() => {
                            const isOverdue = !isDone && parseLocalDatetime(todo.due_at) < new Date()
                            const isDueToday = !isDone && parseLocalDatetime(todo.due_at).toDateString() === new Date().toDateString()
                            return (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isOverdue
                                  ? 'rgba(239, 68, 68, 0.1)'
                                  : isDueToday
                                    ? 'rgba(245, 158, 11, 0.1)'
                                    : 'rgba(100, 116, 139, 0.1)',
                                color: isOverdue
                                  ? 'var(--error)'
                                  : isDueToday
                                    ? '#d97706'
                                    : 'var(--muted)',
                                border: `1px solid ${
                                  isOverdue
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : isDueToday
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : 'rgba(100, 116, 139, 0.15)'
                                }`,
                                whiteSpace: 'nowrap',
                              }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                <span>
                                  {parseLocalDatetime(todo.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  {' at '}
                                  {parseLocalDatetime(todo.due_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Actions — visible here on mobile, hidden on desktop */}
                        <div className="tv-mobile-actions">
                          {actionButtons}
                        </div>
                      </td>

                      {/* Actions — visible on desktop, hidden on mobile */}
                      <td className="tv-td-actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {actionButtons}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div className="tv-pagination-wrap" style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-xl)', marginBottom: 'var(--sp-xl)' }}>
            <button
              onClick={() => fetchTodos(page + 1, true)}
              className="tv-toolbar-btn"
              style={{ padding: '8px 24px', fontSize: 'var(--fs-sm)', borderRadius: 'var(--r-lg)' }}
            >
              Load more tasks
            </button>
          </div>
        )}
      </div>

      {selectedTodo && (
        <TodoPanel
          todo={selectedTodo}
          products={products}
          priorities={priorities}
          statuses={statuses}
          isAll={isAll}
          onClose={() => setSelectedTodo(null)}
          onSave={updated => {
            setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
            setSelectedTodo(updated)
          }}
          onDelete={id => {
            setTodos(prev => prev.filter(t => t.id !== id))
            setSelectedTodo(null)
          }}
        />
      )}

      {showNewTodo && (
        <TodoForm
          productId={isAll ? undefined : productId}
          products={products}
          priorities={priorities}
          onClose={() => setShowNewTodo(false)}
          onCreate={todo => {
            setTodos(prev => [...prev, todo])
            setShowNewTodo(false)
          }}
        />
      )}



      {distillTodo && (
        <DistillModal
          todoId={distillTodo.id}
          productId={distillTodo.product_id}
          initialTitle={`Lesson: ${distillTodo.title}`}
          initialContent={distillTodo.resolution_notes || distillTodo.description || ''}
          onClose={() => setDistillTodo(null)}
          onSaved={() => setDistillTodo(null)}
        />
      )}

      {inlineEdit && (
        <InlineEditPopover
          todo={inlineEdit.todo}
          priorities={priorities}
          statuses={statuses}
          anchorRect={inlineEdit.rect}
          onClose={() => setInlineEdit(null)}
          onSave={updated => {
            setTodos(prev => prev.map(t => t.id === updated.id ? updated : t))
            if (selectedTodo?.id === updated.id) setSelectedTodo(updated)
            setInlineEdit(ie => ie ? { ...ie, todo: updated } : null)
          }}
        />
      )}



      {/* Version */}
      <div className="tv-version-footer">
        <OrbVersionLabel className="tv-version-text" />
      </div>
    </div>
  )
}
