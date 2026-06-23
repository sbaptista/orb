'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useDirtyForm } from '@/lib/hooks/useDirtyForm'
import SkeletonRows from '@/components/ui/SkeletonRows'
import { useToast } from '@/components/ui/Toast'
import FilterKebab from '@/components/ui/FilterKebab'
import EditorModal from '@/components/ui/EditorModal'
import PaginationController from '@/components/ui/PaginationController'
import SearchController from '@/components/ui/SearchController'

export type EditorSearchMatch = { label: string; value: string }

const PILL_THRESHOLD = 4

export function highlightText(node: React.ReactNode, term: string): React.ReactNode {
  if (!term) return node
  if (typeof node === 'string') {
    const lower = node.toLowerCase()
    const tLower = term.toLowerCase()
    const idx = lower.indexOf(tLower)
    if (idx === -1) return node
    const parts: React.ReactNode[] = []
    let last = 0
    let pos = idx
    let key = 0
    while (pos !== -1) {
      if (pos > last) parts.push(node.slice(last, pos))
      parts.push(<mark key={key++} className="crud-highlight">{node.slice(pos, pos + term.length)}</mark>)
      last = pos + term.length
      pos = lower.indexOf(tLower, last)
    }
    if (last < node.length) parts.push(node.slice(last))
    return <>{parts}</>
  }
  if (typeof node === 'number') {
    return highlightText(String(node), term)
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<any>
    if (el.type === 'input' || el.type === 'select' || el.type === 'textarea') return node
    const children = el.props?.children
    if (children === undefined || children === null) return node
    const newChildren = React.Children.map(children, child => highlightText(child, term))
    return React.cloneElement(el, {}, newChildren)
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => <React.Fragment key={i}>{highlightText(child, term)}</React.Fragment>)
  }
  return node
}
type TablePlatform = 'mac' | 'ipad' | 'iphone'

type TableColumn<T = any> = {
  label: string
  width?: string
  platformWidths?: Partial<Record<TablePlatform, string>>
  align?: 'left' | 'right' | 'center'
  sortKey?: string
  sortValue?: (item: T, extra: any) => string | number
  hidden?: 'mobile'
}

type MobileCardField<T = any> = {
  label: string
  value: ReactNode
  column: TableColumn<T>
}

function formatMobileCardValue(value: unknown, label: string): ReactNode {
  if (value === undefined || value === null || value === '') return null
  if (label.match(/date|created|updated|sent|expires|invited|responded/i)) {
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value))
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object' && !React.isValidElement(value)) return JSON.stringify(value)
  return value as ReactNode
}

function tableColumnDataKey(label: string) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const aliases: Record<string, string> = {
    date: 'created_at',
    created: 'created_at',
    updated: 'updated_at',
    invited: 'invited_at',
    responded: 'responded_at',
    record: 'record_id',
  }
  return aliases[normalized] ?? normalized
}

type PaginationRequest = {
  page: number
  pageSize: number
  search: string
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  cursor?: string | null
}

