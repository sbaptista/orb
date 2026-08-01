'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  deleteFinancialTransaction,
  getFinancialImportSetup,
  getFinancialTransactions,
  saveFinancialTransaction,
  type FinancialKind,
  type FinancialPoolOption,
  type FinancialTransaction,
} from '@/app/actions/orb-financial-import'
import EditorModal from '@/components/ui/EditorModal'
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

type EntryForm = {
  id?: string
  transactionDate: string
  company: string
  amountUsd: string
  kind: FinancialKind
  poolKey: string
  model: string
  notes: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm(): EntryForm {
  return { transactionDate: today(), company: '', amountUsd: '', kind: 'top_up', poolKey: '', model: '', notes: '' }
}

function formFor(item: FinancialTransaction): EntryForm {
  return {
    id: item.id,
    transactionDate: item.transactionDate,
    company: item.company,
    amountUsd: String(item.amountUsd),
    kind: item.kind,
    poolKey: item.poolKey,
    model: item.model ?? '',
    notes: item.notes ?? '',
  }
}

export default function SettingsCostReconciliation({ onLoaded, onSaved }: { onLoaded?: (success: boolean, error?: string) => void; onSaved?: () => void }) {
  const toast = useToast()
  const [items, setItems] = useState<FinancialTransaction[]>([])
  const [pools, setPools] = useState<FinancialPoolOption[]>([])
  const [form, setForm] = useState<EntryForm | null>(null)
  const [baseline, setBaseline] = useState<EntryForm | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'financial_entries_load', surface: 'settings-metrics', immediateFlush: true })
    try {
      const [transactions, setup] = await Promise.all([getFinancialTransactions(), getFinancialImportSetup()])
      setItems(transactions)
      setPools(setup.pools)
      onLoaded?.(true)
      perf.end(true, null, { rows: transactions.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load financial entries.'
      onLoaded?.(false, message)
      toast.error(message)
      perf.end(false, message)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [baseline, form])
  const invalid = !form || !form.transactionDate || !form.company.trim() || !form.amountUsd || !form.poolKey

  function openForm(next: EntryForm) {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: next.id ? 'financial_entry_edit_open' : 'financial_entry_new_open', surface: 'settings-metrics' })
    setDeleteConfirmId(null)
    setForm(next)
    setBaseline(next)
    perf.end(true)
  }

  async function save() {
    if (!form || invalid) return false
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: form.id ? 'financial_entry_update' : 'financial_entry_create', surface: 'settings-metrics', immediateFlush: true })
    setSaving(true)
    try {
      await saveFinancialTransaction({
        id: form.id,
        transactionDate: form.transactionDate,
        company: form.company,
        amountUsd: Number(form.amountUsd),
        kind: form.kind,
        poolKey: form.poolKey,
        model: form.model,
        notes: form.notes,
      })
      await load()
      onSaved?.()
      toast.success(form.id ? 'Financial entry updated.' : 'Financial entry created.')
      perf.end(true)
      setForm(null)
      setBaseline(null)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save financial entry.'
      toast.error(message)
      perf.end(false, message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'financial_entry_delete', surface: 'settings-metrics', immediateFlush: true })
    setSaving(true)
    try {
      await deleteFinancialTransaction(id)
      setDeleteConfirmId(null)
      await load()
      onSaved?.()
      toast.success('Financial entry deleted.')
      perf.end(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete financial entry.'
      toast.error(message)
      perf.end(false, message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="metrics-reconciliation-section">
      <div className="metrics-section-intro">
        <div>
          <h2 className="s-card-title">Funding and Bill Entries</h2>
          <p className="s-card-desc">Individual credit purchases, grants, refunds, adjustments, expirations, and subscription charges.</p>
        </div>
        <button type="button" className="tv-toolbar-btn tv-toolbar-primary" onClick={() => openForm(emptyForm())}>+ New</button>
      </div>

      <div className="metrics-collection-list">
        {items.length === 0 ? <div className="s-card s-card-desc">No financial entries yet.</div> : items.map(item => (
          <article className="crud-card" style={{ cursor: 'default' }} key={item.id}>
            <div className="crud-card-header">
              <div className="crud-card-header-left"><span className="crud-card-code">{item.poolName}</span></div>
              <span className="crud-card-date">{item.transactionDate}</span>
            </div>
            <div className="crud-card-title">{item.company} · ${item.amountUsd.toFixed(2)}</div>
            <div className="crud-card-pills">
              <span className="crud-card-pill">{KIND_LABELS[item.kind]}</span>
              {item.imported && <span className="crud-card-pill">Imported</span>}
              {item.model && <span className="crud-card-pill">{item.model}</span>}
            </div>
            {item.notes && <div className="crud-card-meta"><span className="crud-card-meta-value">{item.notes}</span></div>}
            {deleteConfirmId === item.id ? (
              <div className="crud-card-actions s-row-delete" aria-live="polite">
                <span className="text-sm text-error" style={{ marginRight: 'auto' }}>Delete this entry?</span>
                <button type="button" className="btn-cancel" onClick={() => setDeleteConfirmId(null)} disabled={saving}>Cancel</button>
                <button type="button" className="btn-danger-confirm" onClick={() => void remove(item.id)} disabled={saving}>{saving ? 'Deleting…' : 'Confirm Delete'}</button>
              </div>
            ) : (
              <div className="crud-card-actions">
                <button type="button" className="text-btn btn-sm" onClick={() => openForm(formFor(item))}>Edit</button>
                <button type="button" className="text-btn btn-sm" style={{ color: 'var(--error)' }} onClick={() => setDeleteConfirmId(item.id)}>Delete</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {form && (
        <EditorModal
          title={form.id ? 'Edit financial entry' : 'New financial entry'}
          titleId="financial-entry-title"
          isDirty={dirty}
          isSaving={saving}
          saveDisabled={invalid}
          saveLabel={form.id ? 'Save Changes' : 'Create Entry'}
          onSave={save}
          onClose={() => { setForm(null); setBaseline(null) }}
          lockSettingsScroll
        >
          <div className="modal-body s-form metrics-editor-form">
            <label><span className="label">Date</span><input className="input" type="date" value={form.transactionDate} onChange={event => setForm(current => current && ({ ...current, transactionDate: event.target.value }))} /></label>
            <label><span className="label">Company</span><input className="input" value={form.company} onChange={event => setForm(current => current && ({ ...current, company: event.target.value }))} /></label>
            <label><span className="label">Cost ($)</span><input className="input" type="number" step="0.01" value={form.amountUsd} onChange={event => setForm(current => current && ({ ...current, amountUsd: event.target.value }))} /></label>
            <label><span className="label">Type</span><select className="select" value={form.kind} onChange={event => setForm(current => current && ({ ...current, kind: event.target.value as FinancialKind }))}>{FINANCIAL_KINDS.map(kind => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}</select></label>
            <label><span className="label">Destination</span><select className="select" value={form.poolKey} onChange={event => setForm(current => current && ({ ...current, poolKey: event.target.value }))}><option value="">Choose…</option>{pools.map(pool => <option key={pool.poolKey} value={pool.poolKey}>{pool.displayName}{pool.active ? '' : ' · historical'}</option>)}</select></label>
            <label><span className="label">Model <span className="text-muted">(optional)</span></span><input className="input" value={form.model} onChange={event => setForm(current => current && ({ ...current, model: event.target.value }))} /></label>
            <label className="metrics-editor-wide"><span className="label">Notes <span className="text-muted">(optional)</span></span><textarea value={form.notes} onChange={event => setForm(current => current && ({ ...current, notes: event.target.value }))} /></label>
          </div>
        </EditorModal>
      )}
    </section>
  )
}
