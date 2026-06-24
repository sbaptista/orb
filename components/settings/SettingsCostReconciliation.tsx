'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
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
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
]

function providerLabel(provider: string) {
  return PROVIDERS.find(option => option.value === provider)?.label ?? provider
}

export default function SettingsCostReconciliation() {
  const toast = useToast()
  const [items, setItems] = useState<OrbCostReconciliation[]>([])
  const [provider, setProvider] = useState('anthropic')
  const [periodStart, setPeriodStart] = useState(monthStart)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [actualCost, setActualCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setItems(await getOrbCostReconciliations())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load actual costs.')
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    try {
      await saveOrbCostReconciliation({
        provider,
        periodStart,
        periodEnd,
        actualOrbCostUsd: Number(actualCost),
        notes,
      })
      setActualCost('')
      setNotes('')
      await load()
      toast.success('Actual Orb cost recorded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record actual cost.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="s-card flex-col gap-lg" style={{ marginTop: 'var(--sp-lg)' }}>
      <div>
        <h2 className="s-card-title">Actual Provider Cost</h2>
        <p className="s-card-desc">Record the Orb-attributable amount from a provider dashboard or invoice. This becomes the primary cost for that reconciled period.</p>
      </div>
      <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
        <label><span className="label">Provider</span><select value={provider} onChange={event => setProvider(event.target.value)}>{PROVIDERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span className="label">Actual Orb Cost</span><input type="number" min="0" step="0.0001" value={actualCost} onChange={event => setActualCost(event.target.value)} placeholder="0.00" /></label>
        <label><span className="label">Period start</span><input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></label>
        <label><span className="label">Period end</span><input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></label>
      </div>
      <div className="s-form">
        <label><span className="label">Notes</span><input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional provider-console reference" /></label>
      </div>
      <div className="flex-center gap-md">
        <button type="button" className="btn-primary" onClick={save} disabled={saving || actualCost === ''}>{saving ? 'Saving…' : 'Record Actual Cost'}</button>
      </div>
      {items.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-md)', display: 'grid', gap: 'var(--sp-sm)' }}>
          {items.map(item => (
            <div key={item.id} className="s-card-row">
              <span>{providerLabel(item.provider)} · {item.periodStart} to {item.periodEnd}</span>
              <strong>${item.actualOrbCostUsd.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
