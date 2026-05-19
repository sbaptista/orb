'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { VERSION } from '@/lib/version'
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import ProductConfigPanel from './ProductConfigPanel'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'

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
}

export type Product  = { id: string; name: string; color: string | null; icon: string | null; code: string | null }
export type Priority = { value: number; label: string }
export type StatusDef = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }

const PRIORITY_DOT: Record<number, string> = {
  1: '#a05010',  // high — amber
  2: '#5a3090',  // medium — purple
  3: 'var(--muted)',  // low — muted
}

export default function TodoView({ productId }: { productId: string }) {
  const isAll = productId === 'all'
  const supabase = useMemo(() => createClient(), [])

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

  const fetchTodos = useCallback(async () => {
    let todoQuery = supabase
      .from('todos')
      .select('*, groups(name), categories(name)')
      .is('deleted_at', null)
    todoQuery = todoQuery.order('todo_number', { ascending: sortAsc })
    if (!isAll) todoQuery = todoQuery.eq('product_id', productId)
    const { data } = await todoQuery
    setTodos((data as Todo[]) ?? [])
  }, [productId, isAll, supabase, sortAsc])

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

  async function handleToggleDone(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation()
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    const openStatus = statuses.find(s => s.is_open)?.name ?? 'open'
    const newStatus = isClosed(todo.status) ? openStatus : closedStatus
    const { data } = await supabase
      .from('todos')
      .update({
        status: newStatus,
        closed_at: isClosed(newStatus) ? new Date().toISOString() : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()

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
    const closedStatus = statuses.find(s => s.is_closed)?.name ?? 'closed'
    await supabase.from('todos').update({
      status: closedStatus,
      closed_at: new Date().toISOString(),
    }).in('id', ids)
    logAudit({
      action: 'todo_bulk_close',
      table_name: 'todos',
      after: { count: ids.length, ids }
    })
    await fetchTodos()
    setSelectedIds([])
    setSelectMode(false)
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const ids = [...selectedIds]
    await supabase.from('todos').delete().in('id', ids)
    logAudit({
      action: 'todo_bulk_delete',
      table_name: 'todos',
      before: { count: ids.length, ids }
    })
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

                  {/* Title + meta */}
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p className="tv-todo-title" style={{
                      fontSize: 'var(--fs-base)',
                      color: isDone ? 'var(--muted)' : 'var(--text)',
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}>
                      {todo.title}
                    </p>

                    {todoRef && (
                      <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                        {todoRef}
                      </p>
                    )}
                  </div>

                  {/* Done toggle — hidden in select mode */}
                  {!selectMode && (
                    <button
                      className="tv-done-toggle"
                      onClick={e => handleToggleDone(e, todo)}
                      style={{
                        border: `1.5px solid ${isDone ? statusColor(todo.status) : 'var(--border)'}`,
                        background: isDone ? statusColor(todo.status) : 'transparent',
                        opacity: isHovered || isSelected || isDone ? 1 : 0,
                      }}
                      aria-label={isDone ? 'Reopen' : 'Close'}
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
        {filterStatus === 'active' && doneTodos.length > 0 && (
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
              Done ({doneTodos.length})
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
        <span className="tv-version-text">Orb {VERSION}</span>
      </div>
    </div>
  )
}
