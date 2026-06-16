'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TableDraft = {
  widths: number[]
  frozenColumns: number
}

type TablePlatform = 'mac' | 'ipad' | 'iphone'

type HandlePosition = {
  index: number
  left: number
  top: number
  height: number
}

const STORAGE_PREFIX = 'orb_table_tuner_v3:'
const MIN_COLUMN_WIDTH = 24
export const TABLE_TUNER_TOGGLE_EVENT = 'orb-table-tuner-toggle'

function tableLabel(table: HTMLTableElement) {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    .map(cell => cell.textContent?.trim() || 'Blank')
  return headers.join(' / ')
}

function tableKey(table: HTMLTableElement) {
  const tables = Array.from(document.querySelectorAll('table'))
  const sameSignature = tables.filter(candidate => tableLabel(candidate) === tableLabel(table))
  const occurrence = Math.max(0, sameSignature.indexOf(table))
  return `${window.location.pathname}:${tableLabel(table)}:${occurrence}`
}

function detectPlatform(): TablePlatform {
  if (typeof window === 'undefined') return 'mac'
  if (window.innerWidth <= 767) return 'iphone'
  if (window.matchMedia('(pointer: coarse)').matches) return 'ipad'
  return 'mac'
}

function storageKey(table: HTMLTableElement, platform: TablePlatform) {
  return `${STORAGE_PREFIX}${platform}:${tableKey(table)}`
}

function measuredWidths(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    .map(cell => Math.round(cell.getBoundingClientRect().width))
}

function findScrollContainer(table: HTMLTableElement) {
  let element = table.parentElement
  while (element) {
    const style = window.getComputedStyle(element)
    if (['auto', 'scroll'].includes(style.overflowX)) return element
    element = element.parentElement
  }
  return table.parentElement
}

function applyDraft(table: HTMLTableElement, draft: TableDraft) {
  const rows = Array.from(table.rows)
  const totalWidth = draft.widths.reduce((sum, width) => sum + width, 0)

  table.style.tableLayout = 'fixed'
  table.style.width = `${totalWidth}px`
  table.style.minWidth = `${totalWidth}px`

  rows.forEach(row => {
    Array.from(row.cells).forEach((cell, index) => {
      const width = draft.widths[index]
      if (!width) return
      cell.style.width = `${width}px`
      cell.style.minWidth = `${width}px`
      cell.style.maxWidth = `${width}px`

      if (index < draft.frozenColumns) {
        const left = draft.widths.slice(0, index).reduce((sum, value) => sum + value, 0)
        cell.style.position = 'sticky'
        cell.style.left = `${left}px`
        cell.style.zIndex = cell.tagName === 'TH' ? '8' : '7'
        cell.style.background = cell.tagName === 'TH' ? 'var(--btn-primary-bg)' : 'var(--bg2)'
      } else {
        cell.style.removeProperty('position')
        cell.style.removeProperty('left')
        cell.style.removeProperty('z-index')
        cell.style.removeProperty('background')
      }

      cell.classList.toggle('table-tuner-frozen-edge', index === draft.frozenColumns - 1)
    })
  })

  const scrollContainer = findScrollContainer(table)
  if (scrollContainer) {
    scrollContainer.style.overflowX = 'auto'
    scrollContainer.style.setProperty('-webkit-overflow-scrolling', 'touch')
  }
}

function loadDraft(table: HTMLTableElement, platform: TablePlatform, fallbackWidths = measuredWidths(table)): TableDraft {
  try {
    const saved = localStorage.getItem(storageKey(table, platform))
    if (!saved) return { widths: fallbackWidths, frozenColumns: 0 }
    const parsed = JSON.parse(saved) as TableDraft
    if (parsed.widths.length !== fallbackWidths.length) return { widths: fallbackWidths, frozenColumns: 0 }
    return parsed
  } catch {
    return { widths: fallbackWidths, frozenColumns: 0 }
  }
}

