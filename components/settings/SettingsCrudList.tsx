'use client'

import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

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
  toRecord: (form: F, items: T[]) => Record<string, any>
  toForm: (item: T) => F
  getId: (item: T) => string

  onAdd?: (supabase: any, record: Record<string, any>, items: T[]) => Promise<void>
  onDelete?: (supabase: any, item: T, items: T[]) => Promise<void>
  onBeforeDelete?: (supabase: any, item: T) => Promise<void>
  deleteWarning?: (item: T, extra: any) => ReactNode
  canDelete?: (item: T, extra: any) => boolean

  renderForm: (props: {
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
    onEdit: () => void
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

  const [items, setItems] = useState<T[]>([])
  const [extra, setExtra] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<F>(config.emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<F>(config.emptyForm)
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

  function startAdd() {
    let form = { ...config.emptyForm }
    if (config.scopeFilter?.applyToForm) {
      form = config.scopeFilter.applyToForm(form, scope)
    }
    setShowAdd(true)
    setEditingId(null)
    setConfirmDeleteId(null)
    setAddForm(form)
    setError('')
  }

  function startEdit(item: T) {
    setEditingId(config.getId(item))
    setEditForm(config.toForm(item))
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleAdd() {
    const err = config.validate?.(addForm, items, null)
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    try {
      if (config.onAdd) {
        await config.onAdd(supabase, config.toRecord(addForm, items), items)
        toast.success(`${config.itemLabel} added.`)
        await load()
      } else {
        const { data, error: dbErr } = await supabase
          .from(config.table)
          .insert(config.toRecord(addForm, items))
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
    setShowAdd(false)
    setAddForm(config.emptyForm)
  }

  async function handleSave(id: string) {
    const err = config.validate?.(editForm, items, id)
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    const { data, error: dbErr } = await supabase
      .from(config.table)
      .update(config.toRecord(editForm, items))
      .eq(idCol, id)
      .select()
      .single()
    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    if (data) {
      toast.success(`${config.itemLabel} saved.`)
      setItems(prev => prev.map(item => config.getId(item) === id ? data as T : item))
    }
    setEditingId(null)
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

  function renderEditForm(id: string) {
    const formNode = config.renderForm({
      form: editForm,
      onChange: setEditForm,
      onSubmit: () => handleSave(id),
      onCancel: () => { setEditingId(null); setError('') },
      submitLabel: 'Save',
      saving,
      extra,
    })
    if (isTable) {
      return (
        <tr key={id}>
          <td colSpan={colCount} className="audit-td">{formNode}</td>
        </tr>
      )
    }
    return <div key={id}>{formNode}</div>
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
      onEdit: () => startEdit(item),
      onDelete: () => { setConfirmDeleteId(config.getId(item)); setEditingId(null) },
      onMove: config.onMove ? (dir) => handleMove(item, dir) : undefined,
      saving,
      extra,
      checkbox,
    })
    if (isTable) return rowNode
    return <div key={config.getId(item)}>{rowNode}</div>
  }

  function renderAddForm() {
    const formNode = config.renderForm({
      form: addForm,
      onChange: setAddForm,
      onSubmit: handleAdd,
      onCancel: () => { setShowAdd(false); setError('') },
      submitLabel: `Add ${config.itemLabel}`,
      saving,
      extra,
    })
    if (isTable) {
      return (
        <tr key="__add__">
          <td colSpan={colCount} className="audit-td">{formNode}</td>
        </tr>
      )
    }
    return formNode
  }

  const itemRows = displayed.map((item, idx) => {
    const id = config.getId(item)
    if (editingId === id) return renderEditForm(id)
    if (confirmDeleteId === id) return renderDeleteConfirm(item)
    return renderItemRow(item, idx)
  })

  return (
    <div className={config.pageClass ?? 'settings-page s-page'}>
      <div className="s-header">
        <div>
          <h2 className="s-title">{config.title}</h2>
          {config.subtitle && (
            <p className="text-sm text-muted">{config.subtitle(displayed)}</p>
          )}
        </div>
        {!showAdd && (
          <button className="btn-outline" onClick={startAdd}>
            + Add {config.itemLabel}
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
            style={{
              width: '100%',
              maxWidth: '280px',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
        </div>
      )}

      {hasBulk && someChecked && (
        <div className="flex-row gap-sm" style={{
          padding: '8px 12px',
          background: 'var(--bg2)',
          borderRadius: 'var(--r-md)',
          marginBottom: '8px',
          alignItems: 'center',
        }}>
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
            Clear
          </button>
        </div>
      )}

      {error && <p className="s-error">{error}</p>}

      {isTable ? (
        displayed.length === 0 && !showAdd ? (
          <div className="s-card s-empty">No {config.title.toLowerCase()} yet.</div>
        ) : (
          <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
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
                  {showAdd && renderAddForm()}
                  {itemRows}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="s-list">
          {showAdd && renderAddForm()}
          {displayed.length === 0 && !showAdd ? (
            <p className="s-empty">No {config.title.toLowerCase()} yet.</p>
          ) : itemRows}
        </div>
      )}
    </div>
  )
}
