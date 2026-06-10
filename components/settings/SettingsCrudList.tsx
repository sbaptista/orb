'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import HScrollNav from '@/components/ui/HScrollNav'

const PILL_THRESHOLD = 5

type TableColumn<T = any> = {
  label: string
  width?: string
  align?: 'left' | 'right' | 'center'
  sortKey?: string
  sortValue?: (item: T, extra: any) => string | number
  hidden?: 'mobile'
}

type CrudConfig<T, F> = {
  title: string
  table: string
  itemLabel: string
  emptyForm: F
  orderBy?: string
  pageClass?: string
  idColumn?: string
  subtitle?: (items: T[], totalCount?: number) => string

  layout?: 'list' | 'table'
  tableColumns?: TableColumn<T>[]

  load?: (supabase: any, pagination?: { page: number; pageSize: number }) => Promise<{ items: T[]; extra?: any; totalCount?: number }>
  /** Server-side pagination. When set, load() receives { page, pageSize } and must return totalCount. */
  pagination?: { pageSize: number }
  /** Extra ReactNode rendered in the header area (right side, before the Add button). */
  headerExtra?: ReactNode
  /** Custom handler when a row is clicked. When provided, replaces the default edit-on-click behavior. */
  onRowClick?: (item: T) => void
  validate?: (form: F, items: T[], editingId: string | null) => string | null
  toRecord?: (form: F, items: T[]) => Record<string, any>
  toForm?: (item: T) => F
  getId: (item: T) => string

  onAdd?: (supabase: any, record: Record<string, any>, items: T[]) => Promise<void>
  /** Custom save handler for edit. When provided, replaces the default Supabase update. */
  onSave?: (supabase: any, id: string, record: Record<string, any>, items: T[]) => Promise<void>
  onDelete?: (supabase: any, item: T, items: T[]) => Promise<void>
  onBeforeDelete?: (supabase: any, item: T) => Promise<void>
  deleteWarning?: (item: T, extra: any) => ReactNode
  canDelete?: (item: T, extra: any) => boolean

  /** Label for the add button. Defaults to "Add {itemLabel}". */
  addButtonLabel?: string
  /** Label for the modal title when adding. Defaults to "Add {itemLabel}". */
  addModalTitle?: string
  /** Label for the modal title when editing. Defaults to "Edit {itemLabel}". */
  editModalTitle?: string
  /** Additional CSS class(es) for the modal container. E.g. "modal-compose" for wide compose layouts. */
  modalClass?: string
  /** Callback when the modal is closed/cancelled */
  onClose?: () => void

  /** When omitted, no Add button or Edit modal is shown (read-only table). */
  renderForm?: (props: {
    form: F
    onChange: (f: F) => void
    onSubmit: () => void
    onCancel: () => void
    submitLabel: string
    saving: boolean
    extra: any
  }) => ReactNode

  renderRow: (props: {
    item: T
    index: number
    items: T[]
    onEdit: (e?: React.MouseEvent) => void
    onDelete: () => void
    onMove?: (direction: 'up' | 'down') => void
    saving: boolean
    extra: any
    checkbox?: ReactNode
  }) => ReactNode

  renderMobileRow?: (props: {
    item: T
    index: number
    items: T[]
    onEdit: (e?: React.MouseEvent) => void
    onDelete: () => void
    saving: boolean
    extra: any
  }) => ReactNode

  scopeFilter?: {
    getScopes: (extra: any) => Array<{ id: string; label: string }>
    defaultScope: string
    defaultLabel: string
    filterItem: (item: T, scope: string) => boolean
    applyToForm?: (form: F, scope: string) => F
  }

  onMove?: (supabase: any, item: T, items: T[], direction: 'up' | 'down') => Promise<void>

  searchFilter?: (item: T, query: string, extra: any) => boolean
  searchPlaceholder?: string

  bulkDelete?: {
    onDelete: (supabase: any, items: T[]) => Promise<{ error?: string }>
    canSelect?: (item: T) => boolean
    confirmMessage?: (count: number) => string
  }
}

