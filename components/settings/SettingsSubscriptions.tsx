'use client'

import { useEffect, useMemo, useState } from 'react'
import { deleteSubscription, getFinancialImportSetup, saveSubscription, type FinancialPoolOption } from '@/app/actions/orb-financial-import'
import EditorModal from '@/components/ui/EditorModal'
import { useToast } from '@/components/ui/Toast'
import { startInteraction } from '@/lib/performance/telemetry'

type SubscriptionForm = { id?: string; displayName: string; provider: string; recurringCostUsd: string }

function formFor(pool?: FinancialPoolOption): SubscriptionForm {
  return pool ? {
    id: pool.id,
    displayName: pool.displayName,
    provider: pool.provider,
    recurringCostUsd: pool.recurringCostUsd == null ? '' : String(pool.recurringCostUsd),
  } : { displayName: '', provider: '', recurringCostUsd: '' }
}

export default function SettingsSubscriptions({ onSaved }: { onSaved?: () => void }) {
  const toast = useToast()
  const [items, setItems] = useState<FinancialPoolOption[]>([])
  const [form, setForm] = useState<SubscriptionForm | null>(null)
  const [baseline, setBaseline] = useState<SubscriptionForm | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'subscriptions_load', surface: 'settings-metrics', immediateFlush: true })
    try {
      const setup = await getFinancialImportSetup()
      const subscriptions = setup.pools.filter(pool => pool.active && pool.fundingMode === 'subscription_cash')
      setItems(subscriptions)
      perf.end(true, null, { rows: subscriptions.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load subscriptions.'
      toast.error(message)
      perf.end(false, message)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [baseline, form])
  const invalid = !form || !form.displayName.trim() || !form.provider.trim()

  function openForm(next: SubscriptionForm) {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: next.id ? 'subscription_edit_open' : 'subscription_new_open', surface: 'settings-metrics' })
    setDeleteConfirmId(null)
    setForm(next)
    setBaseline(next)
    perf.end(true)
  }

  async function save() {
    if (!form || invalid) return false
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: form.id ? 'subscription_update' : 'subscription_create', surface: 'settings-metrics', immediateFlush: true })
    setSaving(true)
    try {
      await saveSubscription({
        id: form.id,
        displayName: form.displayName,
        provider: form.provider,
        recurringCostUsd: form.recurringCostUsd === '' ? null : Number(form.recurringCostUsd),
      })
      await load()
      onSaved?.()
      toast.success(form.id ? 'Subscription updated.' : 'Subscription created.')
      perf.end(true)
      setForm(null)
      setBaseline(null)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save subscription.'
      toast.error(message)
      perf.end(false, message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const perf = startInteraction({ focus: 'settings', flow: 'settings-ai-metrics', interaction: 'subscription_delete', surface: 'settings-metrics', immediateFlush: true })
    setSaving(true)
    try {
      await deleteSubscription(id)
      setDeleteConfirmId(null)
      await load()
      onSaved?.()
      toast.success('Subscription removed.')
      perf.end(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove subscription.'
      toast.error(message)
      perf.end(false, message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="metrics-subscriptions-heading">
      <div className="metrics-section-intro">
        <div>
          <h2 id="metrics-subscriptions-heading">Subscriptions</h2>
          <p>Recurring operating costs do not deplete and therefore do not have runway.</p>
        </div>
        <button type="button" className="tv-toolbar-btn tv-toolbar-primary" onClick={() => openForm(formFor())}>+ New</button>
      </div>
      <div className="metrics-collection-list">
        {items.length === 0 ? <div className="s-card s-card-desc">No active subscriptions.</div> : items.map(item => (
          <article className="crud-card" style={{ cursor: 'default' }} key={item.id}>
            <div className="crud-card-header">
              <div className="crud-card-header-left"><span className="crud-card-code">{item.provider.toUpperCase()}</span></div>
              <span className="crud-card-date">No runway</span>
            </div>
            <div className="crud-card-title">{item.displayName}</div>
            <div className="crud-card-meta">
              <span><strong>Monthly cost:</strong> <span className="crud-card-meta-value">{item.recurringCostUsd === null ? 'Not configured' : `$${item.recurringCostUsd.toFixed(2)}`}</span></span>
            </div>
            {deleteConfirmId === item.id ? (
              <div className="crud-card-actions s-row-delete" aria-live="polite">
                <span className="text-sm text-error" style={{ marginRight: 'auto' }}>Remove this subscription?</span>
                <button type="button" className="btn-cancel" onClick={() => setDeleteConfirmId(null)} disabled={saving}>Cancel</button>
                <button type="button" className="btn-danger-confirm" onClick={() => void remove(item.id)} disabled={saving}>{saving ? 'Removing…' : 'Confirm Delete'}</button>
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
          title={form.id ? 'Edit subscription' : 'New subscription'}
          titleId="subscription-editor-title"
          isDirty={dirty}
          isSaving={saving}
          saveDisabled={invalid}
          saveLabel={form.id ? 'Save Changes' : 'Create Subscription'}
          onSave={save}
          onClose={() => { setForm(null); setBaseline(null) }}
          lockSettingsScroll
        >
          <div className="modal-body s-form metrics-editor-form">
            <label><span className="label">Name</span><input className="input" value={form.displayName} onChange={event => setForm(current => current && ({ ...current, displayName: event.target.value }))} /></label>
            <label><span className="label">Provider</span><input className="input" value={form.provider} onChange={event => setForm(current => current && ({ ...current, provider: event.target.value }))} placeholder="OpenAI" /></label>
            <label><span className="label">Monthly cost ($) <span className="text-muted">(optional)</span></span><input className="input" type="number" min="0" step="0.01" value={form.recurringCostUsd} onChange={event => setForm(current => current && ({ ...current, recurringCostUsd: event.target.value }))} placeholder="Not configured" /></label>
          </div>
        </EditorModal>
      )}
    </section>
  )
}
