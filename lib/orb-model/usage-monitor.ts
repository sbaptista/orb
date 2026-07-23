import 'server-only'

import { createSign } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { createTicket } from '@/app/actions/ticket-actions'
import { FROM_EMAIL, getResend } from '@/lib/email'
import { mapPolicy } from './ai-settings-core'
import { checkOrbBudget } from './budget'
import { providerLabel, providerConsoleUrl } from './incidents'
import type { OrbModelProviderId } from './types'
import type { OrbModelRole } from './catalog'

// ORB-353: proactive "approaching limit" warning. Runs from a dedicated
// 15-minute Vercel Cron (app/api/cron/usage-check/route.ts), never from a
// user-facing request path — see docs/orb-353-ai-usage-warning-plan.md for
// why (latency risk to /api/version, and it must run even when nobody has
// Orb open). Checks two independent kinds of ceiling per scope: Orb's own
// internal ledger budget, and — for the three providers whose APIs don't
// expose a real configured cap — an admin-entered spend cap compared
// against real queried spend. ElevenLabs is the exception: its API returns
// the real limit directly.

type ScopeResult = {
  key: string
  label: string
  usedUsd: number
  limitUsd: number
  provider: OrbModelProviderId | null
  role: OrbModelRole | null
  reconciliationProvider?: 'anthropic' | 'openai' | 'google'
}

function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return {
    startIso: start.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    nowIso: now.toISOString(),
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(now.getTime() / 1000),
    period: start.toISOString().slice(0, 7),
  }
}

async function getAnthropicOrgSpend(): Promise<number | null> {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY
  if (!key) return null
  const window = monthWindow()
  let total = 0
  let page: string | null = null
  try {
    do {
      const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
      url.searchParams.set('starting_at', window.startIso)
      url.searchParams.set('ending_at', window.nowIso)
      if (page) url.searchParams.set('page', page)
      const res = await fetch(url, { headers: { 'anthropic-version': '2023-06-01', 'x-api-key': key } })
      if (!res.ok) { console.error('[usage-monitor] Anthropic cost_report failed', res.status); return null }
      const body = await res.json()
      for (const bucket of body.data ?? []) {
        for (const result of bucket.results ?? []) total += Number(result.amount) || 0
      }
      page = body.has_more ? body.next_page : null
    } while (page)
    return total
  } catch (error) {
    console.error('[usage-monitor] Anthropic cost_report exception', error)
    return null
  }
}

async function getOpenAiOrgSpend(): Promise<number | null> {
  const key = process.env.OPENAI_ADMIN_API_KEY
  if (!key) return null
  const window = monthWindow()
  let total = 0
  let page: string | null = null
  try {
    do {
      const url = new URL('https://api.openai.com/v1/organization/costs')
      url.searchParams.set('start_time', String(window.startUnix))
      url.searchParams.set('end_time', String(window.endUnix))
      url.searchParams.set('bucket_width', '1d')
      if (page) url.searchParams.set('page', page)
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
      if (!res.ok) { console.error('[usage-monitor] OpenAI costs failed', res.status); return null }
      const body = await res.json()
      for (const bucket of body.data ?? []) {
        for (const result of bucket.results ?? []) total += Number(result.amount?.value) || 0
      }
      page = body.has_more ? body.next_page : null
    } while (page)
    return total
  } catch (error) {
    console.error('[usage-monitor] OpenAI costs exception', error)
    return null
  }
}

async function getElevenLabsUsage(): Promise<{ used: number; limit: number } | null> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
    if (!res.ok) { console.error('[usage-monitor] ElevenLabs subscription failed', res.status); return null }
    const body = await res.json()
    return { used: Number(body.character_count) || 0, limit: Number(body.character_limit) || 0 }
  } catch (error) {
    console.error('[usage-monitor] ElevenLabs subscription exception', error)
    return null
  }
}

