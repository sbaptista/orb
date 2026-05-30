'use client'

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import HScrollNav from '@/components/ui/HScrollNav'

type TableColumn<T = any> = {
  label: string
  width?: string
  align?: 'left' | 'right' | 'center'
  sortKey?: string
  sortValue?: (item: T, extra: any) => string | number
}

type CrudConfig<T, F> = {
  title: string
  table: string
  itemLabel: string
  emptyForm: F
  orderBy?: string
  pageClass?: string
  idColumn?: string
  subtitle?: (items: T[]) => string

  layout?: 'list' | 'table'
  tableColumns?: TableColumn<T>[]

  load?: (supabase: any) => Promise<{ items: T[]; extra?: any }>
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

  const canSelect = config.bulkDelete?.canSelect ?? (() => true)

  const load = useCallback(async () => {
    if (config.load) {
      const result = await config.load(supabase)
      setItems(result.items)
      if (result.extra) setExtra(result.extra)
    } else {
      const { data } = await supabase.from(config.table).select('*').order(config.orderBy ?? 'sort_order')
      setItems(data ?? [])
    }
    setLoading(false)
  }, [supabase, config])

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
    } catch (e: any) {
      setError(e.message)
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
          <td colSpan={colCount} className="audit-td">
            <div className="s-row-delete" style={{ border: 'none', padding: 0 }}>{content}</div>
          </td>
        </tr>
      )
    }
    return <div key={config.getId(item)} className="s-row-delete">{content}</div>
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
        openEditModal(item)
      },
      onDelete: () => { setConfirmDeleteId(config.getId(item)); setModalMode(null); setEditingId(null) },
      onMove: config.onMove ? (dir) => handleMove(item, dir) : undefined,
      saving,
      extra,
      checkbox,
    })
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
          {config.subtitle && (
            <p className="text-sm text-muted">{config.subtitle(displayed)}</p>
          )}
        </div>
        {hasForm && (
          <button className="btn-outline" onClick={openAddModal}>
            + {config.addButtonLabel ?? `Add ${config.itemLabel}`}
          </button>
        )}
      </div>

      {config.scopeFilter && (
        <div className="flex-row gap-sm mb-xl" style={{ flexWrap: 'wrap' }}>
          <button
            className={`pill ${scope === config.scopeFilter.defaultScope ? 'pill-active' : ''}`}
            onClick={() => setScope(config.scopeFilter!.defaultScope)}
          >
            {config.scopeFilter.defaultLabel}
          </button>
          {config.scopeFilter.getScopes(extra).map(s => (
            <button
              key={s.id}
              className={`pill ${scope === s.id ? 'pill-active' : ''}`}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </button>
          ))}
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
          <HScrollNav scrollRef={tableScrollRef as React.RefObject<HTMLElement>} className="crud-table-scroll">
            <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div ref={tableScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="audit-table">
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
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
                        return (
                          <th key={i} className="audit-th"
                            style={{
                              width: col.width,
                              textAlign: col.align ?? 'left',
                              cursor: isSortable ? 'pointer' : undefined,
                              userSelect: isSortable ? 'none' : undefined,
                            }}
                            onClick={isSortable ? () => {
                              if (isActive) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                              else { setSortKey(col.sortKey!); setSortDir('asc') }
                            } : undefined}
                          >
                            {col.label}{isSortable ? (isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕') : ''}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows}
                  </tbody>
                </table>
              </div>
            </div>
          </HScrollNav>
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
          <div className="modal-center">
            <div className="modal-header">
              <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                {modalTitle}
              </h3>
              <button className="close-btn" onClick={closeModal} aria-label="Close">×</button>
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
