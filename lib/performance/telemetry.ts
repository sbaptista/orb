'use client'

import { VERSION } from '@/lib/version'

export type PerfFocus = 'auth' | 'dashboard-init' | 'dashboard-clicks' | 'settings' | 'voice' | 'background'

type PerfStage = {
  name: string
  atMs: number
  durationMs?: number
}

type PerfEvent = {
  appVersion: string
  sessionId: string | null
  correlationId: string
  route: string
  focus: PerfFocus
  flow: string
  interaction: string
  surface: string
  platform: string
  browser: string
  viewport: { width: number; height: number; dpr: number; pointer: string; hover: string; standalone: boolean }
  durationMs: number
  stages: PerfStage[]
  success: boolean
  failureCode?: string | null
  metadata?: Record<string, unknown>
}

type PerfOptions = {
  focus: PerfFocus
  flow: string
  interaction: string
  surface?: string
  startTimeMs?: number
  immediateFlush?: boolean
  metadata?: Record<string, unknown>
}

const STORAGE_ENABLED = 'orb_perf_enabled'
const STORAGE_FOCUS = 'orb_perf_focus'
const STORAGE_SAMPLE = 'orb_perf_sample_rate'
const STORAGE_SESSION = 'orb_perf_session_id'
const STORAGE_FOCUS_MIGRATED = 'orb_perf_focus_settings_migrated'
const STORAGE_NAV_START = 'orb_perf_nav_start'
const FLUSH_INTERVAL_MS = 1_500
const MAX_QUEUE = 10
const DEFAULT_FOCUS: PerfFocus[] = ['auth', 'dashboard-init', 'settings']

let queue: PerfEvent[] = []
let flushTimer: number | null = null

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function storageValue(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

function getSessionId() {
  if (typeof window === 'undefined') return null
  let existing = storageValue(STORAGE_SESSION)
  if (existing) return existing
  existing = uuid()
  try { localStorage.setItem(STORAGE_SESSION, existing) } catch {}
  return existing
}

export function setPerfTelemetryEnabled(enabled: boolean) {
  try { localStorage.setItem(STORAGE_ENABLED, enabled ? 'true' : 'false') } catch {}
}

export function getPerfTelemetryEnabled() {
  return storageValue(STORAGE_ENABLED) === 'true'
}

export function getPerfFocusAreas(): PerfFocus[] {
  const raw = storageValue(STORAGE_FOCUS)
  if (!raw) return DEFAULT_FOCUS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    if (!storageValue(STORAGE_FOCUS_MIGRATED) && !parsed.includes('settings')) {
      const migrated = [...parsed, 'settings'] as PerfFocus[]
      try {
        localStorage.setItem(STORAGE_FOCUS, JSON.stringify(migrated))
        localStorage.setItem(STORAGE_FOCUS_MIGRATED, 'true')
      } catch {}
      return migrated
    }
    return parsed
  } catch {
    return []
  }
}

export function setPerfFocusAreas(focus: PerfFocus[]) {
  try {
    localStorage.setItem(STORAGE_FOCUS, JSON.stringify(focus))
    localStorage.setItem(STORAGE_FOCUS_MIGRATED, 'true')
  } catch {}
}

export function getPerfSampleRate() {
  const raw = Number(storageValue(STORAGE_SAMPLE) ?? '1')
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1
}

export function setPerfSampleRate(rate: number) {
  try { localStorage.setItem(STORAGE_SAMPLE, String(Math.min(1, Math.max(0, rate)))) } catch {}
}

export function shouldMeasurePerformance(focus: PerfFocus) {
  if (typeof window === 'undefined') return false
  if (!getPerfTelemetryEnabled()) return false
  if (!getPerfFocusAreas().includes(focus)) return false
  return Math.random() <= getPerfSampleRate()
}

export function markPerformanceNavigation(href: string) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_NAV_START, JSON.stringify({ href, atMs: performance.now() }))
  } catch {}
}

export function getPerformanceNavigationStart(href: string) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_NAV_START)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { href?: string; atMs?: number }
    if (parsed.href !== href || typeof parsed.atMs !== 'number') return null
    if (performance.now() - parsed.atMs > 60_000) return null
    return parsed.atMs
  } catch {
    return null
  }
}

function platformClass() {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const platform = navigator.platform
  const touchPoints = navigator.maxTouchPoints || 0
  if (/iPhone|iPod/.test(ua) || platform === 'iPhone' || platform === 'iPod') return 'iphone'
  if (/iPad/.test(ua) || platform === 'iPad') return 'ipad'
  if (platform === 'MacIntel' && touchPoints > 1) return 'ipad'
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (window.innerWidth <= 767) return 'iphone'
  if (coarse) return 'ipad'
  return 'mac'
}

function browserLabel() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/Firefox\//.test(ua)) return 'Firefox'
  return 'unknown'
}

function viewportInfo() {
  const pointer = window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine'
  const hover = window.matchMedia('(hover: hover)').matches ? 'hover' : 'none'
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    pointer,
    hover,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> = {}) {
  const allowed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-zA-Z0-9_.-]{1,48}$/.test(key)) continue
    if (typeof value === 'string') allowed[key] = value.slice(0, 160)
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) allowed[key] = value
  }
  return allowed
}

async function flushWithFetch(events: PerfEvent[]) {
  await fetch('/api/performance-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  })
}

export function flushPerformanceEvents(useBeacon = false) {
  if (queue.length === 0 || typeof window === 'undefined') return
  const events = queue
  queue = []
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  if (useBeacon && 'sendBeacon' in navigator) {
    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' })
    if (navigator.sendBeacon('/api/performance-events', blob)) return
  }
  flushWithFetch(events).catch(() => {
    queue = [...events.slice(-MAX_QUEUE), ...queue].slice(-MAX_QUEUE)
  })
}

function enqueue(event: PerfEvent) {
  queue.push(event)
  if (queue.length >= MAX_QUEUE) {
    flushPerformanceEvents()
    return
  }
  if (flushTimer === null && typeof window !== 'undefined') {
    flushTimer = window.setTimeout(() => flushPerformanceEvents(), FLUSH_INTERVAL_MS)
  }
}

export function startInteraction(options: PerfOptions) {
  const enabled = shouldMeasurePerformance(options.focus)
  const start = options.startTimeMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const stages: PerfStage[] = []
  const correlationId = uuid()

  return {
    correlationId,
    mark(name: string) {
      if (!enabled) return
      stages.push({ name, atMs: Math.round((performance.now() - start) * 10) / 10 })
    },
    end(success = true, failureCode?: string | null, metadata?: Record<string, unknown>) {
      if (!enabled || typeof window === 'undefined') return
      const durationMs = Math.round(performance.now() - start)
      enqueue({
        appVersion: VERSION,
        sessionId: getSessionId(),
        correlationId,
        route: window.location.pathname,
        focus: options.focus,
        flow: options.flow,
        interaction: options.interaction,
        surface: options.surface ?? options.flow,
        platform: platformClass(),
        browser: browserLabel(),
        viewport: viewportInfo(),
        durationMs,
        stages,
        success,
        failureCode: failureCode ?? null,
        metadata: sanitizeMetadata({ ...options.metadata, ...metadata }),
      })
      if (options.immediateFlush) flushPerformanceEvents()
    },
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPerformanceEvents(true)
  })
  window.addEventListener('pagehide', () => flushPerformanceEvents(true))
}
