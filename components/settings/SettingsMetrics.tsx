'use client'

import { useState, useSyncExternalStore, useEffect } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getOrbMetrics } from '@/app/actions/get-orb-metrics'

type MetricsRow = {
  id: string
  user_id: string
  date: string
  call_count: number
  speech_chars: number
  voice_speech_chars: number
  input_chars: number
  tool_call_count: number
  ambient_chars: number
  input_tokens: number
  output_tokens: number
  created_at: string
  user_email: string | null
  user_name: string | null
}

type MetricsForm = Record<string, never>

const EMPTY_FORM: MetricsForm = {}
const PAGE_SIZE = 50

const LS_KEY_INPUT_RATE = 'orb_llm_input_rate'
const LS_KEY_OUTPUT_RATE = 'orb_llm_output_rate'
const DEFAULT_INPUT_RATE = 1.00
const DEFAULT_OUTPUT_RATE = 5.00

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

function loadRate(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem(key)
  if (!stored) return fallback
  const parsed = parseFloat(stored)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
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

const rateInputStyle: React.CSSProperties = {
  width: '72px',
  padding: '2px 6px',
  fontSize: 'var(--fs-xs)',
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text)',
  textAlign: 'right',
}

export default function SettingsMetrics() {
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')

  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<CreatedFilter | null>(null)
  const [summaryData, setSummaryData] = useState<MetricsRow[]>([])

  const [inputRate, setInputRate] = useState(DEFAULT_INPUT_RATE)
  const [outputRate, setOutputRate] = useState(DEFAULT_OUTPUT_RATE)

  useEffect(() => {
    setInputRate(loadRate(LS_KEY_INPUT_RATE, DEFAULT_INPUT_RATE))
    setOutputRate(loadRate(LS_KEY_OUTPUT_RATE, DEFAULT_OUTPUT_RATE))
  }, [])

  function handleInputRateChange(value: string) {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      setInputRate(parsed)
      localStorage.setItem(LS_KEY_INPUT_RATE, String(parsed))
    } else if (value === '') {
      setInputRate(0)
      localStorage.setItem(LS_KEY_INPUT_RATE, '0')
    }
  }

  function handleOutputRateChange(value: string) {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      setOutputRate(parsed)
      localStorage.setItem(LS_KEY_OUTPUT_RATE, String(parsed))
    } else if (value === '') {
      setOutputRate(0)
      localStorage.setItem(LS_KEY_OUTPUT_RATE, '0')
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
  }), { calls: 0, speech: 0, voice: 0, input: 0, tools: 0, ambient: 0, inputTokens: 0, outputTokens: 0 })

  const llmInputCost = (totals.inputTokens / 1_000_000) * inputRate
  const llmOutputCost = (totals.outputTokens / 1_000_000) * outputRate
  const llmTotalCost = llmInputCost + llmOutputCost

  const summaryCards = summaryData.length > 0 ? (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
      {[
        { label: 'Calls', value: formatNumber(totals.calls) },
        { label: 'Speech Chars', value: formatCharsAsK(totals.speech) },
        { label: 'Voice Chars', value: formatCharsAsK(totals.voice) },
        { label: 'Input Chars', value: formatCharsAsK(totals.input) },
        { label: 'Tool Calls', value: formatNumber(totals.tools) },
        { label: 'Ambient Chars', value: formatCharsAsK(totals.ambient) },
        { label: 'Input Tokens', value: formatTokensAsK(totals.inputTokens) },
        { label: 'Output Tokens', value: formatTokensAsK(totals.outputTokens) },
      ].map(card => (
        <div key={card.label} style={{
          padding: 'var(--sp-md) var(--sp-lg)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--fs-version)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{card.label}</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{card.value}</div>
        </div>
      ))}

      <div style={{
        gridColumn: '1 / -1',
        padding: 'var(--sp-md) var(--sp-lg)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-lg)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LLM Cost Estimate</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Input $/MTok
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputRate}
              onChange={e => handleInputRateChange(e.target.value)}
              style={rateInputStyle}
              aria-label="LLM input cost per million tokens"
            />
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Output $/MTok
            <input
              type="number"
              min="0"
              step="0.01"
              value={outputRate}
              onChange={e => handleOutputRateChange(e.target.value)}
              style={rateInputStyle}
              aria-label="LLM output cost per million tokens"
            />
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {formatCost(llmInputCost)} in + {formatCost(llmOutputCost)} out = <strong>{formatCost(llmTotalCost)}</strong>
          </span>
        </div>
      </div>

      <div style={{
        gridColumn: '1 / -1',
        padding: 'var(--sp-sm) var(--sp-lg)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--muted)',
        textAlign: 'center',
      }}>
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
          searchCaption: 'Search by user, date, or both',
          tableNavCaption: 'prev/next columns',
          externalFilterKey: `${dateFilter?.from ?? ''}|${dateFilter?.to ?? ''}|${dateFilter?.before ?? ''}`,
          onResetFilters: resetAll,
          headerExtra: summaryCards,
          toolbarExtra: (
            <>
              <button
                type="button"
                className="btn-primary"
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
              {hasAnyFilter && (
                <button type="button" className="btn-primary" onClick={resetAll}>
                  Reset
                </button>
              )}
            </>
          ),

          selectionColumnWidth: 38,
          selectionColumnWidths: { ipad: 38, iphone: 38 },
          tableColumns: [
            { label: 'Date',        width: '120px', platformWidths: { ipad: '120px', iphone: '120px' }, sortKey: 'date',              sortValue: (r: MetricsRow) => new Date(r.date).getTime() },
            { label: 'User',        width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'Calls',       width: '80px',  platformWidths: { ipad: '80px',  iphone: '80px'  }, sortKey: 'call_count',        sortValue: (r: MetricsRow) => r.call_count },
            { label: 'Speech',      width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'speech_chars',      sortValue: (r: MetricsRow) => r.speech_chars },
            { label: 'Voice',       width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'voice_speech_chars', sortValue: (r: MetricsRow) => r.voice_speech_chars },
            { label: 'Input',       width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'input_chars',       sortValue: (r: MetricsRow) => r.input_chars },
            { label: 'Tools',       width: '80px',  platformWidths: { ipad: '80px',  iphone: '80px'  }, sortKey: 'tool_call_count',   sortValue: (r: MetricsRow) => r.tool_call_count },
            { label: 'Ambient',     width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'ambient_chars',     sortValue: (r: MetricsRow) => r.ambient_chars },
            { label: 'In Tokens',   width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'input_tokens',      sortValue: (r: MetricsRow) => r.input_tokens },
            { label: 'Out Tokens',  width: '100px', platformWidths: { ipad: '100px', iphone: '100px' }, sortKey: 'output_tokens',     sortValue: (r: MetricsRow) => r.output_tokens },
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
            setSummaryData(items)
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
    </>
  )
}
