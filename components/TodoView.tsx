'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { VERSION } from '@/lib/version'
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import ProductConfigPanel from './ProductConfigPanel'

export type Status = 'open' | 'in_progress' | 'on_hold' | 'done'

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
  status: Status
  urls: string[]
  sort_order: number
  created_at: string
  closed_at: string | null
  groups: { name: string } | null
  categories: { name: string } | null
}

export type Group    = { id: string; name: string; product_id: string }
export type Category = { id: string; name: string; product_id: string }
export type Product  = { id: string; name: string; color: string | null; icon: string | null; code: string | null }
export type Priority = { value: number; label: string }

const STATUS_COLOR: Record<Status, string> = {
  open:        'var(--status-open)',
  in_progress: 'var(--status-in-progress)',
  on_hold:     'var(--status-on-hold)',
  done:        'var(--status-done)',
}

const PRIORITY_DOT: Record<number, string> = {
  1: '#a05010',  // high — amber
  2: '#5a3090',  // medium — purple
  3: 'var(--muted)',  // low — muted
}

export default function TodoView({ productId }: { productId: string }) {
  const isAll = productId === 'all'
  const supabase = useMemo(() => createClient(), [])

  const [todos, setTodos]       = useState<Todo[]>([])
  const [groups, setGroups]     = useState<Group[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading]   = useState(true)

  const [filterStatus,   setFilterStatus]   = useState('active') // 'active' hides done by default
  const [filterGroup,    setFilterGroup]    = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showFilters,    setShowFilters]    = useState(false)

  const [selectedTodo,      setSelectedTodo]      = useState<Todo | null>(null)
  const [showNewTodo,       setShowNewTodo]        = useState(false)
  const [showProductConfig, setShowProductConfig]  = useState(false)
  const [hoveredId,         setHoveredId]          = useState<string | null>(null)
  const [showDone,          setShowDone]           = useState(false)

  const fetchTodos = useCallback(async () => {
    let todoQuery = supabase
      .from('todos')
      .select('*, groups(name), categories(name)')
      .is('deleted_at', null)
      .order('sort_order')
    if (!isAll) todoQuery = todoQuery.eq('product_id', productId)
    const { data } = await todoQuery
    setTodos((data as Todo[]) ?? [])
  }, [productId, isAll, supabase])

  useVisibilityRefetch(fetchTodos)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      let groupQuery = supabase.from('groups').select('id, name, product_id').order('sort_order')
      if (!isAll) groupQuery = groupQuery.eq('product_id', productId)

      let catQuery = supabase.from('categories').select('id, name, product_id').order('sort_order')
      if (!isAll) catQuery = catQuery.eq('product_id', productId)

      const [, groupsRes, catsRes, productsRes, prioritiesRes] = await Promise.all([
        fetchTodos(), groupQuery, catQuery,
        supabase.from('projects').select('id, name, color, icon, code').order('sort_order'),
        supabase.from('priorities').select('value, label').order('value'),
      ])

      setGroups(groupsRes.data ?? [])
      setCategories(catsRes.data ?? [])
      setProducts(productsRes.data ?? [])
      setPriorities(prioritiesRes.data ?? [])
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
    const newStatus: Status = todo.status === 'done' ? 'open' : 'done'
    const { data } = await supabase
      .from('todos')
      .update({
        status: newStatus,
        closed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()

    if (data) {
      const updated = data as Todo
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
      if (selectedTodo?.id === todo.id) setSelectedTodo(updated)
    }
  }

  const priorityMap    = useMemo(() => new Map(priorities.map(p => [p.value, p.label])), [priorities])
  const productCodeMap = useMemo(() => new Map(products.map(p => [p.id, p.code])), [products])


  const filtered = todos.filter(t => {
    if (filterStatus === 'active' && t.status === 'done') return false
    if (filterStatus !== 'active' && filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterGroup    !== 'all' && t.group_id    !== filterGroup)           return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory)        return false
    if (filterPriority !== 'all' && String(t.priority_value) !== filterPriority) return false
    return true
  })

  const doneTodos = filterStatus === 'active'
    ? todos.filter(t => {
        if (t.status !== 'done') return false
        if (filterGroup    !== 'all' && t.group_id    !== filterGroup)           return false
        if (filterCategory !== 'all' && t.category_id !== filterCategory)        return false
        if (filterPriority !== 'all' && String(t.priority_value) !== filterPriority) return false
        return true
      })
    : []

  const currentProduct = products.find(p => p.id === productId)

  // ── Styles ────────────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-ui)',
      WebkitFontSmoothing: 'antialiased' as const,
    } as React.CSSProperties,

    topBar: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--sp-2xl)',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-md)',
    } as React.CSSProperties,

    filterBar: {
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: 'var(--sp-md) var(--sp-2xl)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-sm)',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,

    select: {
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r)',
      padding: '6px 10px',
      color: 'var(--text2)',
      outline: 'none',
      cursor: 'pointer',
      WebkitAppearance: 'none' as const,
      appearance: 'none' as const,
    } as React.CSSProperties,

    listWrap: {
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--sp-xl) var(--sp-2xl)',
    } as React.CSSProperties,

    listCard: {
      background: 'var(--bg2)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    } as React.CSSProperties,
  }

  return (
    <div id="main-content" style={s.page}>

      {/* Top bar */}
      <div style={s.topBar}>
        <Link href="/dashboard" style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--muted)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          ← Back
        </Link>

        {!isAll && currentProduct && (
          <span style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            color: 'var(--text2)',
            flex: 1,
            textAlign: 'center',
          }}>
            {currentProduct.name}
          </span>
        )}
        {isAll && (
          <span style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            color: 'var(--text2)',
            flex: 1,
            textAlign: 'center',
          }}>
            All Products
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              position: 'relative',
              background: showFilters ? 'var(--pill-active-bg)' : 'transparent',
              border: `1px solid ${showFilters ? 'var(--pill-active-border)' : 'var(--border)'}`,
              borderRadius: 'var(--r)',
              padding: '5px 10px',
              fontSize: 'var(--fs-sm)',
              color: showFilters ? 'var(--pill-active-color)' : 'var(--muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            aria-label="Toggle filters"
          >
            Filter
            <span style={{
              background: 'var(--pill-active-color)',
              color: 'var(--bg2)',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              lineHeight: 1.4,
            }}>
              {filtered.length}
            </span>
          </button>

          {/* Configure — product only */}
          {!isAll && currentProduct && (
            <button
              onClick={() => setShowProductConfig(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
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

          {/* New todo */}
          <button
            onClick={() => setShowNewTodo(true)}
            style={{
              background: 'var(--pill-active-bg)',
              border: '1px solid var(--pill-active-border)',
              borderRadius: 'var(--r)',
              padding: '5px 14px',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              color: 'var(--pill-active-color)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Filter bar — collapsed by default */}
      {showFilters && (
        <div style={s.filterBar}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={s.select}
            aria-label="Filter by status"
          >
            <option value="active">Active only</option>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="done">Done</option>
          </select>

          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            style={s.select}
            aria-label="Filter by group"
          >
            <option value="all">All groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={s.select}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            style={s.select}
            aria-label="Filter by priority"
          >
            <option value="all">All priorities</option>
            {priorities.map(p => <option key={p.value} value={String(p.value)}>{p.label}</option>)}
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
            {filtered.length} todo{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* List */}
      <div style={s.listWrap}>
        {loading ? (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
            {filterStatus === 'active' ? 'Nothing open — you\'re clear.' : 'No todos found.'}
          </p>
        ) : (
          <div style={s.listCard}>
            {filtered.map((todo, i) => {
              const isHovered  = hoveredId === todo.id
              const isSelected = selectedTodo?.id === todo.id
              const isDone     = todo.status === 'done'
              const todoRef    = productCodeMap.get(todo.product_id) && todo.todo_number != null
                ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}`
                : null

              return (
                <div
                  key={todo.id}
                  onClick={() => setSelectedTodo(todo)}
                  onMouseEnter={() => setHoveredId(todo.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${todo.title}, ${todo.status}`}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedTodo(todo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-md)',
                    padding: 'var(--sp-md) var(--sp-lg)',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    background: isSelected
                      ? 'var(--pill-active-bg)'
                      : isHovered ? 'var(--bg3)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background var(--transition)',
                  }}
                >
                  {/* Status bar */}
                  <div style={{
                    width: '3px',
                    alignSelf: 'stretch',
                    borderRadius: '2px',
                    flexShrink: 0,
                    background: STATUS_COLOR[todo.status],
                    opacity: isDone ? 0.4 : 1,
                  }} />

                  {/* Priority dot */}
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: todo.priority_value != null
                      ? (PRIORITY_DOT[todo.priority_value] ?? 'var(--muted)')
                      : 'transparent',
                    opacity: isDone ? 0.4 : 1,
                  }} />

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 'var(--fs-base)',
                      color: isDone ? 'var(--muted)' : 'var(--text)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {todo.title}
                    </p>

                    {(todoRef || todo.groups?.name || todo.categories?.name) && (
                      <p style={{
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--muted)',
                        marginTop: '2px',
                      }}>
                        {[todoRef, todo.groups?.name, todo.categories?.name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Done toggle */}
                  <button
                    onClick={e => handleToggleDone(e, todo)}
                    style={{
                      flexShrink: 0,
                      width: '20px',
                      height: '20px',
                      minHeight: '20px',
                      borderRadius: '50%',
                      border: `1.5px solid ${isDone ? 'var(--status-done)' : 'var(--border)'}`,
                      background: isDone ? 'var(--status-done)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition)',
                      opacity: isHovered || isSelected || isDone ? 1 : 0,
                    }}
                    aria-label={isDone ? 'Mark open' : 'Mark done'}
                  >
                    {isDone && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Done section — collapsed by default, only shown in active filter mode */}
        {filterStatus === 'active' && doneTodos.length > 0 && (
          <div style={{ marginTop: 'var(--sp-lg)' }}>
            <button
              onClick={() => setShowDone(d => !d)}
              aria-expanded={showDone}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-sm)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--sp-sm) 0',
                color: 'var(--muted)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-sm)',
              }}
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
              <div style={{ ...s.listCard, marginTop: 'var(--sp-sm)', opacity: 0.7 }}>
                {doneTodos.map((todo, i) => {
                  const isHovered  = hoveredId === todo.id
                  const isSelected = selectedTodo?.id === todo.id
                  const todoRef    = productCodeMap.get(todo.product_id) && todo.todo_number != null
                    ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}`
                    : null

                  return (
                    <div
                      key={todo.id}
                      onClick={() => setSelectedTodo(todo)}
                      onMouseEnter={() => setHoveredId(todo.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${todo.title}, done`}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedTodo(todo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-md)',
                        padding: 'var(--sp-sm) var(--sp-lg)',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        background: isSelected
                          ? 'var(--pill-active-bg)'
                          : isHovered ? 'var(--bg3)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background var(--transition)',
                      }}
                    >
                      <div style={{
                        width: '3px',
                        alignSelf: 'stretch',
                        borderRadius: '2px',
                        flexShrink: 0,
                        background: STATUS_COLOR['done'],
                        opacity: 0.3,
                      }} />
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--muted)',
                          textDecoration: 'line-through',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {todo.title}
                        </p>
                        {(todoRef || todo.groups?.name || todo.categories?.name) && (
                          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: '2px' }}>
                            {[todoRef, todo.groups?.name, todo.categories?.name].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={e => handleToggleDone(e, todo)}
                        style={{
                          flexShrink: 0,
                          width: '20px',
                          height: '20px',
                          minHeight: '20px',
                          borderRadius: '50%',
                          border: '1.5px solid var(--status-done)',
                          background: 'var(--status-done)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isHovered || isSelected ? 1 : 0.5,
                        }}
                        aria-label="Mark open"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="var(--bg2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
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
          groups={groups}
          categories={categories}
          products={products}
          priorities={priorities}
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
          groups={groups}
          categories={categories}
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

      {/* Version */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'calc(12px + var(--sab)) 20px 12px',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 'var(--fs-version)',
          color: 'var(--muted)',
          letterSpacing: '0.05em',
        }}>
          TODOS {VERSION}
        </span>
      </div>
    </div>
  )
}
