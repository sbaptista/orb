'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  getOrbAiSettings,
  saveOrbAiPolicy,
} from '@/app/actions/orb-ai-settings'
import {
  DEFAULT_ORB_AI_POLICY,
  ORB_MODEL_OPTIONS,
  type OrbAiPolicy,
} from '@/lib/orb-model/policy'
import { startInteraction } from '@/lib/performance/telemetry'

function applyModel(role: 'operational' | 'strategic' | 'evaluation', value: string, setPolicy: Dispatch<SetStateAction<OrbAiPolicy>>) {
  const [provider, ...modelParts] = value.split(':')
  const model = modelParts.join(':')
  setPolicy(current => {
    if (role === 'operational') return { ...current, operationalProvider: provider as OrbAiPolicy['operationalProvider'], operationalModel: model }
    if (role === 'strategic') return { ...current, strategicProvider: provider as OrbAiPolicy['strategicProvider'], strategicModel: model }
    return { ...current, evaluationProvider: provider as OrbAiPolicy['evaluationProvider'], evaluationModel: model }
  })
}

export default function SettingsAI() {
  const toast = useToast()
  const toastError = toast.error
  const [policy, setPolicy] = useState<OrbAiPolicy>(DEFAULT_ORB_AI_POLICY)
  const [savedPolicy, setSavedPolicy] = useState<OrbAiPolicy>(DEFAULT_ORB_AI_POLICY)
  const [loading, setLoading] = useState(true)
  const [savingPolicy, setSavingPolicy] = useState(false)

  useEffect(() => {
    getOrbAiSettings()
      .then(({ policy: loadedPolicy }) => {
        setPolicy(loadedPolicy)
        setSavedPolicy(loadedPolicy)
      })
      .catch(error => toastError(error instanceof Error ? error.message : 'Failed to load AI settings.'))
      .finally(() => setLoading(false))
  }, [toastError])

  const budgetError = policy.strategicBudgetUsd + policy.operationalBudgetUsd + policy.voiceBudgetUsd > policy.monthlyBudgetUsd
  const policyDirty = useMemo(() => JSON.stringify(policy) !== JSON.stringify(savedPolicy), [policy, savedPolicy])

  async function savePolicy() {
    if (budgetError) return
    const perf = startInteraction({
      focus: 'settings',
      flow: 'settings-ai-policy',
      interaction: 'policy_save',
      surface: 'settings-ai',
      immediateFlush: true,
      metadata: {
        operationalProvider: policy.operationalProvider,
        operationalModel: policy.operationalModel,
        strategicProvider: policy.strategicProvider,
        strategicModel: policy.strategicModel,
        evaluationProvider: policy.evaluationProvider,
        evaluationModel: policy.evaluationModel,
      },
    })
    setSavingPolicy(true)
    try {
      await saveOrbAiPolicy(policy)
      perf.mark('server_action_completed')
      setSavedPolicy(policy)
      toast.success('AI settings saved.')
      perf.end(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI settings.'
      toast.error(message)
      perf.end(false, message)
    } finally {
      setSavingPolicy(false)
    }
  }

  if (loading) return <div className="s-loading">Loading AI settings…</div>

  return (
    <div className="s-page">
      <div className="s-header">
        <h1 className="s-title">AI Settings</h1>
      </div>

      <div className="s-card flex-col gap-lg">
        <div>
          <h2 className="s-card-title">Model Roles</h2>
          <p className="s-card-desc">Operational handles task management and queries. Strategic handles prioritization and guidance. Evaluation runs the routine Orb eval suite. Realtime voice uses its own model (gpt-realtime) and does not route through Strategic.</p>
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
              {ORB_MODEL_OPTIONS.operational.map(option => <option key={`${option.provider}:${option.model}`} value={`${option.provider}:${option.model}`}>{option.label}</option>)}
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
              {ORB_MODEL_OPTIONS.strategic.map(option => <option key={`${option.provider}:${option.model}`} value={`${option.provider}:${option.model}`}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Evaluation Model</span>
            <select
              className="select"
              style={{ minHeight: 'var(--touch)', appearance: 'auto', WebkitAppearance: 'menulist' }}
              value={`${policy.evaluationProvider}:${policy.evaluationModel}`}
              onChange={event => applyModel('evaluation', event.target.value, setPolicy)}
            >
              {ORB_MODEL_OPTIONS.evaluation.map(option => <option key={`${option.provider}:${option.model}`} value={`${option.provider}:${option.model}`}>{option.label}</option>)}
            </select>
            <span className="s-card-desc">Used by routine local eval commands. An explicit EVAL_PROVIDER/EVAL_MODEL pair overrides this selection for one run.</span>
          </label>
          {(policy.operationalProvider === 'moonshot' || policy.strategicProvider === 'moonshot' || policy.evaluationProvider === 'moonshot') && (
            <p className="s-card-desc" style={{ margin: 0 }}>
              Kimi K3 is an experimental local candidate. Operational uses low reasoning effort; Strategic uses high. Production keeps the accepted models until Kimi completes its eval gates.
            </p>
          )}
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
          <p style={{ margin: 0, padding: 'var(--sp-md) var(--sp-lg)', background: 'rgba(122,80,16,0.06)', border: '1px solid rgba(122,80,16,0.15)', borderRadius: 'var(--r)', color: 'var(--warning)', fontSize: 'var(--fs-sm)' }}>New AI calls stop when the selected allowance is reached. Token rates and cost reporting live in AI Metrics.</p>
        </div>

        <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
          {[
            ['Monthly total', 'monthlyBudgetUsd'],
            ['Strategic', 'strategicBudgetUsd'],
            ['Operational', 'operationalBudgetUsd'],
            ['Voice', 'voiceBudgetUsd'],
          ].map(([label, key]) => (
            <label key={key}>
              <span className="label">{label}</span>
              <input
                type="number"
                className="input"
                min="0"
                step="1"
                value={policy[key as keyof Pick<OrbAiPolicy, 'monthlyBudgetUsd' | 'strategicBudgetUsd' | 'operationalBudgetUsd' | 'voiceBudgetUsd'>]}
                onChange={event => setPolicy(current => ({ ...current, [key]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        {budgetError && <p className="text-sm" style={{ margin: 0, color: 'var(--error)' }}>Strategic, operational, and voice limits cannot exceed the monthly total.</p>}
      </div>

      <div className="s-card flex-col gap-lg" style={{ marginTop: 'var(--sp-lg)' }}>
        <div>
          <h2 className="s-card-title">Usage Monitoring</h2>
          <p className="s-card-desc">Warns admins through push, email, and the broadcast banner when a usage scope approaches its limit. Provider funding caps now live with runway in AI Metrics.</p>
        </div>

        <div className="s-form" style={{ display: 'grid', gap: 'var(--sp-lg)' }}>
          <label>
            <span className="label">Warning threshold (%)</span>
            <input
              type="number"
              className="input"
              min="1"
              max="100"
              step="1"
              value={policy.warningThresholdPct}
              onChange={event => setPolicy(current => ({ ...current, warningThresholdPct: Number(event.target.value) }))}
            />
          </label>
        </div>
      </div>

      <div className="flex-center gap-md mt-md">
        <button type="button" className="btn-primary" onClick={savePolicy} disabled={savingPolicy || !policyDirty || budgetError}>{savingPolicy ? 'Saving…' : 'Save AI Settings'}</button>
      </div>
    </div>
  )
}