function TableTunerInner() {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [table, setTable] = useState<HTMLTableElement | null>(null)
  const [draft, setDraft] = useState<TableDraft | null>(null)
  const [platform, setPlatform] = useState<TablePlatform>(() => detectPlatform())
  const [handles, setHandles] = useState<HandlePosition[]>([])
  const [copyLabel, setCopyLabel] = useState('Copy configuration')
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null)
  const baselineWidthsRef = useRef<number[]>([])

  const headers = useMemo(() => {
    if (!table) return []
    return Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
      .map((cell, index) => cell.textContent?.trim() || `Column ${index + 1}`)
  }, [table])

  const refreshHandles = useCallback(() => {
    if (!table || !draft) {
      setHandles([])
      return
    }
    const tableRect = table.getBoundingClientRect()
    const headerCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    setHandles(headerCells.slice(0, -1).map((cell, index) => {
      const rect = cell.getBoundingClientRect()
      return {
        index,
        left: rect.right,
        top: tableRect.top,
        height: tableRect.height,
      }
    }))
  }, [table, draft])

  const selectTable = useCallback((nextTable: HTMLTableElement) => {
    const nextPlatform = detectPlatform()
    const baselineWidths = measuredWidths(nextTable)
    baselineWidthsRef.current = baselineWidths
    const nextDraft = loadDraft(nextTable, nextPlatform, baselineWidths)
    setPlatform(nextPlatform)
    setTable(nextTable)
    setDraft(nextDraft)
    setPicking(false)
    setOpen(true)
    applyDraft(nextTable, nextDraft)
  }, [])

  useEffect(() => {
    const toggle = () => {
      setOpen(value => {
        if (value) {
          setPicking(false)
          setHandles([])
        }
        return !value
      })
    }
    window.addEventListener(TABLE_TUNER_TOGGLE_EVENT, toggle)
    return () => window.removeEventListener(TABLE_TUNER_TOGGLE_EVENT, toggle)
  }, [])

  useEffect(() => {
    if (!picking) return
    const pick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.table-tuner-panel, .dev-panel')) return
      const nextTable = target.closest('table')
      if (!(nextTable instanceof HTMLTableElement)) return
      event.preventDefault()
      event.stopPropagation()
      selectTable(nextTable)
    }
    document.addEventListener('click', pick, true)
    return () => document.removeEventListener('click', pick, true)
  }, [picking, selectTable])

  useEffect(() => {
    if (!table || !draft) return
    applyDraft(table, draft)
    localStorage.setItem(storageKey(table, platform), JSON.stringify(draft))
    const frame = window.requestAnimationFrame(refreshHandles)
    return () => window.cancelAnimationFrame(frame)
  }, [table, draft, platform, refreshHandles])

  useEffect(() => {
    const pointerQuery = window.matchMedia('(pointer: coarse)')
    const updatePlatform = () => {
      const nextPlatform = detectPlatform()
      setPlatform(current => {
        if (current === nextPlatform) return current
        if (table) {
          const nextDraft = loadDraft(table, nextPlatform, baselineWidthsRef.current)
          setDraft(nextDraft)
          applyDraft(table, nextDraft)
        }
        return nextPlatform
      })
    }
    window.addEventListener('resize', updatePlatform)
    pointerQuery.addEventListener('change', updatePlatform)
    return () => {
      window.removeEventListener('resize', updatePlatform)
      pointerQuery.removeEventListener('change', updatePlatform)
    }
  }, [table])

  useEffect(() => {
    if (!table) return
    const refresh = () => refreshHandles()
    const observer = new ResizeObserver(refresh)
    observer.observe(table)
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
    }
  }, [table, refreshHandles])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const width = Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + event.clientX - drag.startX))
      setDraft(current => {
        if (!current) return current
        const widths = [...current.widths]
        widths[drag.index] = width
        return { ...current, widths }
      })
    }
    const end = () => { dragRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  function clearSelection() {
    setTable(null)
    setDraft(null)
    setHandles([])
    setPicking(false)
  }

  function closeTuner() {
    setOpen(false)
    setPicking(false)
    setHandles([])
  }

  function resetDraft() {
    if (!table) return
    localStorage.removeItem(storageKey(table, platform))
    window.location.reload()
  }

  function copyConfiguration() {
    if (!table || !draft) return
    const presets = (['mac', 'ipad', 'iphone'] as TablePlatform[]).reduce<Partial<Record<TablePlatform, {
      columns: Array<{ label: string; width: string }>
      frozenColumns: number
    }>>>((result, presetPlatform) => {
      const saved = localStorage.getItem(storageKey(table, presetPlatform))
      if (!saved) return result
      try {
        const preset = JSON.parse(saved) as TableDraft
        result[presetPlatform] = {
          columns: headers.map((label, index) => ({
            label,
            width: `${preset.widths[index]}px`,
          })),
          frozenColumns: preset.frozenColumns,
        }
      } catch {
        // Ignore malformed development-only drafts.
      }
      return result
    }, {})
    const output = JSON.stringify({
      table: tableKey(table),
      activePlatform: platform,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      container: {
        clientWidth: findScrollContainer(table)?.clientWidth ?? null,
        scrollWidth: findScrollContainer(table)?.scrollWidth ?? null,
      },
      presets,
    }, null, 2)
    navigator.clipboard.writeText(output).then(() => {
      setCopyLabel('Copied')
      window.setTimeout(() => setCopyLabel('Copy configuration'), 1500)
    }).catch(() => setCopyLabel('Copy failed'))
  }

  return (
    <>
      {open && handles.map(handle => (
        <button
          key={handle.index}
          type="button"
          className="table-tuner-handle"
          aria-label={`Resize ${headers[handle.index]}`}
          style={{ left: handle.left, top: handle.top, height: handle.height }}
          onPointerDown={event => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = {
              index: handle.index,
              startX: event.clientX,
              startWidth: draft?.widths[handle.index] ?? 0,
            }
          }}
        >
          <span />
        </button>
      ))}

      {open && (
        <div className="table-tuner">
          <div className="table-tuner-panel" role="dialog" aria-label="Table tuning">
            <div className="table-tuner-heading">
              <strong>Table Tuning</strong>
              <button type="button" className="text-btn" onClick={closeTuner}>Close</button>
            </div>
            {!table || !draft ? (
              <p>Select a table, then tap it. Drag its column boundaries until the layout feels right.</p>
            ) : (
              <>
                <div className="table-tuner-context">
                  <p className="table-tuner-name">{tableLabel(table)}</p>
                  <span className="table-tuner-platform">{platform}</span>
                </div>
                <div className="table-tuner-columns">
                  {headers.map((label, index) => (
                    <div className="table-tuner-column" key={`${label}-${index}`}>
                      <span>{label}</span>
                      <label className="table-tuner-width">
                        <input
                          type="number"
                          min={MIN_COLUMN_WIDTH}
                          step="1"
                          value={draft.widths[index]}
                          aria-label={`${label} width in pixels`}
                          onChange={event => {
                            const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(Number(event.target.value) || MIN_COLUMN_WIDTH))
                            setDraft(current => {
                              if (!current) return current
                              const widths = [...current.widths]
                              widths[index] = nextWidth
                              return { ...current, widths }
                            })
                          }}
                        />
                        <span>px</span>
                      </label>
                      <button
                        type="button"
                        className="dev-btn"
                        aria-pressed={draft.frozenColumns === index + 1}
                        onClick={() => setDraft(current => current ? { ...current, frozenColumns: index + 1 } : current)}
                      >
                        Freeze through
                      </button>
                    </div>
                  ))}
                </div>
                <div className="table-tuner-actions">
                  <button type="button" className="dev-btn" onClick={() => setDraft(current => current ? { ...current, frozenColumns: 0 } : current)}>
                    Unfreeze
                  </button>
                  <button type="button" className="dev-btn" onClick={copyConfiguration}>{copyLabel}</button>
                  <button type="button" className="dev-btn" onClick={resetDraft}>Reset</button>
                </div>
              </>
            )}
            <button type="button" className="btn-dev" onClick={() => { clearSelection(); setPicking(true) }}>
              {picking ? 'Tap a table…' : 'Choose table'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function TableTuner() {
  if (process.env.NODE_ENV !== 'development') return null
  return <TableTunerInner />
}
