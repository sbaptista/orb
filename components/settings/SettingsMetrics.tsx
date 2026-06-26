'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getOrbMetrics } from '@/app/actions/get-orb-metrics'
import SettingsCostReconciliation from './SettingsCostReconciliation'
import { getAiCostSummary, type AiCostDateMode, type AiCostSummary } from '@/app/actions/get-ai-cost-summary'
import { getOrbAiSettings, saveOrbModelRateCard } from '@/app/actions/orb-ai-settings'
import type { OrbModelRateCard } from '@/lib/orb-model/policy'
import { useToast } from '@/components/ui/Toast'

type MetricsRow = {
  id: string
  user_id: string
  date: string
  model: string
  call_count: number
  speech_chars: number
  voice_speech_chars: number
  input_chars: number
  tool_call_count: number
  ambient_chars: number
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  created_at: string
  user_email: string | null
  user_name: string | null
}

type MetricsForm = Record<string, never>
type EditableRateCard = OrbModelRateCard & { saving?: boolean }
type MetricsSummaryRow = Pick<MetricsRow,
  'model' | 'call_count' | 'speech_chars' | 'voice_speech_chars' | 'input_chars' |
  'tool_call_count' | 'ambient_chars' | 'input_tokens' | 'output_tokens' |
  'cache_creation_input_tokens' | 'cache_read_input_tokens'
>

const EMPTY_FORM: MetricsForm = {}
const PAGE_SIZE = 50

type ModelRates = { input: number; output: number; cacheCreate: number; cacheRead: number }

const MODEL_RATES: Record<string, ModelRates> = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheCreate: 1.25, cacheRead: 0.10 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.30 },
  'claude-opus-4-6': { input: 5, output: 25, cacheCreate: 6.25, cacheRead: 0.50 },
  'claude-opus-4-7': { input: 5, output: 25, cacheCreate: 6.25, cacheRead: 0.50 },
  'claude-opus-4-8': { input: 5, output: 25, cacheCreate: 6.25, cacheRead: 0.50 },
}
const FALLBACK_RATES: ModelRates = { input: 1, output: 5, cacheCreate: 1.25, cacheRead: 0.10 }

function getRates(model: string): ModelRates {
  return MODEL_RATES[model] ?? FALLBACK_RATES
}

function subscribeToTimeZone() { return () => {} }
function getBrowserTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone }

