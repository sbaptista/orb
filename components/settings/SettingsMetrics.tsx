'use client'

import { useState, useSyncExternalStore } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getOrbMetrics } from '@/app/actions/get-orb-metrics'
import SettingsCostReconciliation from './SettingsCostReconciliation'

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
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')

  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<CreatedFilter | null>(null)
  const [summaryData, setSummaryData] = useState<MetricsSummaryRow[]>([])

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
          title: 'Orb Metrics',
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
          headerExtra: summaryCards,
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
      <SettingsCostReconciliation />
    </>
  )
}
