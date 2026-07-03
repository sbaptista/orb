'use client'

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import EditorModal from '@/components/ui/EditorModal'
import {
  deletePerformanceEvents,
  getPerformanceEvents,
  getPerformanceSummary,
  savePerformanceEvent,
  type PerformanceEventQuery,
} from '@/app/actions/performance-events'
import {
  getPerfFocusAreas,
  getPerfSampleRate,
  getPerfTelemetryEnabled,
  flushPerformanceEvents,
  setPerfFocusAreas,
  setPerfSampleRate,
  setPerfTelemetryEnabled,
  type PerfFocus,
} from '@/lib/performance/telemetry'

type PerfRow = {
  id: string
  created_at: string
  environment: string
  app_version: string
  user_id: string | null
  session_id: string | null
  correlation_id: string
  route: string
  focus: PerfFocus
  flow: string
  interaction: string
  surface: string
  platform: string | null
  browser: string | null
  viewport: Record<string, unknown> | null
  duration_ms: number
  stages: Array<{ name: string; atMs: number; durationMs?: number }>
  success: boolean
  failure_code: string | null
  metadata: Record<string, unknown>
}

type PerfForm = {
  environment: string
  app_version: string
  route: string
  focus: PerfFocus
  flow: string
  interaction: string
  surface: string
  platform: string
  browser: string
  duration_ms: string
  success: boolean
  failure_code: string
  stages: string
  metadata: string
}

type SummaryRow = {
  environment: string
  focus: string
  flow: string
  interaction: string
  platform: string
  browser: string
  count: number
  totalCount: number
  failures: number
  failureRate: number
  p50: number
  p75: number
  p95: number
  max: number
}

type CoverageRow = {
  environment: string
  platform: string
  browser: string
  count: number
  successes: number
  failures: number
  latestAt: string
}

const PAGE_SIZE = 50
const FOCUS_OPTIONS: Array<{ value: PerfFocus | 'all'; label: string }> = [
  { value: 'all', label: 'All focus areas' },
  { value: 'auth', label: 'Auth' },
  { value: 'dashboard-init', label: 'Dashboard init' },
  { value: 'dashboard-clicks', label: 'Dashboard clicks' },
  { value: 'settings', label: 'Settings' },
  { value: 'voice', label: 'Voice' },
  { value: 'background', label: 'Background' },
]
const PLATFORM_OPTIONS = ['all', 'mac', 'ipad', 'iphone', 'unknown']
const BROWSER_OPTIONS = ['all', 'Safari', 'Chrome', 'Edge', 'Firefox', 'unknown']
const ENV_OPTIONS = ['all', 'development', 'production']
const SUCCESS_OPTIONS = [
  { value: 'all', label: 'All results' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
] as const

const EMPTY_FORM: PerfForm = {
  environment: 'development',
  app_version: '',
  route: '/settings/performance',
  focus: 'settings',
  flow: 'manual',
  interaction: 'manual_event',
  surface: 'settings',
  platform: 'unknown',
  browser: 'unknown',
  duration_ms: '0',
  success: true,
  failure_code: '',
  stages: '[]',
  metadata: '{}',
}

function subscribeToTimeZone() { return () => {} }
function getBrowserTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone }

function formatDateTime(value: string, timeZone: string) {
  return new Date(value).toLocaleString(undefined, { timeZone })
}

function ms(value: number) {
  return `${value.toLocaleString()}ms`
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function compactJson(value: unknown): string {
  if (!value) return '—'
  const text = JSON.stringify(value)
  return text.length > 120 ? `${text.slice(0, 120)}…` : text
}

function parseJsonField(value: string, fallback: unknown) {
  try {
    return JSON.parse(value || JSON.stringify(fallback))
  } catch {
    throw new Error('Stages and metadata must be valid JSON.')
  }
}

function toForm(row: PerfRow): PerfForm {
  return {
    environment: row.environment,
    app_version: row.app_version,
    route: row.route,
    focus: row.focus,
    flow: row.flow,
    interaction: row.interaction,
    surface: row.surface,
    platform: row.platform ?? 'unknown',
    browser: row.browser ?? 'unknown',
    duration_ms: String(row.duration_ms),
    success: row.success,
    failure_code: row.failure_code ?? '',
    stages: JSON.stringify(row.stages ?? [], null, 2),
    metadata: JSON.stringify(row.metadata ?? {}, null, 2),
  }
}

function toRecord(form: PerfForm) {
  const duration = Number(form.duration_ms)
  const stages = parseJsonField(form.stages, [])
  const metadata = parseJsonField(form.metadata, {})
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Duration must be a non-negative number.')
  if (!Array.isArray(stages)) throw new Error('Stages must be a JSON array.')
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Metadata must be a JSON object.')
  return {
    environment: form.environment,
    app_version: form.app_version || 'manual',
    route: form.route || '/settings/performance',
    focus: form.focus,
    flow: form.flow || 'manual',
    interaction: form.interaction || 'manual_event',
    surface: form.surface || 'settings',
    platform: form.platform || 'unknown',
    browser: form.browser || 'unknown',
    duration_ms: Math.round(duration),
    success: form.success,
    failure_code: form.failure_code || null,
    stages,
    metadata,
  }
}

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metrics-summary-card">
      <div className="metrics-summary-label">{label}</div>
      <div className="metrics-summary-value">{value}</div>
    </div>
  )
}