function formatDate(value: string, timeZone: string): string {
  return new Date(value + 'T00:00:00').toLocaleDateString(undefined, { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string | null, timeZone: string): string {
  if (!value) return 'No matching rows'
  return new Date(value).toLocaleString(undefined, { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatCharsAsK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
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
      : source === 'conversation' ? 'Conversation'
        : source.replace(/_/g, ' ')
}

function actualRangeText(summary: AiCostSummary, timeZone: string) {
  if (!summary.actualStart || !summary.actualEnd) return 'No matching rows'
  return `${formatDateTime(summary.actualStart, timeZone)} to ${formatDateTime(summary.actualEnd, timeZone)}`
}

const TTS_RATES = [
  { label: 'OpenAI tts-1', perMChar: 15 },
  { label: 'ElevenLabs', perMChar: 66 },
  { label: 'Google WaveNet', perMChar: 16 },
]

function estimateTTSCost(chars: number): string {
  return TTS_RATES.map(r => {
    const cost = (chars / 1_000_000) * r.perMChar
    return `${r.label}: ${formatCost(cost)}`
  }).join(' · ')
}

export default function SettingsMetrics() {
  const toast = useToast()
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')

  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<CreatedFilter | null>(null)
  const [summaryData, setSummaryData] = useState<MetricsSummaryRow[]>([])
  const [costSummary, setCostSummary] = useState<AiCostSummary | null>(null)
  const [rateCards, setRateCards] = useState<EditableRateCard[]>([])
  const [accountingLoading, setAccountingLoading] = useState(true)
  const [aiDateMode, setAiDateMode] = useState<AiCostDateMode>('all_tracked')
  const [aiDateFrom, setAiDateFrom] = useState('')
  const [aiDateTo, setAiDateTo] = useState('')
  const [aiMonth, setAiMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [aiModelKey, setAiModelKey] = useState('all')

  async function loadAiAccounting() {
    setAccountingLoading(true)
    try {
      const [summary, settings] = await Promise.all([
        getAiCostSummary({
          dateMode: aiDateMode,
          from: aiDateFrom || null,
          to: aiDateTo || null,
          month: aiMonth || null,
          modelKey: aiModelKey,
        }),
        getOrbAiSettings(),
      ])
      setCostSummary(summary)
      setRateCards(settings.rateCards)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load AI cost accounting.')
    } finally {
      setAccountingLoading(false)
    }
  }

  useEffect(() => { loadAiAccounting() }, [aiDateMode, aiDateFrom, aiDateTo, aiMonth, aiModelKey])

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

  function resetAll() {
    setTextSearchTerm('')
    setDateFilter(null)
  }

  const hasAnyFilter = !!textSearchTerm || !!dateFilter

  const totals = summaryData.reduce((acc, row) => ({
    calls: acc.calls + row.call_count,
    speech: acc.speech + row.speech_chars,
    voice: acc.voice + row.voice_speech_chars,
    input: acc.input + row.input_chars,
    tools: acc.tools + row.tool_call_count,
    ambient: acc.ambient + row.ambient_chars,
    inputTokens: acc.inputTokens + row.input_tokens,
    outputTokens: acc.outputTokens + row.output_tokens,
    cacheCreateTokens: acc.cacheCreateTokens + row.cache_creation_input_tokens,
    cacheReadTokens: acc.cacheReadTokens + row.cache_read_input_tokens,
  }), { calls: 0, speech: 0, voice: 0, input: 0, tools: 0, ambient: 0, inputTokens: 0, outputTokens: 0, cacheCreateTokens: 0, cacheReadTokens: 0 })

  const llmCost = summaryData.reduce((sum, row) => {
    const r = getRates(row.model)
    return sum
      + (row.input_tokens / 1_000_000) * r.input
      + (row.output_tokens / 1_000_000) * r.output
      + (row.cache_creation_input_tokens / 1_000_000) * r.cacheCreate
      + (row.cache_read_input_tokens / 1_000_000) * r.cacheRead
  }, 0)

  const summaryItems = [
    { label: 'Calls', value: formatNumber(totals.calls) },
    { label: 'Speech Chars', value: formatCharsAsK(totals.speech) },
    { label: 'Voice Chars', value: formatCharsAsK(totals.voice) },
    { label: 'Input Chars', value: formatCharsAsK(totals.input) },
    { label: 'Tool Calls', value: formatNumber(totals.tools) },
    { label: 'Ambient Chars', value: formatCharsAsK(totals.ambient) },
    { label: 'In Tokens', value: formatTokensAsK(totals.inputTokens) },
    { label: 'Out Tokens', value: formatTokensAsK(totals.outputTokens) },
    { label: 'Cache Write', value: formatTokensAsK(totals.cacheCreateTokens) },
    { label: 'Cache Read', value: formatTokensAsK(totals.cacheReadTokens) },
  ]

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

  const aiCostSummary = (
    <div className="metrics-summary" style={{ marginBottom: 'var(--sp-lg)' }}>
      <div style={{ marginBottom: 'var(--sp-md)' }}>
        <h2 className="s-card-title" style={{ margin: 0 }}>AI Cost Summary</h2>
        <p className="s-card-desc" style={{ marginTop: 'var(--sp-xs)' }}>
          App AI cost from tracked request tokens multiplied by the configured rate cards.
        </p>
      </div>
      <div className="s-card flex-col gap-md" style={{ marginBottom: 'var(--sp-md)' }}>
        <div className="s-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--sp-md)' }}>
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
              {costSummary?.modelOptions.map(option => (
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
          ) : (
            <div className="s-card-desc" style={{ alignSelf: 'end', margin: 0 }}>Eval and day-to-day calls are included.</div>
          )}
        </div>
      </div>
      {accountingLoading || !costSummary ? (
        <div className="metrics-cost-bar">Loading AI cost accounting…</div>
      ) : (
        <>
          <div className="metrics-summary-grid">
            <div className="metrics-summary-card">
              <div className="metrics-summary-label">Estimated AI Cost</div>
              <div className="metrics-summary-value">{formatCost(costSummary.estimatedLiveCostUsd)}</div>
            </div>
            <div className="metrics-summary-card">
              <div className="metrics-summary-label">Requests</div>
              <div className="metrics-summary-value">{formatNumber(costSummary.requestCount)}</div>
            </div>
            {tokenCards.map(card => (
              <div key={card.label} className="metrics-summary-card" data-tooltip={card.tooltip}>
                <div className="metrics-summary-label">{card.label}</div>
                <div className="metrics-summary-value">{card.value}</div>
              </div>
            ))}
            <div className="metrics-summary-card">
              <div className="metrics-summary-label">Provider Bills</div>
              <div className="metrics-summary-value">{formatCost(costSummary.reconciledTotalUsd)}</div>
            </div>
          </div>

          <ul className="metrics-summary-list">
            <li><span className="metrics-summary-label">Estimated AI Cost:</span> <span className="metrics-summary-value">{formatCost(costSummary.estimatedLiveCostUsd)}</span></li>
            <li><span className="metrics-summary-label">Requests:</span> <span className="metrics-summary-value">{formatNumber(costSummary.requestCount)}</span></li>
            {tokenCards.map(card => (
              <li key={card.label} data-tooltip={card.tooltip}><span className="metrics-summary-label">{card.label}:</span> <span className="metrics-summary-value">{card.value}</span></li>
            ))}
            <li><span className="metrics-summary-label">Provider Bills:</span> <span className="metrics-summary-value">{formatCost(costSummary.reconciledTotalUsd)}</span></li>
          </ul>

          <div className="metrics-cost-bar">
            Requested range · {costSummary.periodStart} to {costSummary.periodEnd}
          </div>
          <div className="metrics-cost-bar">
            Actual row range · {actualRangeText(costSummary, timeZone)}
          </div>
          {costSummary.providerBreakdown.length > 0 && (
            <div className="metrics-cost-bar">
              By provider · {costSummary.providerBreakdown.map(row => `${providerLabel(row.provider)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}
            </div>
          )}
          {costSummary.roleBreakdown.length > 0 && (
            <div className="metrics-cost-bar">
              By role · {costSummary.roleBreakdown.map(row => `${roleLabel(row.routeRole)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}
            </div>
          )}
          {costSummary.sourceBreakdown.length > 0 && (
            <div className="metrics-cost-bar">
              By source · {costSummary.sourceBreakdown.map(row => `${sourceLabel(row.source)} ${formatCost(row.estimatedCostUsd)}`).join(' · ')}
            </div>
          )}
          {costSummary.reconciliations.length > 0 && (
            <div className="metrics-cost-bar">
              Provider bill entries · {costSummary.reconciliations.map(row => `${providerLabel(row.provider)} ${formatCost(row.actualOrbCostUsd)}`).join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  )

  const rateCardEditor = (
    <section className="s-card flex-col gap-lg" style={{ marginBottom: 'var(--sp-lg)' }}>
      <div>
        <h2 className="s-card-title">Rate Cards</h2>
        <p className="s-card-desc">These rates are the cost assumptions behind the app AI estimate. Future request records use the current provider/model rate at call time.</p>
      </div>
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
    </section>
  )

  const summaryCards = summaryData.length > 0 ? (
    <div className="metrics-summary" style={{ marginBottom: 'var(--sp-lg)' }}>
      <div className="metrics-summary-grid">
        {summaryItems.map(card => (
          <div key={card.label} className="metrics-summary-card">
            <div className="metrics-summary-label">{card.label}</div>
            <div className="metrics-summary-value">{card.value}</div>
          </div>
        ))}
      </div>

      <ul className="metrics-summary-list">
        {summaryItems.map(item => (
          <li key={item.label}>
            <span className="metrics-summary-label">{item.label}:</span>{' '}
            <span className="metrics-summary-value">{item.value}</span>
          </li>
        ))}
        <li>
          <span className="metrics-summary-label">LLM Cost:</span>{' '}
          <span className="metrics-summary-value">{formatCost(llmCost)}</span>
        </li>
        <li>
          <span className="metrics-summary-label">TTS est:</span>{' '}
          <span className="metrics-summary-value">{estimateTTSCost(totals.speech)}</span>
        </li>
      </ul>

      <div className="metrics-cost-bar">
        <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LLM Cost Estimate</span>
        {' · '}
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
          <strong>{formatCost(llmCost)}</strong>
        </span>
        {' · '}
        <span>per-model rates</span>
      </div>

      <div className="metrics-cost-bar">
        TTS cost estimate (speech chars) · {estimateTTSCost(totals.speech)}
      </div>
    </div>
  ) : null

  return (
    <>
      <SettingsCrudList<MetricsRow, MetricsForm>
        config={{
          title: 'AI Metrics',
          table: 'orb_metrics',
          itemLabel: 'Entry',
          emptyForm: EMPTY_FORM,
          pageClass: 'settings-page s-page-wide',
          layout: 'table',
          pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
          subtitle: (_items, total, pageInfo) => {
            if (!total) return 'No metrics recorded yet.'
            const ps = pageInfo?.pageSize ?? PAGE_SIZE
            const pg = pageInfo?.page ?? 0
            const start = pg * ps + 1
            const end = Math.min(start + _items.length - 1, total)
            if (start === end) return `Row ${start} of ${total}.`
            return `Rows ${start}–${end} of ${total}.`
          },
          externalSearchTerm: textSearchTerm,
          searchCaption: 'Actions',
          externalFilterActive: !!textSearchTerm || !!dateFilter,
          tableNavCaption: 'prev/next columns',
          externalFilterKey: `${dateFilter?.from ?? ''}|${dateFilter?.to ?? ''}|${dateFilter?.before ?? ''}`,
          onResetFilters: resetAll,
          headerExtra: (
            <>
              {aiCostSummary}
              {rateCardEditor}
              {summaryCards}
            </>
          ),
          toolbarExtra: (
            <>
              <button
                type="button"
                className={textSearchTerm ? 'btn-primary btn-primary-clamped' : 'btn-primary'}
                onClick={() => setShowTextSearch(true)}
              >
                {textSearchTerm || 'Search by User'}
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
            { label: 'Date',         width: '120px', platformWidths: { ipad: '120px', iphone: '120px' }, sortKey: 'date',              sortValue: (r: MetricsRow) => new Date(r.date).getTime() },
            { label: 'Model',        width: '160px', platformWidths: { ipad: '160px', iphone: '140px' }, sortKey: 'model' },
            { label: 'User',         width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'Calls',        width: '80px',  platformWidths: { ipad: '80px',  iphone: '80px'  }, sortKey: 'call_count',        sortValue: (r: MetricsRow) => r.call_count },
            { label: 'Speech',       width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'speech_chars',      sortValue: (r: MetricsRow) => r.speech_chars },
            { label: 'Voice',        width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'voice_speech_chars', sortValue: (r: MetricsRow) => r.voice_speech_chars },
            { label: 'Input',        width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'input_chars',       sortValue: (r: MetricsRow) => r.input_chars },
            { label: 'Tools',        width: '80px',  platformWidths: { ipad: '80px',  iphone: '80px'  }, sortKey: 'tool_call_count',   sortValue: (r: MetricsRow) => r.tool_call_count },
            { label: 'Ambient',      width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'ambient_chars',     sortValue: (r: MetricsRow) => r.ambient_chars },
            { label: 'In Tokens',    width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'input_tokens',      sortValue: (r: MetricsRow) => r.input_tokens },
            { label: 'Out Tokens',   width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'output_tokens',     sortValue: (r: MetricsRow) => r.output_tokens },
            { label: 'Cache Write',  width: '110px', platformWidths: { ipad: '110px', iphone: '100px' }, sortKey: 'cache_creation_input_tokens', sortValue: (r: MetricsRow) => r.cache_creation_input_tokens },
            { label: 'Cache Read',   width: '110px', platformWidths: { ipad: '110px', iphone: '100px' }, sortKey: 'cache_read_input_tokens',     sortValue: (r: MetricsRow) => r.cache_read_input_tokens },
          ],

          load: async (_supabase, pagination) => {
            const res = await getOrbMetrics({
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              sortKey: pagination?.sortKey,
              sortDir: pagination?.sortDir,
              createdFrom: dateFilter?.from,
              createdTo: dateFilter?.to,
              createdBefore: dateFilter?.before,
            })
            if (res.error) throw new Error(res.error)
            const items = (res.data ?? []) as MetricsRow[]
            setSummaryData((res.summary ?? []) as MetricsSummaryRow[])
            return {
              items,
              totalCount: res.count ?? 0,
            }
          },

          getId: (item) => item.id,

          renderRow: ({ item, checkbox }) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {checkbox}
              <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
                {formatDate(item.date, timeZone)}
              </td>
              <td className="audit-td" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                {item.model.replace('claude-', '')}
              </td>
              <td className="audit-td" style={{ color: 'var(--text2)' }}>
                {item.user_name || item.user_email || '—'}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatNumber(item.call_count)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatNumber(item.speech_chars)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.voice_speech_chars > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {formatNumber(item.voice_speech_chars)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatNumber(item.input_chars)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatNumber(item.tool_call_count)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.ambient_chars > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {formatNumber(item.ambient_chars)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatTokensAsK(item.input_tokens)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {formatTokensAsK(item.output_tokens)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.cache_creation_input_tokens > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {formatTokensAsK(item.cache_creation_input_tokens)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: item.cache_read_input_tokens > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {formatTokensAsK(item.cache_read_input_tokens)}
              </td>
            </tr>
          ),
        }}
      />

      <TextSearchModal
        open={showTextSearch}
        onClose={() => setShowTextSearch(false)}
        onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
        onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
        currentTerm={textSearchTerm}
        placeholder="Search by user name or email"
        ariaLabel="Search metrics by user"
      />

      <DateSearchModal
        open={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onApply={filter => { setDateFilter(filter); setShowDateFilter(false) }}
        onClear={() => { setDateFilter(null); setShowDateFilter(false) }}
        currentFilter={dateFilter}
      />
      <SettingsCostReconciliation onSaved={loadAiAccounting} />
    </>
  )
}
