'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  getOrbAiSettings,
  saveOrbAiPolicy,
  saveOrbModelRateCard,
} from '@/app/actions/orb-ai-settings'
import {
  DEFAULT_ORB_AI_POLICY,
  ORB_MODEL_OPTIONS,
  type OrbAiPolicy,
  type OrbModelRateCard,
} from '@/lib/orb-model/policy'

type EditableRateCard = OrbModelRateCard & { saving?: boolean }

function formatModel(provider: string, model: string) {
  return provider === 'anthropic' && model === 'claude-haiku-4-5'
    ? 'Claude Haiku 4.5'
    : provider === 'google' && model === 'gemini-3.1-pro-preview'
      ? 'Gemini 3.1 Pro Preview'
      : model
}

function applyModel(role: 'operational' | 'strategic', value: string, setPolicy: Dispatch<SetStateAction<OrbAiPolicy>>) {
  const [provider, ...modelParts] = value.split(':')
  const model = modelParts.join(':')
  setPolicy(current => role === 'operational'
    ? { ...current, operationalProvider: provider as OrbAiPolicy['operationalProvider'], operationalModel: model }
    : { ...current, strategicProvider: provider as OrbAiPolicy['strategicProvider'], strategicModel: model })
}

export default function SettingsAI() {
  const toast = useToast()
  const toastError = toast.error
  const [policy, setPolicy] = useState<OrbAiPolicy>(DEFAULT_ORB_AI_POLICY)
  const [savedPolicy, setSavedPolicy] = useState<OrbAiPolicy>(DEFAULT_ORB_AI_POLICY)
  const [rateCards, setRateCards] = useState<EditableRateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPolicy, setSavingPolicy] = useState(false)

  useEffect(() => {
    getOrbAiSettings()
      .then(({ policy: loadedPolicy, rateCards: loadedRateCards }) => {
        setPolicy(loadedPolicy)
        setSavedPolicy(loadedPolicy)
        setRateCards(loadedRateCards)
      })
      .catch(error => toastError(error instanceof Error ? error.message : 'Failed to load Orb AI settings.'))
      .finally(() => setLoading(false))
  }, [toastError])

  const budgetError = policy.strategicBudgetUsd + policy.operationalBudgetUsd > policy.monthlyBudgetUsd
  const policyDirty = useMemo(() => JSON.stringify(policy) !== JSON.stringify(savedPolicy), [policy, savedPolicy])

  async function savePolicy() {
    if (budgetError) return
    setSavingPolicy(true)
    try {
      await saveOrbAiPolicy(policy)
      setSavedPolicy(policy)
      toast.success('Orb AI policy saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save Orb AI policy.')
    } finally {
      setSavingPolicy(false)
    }
  }

  function patchRateCard(id: string, patch: Partial<EditableRateCard>) {
    setRateCards(cards => cards.map(card => card.id === id ? { ...card, ...patch } : card))
  }

  async function saveRateCard(card: EditableRateCard) {
    patchRateCard(card.id, { saving: true })
    try {
      await saveOrbModelRateCard(card)
      toast.success(`${formatModel(card.provider, card.model)} rate saved.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save rate card.')
    } finally {
      patchRateCard(card.id, { saving: false })
    }
  }

  if (loading) return <div className="s-loading">Loading Orb AI settings…</div>

  return (
    <div className="s-page">
      <div className="s-header">
        <h1 className="s-title">Orb AI</h1>
      </div>

      <div className="s-card flex-col gap-lg">
        <div>
          <h2 className="s-card-title">Model Roles</h2>
          <p className="s-card-desc">Assign models by capability. One compatible model can serve both roles; additional choices appear only after Orb has a tested production adapter.</p>
        </div>

        <div className="s-form" style={{ display: 'grid', gap: 'var(--sp-lg)' }}>
          <label>
            <span className="label">Operational Model</span>
            <select
              className="select"
              style={{ minHeight: 'var(--touch)', appearance: 'auto', WebkitAppearance: 'menulist' }}
              value={`${policy.operationalProvider}:${policy.operationalModel}`}
              onChange={event => applyModel('operational', event.target.value, setPolicy)}
            >
              {ORB_MODEL_OPTIONS.operational.map(option => <option key={option.model} value={`${option.provider}:${option.model}`}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Strategic Model</span>
            <select
              className="select"
              style={{ minHeight: 'var(--touch)', appearance: 'auto', WebkitAppearance: 'menulist' }}
              value={`${policy.strategicProvider}:${policy.strategicModel}`}
              onChange={event => applyModel('strategic', event.target.value, setPolicy)}
            >
              {ORB_MODEL_OPTIONS.strategic.map(option => <option key={option.model} value={`${option.provider}:${option.model}`}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex-center gap-md" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={policy.routingEnabled}
              onChange={event => setPolicy(current => ({ ...current, routingEnabled: event.target.checked }))}
            />
            <span className="text-base" style={{ fontWeight: 'var(--fw-medium)' }}>Enable role-based routing</span>
          </label>
          <label className="flex-center gap-md" style={{ cursor: policy.routingEnabled ? 'pointer' : 'not-allowed', opacity: policy.routingEnabled ? 1 : 0.65 }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={policy.strategicReadsEnabled}
              disabled={!policy.routingEnabled}
              onChange={event => setPolicy(current => ({ ...current, strategicReadsEnabled: event.target.checked }))}
            />
            <span className="text-base" style={{ fontWeight: 'var(--fw-medium)' }}>Allow explicit strategic reads</span>
          </label>
        </div>
      </div>

      <div className="s-card flex-col gap-lg" style={{ marginTop: 'var(--sp-lg)' }}>
        <div>
          <h2 className="s-card-title">Monthly Limits</h2>
          <p style={{ margin: 0, padding: 'var(--sp-md) var(--sp-lg)', background: 'rgba(122,80,16,0.06)', border: '1px solid rgba(122,80,16,0.15)', borderRadius: 'var(--r)', color: 'var(--warning)', fontSize: 'var(--fs-sm)' }}>New AI calls stop when the selected allowance is reached. Provider-reported actual costs are reconciled in Orb Metrics.</p>
        </div>

        <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
          {[
            ['Monthly total', 'monthlyBudgetUsd'],
            ['Strategic reads', 'strategicBudgetUsd'],
            ['Operational reserve', 'operationalBudgetUsd'],
          ].map(([label, key]) => (
            <label key={key}>
              <span className="label">{label}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={policy[key as keyof Pick<OrbAiPolicy, 'monthlyBudgetUsd' | 'strategicBudgetUsd' | 'operationalBudgetUsd'>]}
                onChange={event => setPolicy(current => ({ ...current, [key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        {budgetError && <p className="text-sm" style={{ margin: 0, color: 'var(--error)' }}>Strategic reads and operational reserve cannot exceed the monthly total.</p>}
      </div>

      <div className="s-card flex-col gap-lg" style={{ marginTop: 'var(--sp-lg)' }}>
        <div>
          <h2 className="s-card-title">Rate Cards</h2>
          <p className="s-card-desc">These rates apply to future request records and budget checks. Actual provider costs are reconciled in Orb Metrics and never rewrite history.</p>
        </div>
        {rateCards.map(card => (
          <div key={card.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-lg)' }}>
            <div style={{ fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-md)' }}>{formatModel(card.provider, card.model)}</div>
            <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
              <label><span className="label">Effective from</span><input type="date" value={card.effectiveFrom} onChange={event => patchRateCard(card.id, { effectiveFrom: event.target.value })} /></label>
              <label><span className="label">Input / 1M tokens</span><input type="number" min="0" step="0.0001" value={card.inputPerMillion} onChange={event => patchRateCard(card.id, { inputPerMillion: Number(event.target.value) })} /></label>
              <label><span className="label">Output / 1M tokens</span><input type="number" min="0" step="0.0001" value={card.outputPerMillion} onChange={event => patchRateCard(card.id, { outputPerMillion: Number(event.target.value) })} /></label>
              <label><span className="label">Cached input / 1M</span><input type="number" min="0" step="0.0001" value={card.cachedInputPerMillion ?? ''} onChange={event => patchRateCard(card.id, { cachedInputPerMillion: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            </div>
            <div className="flex-center gap-md" style={{ marginTop: 'var(--sp-md)' }}>
              <button type="button" className="btn-primary" onClick={() => saveRateCard(card)} disabled={card.saving}>{card.saving ? 'Saving…' : 'Save Rate'}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-center gap-md mt-md">
        <button type="button" className="btn-primary" onClick={savePolicy} disabled={savingPolicy || !policyDirty || budgetError}>{savingPolicy ? 'Saving…' : 'Save Orb AI Policy'}</button>
      </div>
    </div>
  )
}