const GEMINI_PROJECT_ID = 'gen-lang-client-0911706834'
const GEMINI_BILLING_TABLE = 'gen-lang-client-0911706834.Shoebill_Software.gcp_billing_export_resource_v1_019FB0_14597B_968D29'

let cachedGoogleToken: { token: string; expiresAt: number } | null = null

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getGoogleAccessToken(): Promise<string | null> {
  if (cachedGoogleToken && Date.now() < cachedGoogleToken.expiresAt) return cachedGoogleToken.token
  const raw = process.env.GOOGLE_BILLING_CREDENTIALS_JSON_BASE64
  if (!raw) return null
  let serviceAccount: { client_email: string; private_key: string; token_uri: string }
  try {
    serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    console.error('[usage-monitor] GOOGLE_BILLING_CREDENTIALS_JSON_BASE64 is not valid base64 JSON')
    return null
  }
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/bigquery.readonly',
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  }))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const jwt = `${unsigned}.${base64url(signer.sign(serviceAccount.private_key))}`
  try {
    const res = await fetch(serviceAccount.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    })
    const body = await res.json()
    if (!res.ok) { console.error('[usage-monitor] Google token exchange failed', res.status, body); return null }
    // Cache for 50 of the token's 60 minutes so a slow tick never runs past expiry.
    cachedGoogleToken = { token: body.access_token, expiresAt: Date.now() + 50 * 60 * 1000 }
    return body.access_token
  } catch (error) {
    console.error('[usage-monitor] Google token exchange exception', error)
    return null
  }
}

async function getGeminiOrgSpend(): Promise<number | null> {
  const token = await getGoogleAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${GEMINI_PROJECT_ID}/queries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT ROUND(SUM(cost), 4) AS total_cost FROM \`${GEMINI_BILLING_TABLE}\` WHERE DATE(usage_start_time) >= DATE_TRUNC(CURRENT_DATE(), MONTH)`,
        useLegacySql: false,
      }),
    })
    const body = await res.json()
    if (!res.ok) { console.error('[usage-monitor] Gemini BigQuery query failed', res.status, body); return null }
    const cell = body.rows?.[0]?.f?.[0]?.v
    return cell == null ? 0 : Number(cell)
  } catch (error) {
    console.error('[usage-monitor] Gemini BigQuery exception', error)
    return null
  }
}

