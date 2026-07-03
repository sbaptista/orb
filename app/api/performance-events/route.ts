import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'

const VALID_FOCUS = new Set(['auth', 'dashboard-init', 'dashboard-clicks', 'settings', 'voice', 'background'])
const VALID_PLATFORM = new Set(['mac', 'ipad', 'iphone', 'unknown'])
const MAX_EVENTS = 20

function telemetryEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.ORB_PERF_TELEMETRY_ENABLED === 'true'
}

function asText(value: unknown, fallback: string, max = 160) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function asUuid(value: unknown) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function asInteger(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback
}

function cleanObject(value: unknown, fallback: Record<string, unknown> | unknown[] = {}) {
  if (!value || typeof value !== 'object') return fallback
  return value
}

function cleanEvent(raw: any, userId: string | null) {
  const focus = asText(raw?.focus, 'background', 40)
  const platform = asText(raw?.platform, 'unknown', 20)
  return {
    app_version: VERSION,
    user_id: userId,
    session_id: asUuid(raw?.sessionId),
    correlation_id: asUuid(raw?.correlationId) ?? randomUUID(),
    route: asText(raw?.route, '/', 160),
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    focus: VALID_FOCUS.has(focus) ? focus : 'background',
    flow: asText(raw?.flow, 'unknown', 80),
    interaction: asText(raw?.interaction, 'unknown', 80),
    surface: asText(raw?.surface, 'unknown', 80),
    platform: VALID_PLATFORM.has(platform) ? platform : 'unknown',
    browser: asText(raw?.browser, 'unknown', 80),
    viewport: cleanObject(raw?.viewport),
    duration_ms: asInteger(raw?.durationMs),
    stages: Array.isArray(raw?.stages) ? raw.stages.slice(0, 40) : [],
    success: raw?.success !== false,
    failure_code: typeof raw?.failureCode === 'string' ? raw.failureCode.slice(0, 120) : null,
    metadata: cleanObject(raw?.metadata),
  }
}

async function getOptionalUserId() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) return null
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!telemetryEnabled()) {
    return NextResponse.json({ ok: true, stored: 0, disabled: true })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : []
  if (events.length === 0) return NextResponse.json({ ok: true, stored: 0 })

  const userId = await getOptionalUserId()
  const admin = createAdminClient()
  const rows = events.map((event: unknown) => cleanEvent(event, userId))

  const { error } = await admin.from('performance_events').insert(rows)
  if (error) {
    console.error('[performance-events] insert failed:', error)
    const detail = process.env.NODE_ENV === 'development' ? `: ${error.message}` : ''
    return NextResponse.json({ error: `Could not store performance events${detail}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, stored: rows.length })
}
