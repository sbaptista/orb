'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  confirmFinancialImport,
  getFinancialImportSetup,
  previewFinancialImport,
  type FinancialImportPreviewRow,
  type FinancialImportSourceRow,
  type FinancialKind,
  type FinancialModelOption,
  type FinancialPoolOption,
} from '@/app/actions/orb-financial-import'
import { useModalScrollLock } from '@/lib/hooks/useModalScrollLock'
import { useToast } from '@/components/ui/Toast'
import { startInteraction } from '@/lib/performance/telemetry'

const KIND_LABELS: Record<FinancialKind, string> = {
  top_up: 'Credit / top-up',
  subscription: 'Subscription',
  grant: 'Grant',
  refund: 'Refund',
  adjustment: 'Adjustment',
  expiration: 'Expiration',
}
const FINANCIAL_KINDS: FinancialKind[] = ['top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration']

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n') {
      row.push(field.trim())
      if (row.some(value => value !== '')) rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') field += character
  }
  row.push(field.trim())
  if (row.some(value => value !== '')) rows.push(row)
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  return rows
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function parseDate(value: string) {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
  throw new Error(`Date “${value}” must be YYYY-MM-DD or MM/DD/YYYY.`)
}

function parseAmount(value: string) {
  const trimmed = value.trim()
  const negative = /^\(.*\)$/.test(trimmed)
  const number = Number(trimmed.replace(/[,$()\s]/g, ''))
  if (!Number.isFinite(number) || number === 0) throw new Error(`Cost “${value}” is not a non-zero amount.`)
  return negative ? -Math.abs(number) : number
}

function rowsFromCsv(text: string): FinancialImportSourceRow[] {
  const parsed = parseCsv(text)
  if (parsed.length < 2) throw new Error('The CSV needs a header row and at least one data row.')
  const headers = parsed[0].map(normalizeHeader)
  const indexOf = (...names: string[]) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1
  const dateIndex = indexOf('date', 'transaction_date')
  const companyIndex = indexOf('company', 'provider', 'vendor', 'description')
  const amountIndex = indexOf('cost', 'amount', 'amount_usd', 'price')
  const typeIndex = indexOf('type', 'kind', 'transaction_type')
  const modelIndex = indexOf('model')
  const notesIndex = indexOf('notes', 'note', 'memo')
  const referenceIndex = indexOf('reference', 'reference_id', 'transaction_id', 'id')
  const missing = [
    [dateIndex, 'date'],
    [companyIndex, 'company'],
    [amountIndex, 'cost'],
    [typeIndex, 'type'],
  ].filter(([index]) => Number(index) < 0).map(([, name]) => name)
  if (missing.length) throw new Error(`Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`)

  return parsed.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    date: parseDate(values[dateIndex] ?? ''),
    company: (values[companyIndex] ?? '').trim(),
    amountUsd: parseAmount(values[amountIndex] ?? ''),
    type: (values[typeIndex] ?? '').trim(),
    model: modelIndex >= 0 ? values[modelIndex]?.trim() : undefined,
    notes: notesIndex >= 0 ? values[notesIndex]?.trim() : undefined,
    externalReference: referenceIndex >= 0 ? values[referenceIndex]?.trim() : undefined,
  }))
}

