'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import OrbPanel from './OrbPanel'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import { ACTIVE_STATUSES } from '@/lib/status-groups'

type Todo = {
  id: string
  product_id: string
  todo_number: number | null
  title: string
  status: string
  due_at: string | null
  closed_at: string | null
}

type Product = { id: string; name: string; code: string | null; view_mode: 'list' | 'checklist' }
type StatusDef = { id: string; name: string; is_closed: boolean }

function parseLocalDatetime(str: string): Date {
  const [datePart, timePart] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

export default function UnifiedView({
  initialProducts,
  isAdmin,
}: {
  initialProducts: Product[]
  isAdmin: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [products] = useState<Product[]>(initialProducts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialProducts.length > 0 ? initialProducts[0].id : null
  )
  const [todos, setTodos] = useState<Todo[]>([])
  const [statuses, setStatuses] = useState<StatusDef[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [orbOpen, setOrbOpen] = useState(false)
  const initialLoadDone = useRef(false)

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedId) ?? null,
    [products, selectedId]
  )

  const closedNames = useMemo(
    () => new Set(statuses.filter(s => s.is_closed).map(s => s.name)),
    [statuses]
  )
  const isClosed = useCallback(
    (status: string) => closedNames.has(status),
    [closedNames]
  )

  // Mobile detection
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    setIsMobile(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // Fetch todos
  const fetchTodos = useCallback(async () => {
    if (!selectedId) return
    if (!initialLoadDone.current) setLoading(true)
    try {
      const { data } = await supabase
        .from('todos')
        .select('id, product_id, todo_number, title, status, due_at, closed_at')
        .eq('product_id', selectedId)
        .is('deleted_at', null)
        .in('status', [...ACTIVE_STATUSES])
        .order('todo_number', { ascending: true })
        .limit(50)
      setTodos((data as Todo[]) ?? [])
    } catch (err) {
      console.error('[UnifiedView] fetch error:', err)
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [selectedId, supabase])

  useVisibilityRefetch(fetchTodos)

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  // Load statuses
  useEffect(() => {
    supabase
      .from('statuses')
      .select('id, name, is_closed')
      .then(({ data }) => setStatuses((data ?? []) as StatusDef[]))
  }, [supabase])

  // Handle Orb mutation — refetch the list
  const handleOrbMutation = useCallback(() => {
    fetchTodos()
  }, [fetchTodos])

  return (
    <div className="up-page">
      {/* Top bar */}
      <div className="up-topbar">
        <Link href="/dashboard" className="tv-back">
          ← Back
        </Link>
        <span className="up-proto-badge">Prototype</span>
        <div style={{ flex: 1 }} />
        {isMobile && (
          <button
            className="up-orb-toggle"
            onClick={() => setOrbOpen(v => !v)}
            aria-label={orbOpen ? 'Hide Orb' : 'Show Orb'}
          >
            <div className="up-orb-dot" />
            {orbOpen ? 'Hide Orb' : 'Ask Orb'}
          </button>
        )}
      </div>

      {/* Project selector */}
      <div className="up-project-bar">
        {products.map(p => (
          <button
            key={p.id}
            className={`up-project-pill${p.id === selectedId ? ' up-project-pill--active' : ''}`}
            onClick={() => { setSelectedId(p.id); initialLoadDone.current = false }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Main content: list + panel */}
      <div className="up-body">
        {/* Task list */}
        <div className="up-list-pane">
          {selectedProduct && (
            <h2 className="tv-project-name">{selectedProduct.name}</h2>
          )}

          {loading ? (
            <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
              Loading…
            </p>
          ) : todos.length === 0 ? (
            <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--sp-3xl) 0' }}>
              Nothing active — you're clear.
            </p>
          ) : (
            <div className="tv-list-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tv-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map(todo => {
                    const isDone = isClosed(todo.status)
                    const ref = selectedProduct?.code && todo.todo_number != null
                      ? `${selectedProduct.code}-${todo.todo_number}`
                      : null
                    return (
                      <tr key={todo.id}>
                        <td className="tv-td-content">
                          <p className="tv-todo-title" style={{
                            fontSize: 'var(--fs-base)',
                            color: isDone ? 'var(--muted)' : 'var(--text)',
                            textDecoration: isDone ? 'line-through' : 'none',
                            margin: 0,
                          }}>
                            {todo.title}
                          </p>
                          {ref && (
                            <span className="text-xs text-muted">{ref}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--muted)' }}>
                          {todo.due_at && (
                            <span style={{
                              color: !isDone && parseLocalDatetime(todo.due_at) < new Date() ? 'var(--error)' : undefined,
                            }}>
                              {parseLocalDatetime(todo.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Orb panel — always visible on desktop, toggleable on mobile */}
        <div className={`up-orb-pane${isMobile ? (orbOpen ? ' up-orb-pane--open' : '') : ' up-orb-pane--desktop'}`}>
          <OrbPanel
            productId={selectedId}
            productCode={selectedProduct?.code ?? null}
            onMutation={handleOrbMutation}
          />
        </div>
      </div>

      <OrbVersionLabel className="up-version" />
    </div>
  )
}
