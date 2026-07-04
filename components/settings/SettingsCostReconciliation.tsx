'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  deleteOrbCostReconciliation,
  getOrbCostReconciliations,
  saveOrbCostReconciliation,
  type OrbCostReconciliation,
} from '@/app/actions/orb-ai-settings'

function monthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
]

function providerLabel(provider: string) {
  return PROVIDERS.find(option => option.value === provider)?.label ?? provider
}

function formatCost(value: number) {
  return '$' + value.toFixed(2)
}

export default function SettingsCostReconciliation({ onLoaded, onSaved }: { onLoaded?: (success: boolean, error?: string) => void; onSaved?: () => void }) {
  const toast = useToast()
  const [items, setItems] = useState<OrbCostReconciliation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [provider, setProvider] = useState('anthropic')
  const [periodStart, setPeriodStart] = useState(monthStart)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [actualCost, setActualCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setItems(await getOrbCostReconciliations())
      onLoaded?.(true)
    } catch (error) {
      onLoaded?.(false, error instanceof Error ? error.message : 'Failed to load actual costs.')
      toast.error(error instanceof Error ? error.message : 'Failed to load actual costs.')
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setEditingId(null)
    setDeleteConfirmId(null)
    setProvider('anthropic')
    setPeriodStart(monthStart())
    setPeriodEnd(today())
    setActualCost('')
    setNotes('')
  }

  function edit(item: OrbCostReconciliation) {
    setEditingId(item.id)
    setDeleteConfirmId(null)
    setProvider(item.provider)
    setPeriodStart(item.periodStart)
    setPeriodEnd(item.periodEnd)
    setActualCost(String(item.actualOrbCostUsd))
    setNotes(item.notes ?? '')
  }

  async function save() {
    setSaving(true)
    try {
      await saveOrbCostReconciliation({
        id: editingId ?? undefined,
        provider,
        periodStart,
        periodEnd,
        actualOrbCostUsd: Number(actualCost),
        notes,
      })
      resetForm()
      await load()
      onSaved?.()
      toast.success(editingId ? 'Provider bill entry updated.' : 'Provider bill entry recorded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record actual cost.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: OrbCostReconciliation) {
    if (deleteConfirmId !== item.id) {
      setDeleteConfirmId(item.id)
      return
    }
    setSaving(true)
    try {
      await deleteOrbCostReconciliation(item.id)
      if (editingId === item.id) resetForm()
      setDeleteConfirmId(null)
      await load()
      onSaved?.()
      toast.success('Provider bill entry deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete provider bill entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="metrics-reconciliation-section">
      <div className="metrics-section-heading">
        <h2 className="s-card-title" style={{ margin: 0 }}>Provider Bill Reconciliation</h2>
        <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>
          Optional provider bill entries used to compare actual invoices with request-ledger estimates.
        </p>
      </div>
      <div className="s-card metrics-reconciliation-card">
        <div>
          <div className="s-card-title">{editingId ? 'Edit Bill Entry' : 'New Bill Entry'}</div>
          <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>
            Use this for invoice totals, plan charges, or provider-console costs for the selected period.
          </p>
        </div>
        <div className="s-form metrics-rate-form">
          <label>
            <span className="label">Provider</span>
            <select value={provider} onChange={event => setProvider(event.target.value)}>
              {PROVIDERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Provider bill amount</span>
            <input type="number" min="0" step="0.0001" value={actualCost} onChange={event => setActualCost(event.target.value)} placeholder="0.00" />
          </label>
          <label>
            <span className="label">Period start</span>
            <input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} />
          </label>
          <label>
            <span className="label">Period end</span>
            <input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} />
          </label>
          <label className="metrics-reconciliation-notes">
            <span className="label">Notes</span>
            <input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional invoice, console, or plan note" />
          </label>
        </div>
        <div className="flex-center gap-md">
          {editingId && (
            <button type="button" className="btn-cancel" onClick={resetForm} disabled={saving}>Cancel Edit</button>
          )}
          <button type="button" className="btn-primary" onClick={save} disabled={saving || actualCost === ''}>
            {saving ? 'Saving...' : editingId ? 'Update Bill Entry' : 'Record Bill Entry'}
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="s-card metrics-reconciliation-list">
          <div className="s-card-title">Recorded Bill Entries</div>
          {items.map(item => (
            <div key={item.id} className="metrics-reconciliation-row">
              <div className="metrics-reconciliation-main">
                <span className="metrics-details-label">{providerLabel(item.provider)}</span>
                <span className="metrics-details-value">{item.periodStart} to {item.periodEnd}</span>
                {item.notes && <span className="s-card-desc">{item.notes}</span>}
              </div>
              <strong className="metrics-reconciliation-amount">{formatCost(item.actualOrbCostUsd)}</strong>
              <div className="metrics-reconciliation-actions">
                <button type="button" className="text-btn" onClick={() => edit(item)} disabled={saving}>Edit</button>
                <button type="button" className="text-btn" onClick={() => remove(item)} disabled={saving} style={{ color: 'var(--error)' }}>
                  {deleteConfirmId === item.id ? 'Confirm Delete' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