type CrudConfig<T, F> = {
  title: string
  table: string
  itemLabel: string
  emptyForm: F
  orderBy?: string
  pageClass?: string
  idColumn?: string
  subtitle?: (items: T[], totalCount?: number, pageInfo?: { page: number; pageSize: number }) => string
  /** Optional externally loaded exact count, used without delaying cursor page loads. */
  totalCount?: number

  layout?: 'list' | 'table'
  tableColumns?: TableColumn<T>[]
  /** Number of leading columns (including checkbox) to pin when scrolling horizontally. */
  stickyColumns?: number
  /** Platform-specific frozen-column counts. Falls back to stickyColumns. */
  stickyColumnsByPlatform?: Partial<Record<TablePlatform, number>>
  /** Width of the bulk-selection checkbox column. Defaults to 36px. */
  selectionColumnWidth?: number
  /** Platform-specific bulk-selection widths. Falls back to selectionColumnWidth. */
  selectionColumnWidths?: Partial<Record<TablePlatform, number>>

  load?: (supabase: any, pagination?: PaginationRequest) => Promise<{ items: T[]; extra?: any; totalCount?: number; nextCursor?: string | null }>
  /** Server-side pagination. Search and sorting stay local unless explicitly enabled. */
  pagination?: { pageSize: number; serverSearch?: boolean; serverSort?: boolean; mode?: 'offset' | 'cursor' }
  /** Card-renderer sort choices. Rendered as a touch-friendly menu on narrow platforms. */
  mobileSortOptions?: Array<{ sortKey: string; sortDir: 'asc' | 'desc'; label: string }>
  /** Extra ReactNode rendered in the header area (right side, before the Add button). */
  headerExtra?: ReactNode
  /** ReactNode rendered before the active search control, such as a compact search-mode selector. */
  toolbarLeading?: ReactNode
  /** Extra ReactNode rendered in the table/search toolbar after the search field. */
  toolbarExtra?: ReactNode
  /** Controls whether the text search input is visible and active. Defaults to true. */
  searchEnabled?: boolean
  /** When true, server search only fires on explicit submit (Enter key or send button), not on debounce. */
  serverSearchOnSubmit?: boolean
  /** When set, overrides the internal search term for server-side search. The parent manages the search UI. CrudList hides its own search input. */
  externalSearchTerm?: string
  /** Caption rendered above the search input when the search toolbar is visible. */
  searchCaption?: string
  /** Caption rendered with table horizontal navigation controls. */
  tableNavCaption?: string
  /** Changes when an external server-side filter changes, resetting pagination to page one. */
  externalFilterKey?: string
  /** Called when the user clicks the Reset button. Use to clear external filters (e.g. date filter). */
  onResetFilters?: () => void
  /** When true, indicates an external filter (beyond text search) is active. Controls Reset button visibility. */
  externalFilterActive?: boolean
  /** Matching editable values to show above an editor when a text search opened the item. */
  searchMatchFields?: (form: F, searchTerm: string) => EditorSearchMatch[]
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

  /** When true, hides the Add button but keeps the Edit modal available. */
  hideAdd?: boolean
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
    extra: any
    mode: 'add' | 'edit'
    searchMatches: EditorSearchMatch[]
    onOpenSearchMatch: (match: EditorSearchMatch) => void
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
  const configRef = useRef(config)
  configRef.current = config
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const loadRequestId = useRef(0)


  const [items, setItems] = useState<T[]>([])
  const [extra, setExtra] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal state: 'add' | 'edit' | null
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const editor = useDirtyForm<F>(config.emptyForm)
  const modalForm = editor.form
  const setModalForm = editor.setForm
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [scope, setScope] = useState(config.scopeFilter?.defaultScope ?? '')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [cardSelectionMode, setCardSelectionMode] = useState(false)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null])
  const [canScrollTableLeft, setCanScrollTableLeft] = useState(false)
  const [canScrollTableRight, setCanScrollTableRight] = useState(false)
  const [tableOverflows, setTableOverflows] = useState(false)
  const [openSearchMatch, setOpenSearchMatch] = useState<EditorSearchMatch | null>(null)
  const modalOpen = modalMode !== null
  const isDirty = modalOpen && editor.isDirty

  const tablePlatform = useSyncExternalStore<TablePlatform>(
    (onChange) => {
      const pointerQuery = window.matchMedia('(pointer: coarse)')
      window.addEventListener('resize', onChange)
      pointerQuery.addEventListener('change', onChange)
      return () => {
        window.removeEventListener('resize', onChange)
        pointerQuery.removeEventListener('change', onChange)
      }
    },
    () => window.innerWidth <= 767
      ? 'iphone'
      : window.matchMedia('(pointer: coarse)').matches ? 'ipad' : 'mac',
    () => 'mac',
  )
  const cardRendererActive = useSyncExternalStore(
    (onChange) => {
      const pointerQuery = window.matchMedia('(pointer: coarse)')
      window.addEventListener('resize', onChange)
      pointerQuery.addEventListener('change', onChange)
      return () => {
        window.removeEventListener('resize', onChange)
        pointerQuery.removeEventListener('change', onChange)
      }
    },
    () => window.innerWidth <= 767 || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900),
    () => false,
  )

  const stickyCount = config.stickyColumnsByPlatform?.[tablePlatform] ?? config.stickyColumns ?? 0
  const selectionColumnWidth = config.selectionColumnWidths?.[tablePlatform] ?? config.selectionColumnWidth ?? 36
  const resolvedColumns = useMemo(() => config.tableColumns?.map(column => ({
    ...column,
    width: column.platformWidths?.[tablePlatform] ?? column.width,
  })), [config.tableColumns, tablePlatform])

  const hasColumnWidths = !!resolvedColumns?.some(column => column.width)
  const usesExactPixelWidths = !!resolvedColumns?.length && resolvedColumns.every(column => !column.width || /^\d+px$/.test(column.width))
  const tableExactWidth = useMemo(() => {
    const cols = resolvedColumns
    if (!cols || !usesExactPixelWidths) return 0
    let total = config.bulkDelete ? selectionColumnWidth : 0
    for (const c of cols) {
      if (c.width) total += Number.parseInt(c.width, 10) || 0
    }
    return total
  }, [resolvedColumns, usesExactPixelWidths, config.bulkDelete, selectionColumnWidth])

  const canSelect = config.bulkDelete?.canSelect ?? (() => true)
  const usesServerSearch = !!config.pagination?.serverSearch
  const usesServerSort = !!config.pagination?.serverSort
  const searchEnabled = config.searchEnabled ?? true
  const serverSearchOnSubmit = !!config.serverSearchOnSubmit
  const hasExternalSearch = config.externalSearchTerm !== undefined
  const pageSize = config.pagination?.pageSize
  const usesCursorPagination = config.pagination?.mode === 'cursor'
  const externalFilterKey = config.externalFilterKey
  const hasAnyExternalFilter = !!((config.externalSearchTerm && config.externalSearchTerm.trim()) || config.externalFilterActive)
  const hasBulk = !!config.bulkDelete
  const effectiveTotalCount = config.totalCount ?? totalCount

  // --- Debounce: search → debouncedSearch ---------------------------------
  useEffect(() => {
    if (!usesServerSearch || serverSearchOnSubmit) {
      if (!usesServerSearch) setDebouncedSearch(search)
      return
    }
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 500)
    return () => window.clearTimeout(timeout)
  }, [search, usesServerSearch, serverSearchOnSubmit])

  function submitSearch() {
    setDebouncedSearch(search.trim())
    setPage(0)
    setCursorHistory([null])
    setNextCursor(null)
    setSelectedIds([])
  }

  function resetAllFilters() {
    setSearch('')
    setDebouncedSearch('')
    setPage(0)
    setCursorHistory([null])
    setSelectedIds([])
    config.onResetFilters?.()
  }

  // --- Request key: the single source of truth for when to reload ---------
  // Every value that should trigger a server call is encoded here.
  // Changing any one of them produces a new string → the effect fires once.
  const serverSearchTerm = hasExternalSearch
    ? config.externalSearchTerm!
    : (usesServerSearch && searchEnabled ? debouncedSearch : '')
  const requestKey = `${serverSearchTerm}|${page}|${sortKey}|${sortDir}|${externalFilterKey ?? ''}`
  const prevRequestKey = useRef(requestKey)

  // Reset page when search or external filter changes (not on page change itself)
  useEffect(() => {
    const prev = prevRequestKey.current
    if (!prev) return
    const [prevSearch, prevPage, , , prevFilter] = prev.split('|')
    const pageChanged = String(page) !== prevPage
    const searchChanged = serverSearchTerm !== prevSearch
    const filterChanged = (externalFilterKey ?? '') !== prevFilter
    if ((searchChanged || filterChanged) && !pageChanged) {
      setPage(0)
      setCursorHistory([null])
      setNextCursor(null)
      setSelectedIds([])
    }
  }, [serverSearchTerm, externalFilterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Stable load function (reads params from refs/current values) -------
  const activeCursor = cursorHistory[page] ?? null
  const loadParamsRef = useRef({ page, pageSize, serverSearchTerm, sortKey, sortDir, usesServerSearch, usesServerSort, activeCursor, usesCursorPagination })
  loadParamsRef.current = { page, pageSize, serverSearchTerm, sortKey, sortDir, usesServerSearch, usesServerSort, activeCursor, usesCursorPagination }

  const load = useCallback(async () => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    try {
      const cfg = configRef.current
      const p = loadParamsRef.current
      if (cfg.load) {
        const paginationArg = p.pageSize ? {
          page: p.page,
          pageSize: p.pageSize,
          search: p.serverSearchTerm,
          sortKey: p.usesServerSort ? p.sortKey : null,
          sortDir: p.sortDir,
          cursor: p.usesCursorPagination ? p.activeCursor : null,
        } : undefined
        const result = await cfg.load(supabase, paginationArg)
        if (requestId !== loadRequestId.current) return
        setItems(result.items)
        if (result.extra) setExtra(result.extra)
        if (result.totalCount !== undefined) setTotalCount(result.totalCount)
        if (p.usesCursorPagination) setNextCursor(result.nextCursor ?? null)
        setError('')
      } else {
        const { data, error: loadError } = await supabase.from(cfg.table).select('*').order(cfg.orderBy ?? 'sort_order')
        if (loadError) throw loadError
        if (requestId !== loadRequestId.current) return
        setItems(data ?? [])
        setError('')
      }
    } catch (loadError) {
      if (requestId !== loadRequestId.current) return
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(`Could not load ${configRef.current.title}: ${message}`)
    } finally {
      if (requestId === loadRequestId.current) setLoading(false)
    }
  }, [supabase]) // stable — supabase client never changes

  // --- Single trigger: reload when the request key changes ----------------
  useVisibilityRefetch(load)
  useEffect(() => {
    prevRequestKey.current = requestKey
    load()
  }, [requestKey, load])

  const scoped = config.scopeFilter
    ? items.filter(item => config.scopeFilter!.filterItem(item, scope))
    : items

  const filtered = !usesServerSearch && config.searchFilter && search.trim()
    ? scoped.filter(item => config.searchFilter!(item, search.trim(), extra))
    : scoped

  const displayed = (() => {
    if (!sortKey || usesServerSort) return filtered
    const col = resolvedColumns?.find(c => c.sortKey === sortKey)
    if (!col?.sortValue) return filtered
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a, extra)
      const bv = col.sortValue!(b, extra)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  })()

  useEffect(() => {
    const element = tableScrollRef.current
    if (!element) return
    const update = () => {
      setCanScrollTableLeft(element.scrollLeft > 2)
      setCanScrollTableRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2)
      setTableOverflows(element.scrollWidth > element.clientWidth + 2)
    }
    requestAnimationFrame(update)
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(() => requestAnimationFrame(update))
    observer.observe(element)
    const table = element.querySelector('table')
    if (table) observer.observe(table)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [displayed.length, tableExactWidth])

  function scrollTable(direction: -1 | 1) {
    tableScrollRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' })
  }

  const selectableIds = displayed.filter(canSelect).map(config.getId)
  const allChecked = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id))
  const someChecked = selectedIds.length > 0
  const showCardSelection = hasBulk && (cardSelectionMode || someChecked)

  const idCol = config.idColumn ?? 'id'
  const isTable = config.layout === 'table'
  const hasMobileCards = isTable
  const mobileSortOptions = config.mobileSortOptions ?? []
  const activeMobileSort = mobileSortOptions.find(option => option.sortKey === (sortKey ?? 'created_at') && option.sortDir === (sortKey ? sortDir : 'desc'))

  function setMobileSort(value: string) {
    const option = mobileSortOptions.find(item => `${item.sortKey}:${item.sortDir}` === value)
    if (!option) return
    setPage(0)
    setCursorHistory([null])
    setNextCursor(null)
    setSelectedIds([])
    setSortKey(option.sortKey)
    setSortDir(option.sortDir)
  }

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
    editor.begin(form)
    setModalMode('add')
    setEditingId(null)
    setConfirmDeleteId(null)
    setError('')
    setOpenSearchMatch(null)
  }

  function openEditModal(item: T) {
    if (!config.toForm || !config.renderForm) return
    const form = config.toForm(item)
    setEditingId(config.getId(item))
    editor.begin(form)
    setModalMode('edit')
    setConfirmDeleteId(null)
    setError('')
    setOpenSearchMatch(null)
  }

  function closeModal() {
    setModalMode(null)
    setEditingId(null)
    setError('')
    setOpenSearchMatch(null)
    config.onClose?.()
  }

  async function handleAdd(): Promise<boolean> {
    if (!config.toRecord) return false
    const err = config.validate?.(modalForm, items, null)
    if (err) { setError(err); return false }
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
        if (dbErr) { setError(dbErr.message); setSaving(false); return false }
        if (data) {
          toast.success(`${config.itemLabel} added.`)
          setItems(prev => [...prev, data as T])
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setSaving(false)
      return false
    }
    setSaving(false)
    closeModal()
    return true
  }

  async function handleSave(id: string, closeAfterSave: boolean): Promise<boolean> {
    if (!config.toRecord) return false
    const err = config.validate?.(modalForm, items, id)
    if (err) { setError(err); return false }
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
        if (dbErr) { setError(dbErr.message); setSaving(false); return false }
        if (data) {
          toast.success(`${config.itemLabel} saved.`)
          setItems(prev => prev.map(item => config.getId(item) === id ? data as T : item))
        }
      }
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
      return false
    }
    setSaving(false)
    if (closeAfterSave) closeModal()
    else editor.markSaved()
    return true
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

  function resetPagination() {
    setPage(0)
    setCursorHistory([null])
    setSelectedIds([])
  }

  function goToPreviousPage() {
    if (page === 0) return
    setPage(current => Math.max(0, current - 1))
    setSelectedIds([])
  }

  function goToNextPage() {
    if (usesCursorPagination) {
      if (!nextCursor) return
      setCursorHistory(history => [...history.slice(0, page + 1), nextCursor])
      setPage(current => current + 1)
      setSelectedIds([])
      return
    }
    const lastPage = Math.max(0, Math.ceil(effectiveTotalCount / (config.pagination?.pageSize ?? 1)) - 1)
    if (page >= lastPage) return
    setPage(current => current + 1)
    setSelectedIds([])
  }

  function renderPaginationButtons() {
    if (!config.pagination) return null
    const lastPage = Math.max(0, Math.ceil(effectiveTotalCount / config.pagination.pageSize) - 1)
    const hasPagination = usesCursorPagination
      ? page > 0 || !!nextCursor || effectiveTotalCount > config.pagination.pageSize
      : effectiveTotalCount > config.pagination.pageSize

    const ps = config.pagination.pageSize
    const start = page * ps + 1
    const end = Math.min(start + ps - 1, effectiveTotalCount)
    const info = usesCursorPagination
      ? `p.${page + 1}`
      : `p.${page + 1} · ${start.toLocaleString()}–${end.toLocaleString()} of ${effectiveTotalCount.toLocaleString()}`

    const subtitleText = config.subtitle
      ? config.subtitle(displayed, effectiveTotalCount || undefined, { page, pageSize: ps })
      : info

    return (
      <PaginationController info={subtitleText} infoOnly={!hasPagination}>
        <button className="nav-circle-btn" onClick={resetPagination} aria-disabled={page === 0} aria-label="First page" data-tooltip="First page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
        </button>
        <button className="nav-circle-btn" onClick={goToPreviousPage} aria-disabled={page === 0} aria-label="Previous page" data-tooltip="Previous page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="nav-circle-btn" onClick={goToNextPage} aria-disabled={usesCursorPagination ? !nextCursor : page >= lastPage} aria-label="Next page" data-tooltip="Next page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button className="nav-circle-btn" onClick={() => { if (!usesCursorPagination && page < lastPage) { setPage(lastPage); setSelectedIds([]) } }} aria-disabled={usesCursorPagination || page >= lastPage} aria-label="Last page" data-tooltip="Last page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
        </button>
      </PaginationController>
    )
  }

  if (loading && items.length === 0) return <div className="s-loading"><SkeletonRows rows={3} /></div>

  const colCount = (config.tableColumns?.length ?? 1) + (hasBulk ? 1 : 0)

  function renderDeleteConfirm(item: T) {
    const deletable = config.canDelete ? config.canDelete(item, extra) : true
    const descriptionId = `delete-confirm-${config.getId(item)}`
    const content = (
      <>
        <span id={descriptionId} className="text-sm flex-1">
          {config.deleteWarning
            ? config.deleteWarning(item, extra)
            : <>Delete <strong>{(item as any).name ?? (item as any).label}</strong>?</>
          }
        </span>
        {deletable ? (
          <>
            <button className="btn-danger-confirm" onClick={() => handleDelete(item)} disabled={saving} aria-describedby={descriptionId}
              style={{ opacity: saving ? 'var(--opacity-disabled)' : 1 }}>
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
            <div className="s-row-delete" style={{ border: 'none', padding: 0 }} aria-live="polite" aria-atomic="true">{content}</div>
          </td>
        </tr>
      )
    }
    return <div key={config.getId(item)} className="s-row-delete" aria-live="polite" aria-atomic="true">{content}</div>
  }

  function renderDeleteConfirmCard(item: T) {
    const deletable = config.canDelete ? config.canDelete(item, extra) : true
    const descriptionId = `delete-confirm-card-${config.getId(item)}`
    return (
      <div key={config.getId(item)} className="crud-card s-row-delete" aria-live="polite" aria-atomic="true" style={{ border: '1px solid var(--error)', padding: 'var(--sp-md)' }}>
        <span id={descriptionId} className="text-sm flex-1">
          {config.deleteWarning
            ? config.deleteWarning(item, extra)
            : <>Delete <strong>{(item as any).name ?? (item as any).label}</strong>?</>
          }
        </span>
        <div className="flex-row gap-sm" style={{ marginTop: 'var(--sp-sm)' }}>
          {deletable ? (
            <>
              <button className="btn-danger-confirm" onClick={() => handleDelete(item)} disabled={saving} aria-describedby={descriptionId}
                style={{ opacity: saving ? 'var(--opacity-disabled)' : 1 }}>
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
    const id = config.getId(item)
    if (confirmDeleteId === id) return renderDeleteConfirmCard(item)
    const onEdit = (e?: React.MouseEvent) => {
      if (e) {
        const tag = (e.target as HTMLElement).tagName
        if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
        if ((e.target as HTMLElement).closest('button, a, input, select')) return
      }
      openEditModal(item)
    }
    const onDelete = () => { setConfirmDeleteId(id); setModalMode(null); setEditingId(null) }
    if (config.renderMobileRow) {
      return config.renderMobileRow({
        item,
        index: idx,
        items: displayed,
        onEdit,
        onDelete,
        saving,
        extra,
      })
    }
    return renderDefaultMobileCard(item, idx, onEdit)
  }

  function renderDefaultMobileCard(item: T, idx: number, onEdit: (e?: React.MouseEvent) => void) {
    const id = config.getId(item)
    const columns = resolvedColumns ?? []
    const visibleColumns = columns.filter(column => column.hidden !== 'mobile' && !/actions?/i.test(column.label))
    const activeSearchTerm = hasExternalSearch ? (config.externalSearchTerm ?? '') : search
    const fieldValues = visibleColumns.map(column => {
      const dataKey = column.sortKey ?? tableColumnDataKey(column.label)
      const raw = column.sortValue && !/date|created|updated|sent|expires|invited|responded/i.test(column.label)
        ? column.sortValue(item, extra)
        : (item as any)[dataKey] ?? column.sortValue?.(item, extra)
      return {
        label: column.label,
        value: formatMobileCardValue(raw, column.label),
        column,
      }
    }).filter(field => field.value !== undefined && field.value !== null && field.value !== '') as MobileCardField<T>[]
    const titleField = fieldValues.find(field => /title|summary|name|label|email|category/i.test(field.label)) ?? fieldValues[0]
    const codeField = fieldValues.find(field => /code|number|id|ticket|task/i.test(field.label) && field !== titleField)
    const dateField = fieldValues.find(field => /date|created|updated|sent|expires/i.test(field.label) && field !== titleField)
    const pillFields = fieldValues.filter(field => /status|type|role|priority|scope|project/i.test(field.label) && field !== titleField).slice(0, 3)
    const metaFields = fieldValues.filter(field => field !== titleField && field !== codeField && field !== dateField && !pillFields.includes(field)).slice(0, 5)
    const canEdit = !!config.renderForm || !!config.onRowClick
    const actionLabel = config.onRowClick && !config.renderForm ? 'Open' : 'Edit'
    const selectable = hasBulk && canSelect(item)
    const title = titleField?.value ?? `${config.itemLabel} ${idx + 1}`
    const titleText = typeof title === 'string' || typeof title === 'number' ? highlightText(title, activeSearchTerm) : title

    return (
      <div
        key={id}
        className="crud-card"
        onClick={e => {
          if (showCardSelection && selectable) {
            toggleSelect(id)
            return
          }
          if (config.onRowClick) {
            const tag = (e.target as HTMLElement).tagName
            if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
            if ((e.target as HTMLElement).closest('button, a, input, select')) return
            config.onRowClick(item)
            return
          }
          onEdit(e)
        }}
      >
        <div className="crud-card-header">
          <div className="crud-card-header-left">
            {showCardSelection && selectable && (
              <input
                type="checkbox"
                checked={selectedIds.includes(id)}
                onChange={() => toggleSelect(id)}
                onClick={e => e.stopPropagation()}
                aria-label={`Select ${config.itemLabel}`}
              />
            )}
            {codeField && <span className="crud-card-code">{highlightText(codeField.value, activeSearchTerm)}</span>}
          </div>
          {dateField && <span className="crud-card-date">{highlightText(dateField.value, activeSearchTerm)}</span>}
        </div>

        <div className="crud-card-title">{titleText}</div>

        {pillFields.length > 0 && (
          <div className="crud-card-pills">
            {pillFields.map(field => (
              <span key={field.label} className="crud-card-pill">
                {highlightText(field.value, activeSearchTerm)}
              </span>
            ))}
          </div>
        )}

        {metaFields.length > 0 && (
          <div className="crud-card-meta">
            {metaFields.map(field => (
              <span key={field.label}>
                <strong>{field.label}:</strong>{' '}
                <span className="crud-card-meta-value">{highlightText(field.value, activeSearchTerm)}</span>
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="crud-card-actions">
            <button className="text-btn btn-sm" onClick={onEdit}>
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderItemRow(item: T, idx: number) {
    const id = config.getId(item)
    const selectable = hasBulk && canSelect(item)
    const checkboxSticky = stickyCount > 0 ? { position: 'sticky' as const, left: 0, zIndex: 2, background: 'var(--bg)' } : {}
    const checkbox = hasBulk ? (
      <td style={{ textAlign: 'center', padding: '8px var(--sp-md)', ...checkboxSticky }}>
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
    if (isTable && stickyCount > 0 && usesExactPixelWidths && React.isValidElement(rowNode) && (rowNode as React.ReactElement<any>).type === 'tr') {
      const trNode = rowNode as React.ReactElement<any>
      const children = React.Children.toArray(trNode.props.children).filter(Boolean) as React.ReactElement<any>[]
      const stickyDataCount = stickyCount - (hasBulk ? 1 : 0)
      const dataStart = hasBulk ? 1 : 0
      const newChildren = children.map((child, ci) => {
        const dataIdx = ci - dataStart
        if (dataIdx >= 0 && dataIdx < stickyDataCount && React.isValidElement(child)) {
          let leftOffset = hasBulk ? selectionColumnWidth : 0
          for (let j = 0; j < dataIdx; j++) {
            const w = resolvedColumns?.[j]?.width
            if (w) leftOffset += Number.parseInt(w, 10) || 0
          }
          const childEl = child as React.ReactElement<any>
          return React.cloneElement(childEl, {
            style: { ...(childEl.props?.style || {}), position: 'sticky', left: `${leftOffset}px`, zIndex: 2, background: 'var(--bg)' },
          })
        }
        return child
      })
      return React.cloneElement(trNode, {}, ...newChildren)
    }
    if (isTable) return rowNode
    return <div key={config.getId(item)}>{rowNode}</div>
  }

  const activeSearchTerm = hasExternalSearch
    ? config.externalSearchTerm!
    : (usesServerSearch ? debouncedSearch : search.trim())

  const itemRows = displayed.map((item, idx) => {
    const id = config.getId(item)
    if (confirmDeleteId === id) return renderDeleteConfirm(item)
    const row = renderItemRow(item, idx)
    if (activeSearchTerm && React.isValidElement(row)) {
      return highlightText(row, activeSearchTerm) as React.ReactElement
    }
    return row
  })

  // ── Modal ──
  const modalTitle = modalMode === 'add'
    ? (config.addModalTitle ?? `Add ${config.itemLabel}`)
    : (config.editModalTitle ?? `Edit ${config.itemLabel}`)

  const hasForm = !!config.renderForm
  const modalSubmit = (closeAfterSave: boolean) => modalMode === 'add'
    ? handleAdd()
    : handleSave(editingId!, closeAfterSave)
  const modalSubmitLabel = modalMode === 'add' ? (config.addButtonLabel ?? `Add ${config.itemLabel}`) : 'Save'
  const modalSearchTerm = (hasExternalSearch ? config.externalSearchTerm ?? '' : search).trim()
  const modalSearchMatches = modalOpen && modalMode === 'edit' && modalSearchTerm && config.searchMatchFields
    ? config.searchMatchFields(modalForm, modalSearchTerm)
    : []

  const modalFormNode = modalOpen && config.renderForm ? config.renderForm({
    form: modalForm,
    onChange: setModalForm,
    extra,
    mode: modalMode!,
    searchMatches: modalSearchMatches,
    onOpenSearchMatch: setOpenSearchMatch,
  }) : null

  return (
    <div className={config.pageClass ?? 'settings-page s-page'}>
      <div className="s-header">
        <div>
          <h2 className="s-title">{config.title}</h2>
          {config.subtitle && !config.pagination && (
            <div className="flex-row gap-sm" style={{ alignItems: 'baseline' }}>
              <p className="text-sm text-muted">{config.subtitle(displayed, effectiveTotalCount || undefined, { page, pageSize: pageSize ?? 0 })}</p>
            </div>
          )}
        </div>
        <div className="flex-row gap-sm">
          {hasForm && !config.hideAdd && !((config.searchFilter || usesServerSearch || hasExternalSearch) || isTable) && (
            <button className="btn-primary" onClick={openAddModal}>
              + {config.addButtonLabel ?? `Add ${config.itemLabel}`}
            </button>
          )}
        </div>
      </div>

      {config.headerExtra}

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
          <FilterKebab
            value={scope}
            options={allScopes.map(s => ({ value: s.id, label: s.label }))}
            onChange={setScope}
            ariaLabel={`Filter ${config.title}`}
            tooltip={`${allScopes.length} filter options`}
          />
        </div>
      )}

      {hasExternalSearch && (
        <div className="ctrl-toolbar">
          <SearchController
            info={hasAnyExternalFilter ? (config.searchCaption ?? 'Filtered results') : (config.searchCaption ?? null)}
            infoTrailing={hasAnyExternalFilter ? (
              <button type="button" className="text-btn ctrl-reset-btn" onClick={resetAllFilters}>Reset search</button>
            ) : undefined}
          >
            {config.toolbarLeading}
            {config.toolbarExtra}
            {hasMobileCards && cardRendererActive && mobileSortOptions.length > 0 && (
              <FilterKebab
                value={activeMobileSort ? `${activeMobileSort.sortKey}:${activeMobileSort.sortDir}` : `${mobileSortOptions[0].sortKey}:${mobileSortOptions[0].sortDir}`}
                options={mobileSortOptions.map(option => ({ value: `${option.sortKey}:${option.sortDir}`, label: `Sort: ${option.label}` }))}
                onChange={setMobileSort}
                ariaLabel={`Sort ${config.title}`}
              />
            )}
            {hasForm && !config.hideAdd && (
              <button className="btn-primary" onClick={openAddModal}>
                + {config.addButtonLabel ?? `Add ${config.itemLabel}`}
              </button>
            )}
          </SearchController>
          {renderPaginationButtons()}
        </div>
      )}

      {!hasExternalSearch && ((config.searchFilter || usesServerSearch) || isTable) && (
        <div className="crud-table-toolbar" style={tableExactWidth ? { width: `${tableExactWidth}px`, maxWidth: '100%' } : undefined}>
          {(config.searchFilter || usesServerSearch) ? (
            <label className="crud-toolbar-field">
              {config.searchCaption && <span className="crud-toolbar-caption">{config.searchCaption}</span>}
              <div className="crud-search-row">
                <div className="crud-search-wrap">
                  <input
                    type="text"
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value)
                      if (!usesServerSearch) {
                        setPage(0)
                        setSelectedIds([])
                      }
                    }}
                    onKeyDown={e => {
                      if (serverSearchOnSubmit && e.key === 'Enter') {
                        e.preventDefault()
                        submitSearch()
                      }
                    }}
                    placeholder={serverSearchOnSubmit ? '' : (config.searchPlaceholder ?? 'Filter…')}
                    aria-label={config.searchPlaceholder ?? `Filter ${config.title}`}
                    className="crud-search-input"
                  />
                  {serverSearchOnSubmit && !search && (
                    <span className="crud-search-placeholder" aria-hidden="true">
                      Search log then press
                      <span className="crud-search-placeholder-icon">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </span>
                      or
                      <span className="crud-search-placeholder-return">⏎</span>
                    </span>
                  )}
                </div>
                {serverSearchOnSubmit && (
                  <button
                    type="button"
                    className="oc-action-circle crud-search-submit"
                    onClick={submitSearch}
                    disabled={!search.trim()}
                    data-tooltip="Search (Enter)"
                    aria-label="Search"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                )}
                {serverSearchOnSubmit && (debouncedSearch || (externalFilterKey && externalFilterKey !== '||')) && (
                  <button type="button" className="btn-primary crud-reset-btn" onClick={resetAllFilters}>
                    Reset
                  </button>
                )}
                {config.toolbarExtra}
                {hasForm && !config.hideAdd && (
                  <button className="btn-primary" onClick={openAddModal}>
                    + {config.addButtonLabel ?? `Add ${config.itemLabel}`}
                  </button>
                )}
              </div>
            </label>
          ) : null}
          {hasMobileCards && cardRendererActive && mobileSortOptions.length > 0 && (
            <div className="crud-mobile-sort">
              <FilterKebab
                value={activeMobileSort ? `${activeMobileSort.sortKey}:${activeMobileSort.sortDir}` : `${mobileSortOptions[0].sortKey}:${mobileSortOptions[0].sortDir}`}
                options={mobileSortOptions.map(option => ({ value: `${option.sortKey}:${option.sortDir}`, label: `Sort: ${option.label}` }))}
                onChange={setMobileSort}
                ariaLabel={`Sort ${config.title}`}
              />
            </div>
          )}
          {isTable && !(hasMobileCards && cardRendererActive) && tableOverflows && (
            <PaginationController info={config.tableNavCaption ?? 'Prev/Next Columns'}>
              <button
                type="button"
                className="nav-circle-btn"
                onClick={() => { if (canScrollTableLeft) scrollTable(-1) }}
                aria-disabled={!canScrollTableLeft}
                aria-label="Previous table columns"
                data-tooltip="Previous table columns"
              >
                ‹
              </button>
              <button
                type="button"
                className="nav-circle-btn"
                onClick={() => { if (canScrollTableRight) scrollTable(1) }}
                aria-disabled={!canScrollTableRight}
                aria-label="Next table columns"
                data-tooltip="Next table columns"
              >
                ›
              </button>
            </PaginationController>
          )}
        </div>
      )}

      {!hasExternalSearch && renderPaginationButtons()}

      {hasBulk && someChecked && (
        <div className="crud-bulk-bar">
          <span className="text-sm" style={{ fontWeight: 'var(--fw-medium)' }}>
            {selectedIds.length} selected
          </span>
          <button
            className="btn-danger-outline"
            onClick={handleBulkDelete}
            disabled={saving}
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
          <div className="s-card s-empty">
            {(search.trim() || hasAnyExternalFilter) ? 'No matching entries.' : `No ${config.title.toLowerCase()} yet.`}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={hasMobileCards ? 'crud-desktop-table' : undefined}>
              <div className="s-card" style={{ padding: 0, overflow: 'hidden', ...(tableExactWidth ? { width: `${tableExactWidth}px`, maxWidth: '100%' } : {}) }}>
                  <div ref={tableScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' as any }}>
                    <table className="audit-table" style={tableExactWidth ? { width: `${tableExactWidth}px`, minWidth: `${tableExactWidth}px`, tableLayout: 'fixed' } : hasColumnWidths ? { width: '100%', tableLayout: 'fixed' } : undefined}>
                      {(tableExactWidth > 0 || hasColumnWidths) && (
                        <colgroup>
                          {hasBulk && <col style={{ width: `${selectionColumnWidth}px` }} />}
                          {resolvedColumns?.map((col, i) => (
                            <col key={i} style={{ width: col.width }} />
                          ))}
                        </colgroup>
                      )}
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {hasBulk && (() => {
                            const isSticky = stickyCount > 0
                            return (
                              <th className="audit-th" style={{
                                width: `${selectionColumnWidth}px`, textAlign: 'center',
                                ...(isSticky ? { position: 'sticky', left: 0, zIndex: 3 } : {}),
                              }}>
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={toggleSelectAll}
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                            )
                          })()}
                          {resolvedColumns?.map((col, i) => {
                            const isSortable = !!col.sortKey
                            const isActive = sortKey === col.sortKey
                            const colIdx = hasBulk ? i + 1 : i
                            const isSticky = colIdx < stickyCount

                            let leftOffset = 0
                            if (isSticky) {
                              if (hasBulk) leftOffset += selectionColumnWidth
                              for (let j = 0; j < i; j++) {
                                const w = resolvedColumns?.[j]?.width
                                if (w && usesExactPixelWidths) leftOffset += Number.parseInt(w, 10) || 0
                              }
                            }

                            return (
                              <th key={i} className="audit-th"
                                style={{
                                  width: col.width,
                                  minWidth: col.width,
                                  textAlign: col.align ?? 'left',
                                  cursor: isSortable ? 'pointer' : undefined,
                                  userSelect: 'none',
                                  ...(isSticky ? { position: 'sticky', left: `${leftOffset}px`, zIndex: 3 } : {}),
                                }}
                                onClick={() => {
                                  if (isSortable) {
                                    setPage(0)
                                    setCursorHistory([null])
                                    setNextCursor(null)
                                    setSelectedIds([])
                                    if (isActive) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                    else { setSortKey(col.sortKey!); setSortDir('asc') }
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minWidth: 0 }}>
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
            </div>

            {/* Mobile cards */}
            {hasMobileCards && (
              <>
                {hasBulk && (
                  <div className="crud-mobile-select-bar">
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => {
                        if (showCardSelection) {
                          setCardSelectionMode(false)
                          setSelectedIds([])
                        } else {
                          setCardSelectionMode(true)
                        }
                      }}
                    >
                      {showCardSelection ? 'Done' : 'Select'}
                    </button>
                    {showCardSelection && (
                      <button type="button" className="text-btn" onClick={toggleSelectAll}>
                        {allChecked ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                )}
                <div className="crud-mobile-cards">
                  {displayed.map((item, idx) => renderMobileCard(item, idx))}
                </div>
              </>
            )}
          </>
        )
      ) : (
        <div className="s-list">
          {displayed.length === 0 ? (
            <p className="s-empty">
              {(search.trim() || hasAnyExternalFilter) ? 'No matching entries.' : `No ${config.title.toLowerCase()} yet.`}
            </p>
          ) : itemRows}
        </div>
      )}

      {/* ── Floating modal for Add / Edit ── */}
      {modalOpen && (
        <EditorModal
          title={modalTitle}
          titleId="settings-crud-dialog-title"
          className={config.modalClass}
          isDirty={isDirty}
          isSaving={saving}
          saveLabel={modalSubmitLabel}
          onSave={modalSubmit}
          onClose={closeModal}
          lockSettingsScroll
        >
          <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
            {error && <p className="s-error" style={{ marginBottom: 'var(--sp-md)' }}>{error}</p>}
            {modalSearchMatches.length > 0 && (
              <div className="search-match-notice" role="status">
                <span className="search-match-notice-swatch" aria-hidden="true" />
                Found {modalSearchMatches.length} matching {modalSearchMatches.length === 1 ? 'field' : 'fields'} for "{modalSearchTerm}". Look for amber markers beside the field titles.
              </div>
            )}
            {modalFormNode}
          </div>
        </EditorModal>
      )}
      {openSearchMatch && (
        <EditorModal
          title={`${openSearchMatch.label} match`}
          titleId="settings-search-match-dialog-title"
          isDirty={false}
          readOnly
          showCloseFooter
          stacked
          onClose={() => setOpenSearchMatch(null)}
          lockSettingsScroll
        >
          <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
            <div className="search-match-detail">
              {highlightText(openSearchMatch.value, modalSearchTerm)}
            </div>
          </div>
        </EditorModal>
      )}
    </div>
  )
}
