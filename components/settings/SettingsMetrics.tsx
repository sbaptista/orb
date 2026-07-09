'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import SettingsCostReconciliation from './SettingsCostReconciliation'
import { getAiRequestLog, type AiRequestLogRow } from '@/app/actions/get-ai-request-log'
import { getAiMetricsBundle, type AiCostDateMode, type AiCostSummary } from '@/app/actions/get-ai-cost-summary'
import { saveOrbModelRateCard } from '@/app/actions/orb-ai-settings'
import type { OrbModelRateCard } from '@/lib/orb-model/policy'
import { useToast } from '@/components/ui/Toast'
import { startInteraction } from '@/lib/performance/telemetry'

type MetricsForm = Record<string, never>
type EditableRateCard = OrbModelRateCard & { saving?: boolean }
type DraftRateCard = {
  provider: string
  model: string
  effectiveFrom: string
  inputPerMillion: string
  outputPerMillion: string
  cachedInputPerMillion: string
  cacheWritePerMillion: string
  notes: string
  saving?: boolean
}

const EMPTY_FORM: MetricsForm = {}
const PAGE_SIZE = 50
const todayDate = () => new Date().toISOString().slice(0, 10)
const emptyNewRateCard = (): DraftRateCard => ({
  provider: '',
  model: '',
  effectiveFrom: todayDate(),
  inputPerMillion: '',
  outputPerMillion: '',
  cachedInputPerMillion: '',
  cacheWritePerMillion: '',
  notes: '',
})

function subscribeToTimeZone() { return () => {} }
function getBrowserTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone }

function formatDateTime(value: string | null, timeZone: string): string {
  if (!value) return 'No matching rows'
  return new Date(value).toLocaleString(undefined, { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatTokensAsK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatCost(dollars: number): string {
  if (dollars === 0) return '$0.00'
  if (dollars < 0.01) return '$' + dollars.toFixed(4)
  return '$' + dollars.toFixed(2)
}

function formatNullableCost(value: AiRequestLogRow['estimated_cost_usd']): string {
  if (value === null || value === undefined) return '—'
  const amount = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(amount)) return '—'
  return formatCost(amount)
}

function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${formatNumber(value)}ms`
}

function formatModel(provider: string, model: string) {
  if (provider === 'anthropic' && model === 'claude-haiku-4-5') return 'Claude Haiku 4.5'
  if (provider === 'google' && model === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro Preview'
  if (provider === 'mistral' && model === 'mistral-medium-latest') return 'Mistral Medium'
  if (provider === 'openai' && model === 'tts-1') return 'OpenAI tts-1'
  if (provider === 'openai' && model === 'tts-1-hd') return 'OpenAI tts-1 HD'
  if (provider === 'elevenlabs' && model === 'eleven_turbo_v2_5') return 'ElevenLabs Turbo v2.5'
  return model
}

function providerLabel(provider: string) {
  return provider === 'anthropic' ? 'Anthropic'
    : provider === 'google' ? 'Google'
      : provider === 'mistral' ? 'Mistral'
        : provider === 'openai' ? 'OpenAI'
          : provider === 'elevenlabs' ? 'ElevenLabs'
            : provider
}

function roleLabel(role: string) {
  return role === 'strategic' ? 'Strategic' : role === 'operational' ? 'Operational' : role
}

function sourceLabel(source: string) {
  return source === 'eval' ? 'Eval'
    : source === 'strategic_review' ? 'Strategic review'
      : source === 'voice_tts' ? 'Voice TTS'
      : source === 'conversation' ? 'Conversation'
        : source.replace(/_/g, ' ')
}

function actualRangeText(summary: AiCostSummary, timeZone: string) {
  if (!summary.actualStart || !summary.actualEnd) return 'No matching rows'
  return `${formatDateTime(summary.actualStart, timeZone)} to ${formatDateTime(summary.actualEnd, timeZone)}`
}

export default function SettingsMetrics() {
  const toast = useToast()
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')
  const fullLoadPerf = useRef<ReturnType<typeof startInteraction> | null>(null)
  const fullLoadState = useRef({ accounting: false, table: false, reconciliation: false, ended: false })

  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<CreatedFilter | null>(null)
  const [costSummary, setCostSummary] = useState<AiCostSummary | null>(null)
  const [rateCards, setRateCards] = useState<EditableRateCard[]>([])
  const [newRateCard, setNewRateCard] = useState<DraftRateCard>(() => emptyNewRateCard())
  const [showRequestLog, setShowRequestLog] = useState(true)
  const [accountingLoading, setAccountingLoading] = useState(true)
  const [aiDateMode, setAiDateMode] = useState<AiCostDateMode>('all_tracked')
  const [aiDateFrom, setAiDateFrom] = useState('')
  const [aiDateTo, setAiDateTo] = useState('')
  const [aiMonth, setAiMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [aiModelKey, setAiModelKey] = useState('all')

  function markFullLoad(part: 'accounting' | 'table' | 'reconciliation', success: boolean, failureCode?: string | null) {
    const perf = fullLoadPerf.current
    if (!perf || fullLoadState.current.ended) return
    perf.mark(`${part}_${success ? 'completed' : 'failed'}`)
    if (!success) {
      fullLoadState.current.ended = true
      perf.end(false, failureCode ?? `${part}_failed`, { failedPart: part })
      return
    }
    fullLoadState.current[part] = true
    if (fullLoadState.current.accounting && fullLoadState.current.table && fullLoadState.current.reconciliation) {
      fullLoadState.current.ended = true
      perf.end(true)
    }
  }

  useEffect(() => {
    fullLoadState.current = { accounting: false, table: false, reconciliation: false, ended: false }
    fullLoadPerf.current = startInteraction({
      focus: 'settings',
      flow: 'settings-ai-metrics',
      interaction: 'page_full_load',
      surface: 'settings-metrics',
      immediateFlush: true,
    })
    fullLoadPerf.current.mark('component_mounted')
    return () => {
      if (!fullLoadState.current.ended) {
        fullLoadState.current.ended = true
        fullLoadPerf.current?.end(false, 'unmounted_before_full_load')
      }
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px), ((pointer: coarse) and (max-width: 900px))')
    if (query.matches) setShowRequestLog(false)
  }, [])

  useEffect(() => {
    if (!showRequestLog) markFullLoad('table', true)
  }, [showRequestLog])

  const loadAiAccounting = useCallback(async () => {
    setAccountingLoading(true)
    const perf = startInteraction({
      focus: 'settings',
      flow: 'settings-ai-metrics',
      interaction: 'ai_accounting_load',
      surface: 'settings-metrics',
      immediateFlush: true,
      metadata: {
        dateMode: aiDateMode,
        modelKey: aiModelKey,
      },
    })
    try {
      const { summary, settings } = await getAiMetricsBundle({
        dateMode: aiDateMode,
        from: aiDateFrom || null,
        to: aiDateTo || null,
        month: aiMonth || null,
        modelKey: aiModelKey,
      })
      perf.mark('server_actions_completed')
      setCostSummary(summary)
      setRateCards(settings.rateCards)
      markFullLoad('accounting', true)
      perf.end(true, null, { requestCount: summary.requestCount, rateCards: settings.rateCards.length })
    } catch (error) {
      markFullLoad('accounting', false, error instanceof Error ? error.message : 'ai_accounting_load_failed')
      perf.end(false, error instanceof Error ? error.message : 'ai_accounting_load_failed')
      toast.error(error instanceof Error ? error.message : 'Failed to load AI cost accounting.')
    } finally {
      setAccountingLoading(false)
    }
  }, [aiDateMode, aiDateFrom, aiDateTo, aiMonth, aiModelKey, toast])

  useEffect(() => { loadAiAccounting() }, [loadAiAccounting])

  function patchRateCard(id: string, patch: Partial<EditableRateCard>) {
    setRateCards(cards => cards.map(card => card.id === id ? { ...card, ...patch } : card))
  }

  async function saveRateCard(card: EditableRateCard) {
    patchRateCard(card.id, { saving: true })
    try {
      await saveOrbModelRateCard(card)
      toast.success(`${formatModel(card.provider, card.model)} rate saved.`)
      await loadAiAccounting()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save rate card.')
    } finally {
      patchRateCard(card.id, { saving: false })
    }
  }

  async function saveNewRateCard() {
    setNewRateCard(card => ({ ...card, saving: true }))
    try {
      await saveOrbModelRateCard({
        provider: newRateCard.provider,
        model: newRateCard.model,
        effectiveFrom: newRateCard.effectiveFrom,
        inputPerMillion: Number(newRateCard.inputPerMillion || 0),
        outputPerMillion: Number(newRateCard.outputPerMillion || 0),
        cachedInputPerMillion: newRateCard.cachedInputPerMillion === '' ? null : Number(newRateCard.cachedInputPerMillion),
        cacheWritePerMillion: newRateCard.cacheWritePerMillion === '' ? null : Number(newRateCard.cacheWritePerMillion),
        notes: newRateCard.notes,
      })
      toast.success(`${formatModel(newRateCard.provider, newRateCard.model)} rate created.`)
      setNewRateCard(emptyNewRateCard())
      await loadAiAccounting()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create rate card.')
    } finally {
      setNewRateCard(card => ({ ...card, saving: false }))
    }
  }

  function resetAll() {
    setTextSearchTerm('')
    setDateFilter(null)
  }

  const hasAnyFilter = !!textSearchTerm || !!dateFilter

  const tokenCards = costSummary ? [
    {
      label: 'Input Tokens',
      value: formatTokensAsK(costSummary.inputTokens),
      tooltip: 'Text and context sent to the AI model, including instructions, backlog context, and user input.',
    },
    {
      label: 'Output Tokens',
      value: formatTokensAsK(costSummary.outputTokens),
      tooltip: 'Text generated by the AI model in its response.',
    },
    {
      label: 'Cache Read',
      value: formatTokensAsK(costSummary.cachedInputTokens),
      tooltip: 'Prompt/context tokens served from provider cache at a discounted cached-input rate when the provider reports them.',
    },
    {
      label: 'Cache Write',
      value: formatTokensAsK(costSummary.cacheWriteTokens),
      tooltip: 'Prompt/context tokens written into provider cache, usually billed separately from normal input tokens.',
    },
  ] : []

  const aiModelOptions = (() => {
    const options = new Map<string, { key: string; label: string }>()
    for (const option of costSummary?.modelOptions ?? []) {
      options.set(option.key, { key: option.key, label: option.label })
    }
    for (const card of rateCards) {
      const key = `${card.provider}:${card.model}`
      if (!options.has(key)) options.set(key, { key, label: formatModel(card.provider, card.model) })
    }
    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))
  })()

  const appAiSummaryItems = costSummary ? [
    { label: 'Estimated AI Cost', value: formatCost(costSummary.estimatedLiveCostUsd) },
    { label: 'Requests', value: formatNumber(costSummary.requestCount) },
    ...tokenCards.map(card => ({ label: card.label, value: card.value, tooltip: card.tooltip })),
    { label: 'Provider Bills', value: formatCost(costSummary.reconciledTotalUsd) },
  ] : []

  const aiCostSummary = (
    <div className="metrics-summary" style={{ marginBottom: 'var(--sp-lg)' }}>
      <div style={{ marginBottom: 'var(--sp-md)' }}>
        <h2 className="s-card-title" style={{ margin: 0 }}>App AI Cost Accounting</h2>
        <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>
          Request ledger for conversation and TTS API models.
        </p>
      </div>
      <div className="s-card flex-col gap-md" style={{ marginBottom: 'var(--sp-md)' }}>
        <div className="s-form metrics-filter-grid">
          <label>
            <span className="label">Date filter</span>
            <select
              className="select"
              value={aiDateMode}
              onChange={event => setAiDateMode(event.target.value as AiCostDateMode)}
            >
              <option value="all_tracked">All tracked</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="current_month">Current month</option>
              <option value="specific_month">Specific month</option>
              <option value="custom_range">Date range</option>
            </select>
          </label>
          <label>
            <span className="label">Model</span>
            <select
              className="select"
              value={aiModelKey}
              onChange={event => setAiModelKey(event.target.value)}
            >
              <option value="all">All models</option>
              {aiModelOptions.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          {aiDateMode === 'specific_month' ? (
            <label>
              <span className="label">Month</span>
              <input type="month" value={aiMonth} onChange={event => setAiMonth(event.target.value)} />
            </label>
          ) : aiDateMode === 'custom_range' ? (
            <>
              <label>
                <span className="label">From</span>
                <input type="date" value={aiDateFrom} onChange={event => setAiDateFrom(event.target.value)} />
              </label>
              <label>
                <span className="label">To</span>
                <input type="date" value={aiDateTo} onChange={event => setAiDateTo(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        <p className="s-card-desc" style={{ margin: 0 }}>Eval and day-to-day calls are included.</p>
      </div>
      {accountingLoading || !costSummary ? (
        <div className="metrics-cost-bar">Loading AI cost accounting…</div>
      ) : (
        <>
          <div className="s-card metrics-summary-panel">
            <div className="metrics-details-card" role="table" aria-label="App AI cost accounting summary">
              {appAiSummaryItems.map(item => (
                <div key={item.label} className="metrics-details-row" role="row" data-tooltip={'tooltip' in item ? item.tooltip : undefined}>
                  <span className="metrics-details-label" role="cell">{item.label}</span>
                  <span className="metrics-details-value metrics-summary-value" role="cell">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="metrics-details-section">
            <h3 className="s-card-title metrics-details-title">Accounting Details</h3>
            <div className="s-card metrics-details-card" role="table" aria-label="AI cost accounting details">
              <div className="metrics-details-row" role="row">
                <span className="metrics-details-label" role="cell">Requested range</span>
                <span className="metrics-details-value" role="cell">{costSummary.periodStart} to {costSummary.periodEnd}</span>
              </div>
              <div className="metrics-details-row" role="row">
                <span className="metrics-details-label" role="cell">Actual row range</span>
                <span className="metrics-details-value" role="cell">{actualRangeText(costSummary, timeZone)}</span>
              </div>
              {costSummary.providerBreakdown.length > 0 && (
                <div className="metrics-details-row" role="row">
                  <span className="metrics-details-label" role="cell">By provider</span>
                  <span className="metrics-details-value" role="cell">{costSummary.providerBreakdown.map(row => `${providerLabel(row.provider)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}</span>
                </div>
              )}
              {costSummary.roleBreakdown.length > 0 && (
                <div className="metrics-details-row" role="row">
                  <span className="metrics-details-label" role="cell">By role</span>
                  <span className="metrics-details-value" role="cell">{costSummary.roleBreakdown.map(row => `${roleLabel(row.routeRole)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}</span>
                </div>
              )}
              {costSummary.sourceBreakdown.length > 0 && (
                <div className="metrics-details-row" role="row">
                  <span className="metrics-details-label" role="cell">By source</span>
                  <span className="metrics-details-value" role="cell">{costSummary.sourceBreakdown.map(row => `${sourceLabel(row.source)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}</span>
                </div>
              )}
              <div className="metrics-details-row" role="row">
                <span className="metrics-details-label" role="cell">TTS source label</span>
                <span className="metrics-details-value" role="cell">Voice TTS includes OpenAI and ElevenLabs API speech requests.</span>
              </div>
              {costSummary.reconciliations.length > 0 && (
                <div className="metrics-details-row" role="row">
                  <span className="metrics-details-label" role="cell">Provider bills</span>
                  <span className="metrics-details-value" role="cell">{costSummary.reconciliations.map(row => `${providerLabel(row.provider)} ${formatCost(row.actualOrbCostUsd)}`).join(' · ')}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  const rateCardEditor = (
    <section className="metrics-rate-section">
      <div className="metrics-section-heading">
        <h2 className="s-card-title" style={{ margin: 0 }}>Rate Cards</h2>
        <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>Rates used for future app AI cost estimates.</p>
      </div>
      <div className="s-card metrics-new-rate-card">
        <div>
          <div className="s-card-title">New Rate Card</div>
          <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>Add a provider/model rate that future requests can use.</p>
        </div>
        <div className="s-form metrics-rate-form">
          <label>
            <span className="label">Provider</span>
            <select value={newRateCard.provider} onChange={event => setNewRateCard(card => ({ ...card, provider: event.target.value }))}>
              <option value="">Select provider</option>
              {['anthropic', 'google', 'mistral', 'openai', 'elevenlabs'].map(provider => <option key={provider} value={provider}>{providerLabel(provider)}</option>)}
            </select>
          </label>
          <label><span className="label">Model</span><input value={newRateCard.model} onChange={event => setNewRateCard(card => ({ ...card, model: event.target.value }))} placeholder="provider-model-id" /></label>
          <label><span className="label">Effective from</span><input type="date" value={newRateCard.effectiveFrom} onChange={event => setNewRateCard(card => ({ ...card, effectiveFrom: event.target.value }))} /></label>
          <label><span className="label">Input / 1M tokens</span><input type="number" min="0" step="0.0001" value={newRateCard.inputPerMillion} onChange={event => setNewRateCard(card => ({ ...card, inputPerMillion: event.target.value }))} placeholder="0.0000" /></label>
          <label><span className="label">Output / 1M tokens</span><input type="number" min="0" step="0.0001" value={newRateCard.outputPerMillion} onChange={event => setNewRateCard(card => ({ ...card, outputPerMillion: event.target.value }))} placeholder="0.0000" /></label>
          <label><span className="label">Cached input / 1M</span><input type="number" min="0" step="0.0001" value={newRateCard.cachedInputPerMillion} onChange={event => setNewRateCard(card => ({ ...card, cachedInputPerMillion: event.target.value }))} placeholder="optional" /></label>
          <label><span className="label">Cache write / 1M</span><input type="number" min="0" step="0.0001" value={newRateCard.cacheWritePerMillion} onChange={event => setNewRateCard(card => ({ ...card, cacheWritePerMillion: event.target.value }))} placeholder="optional" /></label>
          <label><span className="label">Notes</span><input value={newRateCard.notes ?? ''} onChange={event => setNewRateCard(card => ({ ...card, notes: event.target.value }))} placeholder="Optional pricing note" /></label>
        </div>
        <div className="flex-center gap-md">
          <button type="button" className="btn-primary" onClick={saveNewRateCard} disabled={newRateCard.saving}>{newRateCard.saving ? 'Creating...' : 'Create Rate'}</button>
        </div>
      </div>
      <div className="s-card flex-col gap-lg" style={{ marginBottom: 'var(--sp-lg)' }}>
      {rateCards.map(card => (
        <div key={card.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-lg)' }}>
          <div style={{ fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-md)' }}>
            {providerLabel(card.provider)} · {formatModel(card.provider, card.model)}
          </div>
          <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
            <label><span className="label">Effective from</span><input type="date" value={card.effectiveFrom} onChange={event => patchRateCard(card.id, { effectiveFrom: event.target.value })} /></label>
            <label><span className="label">Input / 1M tokens</span><input type="number" min="0" step="0.0001" value={card.inputPerMillion} onChange={event => patchRateCard(card.id, { inputPerMillion: Number(event.target.value) })} /></label>
            <label><span className="label">Output / 1M tokens</span><input type="number" min="0" step="0.0001" value={card.outputPerMillion} onChange={event => patchRateCard(card.id, { outputPerMillion: Number(event.target.value) })} /></label>
            <label><span className="label">Cached input / 1M</span><input type="number" min="0" step="0.0001" value={card.cachedInputPerMillion ?? ''} onChange={event => patchRateCard(card.id, { cachedInputPerMillion: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label><span className="label">Cache write / 1M</span><input type="number" min="0" step="0.0001" value={card.cacheWritePerMillion ?? ''} onChange={event => patchRateCard(card.id, { cacheWritePerMillion: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label><span className="label">Notes</span><input value={card.notes ?? ''} onChange={event => patchRateCard(card.id, { notes: event.target.value })} placeholder="Optional pricing note" /></label>
          </div>
          <div className="flex-center gap-md" style={{ marginTop: 'var(--sp-md)' }}>
            <button type="button" className="btn-primary" onClick={() => saveRateCard(card)} disabled={card.saving}>{card.saving ? 'Saving…' : 'Save Rate'}</button>
          </div>
        </div>
      ))}
      </div>
    </section>
  )

  const requestLogHeader = (
    <section className="metrics-request-log-heading">
      <div>
        <h2 className="s-card-title" style={{ margin: 0 }}>AI Request Log</h2>
        <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>
          Request-level ledger for conversation and TTS API model calls.
        </p>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setShowRequestLog(value => !value)}
        aria-expanded={showRequestLog}
      >
        {showRequestLog ? 'Hide Log' : 'Show Log'}
      </button>
    </section>
  )

  const settingsHeader = (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
          <h2 className="s-title">AI Metrics</h2>
        </div>
      </div>
      {aiCostSummary}
      {rateCardEditor}
      {requestLogHeader}
      {!showRequestLog && (
        <div className="s-card metrics-request-log-collapsed">
          The request log is hidden. Use Show Log when you need row-level request detail.
        </div>
      )}
    </div>
  )

  return (
    <>
      {settingsHeader}
      {showRequestLog && (
        <SettingsCrudList<AiRequestLogRow, MetricsForm>
          config={{
            title: 'AI Metrics',
            table: 'orb_model_requests',
            itemLabel: 'Request',
            emptyForm: EMPTY_FORM,
            pageClass: 'settings-page s-page-wide metrics-request-log-shell',
            hideHeader: true,
            layout: 'table',
            pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true, mode: 'cursor' },
            subtitle: (_items, total, pageInfo) => {
              const ps = pageInfo?.pageSize ?? PAGE_SIZE
              const pg = pageInfo?.page ?? 0
              if (_items.length === 0) return 'No request rows found.'
              const start = pg * ps + 1
              const end = start + _items.length - 1
              if (typeof total === 'number' && total > 0) {
                if (start === end) return `Row ${start} of ${total}.`
                return `Rows ${start}–${Math.min(end, total)} of ${total}.`
              }
              if (start === end) return `Row ${start}.`
              return `Rows ${start}–${end}.`
            },
            externalSearchTerm: textSearchTerm,
            searchCaption: 'Actions',
            externalFilterActive: hasAnyFilter,
            tableNavCaption: 'prev/next columns',
            externalFilterKey: `${dateFilter?.from ?? ''}|${dateFilter?.to ?? ''}|${dateFilter?.before ?? ''}`,
            onResetFilters: resetAll,
            toolbarExtra: (
              <>
                <button
                  type="button"
                  className={textSearchTerm ? 'btn-primary btn-primary-clamped' : 'btn-primary'}
                  onClick={() => setShowTextSearch(true)}
                >
                  {textSearchTerm || 'Search Log'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowDateFilter(true)}
                  aria-label={dateFilter ? `Change date filter: ${dateFilter.label}` : 'Search by date'}
                >
                  {dateFilter ? (
                    dateFilter.label2 ? (
                      <span className="audit-date-stack">
                        <span>{dateFilter.label} –</span>
                        <span>{dateFilter.label2}</span>
                      </span>
                    ) : dateFilter.label
                  ) : 'Search by Date'}
                </button>
              </>
            ),

          selectionColumnWidth: 38,
          selectionColumnWidths: { ipad: 38, iphone: 38 },
          tableColumns: [
            { label: 'Created',      width: '170px', platformWidths: { ipad: '170px', iphone: '160px' }, sortKey: 'created_at', sortValue: (r: AiRequestLogRow) => new Date(r.created_at).getTime() },
            { label: 'Provider',     width: '110px', platformWidths: { ipad: '110px', iphone: '110px' } },
            { label: 'Model',        width: '180px', platformWidths: { ipad: '180px', iphone: '170px' } },
            { label: 'Source',       width: '120px', platformWidths: { ipad: '120px', iphone: '120px' } },
            { label: 'Role',         width: '110px', platformWidths: { ipad: '110px', iphone: '110px' } },
            { label: 'Status',       width: '90px',  platformWidths: { ipad: '90px',  iphone: '90px'  } },
            { label: 'Latency',      width: '100px', platformWidths: { ipad: '100px', iphone: '100px' } },
            { label: 'Input',        width: '100px', platformWidths: { ipad: '100px', iphone: '100px' } },
            { label: 'Output',       width: '100px', platformWidths: { ipad: '100px', iphone: '100px' } },
            { label: 'Cache Read',   width: '110px', platformWidths: { ipad: '110px', iphone: '100px' } },
            { label: 'Cache Write',  width: '110px', platformWidths: { ipad: '110px', iphone: '100px' } },
            { label: 'Cost',         width: '100px', platformWidths: { ipad: '100px', iphone: '100px' } },
            { label: 'Failure',      width: '180px', platformWidths: { ipad: '180px', iphone: '170px' } },
          ],

          load: async (_supabase, pagination) => {
            const perf = startInteraction({
              focus: 'settings',
              flow: 'settings-ai-metrics',
              interaction: 'request_log_load',
              surface: 'settings-metrics',
              immediateFlush: true,
              metadata: {
                page: pagination?.page ?? 0,
                sortKey: pagination?.sortKey ?? 'created_at',
                sortDir: pagination?.sortDir ?? 'desc',
                search: Boolean(pagination?.search),
                dateFilter: Boolean(dateFilter),
                cursorPage: Boolean(pagination?.cursor),
              },
            })
            const res = await getAiRequestLog({
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              sortKey: pagination?.sortKey,
              sortDir: pagination?.sortDir,
              cursor: pagination?.cursor,
              createdFrom: dateFilter?.from,
              createdTo: dateFilter?.to,
              createdBefore: dateFilter?.before,
            })
            if (res.error) {
              markFullLoad('table', false, res.error)
              perf.end(false, res.error)
              throw new Error(res.error)
            }
            perf.mark('server_action_completed')
            const items = (res.data ?? []) as AiRequestLogRow[]
            markFullLoad('table', true)
            perf.end(true, null, { rows: items.length, total: res.count ?? items.length, hasNextCursor: Boolean(res.nextCursor) })
            return {
              items,
              totalCount: res.count ?? items.length,
              nextCursor: res.nextCursor,
            }
          },

          getId: (item) => item.id,

          renderRow: ({ item, checkbox }) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {checkbox}
              <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
                {formatDateTime(item.created_at, timeZone)}
              </td>
              <td className="audit-td" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                {providerLabel(item.provider)}
              </td>
              <td className="audit-td" style={{ color: 'var(--text2)' }}>
                {formatModel(item.provider, item.model)}
              </td>
              <td className="audit-td">{sourceLabel(item.source)}</td>
              <td className="audit-td">{roleLabel(item.route_role)}</td>
              <td className="audit-td" style={{ color: item.success ? 'var(--success)' : 'var(--error)', fontWeight: 'var(--fw-semibold)' }}>
                {item.success ? 'OK' : 'Failed'}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatMs(item.latency_ms)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatTokensAsK(item.input_tokens)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatTokensAsK(item.output_tokens)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.cached_input_tokens ? 'var(--text)' : 'var(--muted)' }}>
                {formatTokensAsK(item.cached_input_tokens ?? 0)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.cache_write_tokens ? 'var(--text)' : 'var(--muted)' }}>
                {formatTokensAsK(item.cache_write_tokens ?? 0)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatNullableCost(item.estimated_cost_usd)}
              </td>
              <td className="audit-td" style={{ color: item.failure_code ? 'var(--text2)' : 'var(--muted)' }}>
                {item.failure_code ?? '—'}
              </td>
            </tr>
            ),
          }}
        />
      )}

      <TextSearchModal
        open={showTextSearch}
        onClose={() => setShowTextSearch(false)}
        onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
        onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
        currentTerm={textSearchTerm}
        placeholder="Search provider, model, source, role, or failure"
        ariaLabel="Search AI request log"
      />

      <DateSearchModal
        open={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onApply={filter => { setDateFilter(filter); setShowDateFilter(false) }}
        onClear={() => { setDateFilter(null); setShowDateFilter(false) }}
        currentFilter={dateFilter}
      />
      <SettingsCostReconciliation onLoaded={(success, error) => markFullLoad('reconciliation', success, error)} onSaved={loadAiAccounting} />
    </>
  )
}