async function collectScopes(admin: ReturnType<typeof createAdminClient>): Promise<{ scopes: ScopeResult[]; warningThresholdPct: number }> {
  const { data: policyRow, error: policyError } = await admin.from('orb_ai_policy').select('*').eq('id', true).maybeSingle()
  if (policyError) throw policyError
  const policy = mapPolicy(policyRow)

  const [operational, strategic, voice, anthropicSpent, openaiSpent, geminiSpent, elevenLabs] = await Promise.all([
    checkOrbBudget(admin, policy, 'operational'),
    checkOrbBudget(admin, policy, 'strategic'),
    checkOrbBudget(admin, policy, 'voice'),
    getAnthropicOrgSpend(),
    getOpenAiOrgSpend(),
    getGeminiOrgSpend(),
    getElevenLabsUsage(),
  ])

  const scopes: ScopeResult[] = [
    { key: 'orb-operational', label: 'Orb operational budget', usedUsd: operational.spentUsd, limitUsd: policy.operationalBudgetUsd, provider: policy.operationalProvider, role: 'operational' },
    { key: 'orb-strategic', label: 'Orb strategic budget', usedUsd: strategic.spentUsd, limitUsd: policy.strategicBudgetUsd, provider: policy.strategicProvider, role: 'strategic' },
    { key: 'orb-voice', label: 'Orb voice budget', usedUsd: voice.spentUsd, limitUsd: policy.voiceBudgetUsd, provider: 'openai', role: 'voice' },
  ]
  if (anthropicSpent != null && policy.anthropicSpendCapUsd > 0) {
    scopes.push({ key: 'anthropic-org', label: 'Anthropic organization spend', usedUsd: anthropicSpent, limitUsd: policy.anthropicSpendCapUsd, provider: 'anthropic', role: null, reconciliationProvider: 'anthropic' })
  }
  if (openaiSpent != null && policy.openaiSpendCapUsd > 0) {
    scopes.push({ key: 'openai-org', label: 'OpenAI organization spend', usedUsd: openaiSpent, limitUsd: policy.openaiSpendCapUsd, provider: 'openai', role: null, reconciliationProvider: 'openai' })
  }
  if (geminiSpent != null && policy.geminiSpendCapUsd > 0) {
    scopes.push({ key: 'gemini-org', label: 'Gemini organization spend', usedUsd: geminiSpent, limitUsd: policy.geminiSpendCapUsd, provider: 'google', role: null, reconciliationProvider: 'google' })
  }
  if (elevenLabs != null && elevenLabs.limit > 0) {
    scopes.push({ key: 'elevenlabs', label: 'ElevenLabs character usage', usedUsd: elevenLabs.used, limitUsd: elevenLabs.limit, provider: 'elevenlabs', role: null })
  }

  // Auto-populate the existing manual "provider bills" table with real
  // queried spend for the providers that expose it, replacing the need to
  // remember to type it in — Stan's own framing for why this beats a
  // manually-maintained figure.
  const window = monthWindow()
  const reconciliationRows = scopes
    .filter(scope => scope.reconciliationProvider)
    .map(scope => ({
      provider: scope.reconciliationProvider,
      period_start: window.startDate,
      period_end: window.endDate,
      actual_orb_cost_usd: scope.usedUsd,
      notes: 'Auto-populated by the ORB-353 usage-check cron from the provider\'s own cost API.',
    }))
  if (reconciliationRows.length > 0) {
    const { error: reconciliationError } = await admin
      .from('orb_cost_reconciliations')
      .upsert(reconciliationRows, { onConflict: 'provider,period_start,period_end' })
    if (reconciliationError) console.error('[usage-monitor] Reconciliation upsert failed:', reconciliationError.message)
  }

  return { scopes, warningThresholdPct: policy.warningThresholdPct }
}

// scope.label alone is ambiguous for Orb's own ledger scopes ("Orb
// operational budget" doesn't say which provider backs the operational
// role) — those scopes carry a role and their label never names a
// provider. The provider-org/ElevenLabs scopes already name the provider
// directly in their label, so leave those as-is.
function scopeDisplayLabel(scope: ScopeResult): string {
  if (scope.role && scope.provider) return `${scope.label} (${providerLabel(scope.provider)})`
  return scope.label
}

async function pushAndEmailAdmins(admin: ReturnType<typeof createAdminClient>, scope: ScopeResult, percent: number) {
  const { data: admins, error: adminsError } = await admin.from('users').select('id, email').in('role_id', [1, 3])
  if (adminsError || !admins?.length) return

  const displayLabel = scopeDisplayLabel(scope)
  const providerText = scope.provider ? providerLabel(scope.provider) : 'Orb'
  const summary = `${displayLabel} approaching its limit (${percent.toFixed(0)}%) — Orb AI`
  const consoleUrl = scope.provider ? providerConsoleUrl(scope.provider) : undefined
  const consoleAction = consoleUrl
    ? `<p style="margin: 0; font-size: 15px;"><strong>Action:</strong> Review the <a href="${consoleUrl}" style="color: #2d5a2d;">${providerText} console</a>.</p>`
    : ''
  const html = `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2a332a; line-height: 1.6; background: #e8ede8;"><div style="background: #f2f5f2; border: 2px solid #7a5010; border-radius: 8px; padding: 28px;"><h2 style="margin: 0 0 16px; color: #2a332a;">${displayLabel} is approaching its limit</h2><p style="margin: 0 0 12px;">Currently at <strong>${percent.toFixed(0)}%</strong> of the configured limit ($${scope.usedUsd.toFixed(2)} of $${scope.limitUsd.toFixed(2)}).</p>${consoleAction}</div></body></html>`

  await createTicket({
    source: 'orb-auto',
    type: 'bug',
    summary,
    detail: { scope: scope.key, usedUsd: scope.usedUsd, limitUsd: scope.limitUsd, percent, provider: scope.provider, role: scope.role },
  }).catch(error => console.error('[usage-monitor] Ticket creation failed:', error))

  const resend = getResend()
  await Promise.all([
    ...admins.filter(adminUser => adminUser.email).map(adminUser =>
      resend.emails.send({ from: FROM_EMAIL, to: adminUser.email!, subject: `[Orb] ${summary}`, html })
        .catch(error => console.error('[usage-monitor] Warning email failed:', error)),
    ),
    ...admins.map(adminUser =>
      sendPushToUser(adminUser.id, { title: 'Orb AI usage warning', body: summary, tag: `orb-usage-${scope.key}`, url: '/settings/ai' })
        .catch(error => console.error('[usage-monitor] Warning push failed:', error)),
    ),
  ])
}

