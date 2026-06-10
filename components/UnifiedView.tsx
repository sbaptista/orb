'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import OrbPanel from './OrbPanel'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import PrintModal from '@/components/PrintModal'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
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
type User = { id: string; email: string; first_name: string; last_name: string }


function parseLocalDatetime(str: string): Date {
  const [datePart, timePart] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

export default function UnifiedView({
  initialProducts,
  user,
}: {
  initialProducts: Product[]
  isAdmin: boolean
  user?: User | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const pathname = usePathname()
  const [products] = useState<Product[]>(initialProducts)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialProducts.length > 0 ? initialProducts[0].id : null
  )
  const [todos, setTodos] = useState<Todo[]>([])
  const [statuses, setStatuses] = useState<StatusDef[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [orbOpen, setOrbOpen] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const router = useRouter()
  const [projectSearchOpen, setProjectSearchOpen] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const initialLoadDone = useRef(false)

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedId) ?? null,
    [products, selectedId]
  )

  const filteredProducts = useMemo(() => {
    const q = projectSearchQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code?.toLowerCase().includes(q))
    )
  }, [products, projectSearchQuery])

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

  const userName = user?.first_name || user?.email || '?'

  return (
    <div className="up-page">
      {/* Top bar */}
      <div className="up-topbar" style={{ position: 'relative' }}>
        <Link href="/dashboard" className="tv-back">
          ← Back
        </Link>
        <span className="up-proto-badge">Prototype</span>

        {/* Zero-Row Project Switcher Dropdown Trigger */}
        <div style={{ display: 'inline-block' }}>
          <button
            className="up-project-trigger"
            aria-expanded={projectSearchOpen}
            onClick={() => setProjectSearchOpen(v => !v)}
            title="Switch project"
          >
            <span>{selectedProduct?.name ?? 'Select Project'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Desktop Search Dropdown */}
          {!isMobile && projectSearchOpen && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setProjectSearchOpen(false)}
              />
              <div className="up-switcher-dropdown">
                <div className="up-switcher-search-wrap">
                  <span className="up-switcher-search-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="up-switcher-search-input"
                    placeholder="Search projects..."
                    value={projectSearchQuery}
                    onChange={e => setProjectSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="up-switcher-list">
                  {filteredProducts.length === 0 ? (
                    <div className="up-switcher-empty">No projects found</div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        className="up-switcher-item"
                        data-active={p.id === selectedId ? 'true' : undefined}
                        onClick={() => {
                          setSelectedId(p.id)
                          initialLoadDone.current = false
                          setProjectSearchOpen(false)
                          setProjectSearchQuery('')
                        }}
                      >
                        <span>{p.name}</span>
                        {p.code && <span className="up-switcher-item-code">{p.code}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />
        {isMobile ? (
          <button
            className="up-orb-toggle"
            onClick={() => setOrbOpen(v => !v)}
            aria-label={orbOpen ? 'Hide Orb' : 'Show Orb'}
          >
            <div className="up-orb-toggle-dot" />
            {orbOpen ? 'Hide Orb' : 'Ask Orb'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            {!selectedId ? (
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
              onClick={() => router.push('/help')}
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
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </span>
              <span className="nav-btn-label">Settings</span>
            </Link>
            <Link
              href="/account"
              className="nav-btn"
              title="Account"
              aria-label="Account"
            >
              <span className="nav-btn-icon" style={{ fontWeight: 600, fontSize: '14px' }}>
                {userName.charAt(0).toUpperCase()}
              </span>
              <span className="nav-btn-label">Account</span>
            </Link>
          </div>
        )}
      </div>

      {/* Navigation strip / Breadcrumbs (conditional layer) */}
      {pathname !== '/prototype' && (
        <div className="up-nav-strip" style={{ padding: 'var(--sp-xs) var(--sp-2xl)', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <Breadcrumbs />
        </div>
      )}

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
              Nothing active — you&apos;re clear.
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
            todoCount={todos.length}
            onMutation={handleOrbMutation}
          />
        </div>
      </div>

      <OrbVersionLabel className="up-version" />

      {showPrint && (
        <PrintModal
          onClose={() => setShowPrint(false)}
          selectedProductId={selectedId}
          selectedProductName={selectedProduct?.name ?? null}
        />
      )}

      {/* Mobile Switcher Drawer */}
      {isMobile && projectSearchOpen && (
        <div className="up-switcher-drawer-overlay" onClick={() => setProjectSearchOpen(false)}>
          <div className="up-switcher-drawer" onClick={e => e.stopPropagation()}>
            <div className="up-switcher-drawer-header">
              <h3 className="up-switcher-drawer-title">Switch Project</h3>
              <button className="up-switcher-drawer-close" onClick={() => setProjectSearchOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="up-switcher-search-wrap">
              <span className="up-switcher-search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                className="up-switcher-search-input"
                placeholder="Search projects..."
                value={projectSearchQuery}
                onChange={e => setProjectSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className="up-switcher-list">
              {filteredProducts.length === 0 ? (
                <div className="up-switcher-empty">No projects found</div>
              ) : (
                filteredProducts.map(p => (
                  <button
                    key={p.id}
                    className="up-switcher-item"
                    data-active={p.id === selectedId ? 'true' : undefined}
                    onClick={() => {
                      setSelectedId(p.id)
                      initialLoadDone.current = false
                      setProjectSearchOpen(false)
                      setProjectSearchQuery('')
                    }}
                  >
                    <span>{p.name}</span>
                    {p.code && <span className="up-switcher-item-code">{p.code}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
