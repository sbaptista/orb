'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import InlineEditPopover from './InlineEditPopover'
import ProductConfigPanel from './ProductConfigPanel'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { checkReminders } from '@/app/actions/reminder-actions'
import { ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'

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
  groups: { name: string } | null
  categories: { name: string } | null
  due_at: string | null
  reminded_at: string | null
}

export type Product  = { id: string; name: string; color: string | null; icon: string | null; code: string | null }
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
  const [showProductConfig, setShowProductConfig]  = useState(false)
  const [hoveredId,         setHoveredId]          = useState<string | null>(null)
  const [showDone,          setShowDone]           = useState(false)
  const [selectMode,        setSelectMode]         = useState(false)
  const [selectedIds,       setSelectedIds]        = useState<string[]>([])
  const [confirmBulkDelete, setConfirmBulkDelete]  = useState(false)
  const [distillTodo,       setDistillTodo]       = useState<Todo | null>(null)
  const [sortAsc,           setSortAsc]           = useState(true)
  const [inlineEdit,        setInlineEdit]        = useState<{ todo: Todo; rect: DOMRect } | null>(null)

  // Admin project search
  const [adminSearch,       setAdminSearch]       = useState('')
  const [adminProjects,     setAdminProjects]     = useState<AdminProject[]>([])
  const [adminSearchOpen,   setAdminSearchOpen]   = useState(false)

  const fetchTodos = useCallback(async () => {
    let todoQuery = supabase
      .from('todos')
      .select('*, groups(name), categories(name)')
      .is('deleted_at', null)
    todoQuery = todoQuery.order('todo_number', { ascending: sortAsc })
    if (!isAll) todoQuery = todoQuery.eq('product_id', productId)

    // Push status filter to the query — don't fetch rows we won't display
    if (filterStatus === 'active') {
      const include = showDone ? [...ACTIVE_STATUSES, ...PARKED_STATUSES] : [...ACTIVE_STATUSES]
      // Fetch active + closed (if showDone), but always exclude parked unless filter is 'all'
      // Actually: active view shows ACTIVE_STATUSES in main list, closed in toggle
      if (showDone) {
        // Need active + closed — exclude only parked
        todoQuery = todoQuery.not('status', 'in', `(${[...PARKED_STATUSES].join(',')})`)
      } else {
        todoQuery = todoQuery.in('status', [...ACTIVE_STATUSES])
      }
    } else if (filterStatus === 'inactive') {
      todoQuery = todoQuery.in('status', [...PARKED_STATUSES])
    } else if (filterStatus !== 'all') {
      // Specific status selected
      todoQuery = todoQuery.eq('status', filterStatus)
    }

    const { data } = await todoQuery
    setTodos((data as Todo[]) ?? [])

    // Check and trigger email reminders in the background
    checkReminders().catch(err => console.error('Reminder check failed:', err))
  }, [productId, isAll, supabase, sortAsc, filterStatus, showDone])

  useVisibilityRefetch(fetchTodos)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const [, productsRes, prioritiesRes, statusesRes] = await Promise.all([
        fetchTodos(),
        visibleProjectsQuery(supabase, 'id, name, color, icon, code'),
        supabase.from('priorities').select('value, label').order('value'),
        supabase.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order'),
      ])

      setProducts(productsRes.data ?? [])
      setPriorities(prioritiesRes.data ?? [])
      setStatuses(statusesRes.data ?? [])
      setLoading(false)
    }

    fetchData()

    const filter = isAll ? undefined : `product_id=eq.${productId}`
    const channel = supabase
      .channel(`todos-view:${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', ...(filter ? { filter } : {}) },
        () => fetchTodos(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [productId, isAll, supabase, fetchTodos])

  // Fetch all projects with owner names for admin search
  useEffect(() => {
    if (!isAdmin) return
    async function loadAdminProjects() {
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
    }
    loadAdminProjects()
  }, [isAdmin, supabase])

  useEffect(() => {
    async function updateTimezone() {
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
    }
    updateTimezone()
  }, [supabase])

  async function handleToggleDone(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation()
    const beforeUrgency = await getUrgencySnapshot()
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
      if (beforeUrgency) notifyIfEscalated(beforeUrgency)

      if (isClosed(newStatus)) {
        setDistillTodo(updated)
      }
    }
  }

  function toggleSelectMode() {
    setSelectMode(m => !m)
    setSelectedIds([])
    setConfirmBulkDelete(false)
    setSelectedTodo(null)
  }

  function toggleId(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const all = [...filtered, ...(showDone ? doneTodos : [])].map(t => t.id)
    const allSelected = all.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : all)
  }

  async function handleBulkMarkDone() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    const beforeUrgency = await getUrgencySnapshot()
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
    if (beforeUrgency) notifyIfEscalated(beforeUrgency)
    await fetchTodos()
    setSelectedIds([])
    setSelectMode(false)
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    const beforeUrgency = await getUrgencySnapshot()
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
    if (beforeUrgency) notifyIfEscalated(beforeUrgency)
    setTodos(prev => prev.filter(t => !ids.includes(t.id)))
    if (selectedTodo && ids.includes(selectedTodo.id)) setSelectedTodo(null)
    setSelectedIds([])
    setConfirmBulkDelete(false)
    setSelectMode(false)
  }

  const priorityMap    = useMemo(() => new Map(priorities.map(p => [p.value, p.label])), [priorities])
  const productCodeMap = useMemo(() => new Map(products.map(p => [p.id, p.code])), [products])
  const closedNames    = useMemo(() => new Set(statuses.filter(s => s.is_closed).map(s => s.name)), [statuses])
  const isClosed       = useCallback((status: string) => closedNames.has(status), [closedNames])
  const statusColor    = useCallback((status: string) => `var(--status-${status.replace(/\s+/g, '-')})`, [])


  const activeStatuses   = ACTIVE_STATUSES
  const inactiveStatuses = PARKED_STATUSES

  const filtered = todos.filter(t => {
    if (filterStatus === 'active' && !activeStatuses.has(t.status)) return false
    if (filterStatus === 'inactive' && !inactiveStatuses.has(t.status)) return false
    if (filterStatus !== 'active' && filterStatus !== 'inactive' && filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterPriority !== 'all' && String(t.priority_value) !== filterPriority) return false
    return true
  })

  const doneTodos = filterStatus === 'active'
    ? todos.filter(t => {
        if (!isClosed(t.status)) return false
        if (filterPriority !== 'all' && String(t.priority_value) !== filterPriority) return false
        return true
      })
    : []

  const currentProduct = products.find(p => p.id === productId)

  // Admin search results — filter by name, code, or owner
  const adminSearchResults = useMemo(() => {
    if (!adminSearch.trim()) return adminProjects
    const q = adminSearch.trim().toLowerCase()
    return adminProjects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code?.toLowerCase().includes(q)) ||
      p.owner_name.toLowerCase().includes(q)
    )
  }, [adminProjects, adminSearch])

  return (
    <div id="main-content" className="tv-page">

      {/* Top bar */}
      <div className="tv-topbar">
        <Link href="/dashboard" className="tv-back">
          ← Back
        </Link>

        {!isAll && currentProduct && (
          <span className="sl-title">{currentProduct.name}</span>
        )}
        {isAll && (
          <span className="sl-title">All Products</span>
        )}

        {/* Admin project search */}
        {isAdmin && (
          <div className="tv-admin-search" style={{ position: 'relative' }}>
            <div className="admin-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search projects or owners…"
                value={adminSearch}
                onChange={e => { setAdminSearch(e.target.value); setAdminSearchOpen(true) }}
                onFocus={() => setAdminSearchOpen(true)}
                aria-label="Search all projects by name or owner"
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
              <>
                <div className="admin-search-backdrop" onClick={() => setAdminSearchOpen(false)} />
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
                        <span className="admin-search-result-owner">{p.owner_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

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
            onClick={() => setShowFilters(f => !f)}
            aria-label="Toggle filters"
          >
            Filter
            <span className="tv-badge">{filtered.length}</span>
          </button>

          {/* Configure — product only */}
          {!isAll && currentProduct && (
            <button
              className="tv-icon-btn"
              onClick={() => setShowProductConfig(true)}
              aria-label="Configure project"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="20" y2="12"/>
                <line x1="12" y1="18" x2="20" y2="18"/>
                <circle cx="4" cy="6" r="2" fill="currentColor" stroke="none"/>
                <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="18" r="2" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          )}

          {/* Select mode toggle */}
          <button
            className="tv-toolbar-btn"
            aria-pressed={selectMode}
            onClick={toggleSelectMode}
          >
            Select
          </button>

          {/* New todo */}
          <button
            className="tv-toolbar-primary"
            onClick={() => setShowNewTodo(true)}
          >
            + New
          </button>
        </div>
      </div>

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
            <option value="inactive">Inactive (Deferred + On Hold)</option>
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

      {/* List */}
      <div className="tv-list-wrap">
        {loading ? (
          <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            {filterStatus === 'active' ? 'Nothing active — you\'re clear.' : 'No todos found.'}
          </p>
        ) : (
          <div className="tv-list-card">
            {filtered.map((todo, i) => {
              const isHovered   = hoveredId === todo.id
              const isSelected  = selectedTodo?.id === todo.id
              const isChecked   = selectedIds.includes(todo.id)
              const isDone      = isClosed(todo.status)
              const todoRef     = productCodeMap.get(todo.product_id) && todo.todo_number != null
                ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}`
                : null

              return (
                <div
                  key={todo.id}
                  onClick={() => selectMode ? toggleId(todo.id) : setSelectedTodo(todo)}
                  onContextMenu={e => {
                    if (selectMode || isDone) return
                    e.preventDefault()
                    const row = (e.currentTarget as HTMLElement)
                    setInlineEdit({ todo, rect: row.getBoundingClientRect() })
                  }}
                  onMouseEnter={() => setHoveredId(todo.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${todo.title}, ${todo.status}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ')
                      selectMode ? toggleId(todo.id) : setSelectedTodo(todo)
                  }}
                  className="tv-row"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    background: isChecked || isSelected
                      ? 'var(--pill-active-bg)'
                      : isHovered ? 'var(--bg3)' : 'transparent',
                  }}
                >
                  {/* Checkbox (select mode) or status bar */}
                  {selectMode ? (
                    <div className="tv-checkbox" style={{
                      border: `1.5px solid ${isChecked ? 'var(--pill-active-color)' : 'var(--border)'}`,
                      background: isChecked ? 'var(--pill-active-bg)' : 'transparent',
                    }}>
                      {isChecked && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="var(--pill-active-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className="tv-status-bar" style={{
                      background: statusColor(todo.status),
                      opacity: isDone ? 0.4 : 1,
                    }} />
                  )}

                  {/* Priority dot */}
                  <div className="tv-priority-dot" style={{
                    background: todo.priority_value != null
                      ? (PRIORITY_DOT[todo.priority_value] ?? 'var(--muted)')
                      : 'transparent',
                    opacity: isDone ? 0.4 : 1,
                  }} />

                  {/* Title + meta + due date */}
                  <div className="flex-1" style={{ minWidth: 0, marginRight: '12px' }}>
                    <p className="tv-todo-title" style={{
                      fontSize: 'var(--fs-base)',
                      color: isDone ? 'var(--muted)' : 'var(--text)',
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}>
                      {todo.title}
                    </p>

                    {(todoRef || todo.due_at) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      {todoRef && (
                        <span className="text-xs text-muted">
                          {todoRef}
                        </span>
                      )}

                      {todo.due_at && (() => {
                        const isOverdue = !isDone && parseLocalDatetime(todo.due_at) < new Date()
                        const isDueToday = !isDone && parseLocalDatetime(todo.due_at).toDateString() === new Date().toDateString()
                        return (
                          <div className="tv-due-badge" style={{
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
                    )}
                  </div>

                  {/* Edit + Quick Edit triggers — hidden in select mode and on done items */}
                  {!selectMode && !isDone && (
                    <>
                      <button
                        className="ie-trigger ie-trigger--edit"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedTodo(todo)
                        }}
                        aria-label="Edit task"
                        title="Edit task"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                      </button>
                      <button
                        className="ie-trigger ie-trigger--quick"
                        onClick={e => {
                          e.stopPropagation()
                          const row = (e.currentTarget as HTMLElement).closest('.tv-row')
                          if (row) setInlineEdit({ todo, rect: row.getBoundingClientRect() })
                        }}
                        aria-label="Quick edit"
                        title="Edit status, priority, and due date"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </button>
                    </>
                  )}

                  {/* Done toggle — hidden in select mode */}
                  {!selectMode && (
                    <button
                      className="tv-done-toggle"
                      onClick={e => handleToggleDone(e, todo)}
                      style={{
                        border: `2px solid ${isDone ? statusColor(todo.status) : 'var(--muted)'}`,
                        background: isDone ? statusColor(todo.status) : 'transparent',
                      }}
                      aria-label={isDone ? 'Reopen' : 'Close'}
                      title={isDone ? 'Reopen task' : 'Close task'}
                    >
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Done section — collapsed by default, only shown in open filter mode */}
        {filterStatus === 'active' && (showDone ? doneTodos.length > 0 : true) && (
          <div className="tv-done-section">
            <button
              className="tv-done-header"
              onClick={() => setShowDone(d => !d)}
              aria-expanded={showDone}
            >
              <span style={{
                fontSize: '10px',
                transition: 'transform var(--transition)',
                display: 'inline-block',
                transform: showDone ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>▶</span>
              {showDone ? `Done (${doneTodos.length})` : 'Show completed'}
            </button>

            {showDone && (
              <div className="tv-list-card" style={{ marginTop: 'var(--sp-sm)', opacity: 0.7 }}>
                {doneTodos.map((todo, i) => {
                  const isHovered  = hoveredId === todo.id
                  const isSelected = selectedTodo?.id === todo.id
                  const isChecked  = selectedIds.includes(todo.id)
                  const todoRef    = productCodeMap.get(todo.product_id) && todo.todo_number != null
                    ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}`
                    : null

                  return (
                    <div
                      key={todo.id}
                      onClick={() => selectMode ? toggleId(todo.id) : setSelectedTodo(todo)}
                      onMouseEnter={() => setHoveredId(todo.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${todo.title}, done`}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ')
                          selectMode ? toggleId(todo.id) : setSelectedTodo(todo)
                      }}
                      className="tv-row tv-row-done"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        background: isChecked || isSelected
                          ? 'var(--pill-active-bg)'
                          : isHovered ? 'var(--bg3)' : 'transparent',
                      }}
                    >
                      {selectMode ? (
                        <div className="tv-checkbox" style={{
                          border: `1.5px solid ${isChecked ? 'var(--pill-active-color)' : 'var(--border)'}`,
                          background: isChecked ? 'var(--pill-active-bg)' : 'transparent',
                        }}>
                          {isChecked && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="var(--pill-active-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      ) : (
                        <div className="tv-status-bar" style={{
                          background: statusColor(todo.status),
                          opacity: 0.3,
                        }} />
                      )}
                      <div className="tv-priority-dot" />
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <p className="tv-todo-title text-sm text-muted" style={{ textDecoration: 'line-through' }}>
                          {todo.title}
                        </p>
                        {todoRef && (
                          <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                            {todoRef}
                          </p>
                        )}
                      </div>
                      {!selectMode && (
                        <button
                          className="tv-done-toggle"
                          onClick={e => handleToggleDone(e, todo)}
                          style={{
                            border: `1.5px solid ${statusColor(todo.status)}`,
                            background: statusColor(todo.status),
                            opacity: isHovered || isSelected ? 1 : 0.5,
                          }}
                          aria-label="Reopen"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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

      {showProductConfig && !isAll && currentProduct && (
        <ProductConfigPanel
          productId={productId}
          productName={currentProduct.name}
          productIcon={currentProduct.icon}
          onClose={() => setShowProductConfig(false)}
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

      {/* Bulk action bar */}
      {selectMode && (
        <div className="tv-bulk-bar">
          {confirmBulkDelete ? (
            <>
              <span className="text-error">
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
              <span style={{ color: 'var(--text2)', minWidth: '72px' }}>
                {selectedIds.length} selected
              </span>
              <button className="tv-bulk-btn text-muted" onClick={toggleSelectAll}>
                {[...filtered, ...(showDone ? doneTodos : [])].every(t => selectedIds.includes(t.id))
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
              <button
                className="tv-toolbar-btn"
                aria-pressed={selectedIds.length > 0}
                onClick={handleBulkMarkDone}
                disabled={selectedIds.length === 0}
                style={{ cursor: selectedIds.length > 0 ? 'pointer' : 'default' }}
              >
                Mark done
              </button>
              <button
                className="tv-bulk-btn"
                onClick={() => setConfirmBulkDelete(true)}
                disabled={selectedIds.length === 0}
                style={{
                  color: selectedIds.length > 0 ? 'var(--error)' : 'var(--muted)',
                  cursor: selectedIds.length > 0 ? 'pointer' : 'default',
                }}
              >
                Delete
              </button>
              <button className="tv-bulk-btn text-muted" onClick={toggleSelectMode}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Version */}
      <div className="tv-version-footer">
        <OrbVersionLabel className="tv-version-text" />
      </div>
    </div>
  )
}