function PerformanceForm({ form, onChange }: { form: PerfForm; onChange: (form: PerfForm) => void }) {
  return (
    <div className="s-form">
      <label className="s-field">
        <span className="s-label">Environment</span>
        <select className="s-input" value={form.environment} onChange={e => onChange({ ...form, environment: e.target.value })}>
          <option value="development">development</option>
          <option value="production">production</option>
        </select>
      </label>
      <label className="s-field">
        <span className="s-label">Version</span>
        <input className="s-input" value={form.app_version} onChange={e => onChange({ ...form, app_version: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Route</span>
        <input className="s-input" value={form.route} onChange={e => onChange({ ...form, route: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Focus</span>
        <select className="s-input" value={form.focus} onChange={e => onChange({ ...form, focus: e.target.value as PerfFocus })}>
          {FOCUS_OPTIONS.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="s-field">
        <span className="s-label">Flow</span>
        <input className="s-input" value={form.flow} onChange={e => onChange({ ...form, flow: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Interaction</span>
        <input className="s-input" value={form.interaction} onChange={e => onChange({ ...form, interaction: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Surface</span>
        <input className="s-input" value={form.surface} onChange={e => onChange({ ...form, surface: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Platform</span>
        <select className="s-input" value={form.platform} onChange={e => onChange({ ...form, platform: e.target.value })}>
          {PLATFORM_OPTIONS.filter(value => value !== 'all').map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="s-field">
        <span className="s-label">Browser</span>
        <input className="s-input" value={form.browser} onChange={e => onChange({ ...form, browser: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Duration ms</span>
        <input className="s-input" inputMode="numeric" value={form.duration_ms} onChange={e => onChange({ ...form, duration_ms: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Result</span>
        <select className="s-input" value={form.success ? 'success' : 'failure'} onChange={e => onChange({ ...form, success: e.target.value === 'success' })}>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
      </label>
      <label className="s-field">
        <span className="s-label">Failure code</span>
        <input className="s-input" value={form.failure_code} onChange={e => onChange({ ...form, failure_code: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Stages JSON</span>
        <textarea className="s-input" rows={6} value={form.stages} onChange={e => onChange({ ...form, stages: e.target.value })} />
      </label>
      <label className="s-field">
        <span className="s-label">Metadata JSON</span>
        <textarea className="s-input" rows={6} value={form.metadata} onChange={e => onChange({ ...form, metadata: e.target.value })} />
      </label>
    </div>
  )
}

export default function SettingsPerformance() {
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showCreatedFilter, setShowCreatedFilter] = useState(false)
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter | null>(null)
  const [environment, setEnvironment] = useState('all')
  const [focus, setFocus] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [browser, setBrowser] = useState('all')
  const [success, setSuccess] = useState<'all' | 'success' | 'failure'>('all')
  const [version, setVersion] = useState('all')
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [coverage, setCoverage] = useState<CoverageRow[]>([])
  const [totals, setTotals] = useState<{ events: number; successes: number; failures: number; environments: string[] }>({ events: 0, successes: 0, failures: 0, environments: [] })
  const [viewingRow, setViewingRow] = useState<PerfRow | null>(null)
  const [clientEnabled, setClientEnabled] = useState(false)
  const [clientFocus, setClientFocus] = useState<PerfFocus[]>([])
  const [sampleRate, setSampleRateState] = useState(1)
  const [probeStatus, setProbeStatus] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setClientEnabled(getPerfTelemetryEnabled())
      setClientFocus(getPerfFocusAreas())
      setSampleRateState(getPerfSampleRate())
    }, 0)

    return () => window.clearTimeout(id)
  }, [])

  const filterKey = [
    textSearchTerm,
    createdFilter?.from ?? '',
    createdFilter?.to ?? '',
    createdFilter?.before ?? '',
    environment,
    focus,
    platform,
    browser,
    success,
    version,
    refreshToken,
  ].join('|')

  const queryOptions: Omit<PerformanceEventQuery, 'page' | 'pageSize' | 'sortKey' | 'sortDir'> = {
    search: textSearchTerm,
    createdFrom: createdFilter?.from,
    createdTo: createdFilter?.to,
    createdBefore: createdFilter?.before,
    environment,
    focus,
    platform,
    browser,
    success,
    version,
  }

  useEffect(() => {
    let cancelled = false
    getPerformanceSummary(queryOptions).then(result => {
      if (!cancelled && result.ok) {
        setSummary((result.data ?? []) as SummaryRow[])
        setCoverage((result.coverage ?? []) as CoverageRow[])
        setTotals((result.totals ?? { events: 0, successes: 0, failures: 0, environments: [] }) as { events: number; successes: number; failures: number; environments: string[] })
      }
    })
    return () => { cancelled = true }
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const completedSummary = useMemo(() => summary.filter(row => row.count > 0), [summary])
  const analysis = useMemo(() => {
    const topBottleneck = completedSummary[0]
    const largestOutlier = completedSummary
      .map(row => ({ row, gap: Math.max(0, row.max - row.p95) }))
      .sort((a, b) => b.gap - a.gap)[0]
    const attention = summary
      .filter(row => row.count > 0 && (row.p95 >= 5000 || row.max >= 10000 || row.failureRate >= 0.2 || row.failures >= 3))
      .slice(0, 6)
    const productionEvents = coverage.filter(row => row.environment === 'production').reduce((sum, row) => sum + row.count, 0)
    const platformGroups = new Map<string, SummaryRow[]>()
    for (const row of completedSummary) {
      const key = [row.environment, row.focus, row.flow, row.interaction, row.browser].join('|')
      platformGroups.set(key, [...(platformGroups.get(key) ?? []), row])
    }
    const platformGap = [...platformGroups.values()]
      .filter(rows => rows.length > 1)
      .map(rows => {
        const sorted = [...rows].sort((a, b) => b.p95 - a.p95)
        return { slow: sorted[0], fast: sorted[sorted.length - 1], gap: sorted[0].p95 - sorted[sorted.length - 1].p95 }
      })
      .sort((a, b) => b.gap - a.gap)[0]
    return { topBottleneck, largestOutlier, attention, productionEvents, platformGap }
  }, [completedSummary, coverage, summary])

  function setEnabled(next: boolean) {
    setClientEnabled(next)
    setPerfTelemetryEnabled(next)
  }

  function setFocusAreas(next: PerfFocus[]) {
    setClientFocus(next)
    setPerfFocusAreas(next)
  }

  function setSample(next: number) {
    setSampleRateState(next)
    setPerfSampleRate(next)
  }

  async function runApiProbe() {
    setProbeStatus('Recording probe...')
    try {
      const response = await fetch('/api/performance-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            focus: 'settings',
            flow: 'performance-settings',
            interaction: 'api_probe',
            surface: 'settings-performance',
            platform: window.innerWidth <= 767 ? 'iphone' : window.matchMedia('(pointer: coarse)').matches ? 'ipad' : 'mac',
            browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'unknown',
            route: window.location.pathname,
            durationMs: 1,
            stages: [],
            metadata: { source: 'settings_probe' },
          }],
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.error) throw new Error(payload.error ?? `HTTP ${response.status}`)
      setProbeStatus(`Probe stored: ${payload.stored ?? 0}`)
      setRefreshToken(value => value + 1)
    } catch (err: any) {
      setProbeStatus(`Probe failed: ${err.message}`)
    }
  }

  function flushQueued() {
    flushPerformanceEvents()
    setProbeStatus('Queued events flushed.')
    window.setTimeout(() => setRefreshToken(value => value + 1), 800)
  }

  function resetAll() {
    setTextSearchTerm('')
    setCreatedFilter(null)
    setEnvironment('all')
    setFocus('all')
    setPlatform('all')
    setBrowser('all')
    setSuccess('all')
    setVersion('all')
  }

  const hasAnyFilter = !!textSearchTerm || !!createdFilter || environment !== 'all' || focus !== 'all' || platform !== 'all' || browser !== 'all' || success !== 'all' || version !== 'all'
  const totalEvents = totals.events
  const worst = analysis.topBottleneck

  return (
    <>
      <SettingsCrudList<PerfRow, PerfForm>
        config={{
          title: 'Performance Events',
          table: 'performance_events',
          itemLabel: 'Event',
          emptyForm: EMPTY_FORM,
          pageClass: 'settings-page s-page-wide',
          layout: 'table',
          pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
          addButtonLabel: 'Manual Event',
          addModalTitle: 'Add Manual Performance Event',
          editModalTitle: 'Edit Performance Event',
          totalCount: undefined,
          subtitle: (items, count, pageInfo) => {
            if (!items.length) return 'No rows found.'
            const start = (pageInfo?.page ?? 0) * PAGE_SIZE + 1
            const end = start + items.length - 1
            return count === undefined ? `Rows ${start}-${end}.` : `Rows ${start}-${end} of ${count}.`
          },
          headerExtra: (
            <>
              <div className="s-card flex-col gap-lg" style={{ marginBottom: 'var(--sp-lg)' }}>
                <div>
                  <h2 className="s-card-title">Measurement Controls</h2>
                  <p className="s-card-desc">
                    This browser is {clientEnabled ? 'recording selected focus areas.' : 'not recording measurements.'}
                  </p>
                </div>
                <div className="s-form perf-controls-form">
                  <div className="metrics-summary-grid perf-stats-grid">
                    <StatCard label="Matching Events" value={totalEvents.toLocaleString()} />
                    <StatCard label="Slowest P95" value={worst ? ms(worst.p95) : '—'} />
                    <StatCard label="Worst Platform" value={worst?.platform ?? '—'} />
                    <StatCard label="Recording" value={clientEnabled ? 'On' : 'Off'} />
                  </div>

                  <div className="perf-control-grid">
                    <div className="s-card perf-control-card">
                      <div className="metrics-summary-label">Local Browser Measurement</div>
                      <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`pill ${clientEnabled ? 'pill-active' : ''}`}
                          onClick={() => setEnabled(true)}
                          aria-pressed={clientEnabled}
                        >
                          On
                        </button>
                        <button
                          type="button"
                          className={`pill ${!clientEnabled ? 'pill-active' : ''}`}
                          onClick={() => setEnabled(false)}
                          aria-pressed={!clientEnabled}
                        >
                          Off
                        </button>
                      </div>
                    </div>
                    <label className="s-card perf-control-card">
                      <span className="metrics-summary-label">Sample Rate</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={sampleRate}
                        onChange={e => setSample(Number(e.target.value))}
                        style={{ minHeight: 'var(--touch)' }}
                      />
                    </label>
                  </div>

                  <div className="s-card perf-control-card">
                    <div className="metrics-summary-label">Focus Areas</div>
                    <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
                      {FOCUS_OPTIONS.filter(option => option.value !== 'all').map(option => {
                        const value = option.value as PerfFocus
                        const active = clientFocus.includes(value)
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`pill ${active ? 'pill-active' : ''}`}
                            onClick={() => setFocusAreas(active ? clientFocus.filter(item => item !== value) : [...clientFocus, value])}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="s-card perf-control-card">
                    <div className="metrics-summary-label">Measurement Check</div>
                    <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
                      <button type="button" className="btn-primary" onClick={runApiProbe}>Run Probe</button>
                      <button type="button" className="btn-primary" onClick={flushQueued}>Flush Queue</button>
                    </div>
                  </div>

                  <div className="s-card perf-production-card">
                    <div>
                      <div className="metrics-summary-label">Production Collection Checklist</div>
                      <p className="text-sm text-muted" style={{ margin: 'var(--sp-xs) 0 0' }}>
                        Production rows appear only after the deployed server accepts telemetry and each testing browser records locally.
                      </p>
                    </div>
                    <ol className="perf-checklist">
                      <li>Deploy the latest app version.</li>
                      <li>Set <code>ORB_PERF_TELEMETRY_ENABLED=true</code> in Vercel Production.</li>
                      <li>Redeploy if Vercel requires it for the environment variable to take effect.</li>
                      <li>On each Mac, iPad, or iPhone browser, set Local Browser Measurement to On.</li>
                      <li>Select the focus areas being measured, then run the target flows.</li>
                      <li>Confirm new rows appear with environment set to production.</li>
                    </ol>
                  </div>

                  {probeStatus && <p className="text-sm text-muted" style={{ margin: 0 }}>{probeStatus}</p>}
                  {clientEnabled && !clientFocus.includes('settings') && (
                    <p className="text-sm" style={{ margin: 0, color: 'var(--warning)' }}>
                      Settings focus is off, so Settings page loads and navigation clicks will not be recorded.
                    </p>
                  )}
                </div>
              </div>
              {summary.length > 0 && (
                <div className="s-card perf-analysis-section">
                  <div className="perf-section-heading">
                    <h2 className="s-card-title">Performance Analysis</h2>
                    <p className="s-card-desc">
                      Completed events drive latency percentiles. Failed, stale, and interrupted events are counted separately so they point to reliability problems without distorting P50/P75/P95.
                    </p>
                  </div>
                  <div className="metrics-summary-grid perf-analysis-grid">
                    <StatCard label="Data Coverage" value={analysis.productionEvents > 0 ? `${analysis.productionEvents.toLocaleString()} production` : 'Dev only'} />
                    <StatCard label="Completed Events" value={totals.successes.toLocaleString()} />
                    <StatCard label="Failed / Interrupted" value={totals.failures.toLocaleString()} />
                    <StatCard label="Top Bottleneck" value={analysis.topBottleneck ? `${analysis.topBottleneck.interaction} ${ms(analysis.topBottleneck.p95)}` : '—'} />
                  </div>
                  <div className="perf-analysis-columns">
                    <div className="s-card perf-analysis-card">
                      <div className="metrics-summary-label">Needs Attention</div>
                      {analysis.attention.length === 0 ? (
                        <p className="text-sm text-muted" style={{ margin: 0 }}>No matching groups crossed the current attention thresholds.</p>
                      ) : (
                        <div className="perf-attention-list">
                          {analysis.attention.map(row => (
                            <div className="perf-attention-row" key={`${row.environment}-${row.focus}-${row.flow}-${row.interaction}-${row.platform}-${row.browser}`}>
                              <div>
                                <div className="perf-attention-title">{row.flow} / {row.interaction}</div>
                                <div className="perf-attention-meta">{row.environment} · {row.platform} · {row.browser} · {row.count} completed · {row.failures} failed</div>
                              </div>
                              <div className="crud-card-pills">
                                {row.p95 >= 5000 && <span className="crud-card-pill">P95 {ms(row.p95)}</span>}
                                {row.max >= 10000 && <span className="crud-card-pill">Max {ms(row.max)}</span>}
                                {row.failureRate >= 0.2 && <span className="crud-card-pill">Fail {pct(row.failureRate)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="s-card perf-analysis-card">
                      <div className="metrics-summary-label">Platform Differences</div>
                      {analysis.platformGap && analysis.platformGap.gap > 0 ? (
                        <div className="perf-attention-row">
                          <div>
                            <div className="perf-attention-title">{analysis.platformGap.slow.flow} / {analysis.platformGap.slow.interaction}</div>
                            <div className="perf-attention-meta">
                              {analysis.platformGap.slow.platform} P95 {ms(analysis.platformGap.slow.p95)} vs {analysis.platformGap.fast.platform} P95 {ms(analysis.platformGap.fast.p95)}
                            </div>
                          </div>
                          <span className="crud-card-pill">Gap {ms(analysis.platformGap.gap)}</span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted" style={{ margin: 0 }}>Need matching flow samples on more than one platform.</p>
                      )}
                      <div className="metrics-summary-label" style={{ marginTop: 'var(--sp-md)' }}>Coverage</div>
                      <div className="perf-coverage-list">
                        {coverage.slice(0, 6).map(row => (
                          <div className="perf-coverage-row" key={`${row.environment}-${row.platform}-${row.browser}`}>
                            <span>{row.environment} · {row.platform} · {row.browser}</span>
                            <strong>{row.count.toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {summary.length > 0 && (
                <div className="s-card perf-summary-section">
                  <div className="perf-section-heading">
                    <h2 className="s-card-title">Latency Summary</h2>
                    <p className="s-card-desc">
                      Latency is elapsed time from a measured user action or page-load start until that interaction settles. Settings is the focus area for Settings pages and controls. Flow names the measured path, such as a Settings page or CRUD table. Count is the number of matching timing events in the group. P50/P75/P95 are percentiles: 50%, 75%, or 95% of matching events completed at or below that time.
                    </p>
                  </div>
                  <div className="perf-summary-table-wrap">
                    <table className="audit-table perf-summary-table">
                      <thead>
                        <tr>
                          <th className="audit-th">Focus</th>
                          <th className="audit-th">Flow</th>
                          <th className="audit-th">Interaction</th>
                          <th className="audit-th">Platform</th>
                          <th className="audit-th">Browser</th>
                          <th className="audit-th">Completed</th>
                          <th className="audit-th">Failed</th>
                          <th className="audit-th">P50</th>
                          <th className="audit-th">P75</th>
                          <th className="audit-th">P95</th>
                          <th className="audit-th">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.slice(0, 8).map(row => (
                          <tr key={`${row.environment}-${row.focus}-${row.flow}-${row.interaction}-${row.platform}-${row.browser}`}>
                            <td>{row.focus}</td>
                            <td>{row.flow}</td>
                            <td>{row.interaction}</td>
                            <td>{row.platform}</td>
                            <td>{row.browser}</td>
                            <td>{row.count}</td>
                            <td>{row.failures}</td>
                            <td>{ms(row.p50)}</td>
                            <td>{ms(row.p75)}</td>
                            <td>{ms(row.p95)}</td>
                            <td>{ms(row.max)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="perf-summary-cards">
                    {summary.slice(0, 8).map(row => (
                      <div key={`${row.environment}-${row.focus}-${row.flow}-${row.interaction}-${row.platform}-${row.browser}`} className="crud-card perf-summary-card">
                        <div className="crud-card-header">
                          <div className="crud-card-header-left">
                            <span className="crud-card-code">{row.focus}</span>
                          </div>
                          <span className="crud-card-date">{row.platform}</span>
                        </div>
                        <div className="crud-card-title">{row.interaction}</div>
                        <div className="crud-card-pills">
                          <span className="crud-card-pill">{row.browser}</span>
                        </div>
                        <div className="crud-card-meta">
                          <span><strong>Flow:</strong> <span className="crud-card-meta-value">{row.flow}</span></span>
                          <span><strong>Completed:</strong> <span className="crud-card-meta-value">{row.count}</span></span>
                          <span><strong>Failed:</strong> <span className="crud-card-meta-value">{row.failures}</span></span>
                          <span><strong>P50:</strong> <span className="crud-card-meta-value">{ms(row.p50)}</span></span>
                          <span><strong>P75:</strong> <span className="crud-card-meta-value">{ms(row.p75)}</span></span>
                          <span><strong>P95:</strong> <span className="crud-card-meta-value">{ms(row.p95)}</span></span>
                          <span><strong>Max:</strong> <span className="crud-card-meta-value">{ms(row.max)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ),
          externalSearchTerm: textSearchTerm,
          searchCaption: 'Performance filters',
          externalFilterActive: hasAnyFilter,
          tableNavCaption: 'Event columns',
          externalFilterKey: filterKey,
          onResetFilters: resetAll,
          onRowClick: setViewingRow,
          toolbarExtra: (
            <>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Text</span>
                <button type="button" className={textSearchTerm ? 'btn-primary btn-primary-clamped perf-filter-control' : 'btn-primary perf-filter-control'} onClick={() => setShowTextSearch(true)}>
                  {textSearchTerm || 'Search by Text'}
                </button>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Date</span>
                <button type="button" className="btn-primary perf-filter-control" onClick={() => setShowCreatedFilter(true)}>
                  {createdFilter?.label ?? 'Search by Date'}
                </button>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Environment</span>
                <select className="s-input perf-filter-control perf-filter-select" value={environment} onChange={e => setEnvironment(e.target.value)} aria-label="Environment filter">
                  {ENV_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Focus</span>
                <select className="s-input perf-filter-control perf-filter-select" value={focus} onChange={e => setFocus(e.target.value)} aria-label="Focus filter">
                  {FOCUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Platform</span>
                <select className="s-input perf-filter-control perf-filter-select" value={platform} onChange={e => setPlatform(e.target.value)} aria-label="Platform filter">
                  {PLATFORM_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Browser</span>
                <select className="s-input perf-filter-control perf-filter-select" value={browser} onChange={e => setBrowser(e.target.value)} aria-label="Browser filter">
                  {BROWSER_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Result</span>
                <select className="s-input perf-filter-control perf-filter-select" value={success} onChange={e => setSuccess(e.target.value as 'all' | 'success' | 'failure')} aria-label="Result filter">
                  {SUCCESS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="perf-filter-field">
                <span className="perf-filter-label">Version</span>
                <input className="s-input perf-filter-control" value={version} onChange={e => setVersion(e.target.value || 'all')} aria-label="Version filter" placeholder="version or all" />
              </label>
            </>
          ),
          mobileSortOptions: [
            { sortKey: 'created_at', sortDir: 'desc', label: 'Newest first' },
            { sortKey: 'duration_ms', sortDir: 'desc', label: 'Slowest first' },
            { sortKey: 'focus', sortDir: 'asc', label: 'Focus A-Z' },
            { sortKey: 'platform', sortDir: 'asc', label: 'Platform A-Z' },
          ],
          selectionColumnWidth: 38,
          selectionColumnWidths: { ipad: 38, iphone: 38 },
          stickyColumnsByPlatform: { mac: 2, ipad: 1, iphone: 0 },
          tableColumns: [
            { label: 'Created', width: '160px', platformWidths: { ipad: '170px', iphone: '150px' }, sortKey: 'created_at', sortValue: (row: PerfRow) => new Date(row.created_at).getTime() },
            { label: 'Env', width: '110px', platformWidths: { ipad: '120px', iphone: '120px' }, sortKey: 'environment', sortValue: (row: PerfRow) => row.environment },
            { label: 'Focus', width: '140px', platformWidths: { ipad: '150px', iphone: '140px' }, sortKey: 'focus', sortValue: (row: PerfRow) => row.focus },
            { label: 'Flow', width: '160px', platformWidths: { ipad: '170px', iphone: '150px' }, sortKey: 'flow', sortValue: (row: PerfRow) => row.flow },
            { label: 'Interaction', width: '180px', platformWidths: { ipad: '190px', iphone: '160px' }, sortKey: 'interaction', sortValue: (row: PerfRow) => row.interaction },
            { label: 'Platform', width: '110px', platformWidths: { ipad: '120px', iphone: '120px' }, sortKey: 'platform', sortValue: (row: PerfRow) => row.platform ?? '' },
            { label: 'Duration', width: '120px', platformWidths: { ipad: '130px', iphone: '120px' }, align: 'right', sortKey: 'duration_ms', sortValue: (row: PerfRow) => row.duration_ms },
            { label: 'Result', width: '110px', platformWidths: { ipad: '120px', iphone: '110px' } },
            { label: 'Route', width: '220px', platformWidths: { ipad: '220px', iphone: '180px' } },
            { label: 'Actions', width: '120px', platformWidths: { ipad: '120px', iphone: '120px' } },
          ],
          load: async (_supabase, pagination) => {
            const res = await getPerformanceEvents({
              ...queryOptions,
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              sortKey: pagination?.sortKey,
              sortDir: pagination?.sortDir,
            })
            if (res.error) throw new Error(res.error)
            return { items: (res.data ?? []) as PerfRow[], totalCount: res.totalCount ?? 0 }
          },
          getId: row => row.id,
          toForm,
          toRecord: form => toRecord(form),
          validate: form => {
            try { toRecord(form); return null } catch (err: any) { return err.message }
          },
          onAdd: async (_supabase, record) => {
            const res = await savePerformanceEvent(null, record)
            if (res.error) throw new Error(res.error)
          },
          onSave: async (_supabase, id, record) => {
            const res = await savePerformanceEvent(id, record)
            if (res.error) throw new Error(res.error)
          },
          renderForm: ({ form, onChange }) => <PerformanceForm form={form} onChange={onChange} />,
          bulkDelete: {
            confirmMessage: count => `Delete ${count} performance event${count === 1 ? '' : 's'}? This cannot be undone.`,
            onDelete: async (_supabase, rows) => {
              const res = await deletePerformanceEvents(rows.map(row => row.id))
              return res.error ? { error: res.error } : {}
            },
          },
          renderRow: ({ item, onEdit, onDelete, checkbox }) => (
            <tr key={item.id} onClick={() => setViewingRow(item)} style={{ cursor: 'pointer' }}>
              {checkbox}
              <td>{formatDateTime(item.created_at, timeZone)}</td>
              <td>{item.environment}</td>
              <td>{item.focus}</td>
              <td>{item.flow}</td>
              <td>{item.interaction}</td>
              <td>{item.platform ?? 'unknown'}</td>
              <td style={{ textAlign: 'right' }}>{ms(item.duration_ms)}</td>
              <td>{item.success ? 'Success' : item.failure_code ?? 'Failure'}</td>
              <td>{item.route}</td>
              <td className="action-cell" onClick={e => e.stopPropagation()}>
                <button className="action-link" onClick={onEdit}>Edit</button>
                <button className="action-link btn-row-delete" onClick={onDelete}>Delete</button>
              </td>
            </tr>
          ),
          renderMobileRow: ({ item, onEdit, onDelete }) => (
            <div key={item.id} className="crud-card perf-event-card" onClick={() => setViewingRow(item)}>
              <div className="crud-card-header">
                <div className="crud-card-header-left">
                  <span className="crud-card-code">{item.focus}</span>
                </div>
                <span className="crud-card-date">{formatDateTime(item.created_at, timeZone)}</span>
              </div>
              <div className="crud-card-title">{item.interaction}</div>
              <div className="crud-card-pills">
                <span className="crud-card-pill">{item.platform ?? 'unknown'}</span>
                <span className="crud-card-pill">{ms(item.duration_ms)}</span>
                <span className="crud-card-pill">{item.success ? 'Success' : item.failure_code ?? 'Failure'}</span>
              </div>
              <div className="crud-card-meta">
                <span><strong>Flow:</strong> <span className="crud-card-meta-value">{item.flow}</span></span>
                <span><strong>Route:</strong> <span className="crud-card-meta-value">{item.route}</span></span>
              </div>
              <div className="crud-card-actions" onClick={e => e.stopPropagation()}>
                <button className="text-btn btn-sm" onClick={onEdit}>Edit</button>
                <button className="text-btn btn-sm btn-row-delete" onClick={onDelete}>Delete</button>
              </div>
            </div>
          ),
        }}
      />

      <TextSearchModal
        open={showTextSearch}
        onClose={() => setShowTextSearch(false)}
        onApply={term => setTextSearchTerm(term)}
        onClear={() => setTextSearchTerm('')}
        currentTerm={textSearchTerm}
        placeholder="Search route, focus, flow, interaction, browser..."
        ariaLabel="Search performance events"
      />
      <DateSearchModal
        open={showCreatedFilter}
        onClose={() => setShowCreatedFilter(false)}
        onApply={setCreatedFilter}
        onClear={() => setCreatedFilter(null)}
        currentFilter={createdFilter}
      />
      {viewingRow && (
        <EditorModal
          title="Performance Event"
          titleId="performance-event-detail-title"
          isDirty={false}
          readOnly
          showCloseFooter
          onClose={() => setViewingRow(null)}
          lockSettingsScroll
        >
          <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)', overflowY: 'auto' }}>
            <div className="s-form" style={{ display: 'grid', gap: 'var(--sp-lg)', borderBottom: 0, padding: 0 }}>
              <div className="s-card" style={{ padding: 'var(--sp-md)', background: 'var(--bg2)' }}>
                <p className="text-sm" style={{ margin: 0 }}><strong>Created:</strong> {formatDateTime(viewingRow.created_at, timeZone)}</p>
                <p className="text-sm" style={{ margin: 0 }}><strong>Flow:</strong> {viewingRow.focus} / {viewingRow.flow} / {viewingRow.interaction}</p>
                <p className="text-sm" style={{ margin: 0 }}><strong>Duration:</strong> {ms(viewingRow.duration_ms)} on {viewingRow.platform ?? 'unknown'}</p>
                <p className="text-sm" style={{ margin: 0 }}><strong>Route:</strong> {viewingRow.route}</p>
                <p className="text-sm" style={{ margin: 0, overflowWrap: 'anywhere' }}><strong>Correlation:</strong> {viewingRow.correlation_id}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-md)' }}>
                <label className="s-card" style={{ padding: 'var(--sp-md)', background: 'var(--bg2)', display: 'grid', gap: 'var(--sp-sm)' }}>
                  <span className="metrics-summary-label">Stages</span>
                  <textarea className="s-input" rows={8} readOnly value={JSON.stringify(viewingRow.stages ?? [], null, 2)} />
                </label>
                <label className="s-card" style={{ padding: 'var(--sp-md)', background: 'var(--bg2)', display: 'grid', gap: 'var(--sp-sm)' }}>
                  <span className="metrics-summary-label">Viewport</span>
                  <textarea className="s-input" rows={8} readOnly value={JSON.stringify(viewingRow.viewport ?? {}, null, 2)} />
                </label>
                <label className="s-card" style={{ padding: 'var(--sp-md)', background: 'var(--bg2)', display: 'grid', gap: 'var(--sp-sm)' }}>
                  <span className="metrics-summary-label">Metadata</span>
                  <textarea className="s-input" rows={8} readOnly value={JSON.stringify(viewingRow.metadata ?? {}, null, 2)} />
                </label>
              </div>
              <p className="text-sm text-muted" style={{ margin: 0 }}>{compactJson(viewingRow.metadata)}</p>
            </div>
          </div>
        </EditorModal>
      )}
    </>
  )
}