async function writeAutoBroadcast(admin: ReturnType<typeof createAdminClient>, warnedScopes: Array<{ scope: ScopeResult; percent: number }>) {
  const { data: existing } = await admin.from('system_settings').select('value').eq('key', 'broadcast_message').maybeSingle()
  const currentlyAutoSet = existing?.value && typeof existing.value === 'object' && (existing.value as any).source === 'auto-usage-warning'
  const currentlyAdminSet = existing?.value && typeof existing.value === 'object' && !(existing.value as any).source

  if (warnedScopes.length === 0) {
    // Nothing over threshold. Clear only if we're the one who set it —
    // never touch an admin-typed broadcast.
    if (currentlyAutoSet) await admin.from('system_settings').delete().eq('key', 'broadcast_message')
    return
  }

  // Never clobber a manually-typed announcement — push/email still fired above.
  if (currentlyAdminSet) return

  const message = warnedScopes.length === 1
    ? `${scopeDisplayLabel(warnedScopes[0].scope)} is at ${warnedScopes[0].percent.toFixed(0)}% of its limit.`
    : `${warnedScopes.length} AI usage scopes are approaching their limits: ${warnedScopes.map(w => `${scopeDisplayLabel(w.scope)} (${w.percent.toFixed(0)}%)`).join(', ')}.`

  await admin.from('system_settings').upsert({
    key: 'broadcast_message',
    value: { message, id: `auto-usage-${Date.now()}`, type: 'warning', source: 'auto-usage-warning' },
    updated_at: new Date().toISOString(),
  })
}

export async function checkAllUsageThresholds(): Promise<{ checked: number; warned: string[] }> {
  const admin = createAdminClient()
  const { scopes, warningThresholdPct } = await collectScopes(admin)
  const window = monthWindow()

  const overThreshold = scopes
    .filter(scope => scope.limitUsd > 0)
    .map(scope => ({ scope, percent: (scope.usedUsd / scope.limitUsd) * 100 }))
    .filter(({ percent }) => percent >= warningThresholdPct)

  const warned: string[] = []
  for (const { scope, percent } of overThreshold) {
    const { data: existingWarning } = await admin
      .from('orb_usage_warnings')
      .select('id')
      .eq('scope', scope.key)
      .eq('period', window.period)
      .maybeSingle()
    if (existingWarning) continue // already warned this scope this billing period

    await pushAndEmailAdmins(admin, scope, percent)
    await admin.from('orb_usage_warnings').insert({
      scope: scope.key,
      period: window.period,
      detail: { usedUsd: scope.usedUsd, limitUsd: scope.limitUsd, percent },
    })
    warned.push(scope.key)
  }

  await writeAutoBroadcast(admin, overThreshold)

  return { checked: scopes.length, warned }
}