export default function SettingsCrudList<T, F>({ config }: { config: CrudConfig<T, F> }) {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<T[]>([])
  const [extra, setExtra] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal state: 'add' | 'edit' | null
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [modalForm, setModalForm] = useState<F>(config.emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [scope, setScope] = useState(config.scopeFilter?.defaultScope ?? '')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Column width resizing state/refs (declared at top level to obey hook rules)
  const colStorageKey = `orb-col-widths-v2-${config.title}`
  const [colWidths, setColWidths] = useState<Record<number, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(colStorageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          const expectedLen = config.tableColumns?.length ?? 0
          if (Object.keys(parsed).length === expectedLen) {
            return parsed
          }
        } catch {
          return {}
        }
      }
    }
    return {}
  })
  const [activeResizeColIdx, setActiveResizeColIdx] = useState<number | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const resizingIdx = useRef<number | null>(null)
  const hasCustomWidths = Object.keys(colWidths).length > 0

  const resetColWidths = useCallback(() => {
    setColWidths({})
    localStorage.removeItem(colStorageKey)
  }, [colStorageKey])

  useEffect(() => {
    if (hasCustomWidths) {
      localStorage.setItem(colStorageKey, JSON.stringify(colWidths))
    }
  }, [colWidths, colStorageKey, hasCustomWidths])

  const startResizeActivation = (index: number) => {
    setActiveResizeColIdx(index)
  }

  useEffect(() => {
    if (activeResizeColIdx === null) return
    const handleOutsideClick = (e: MouseEvent) => {
      const th = (e.target as HTMLElement).closest('th.audit-th')
      if (th) return
      setActiveResizeColIdx(null)
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [activeResizeColIdx])

  const totalColWidth = useMemo(() => {
    if (Object.keys(colWidths).length === 0) return undefined
    let sum = !!config.bulkDelete ? 36 : 0
    config.tableColumns?.forEach((_col, idx) => {
      sum += colWidths[idx] || 100
    })
    return sum
  }, [colWidths, config.bulkDelete, config.tableColumns])

  const canSelect = config.bulkDelete?.canSelect ?? (() => true)

  const load = useCallback(async () => {
    if (config.load) {
      const paginationArg = config.pagination ? { page, pageSize: config.pagination.pageSize } : undefined
      const result = await config.load(supabase, paginationArg)
      setItems(result.items)
      if (result.extra) setExtra(result.extra)
      if (result.totalCount !== undefined) setTotalCount(result.totalCount)
    } else {
      const { data } = await supabase.from(config.table).select('*').order(config.orderBy ?? 'sort_order')
      setItems(data ?? [])
    }
    setLoading(false)
  }, [supabase, config, page])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const scoped = config.scopeFilter
    ? items.filter(item => config.scopeFilter!.filterItem(item, scope))
    : items

  const filtered = config.searchFilter && search.trim()
    ? scoped.filter(item => config.searchFilter!(item, search.trim(), extra))
    : scoped

  const displayed = (() => {
    if (!sortKey) return filtered
    const col = config.tableColumns?.find(c => c.sortKey === sortKey)
    if (!col?.sortValue) return filtered
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a, extra)
      const bv = col.sortValue!(b, extra)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  })()

  const selectableIds = displayed.filter(canSelect).map(config.getId)
  const allChecked = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id))
  const someChecked = selectedIds.length > 0

  const idCol = config.idColumn ?? 'id'
  const isTable = config.layout === 'table'
  const hasMobileCards = isTable && !!config.renderMobileRow

  const allScopes = config.scopeFilter
    ? [
        { id: config.scopeFilter.defaultScope, label: config.scopeFilter.defaultLabel },
        ...config.scopeFilter.getScopes(extra),
      ]
    : []
  const usePills = allScopes.length <= PILL_THRESHOLD

  function openAddModal() {
    let form = { ...config.emptyForm }
    if (config.scopeFilter?.applyToForm) {
      form = config.scopeFilter.applyToForm(form, scope)
    }
    setModalForm(form)
    setModalMode('add')
    setEditingId(null)
    setConfirmDeleteId(null)
    setError('')
  }

  function openEditModal(item: T) {
    if (!config.toForm || !config.renderForm) return
    setEditingId(config.getId(item))
    setModalForm(config.toForm(item))
    setModalMode('edit')
    setConfirmDeleteId(null)
    setError('')
  }

  function closeModal() {
    setModalMode(null)
    setEditingId(null)
    setError('')
    config.onClose?.()
  }

  async function handleAdd() {
    if (!config.toRecord) return
    const err = config.validate?.(modalForm, items, null)
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    try {
      if (config.onAdd) {
        await config.onAdd(supabase, config.toRecord(modalForm, items), items)
        toast.success(`${config.itemLabel} added.`)
        await load()
      } else {
        const { data, error: dbErr } = await supabase
          .from(config.table)
          .insert(config.toRecord(modalForm, items))
          .select()
          .single()
        if (dbErr) { setError(dbErr.message); setSaving(false); return }
        if (data) {
          toast.success(`${config.itemLabel} added.`)
          setItems(prev => [...prev, data as T])
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setSaving(false)
      return
    }
    setSaving(false)
    closeModal()
  }

  async function handleSave(id: string) {
    if (!config.toRecord) return
    const err = config.validate?.(modalForm, items, id)
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    try {
      if (config.onSave) {
        await config.onSave(supabase, id, config.toRecord(modalForm, items), items)
        toast.success(`${config.itemLabel} saved.`)
        await load()
      } else {
        const { data, error: dbErr } = await supabase
          .from(config.table)
          .update(config.toRecord(modalForm, items))
          .eq(idCol, id)
          .select()
          .single()
        if (dbErr) { setError(dbErr.message); setSaving(false); return }
        if (data) {
          toast.success(`${config.itemLabel} saved.`)
          setItems(prev => prev.map(item => config.getId(item) === id ? data as T : item))
        }
      }
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
      return
    }
    setSaving(false)
    closeModal()
  }

  async function handleDelete(item: T) {
    setSaving(true)
    if (config.onDelete) {
      await config.onDelete(supabase, item, items)
      setSaving(false)
      toast.success(`${config.itemLabel} deleted.`)
      setConfirmDeleteId(null)
      load()
    } else {
      const id = config.getId(item)
      if (config.onBeforeDelete) await config.onBeforeDelete(supabase, item)
      await supabase.from(config.table).delete().eq(idCol, id)
      setSaving(false)
      toast.success(`${config.itemLabel} deleted.`)
      setItems(prev => prev.filter(i => config.getId(i) !== id))
      setConfirmDeleteId(null)
    }
  }

  async function handleMove(item: T, direction: 'up' | 'down') {
    if (!config.onMove) return
    setSaving(true)
    setError('')
    try {
      await config.onMove(supabase, item, items, direction)
      await load()
    } catch (err: any) {
      setError(`Failed to move: ${err.message}`)
    }
    setSaving(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    if (allChecked) setSelectedIds([])
    else setSelectedIds(selectableIds)
  }

  async function handleBulkDelete() {
    if (!config.bulkDelete || selectedIds.length === 0) return
    const count = selectedIds.length
    const msg = config.bulkDelete.confirmMessage?.(count) ?? `Permanently delete ${count} item${count > 1 ? 's' : ''}? This cannot be undone.`
    if (!confirm(msg)) return
    setSaving(true)
    const toDelete = displayed.filter(item => selectedIds.includes(config.getId(item)))
    const res = await config.bulkDelete.onDelete(supabase, toDelete)
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(`${count} item${count > 1 ? 's' : ''} deleted.`)
    setSelectedIds([])
    load()
  }

  if (loading) return <div className="s-loading">Loading…</div>

  const hasBulk = !!config.bulkDelete
  const colCount = (config.tableColumns?.length ?? 1) + (hasBulk ? 1 : 0)

  function renderDeleteConfirm(item: T) {
    const deletable = config.canDelete ? config.canDelete(item, extra) : true
    const content = (
      <>
        <span className="text-sm flex-1">
          {config.deleteWarning
            ? config.deleteWarning(item, extra)
            : <>Delete <strong>{(item as any).name ?? (item as any).label}</strong>?</>
          }
        </span>
        {deletable ? (
          <>
            <button className="btn-danger-confirm" onClick={() => handleDelete(item)} disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Deleting…' : 'Confirm'}
            </button>
            <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
          </>
        ) : (
          <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>OK</button>
        )}
      </>
    )
    if (isTable) {
      return (
        <tr key={config.getId(item)}>
          <td colSpan={colCount + 1} className="audit-td">
            <div className="s-row-delete" style={{ border: 'none', padding: 0 }}>{content}</div>
          </td>
        </tr>
      )
    }
    return <div key={config.getId(item)} className="s-row-delete">{content}</div>
  }

  function renderDeleteConfirmCard(item: T) {
    const deletable = config.canDelete ? config.canDelete(item, extra) : true
    return (
      <div key={config.getId(item)} className="crud-card s-row-delete" style={{ border: '1px solid var(--error)', padding: 'var(--sp-md)' }}>
        <span className="text-sm flex-1">
          {config.deleteWarning
            ? config.deleteWarning(item, extra)
            : <>Delete <strong>{(item as any).name ?? (item as any).label}</strong>?</>
          }
        </span>
        <div className="flex-row gap-sm" style={{ marginTop: 'var(--sp-sm)' }}>
          {deletable ? (
            <>
              <button className="btn-danger-confirm" onClick={() => handleDelete(item)} disabled={saving}
                style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Deleting…' : 'Confirm'}
              </button>
              <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
            </>
          ) : (
            <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>OK</button>
          )}
        </div>
      </div>
    )
  }

  function renderMobileCard(item: T, idx: number) {
    if (!config.renderMobileRow) return null
    const id = config.getId(item)
    if (confirmDeleteId === id) return renderDeleteConfirmCard(item)
    return config.renderMobileRow({
      item,
      index: idx,
      items: displayed,
      onEdit: (e?: React.MouseEvent) => {
        if (e) {
          const tag = (e.target as HTMLElement).tagName
          if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
          if ((e.target as HTMLElement).closest('button, a, input, select')) return
        }
        openEditModal(item)
      },
      onDelete: () => { setConfirmDeleteId(id); setModalMode(null); setEditingId(null) },
      saving,
      extra,
    })
  }

  function renderItemRow(item: T, idx: number) {
    const id = config.getId(item)
    const selectable = hasBulk && canSelect(item)
    const checkbox = hasBulk ? (
      <td className="audit-td" style={{ textAlign: 'center' }}>
        {selectable ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(id)}
            onChange={() => toggleSelect(id)}
            style={{ cursor: 'pointer' }}
          />
        ) : null}
      </td>
    ) : undefined
    const rowNode = config.renderRow({
      item,
      index: idx,
      items: displayed,
      onEdit: (e?: React.MouseEvent) => {
        // Don't trigger row-edit when clicking buttons, links, inputs, selects
        if (e) {
          const tag = (e.target as HTMLElement).tagName
          if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
          if ((e.target as HTMLElement).closest('button, a, input, select')) return
        }
        if (config.onRowClick) { config.onRowClick(item); return }
        openEditModal(item)
      },
      onDelete: () => { setConfirmDeleteId(config.getId(item)); setModalMode(null); setEditingId(null) },
      onMove: config.onMove ? (dir) => handleMove(item, dir) : undefined,
      saving,
      extra,
      checkbox,
    })
    if (isTable && !totalColWidth && React.isValidElement(rowNode) && (rowNode as React.ReactElement<any>).type === 'tr') {
      const trNode = rowNode as React.ReactElement<any>
      const children = React.Children.toArray(trNode.props.children) as React.ReactElement<any>[]
      const hasFullWidthCell = children.some(child => child?.props?.colSpan != null)
      if (hasFullWidthCell) {
        const newChildren = children.map(child => {
          if (child?.props?.colSpan != null) {
            return React.cloneElement(child, { colSpan: child.props.colSpan + 1 })
          }
          return child
        })
        return React.cloneElement(trNode, {}, ...newChildren)
      } else {
        children.push(
          <td key="spacer-cell" className="audit-td" style={{ width: 'auto', borderRight: 'none' }} />
        )
        return React.cloneElement(trNode, {}, ...children)
      }
    }
    if (isTable) return rowNode
    return <div key={config.getId(item)}>{rowNode}</div>
  }

  const itemRows = displayed.map((item, idx) => {
    const id = config.getId(item)
    if (confirmDeleteId === id) return renderDeleteConfirm(item)
    return renderItemRow(item, idx)
  })

  // ── Modal ──
  const modalOpen = modalMode !== null
  const modalTitle = modalMode === 'add'
    ? (config.addModalTitle ?? `Add ${config.itemLabel}`)
    : (config.editModalTitle ?? `Edit ${config.itemLabel}`)

  const hasForm = !!config.renderForm
  const modalFormNode = modalOpen && config.renderForm ? config.renderForm({
    form: modalForm,
    onChange: setModalForm,
    onSubmit: modalMode === 'add' ? handleAdd : () => handleSave(editingId!),
    onCancel: closeModal,
    submitLabel: modalMode === 'add' ? (config.addButtonLabel ?? `Add ${config.itemLabel}`) : 'Save',
    saving,
    extra,
  }) : null

  return (
    <div className={config.pageClass ?? 'settings-page s-page'}>
      <div className="s-header">
        <div>
          <h2 className="s-title">{config.title}</h2>
          <div className="flex-row gap-sm" style={{ alignItems: 'baseline' }}>
            {config.subtitle && (
              <p className="text-sm text-muted">{config.subtitle(displayed, totalCount || undefined)}</p>
            )}
            {isTable && hasCustomWidths && (
              <button className="text-btn btn-sm" onClick={resetColWidths}>
                Reset columns
              </button>
            )}
          </div>
        </div>
        <div className="flex-row gap-sm">
          {config.headerExtra}
          {hasForm && (
            <button className="btn-outline" onClick={openAddModal}>
              + {config.addButtonLabel ?? `Add ${config.itemLabel}`}
            </button>
          )}
        </div>
      </div>

      {config.scopeFilter && usePills && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <label className="label">Filters</label>
          <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
            {allScopes.map(s => (
              <button
                key={s.id}
                className={`pill ${scope === s.id ? 'pill-active' : ''}`}
                onClick={() => setScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {config.scopeFilter && !usePills && (
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <label className="label">Filters</label>
          <select
            className="crud-scope-select"
            value={scope}
            onChange={e => setScope(e.target.value)}
          >
            {allScopes.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {config.searchFilter && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={config.searchPlaceholder ?? 'Filter…'}
            className="crud-search-input"
            style={config.searchPlaceholder?.includes('summary') ? { maxWidth: '480px' } : undefined}
          />
        </div>
      )}

      {hasBulk && someChecked && (
        <div className="crud-bulk-bar">
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {selectedIds.length} selected
          </span>
          <button
            className="oc-tool-btn"
            onClick={handleBulkDelete}
            disabled={saving}
            style={{ fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
          >
            Delete
          </button>
          <button
            className="text-btn text-sm"
            onClick={() => setSelectedIds([])}
            style={{ color: 'var(--muted)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && !modalOpen && <p className="s-error">{error}</p>}

      {isTable ? (
        displayed.length === 0 ? (
          <div className="s-card s-empty">No {config.title.toLowerCase()} yet.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={hasMobileCards ? 'crud-desktop-table' : undefined}>
              <HScrollNav scrollRef={tableScrollRef as React.RefObject<HTMLElement>} className="crud-table-scroll">
                <div className="s-card" style={{
                  padding: 0, overflow: 'hidden',
                  ...(totalColWidth ? { width: 'fit-content', maxWidth: '100%', flex: 'none' } : {}),
                }}>
                  <div ref={tableScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' as any }}>
                    {activeResizeColIdx !== null && (
                      <style>{`
                        .audit-table tr th:nth-child(${activeResizeColIdx + (hasBulk ? 2 : 1)}) {
                          border-right: 2px solid var(--accent, #5a3090) !important;
                        }
                        .audit-table tr td:nth-child(${activeResizeColIdx + (hasBulk ? 2 : 1)}) {
                          border-right: 2px solid var(--accent, #5a3090) !important;
                        }
                      `}</style>
                    )}
                    <table className="audit-table" style={{ width: totalColWidth ? `${totalColWidth}px` : '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {hasBulk && (
                            <th className="audit-th" style={{ width: '36px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={toggleSelectAll}
                                style={{ cursor: 'pointer' }}
                              />
                            </th>
                          )}
                          {config.tableColumns?.map((col, i) => {
                            const isSortable = !!col.sortKey
                            const isActive = sortKey === col.sortKey
                            const dynamicWidth = colWidths[i]
                            const widthStyle = dynamicWidth ? `${dynamicWidth}px` : col.width

                            const handleResizeStart = (e: React.PointerEvent) => {
                               e.preventDefault()
                               e.stopPropagation()
                               resizingIdx.current = i
                               startX.current = e.clientX

                               const thEl = (e.target as HTMLElement).closest('th')
                               let currentWidth = colWidths[i]

                               if (Object.keys(colWidths).length === 0 && tableScrollRef.current) {
                                 const ths = tableScrollRef.current.querySelectorAll('th.audit-th')
                                 const initialWidths: Record<number, number> = {}
                                 const offset = !!config.bulkDelete ? 1 : 0
                                 config.tableColumns?.forEach((col, idx) => {
                                   const el = ths[idx + offset]
                                   if (el) {
                                     initialWidths[idx] = el.getBoundingClientRect().width
                                   } else {
                                     initialWidths[idx] = 100
                                   }
                                 })
                                 setColWidths(initialWidths)
                                 currentWidth = initialWidths[i]
                               }

                               startWidth.current = currentWidth || (thEl ? thEl.getBoundingClientRect().width : 100)

                              const onPointerMove = (moveEvent: PointerEvent) => {
                                if (resizingIdx.current === null) return
                                const delta = moveEvent.clientX - startX.current
                                const newWidth = Math.max(60, startWidth.current + delta)
                                setColWidths(prev => ({ ...prev, [i]: newWidth }))
                              }

                              const onPointerUp = () => {
                                resizingIdx.current = null
                                window.removeEventListener('pointermove', onPointerMove)
                                window.removeEventListener('pointerup', onPointerUp)
                              }

                              window.addEventListener('pointermove', onPointerMove)
                              window.addEventListener('pointerup', onPointerUp)
                            }

                            return (
                              <th key={i} className="audit-th"
                                style={{
                                  width: widthStyle,
                                  ...(dynamicWidth ? { minWidth: widthStyle, maxWidth: widthStyle } : {}),
                                  textAlign: col.align ?? 'left',
                                  cursor: isSortable ? 'pointer' : undefined,
                                  userSelect: 'none',
                                  position: 'relative',
                                }}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('.col-resize-handle-sheets')) {
                                    e.stopPropagation()
                                    return
                                  }
                                  startResizeActivation(i)
                                  if (isSortable) {
                                    if (isActive) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                    else { setSortKey(col.sortKey!); setSortDir('asc') }
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', paddingRight: '12px', minWidth: 0 }}>
                                  <span style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 1,
                                  }}>
                                    {col.label}
                                  </span>
                                  {isSortable && (
                                    <span style={{ flexShrink: 0, marginLeft: '4px' }}>
                                      {isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                                    </span>
                                  )}
                                </div>

                                {activeResizeColIdx === i && (
                                  <div
                                    className="col-resize-handle-sheets"
                                    onPointerDown={handleResizeStart}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="17 8 21 12 17 16"></polyline>
                                      <polyline points="7 8 3 12 7 16"></polyline>
                                      <line x1="3" y1="12" x2="21" y2="12"></line>
                                    </svg>
                                  </div>
                                )}
                              </th>
                            )
                          })}
                          {!totalColWidth && <th className="audit-th" style={{ width: 'auto', borderRight: 'none' }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {itemRows}
                      </tbody>
                    </table>
                  </div>
                  {config.pagination && totalCount > 0 && (() => {
                    const lastPage = Math.max(0, Math.ceil(totalCount / config.pagination.pageSize) - 1)
                    return (
                      <div className="flex-between" style={{ padding: 'var(--sp-sm) var(--sp-lg)', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                          <button
                            className="nav-btn"
                            onClick={() => { setPage(0); setSelectedIds([]) }}
                            disabled={page === 0}
                            data-tooltip="First page"
                          >
                            <span className="nav-btn-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                            </span>
                            <span className="nav-btn-label">First</span>
                          </button>
                          <button
                            className="nav-btn"
                            onClick={() => { setPage(p => Math.max(0, p - 1)); setSelectedIds([]) }}
                            disabled={page === 0}
                            data-tooltip="Previous page"
                          >
                            <span className="nav-btn-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </span>
                            <span className="nav-btn-label">Previous</span>
                          </button>
                        </div>
                        <span className="text-xs text-muted">Page {page + 1} of {lastPage + 1}</span>
                        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                          <button
                            className="nav-btn"
                            onClick={() => { setPage(p => p + 1); setSelectedIds([]) }}
                            disabled={page >= lastPage}
                            data-tooltip="Next page"
                          >
                            <span className="nav-btn-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                            <span className="nav-btn-label">Next</span>
                          </button>
                          <button
                            className="nav-btn"
                            onClick={() => { setPage(lastPage); setSelectedIds([]) }}
                            disabled={page >= lastPage}
                            data-tooltip="Last page"
                          >
                            <span className="nav-btn-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                            </span>
                            <span className="nav-btn-label">Last</span>
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </HScrollNav>
            </div>

            {/* Mobile cards */}
            {hasMobileCards && (
              <div className="crud-mobile-cards">
                {displayed.map((item, idx) => renderMobileCard(item, idx))}
              </div>
            )}
          </>
        )
      ) : (
        <div className="s-list">
          {displayed.length === 0 ? (
            <p className="s-empty">No {config.title.toLowerCase()} yet.</p>
          ) : itemRows}
        </div>
      )}

      {/* ── Floating modal for Add / Edit ── */}
      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={closeModal} />
          <div className={`modal-center ${config.modalClass ?? ''}`}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                {modalTitle}
              </h3>
              <button className="close-btn" onClick={closeModal} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
              {error && <p className="s-error" style={{ marginBottom: 'var(--sp-md)' }}>{error}</p>}
              {modalFormNode}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