export default function StatementImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pools, setPools] = useState<FinancialPoolOption[]>([])
  const [models, setModels] = useState<FinancialModelOption[]>([])
  const [fileName, setFileName] = useState('')
  const [statementKey, setStatementKey] = useState('')
  const [rows, setRows] = useState<FinancialImportPreviewRow[]>([])
  const [setupLoading, setSetupLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useModalScrollLock(open)

  const closeModal = useCallback(() => {
    if (saving) return
    setFileName('')
    setStatementKey('')
    setRows([])
    setError(null)
    onClose()
  }, [onClose, saving])

  useEffect(() => {
    if (!open) return
    setSetupLoading(true)
    getFinancialImportSetup().then(result => {
      setPools(result.pools)
      setModels(result.models)
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load import models.')).finally(() => setSetupLoading(false))
    const dialog = dialogRef.current
    const preferred = dialog?.querySelector<HTMLElement>('input, select, button')
    ;(preferred ?? dialog)?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeModal, open])

  const includedCount = useMemo(() => rows.filter(row => row.disposition === 'include').length, [rows])
  const unavailableModelKeys = useMemo(() => new Set(models.filter(model => !model.poolAvailable).map(model => model.key)), [models])
  const reviewCount = useMemo(() => rows.filter(row => row.disposition === 'review' || Boolean(row.modelKey && unavailableModelKeys.has(row.modelKey))).length, [rows, unavailableModelKeys])

  async function chooseFile(file: File | undefined) {
    if (!file) return
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'statement_import_preview', surface: 'settings-metrics', immediateFlush: true, metadata: { fileSize: file.size } })
    setLoading(true)
    setError(null)
    setRows([])
    setFileName(file.name)
    try {
      const parsedRows = rowsFromCsv(await file.text())
      const preview = await previewFinancialImport(parsedRows)
      setRows(preview)
      perf.end(true, null, { rows: preview.length, review: preview.filter(row => row.disposition === 'review').length })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The statement could not be read.'
      setError(message)
      perf.end(false, message)
    } finally {
      setLoading(false)
    }
  }

  function updateRow(index: number, change: Partial<FinancialImportPreviewRow>) {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row))
  }

  function assignmentValue(row: FinancialImportPreviewRow) {
    if (row.modelKey && models.some(model => model.key === row.modelKey)) return `model:${row.modelKey}`
    return row.poolKey ? `service:${row.poolKey}` : ''
  }

  function assignModel(index: number, value: string) {
    const row = rows[index]
    if (!row) return
    if (!value) {
      updateRow(index, { model: undefined, modelKey: null, poolKey: null, disposition: 'review', rememberDecision: !row.recognized })
      return
    }
    if (value.startsWith('model:')) {
      const model = models.find(option => option.key === value.slice('model:'.length))
      if (!model || !model.poolAvailable) return
      updateRow(index, {
        model: model.model,
        modelKey: model.key,
        poolKey: model.poolKey,
        disposition: row.kind ? 'include' : 'review',
        rememberDecision: !row.recognized,
      })
      return
    }
    const poolKey = value.slice('service:'.length)
    updateRow(index, {
      model: undefined,
      modelKey: null,
      poolKey,
      disposition: row.kind ? 'include' : 'review',
      rememberDecision: !row.recognized,
    })
  }

  async function importRows() {
    if (reviewCount > 0 || includedCount === 0) return
    const selectedModels = Array.from(new Set(rows.filter(row => row.disposition === 'include').map(row => row.modelKey ?? `service:${row.poolKey}`)))
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'statement_import_commit', surface: 'settings-metrics', immediateFlush: true, metadata: { rows: rows.length, included: includedCount, selectedModels } })
    setSaving(true)
    setError(null)
    try {
      await confirmFinancialImport({ fileName, statementKey, rows })
      toast.success(`Imported ${includedCount} financial ${includedCount === 1 ? 'entry' : 'entries'}.`)
      perf.end(true)
      onImported()
      closeModal()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The statement could not be imported.'
      setError(message)
      perf.end(false, message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={closeModal} />
      <div ref={dialogRef} className="modal-center modal-compose" role="dialog" aria-modal="true" aria-labelledby="statement-import-title" tabIndex={-1}>
        <div className="modal-header">
          <h3 id="statement-import-title">Import AI statement</h3>
          <button type="button" className="close-btn" onClick={closeModal} aria-label="Close" disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body metrics-import-modal-body">
          <div className="s-form metrics-import-file-fields">
            <label>
              <span className="label">CSV file</span>
              <input type="file" className="input" accept=".csv,text/csv" onChange={event => void chooseFile(event.target.files?.[0])} disabled={setupLoading || loading || saving} />
            </label>
            <label>
              <span className="label">Statement or account label <span className="text-muted">(optional)</span></span>
              <input className="input" value={statementKey} onChange={event => setStatementKey(event.target.value)} placeholder="Amex 2026 or OpenAI account" disabled={saving} />
            </label>
          </div>
          <p className="s-card-desc">Required columns: date, company, cost, and type. Model, notes, and a transaction/reference ID are optional.</p>
          <p className="s-card-desc">Import adds financial entries; it does not replace your AI settings. Remembered classifications and matching subscription costs may be updated.</p>
          {error && <p className="s-error" role="alert">{error}</p>}
          {loading && <div className="s-loading">Reading and classifying statement…</div>}
          {rows.length > 0 && (
            <div className="metrics-import-preview">
              <div className="metrics-section-intro">
                <div>
                  <h4>Review {rows.length} {rows.length === 1 ? 'row' : 'rows'}</h4>
                  <p>{reviewCount > 0 ? `${reviewCount} need a model or service before import.` : `${includedCount} ready to import.`}</p>
                </div>
                {reviewCount > 0 && <span className="metrics-state-pill metrics-state-pill--warning">{reviewCount} to review</span>}
              </div>
              <div className="s-card metrics-import-card">
                {rows.map((row, index) => (
                  <div className="metrics-import-row" key={`${row.rowNumber}-${row.fingerprint}`}>
                    <div className="metrics-import-charge">
                      <strong>{row.company}</strong>
                      <span>{row.date} · ${row.amountUsd.toFixed(2)} · {row.type}</span>
                      {row.duplicate && <span className="metrics-state-pill metrics-state-pill--warning">{row.duplicateReason === 'external_reference' ? 'Already imported' : 'Possible duplicate'}</span>}
                    </div>
                    <label>
                      <span className="label">Model</span>
                      <select
                        className="select"
                        value={assignmentValue(row)}
                        onChange={event => assignModel(index, event.target.value)}
                        disabled={row.disposition === 'exclude'}
                      >
                        <option value="">Choose…</option>
                        <optgroup label="Models">
                          {models.map(model => <option key={model.key} value={`model:${model.key}`} disabled={!model.poolAvailable}>{model.label}{model.poolAvailable ? '' : ' · accounting unavailable'}</option>)}
                        </optgroup>
                        <optgroup label="Other services">
                          {pools.filter(pool => !models.some(model => model.poolKey === pool.poolKey)).map(pool => <option key={pool.poolKey} value={`service:${pool.poolKey}`}>{pool.displayName}{pool.active ? '' : ' · historical'}</option>)}
                        </optgroup>
                      </select>
                    </label>
                    <label>
                      <span className="label">Type</span>
                      <select className="select" value={row.kind ?? ''} onChange={event => updateRow(index, { kind: event.target.value as FinancialKind, disposition: row.poolKey ? 'include' : 'review', rememberDecision: !row.recognized })}>
                        <option value="">Choose…</option>
                        {FINANCIAL_KINDS.map(kind => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
                      </select>
                    </label>
                    <div className="metrics-import-row-actions">
                      {row.duplicateReason === 'external_reference' && row.disposition === 'exclude' ? (
                        <span className="s-card-desc">Excluded</span>
                      ) : (
                        <button type="button" className="text-btn" onClick={() => updateRow(index, row.disposition === 'exclude' ? { disposition: row.poolKey && row.kind ? 'include' : 'review' } : { disposition: 'exclude', rememberDecision: !row.duplicate })}>
                          {row.disposition === 'exclude' ? 'Restore' : 'Exclude'}
                        </button>
                      )}
                      {row.duplicateReason === 'fingerprint' && row.disposition === 'include' && (
                        <label className="metrics-import-duplicate-confirm"><input type="checkbox" checked={row.allowDuplicate} onChange={event => updateRow(index, { allowDuplicate: event.target.checked })} /> Import anyway</label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span className="s-card-desc" style={{ marginRight: 'auto' }}>{fileName || 'No file selected'}</span>
          <button type="button" className="btn-cancel" onClick={closeModal} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => void importRows()} disabled={saving || reviewCount > 0 || includedCount === 0}>
            {saving ? 'Importing…' : `Import ${includedCount || ''} ${includedCount === 1 ? 'entry' : 'entries'}`.trim()}
          </button>
        </div>
      </div>
    </>
  )
}
