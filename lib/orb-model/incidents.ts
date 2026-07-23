import 'server-only'

import { createTicket } from '@/app/actions/ticket-actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { FROM_EMAIL, getResend } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import type { OrbModelProviderId } from './types'
import type { OrbModelRole } from './catalog'

type OrbIncident = {
  summary: string
  provider: OrbModelProviderId | null
  role: OrbModelRole | null
  reason: string
  detail: Record<string, unknown>
  consoleUrl?: string
}

const ACTIVE_TICKET_STATUSES = ['open', 'in_progress', 'pending', 'awaiting_input', 'pending_release', 'pending_verification', 'on_hold', 'deferred']

const PROVIDER_LABELS: Record<OrbModelProviderId, string> = {
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  mistral: 'Mistral',
  openai: 'OpenAI',
  elevenlabs: 'ElevenLabs',
  local: 'Local model',
}

const PROVIDER_CONSOLES: Partial<Record<OrbModelProviderId, string>> = {
  anthropic: 'https://console.anthropic.com',
  google: 'https://aistudio.google.com',
  mistral: 'https://console.mistral.ai',
  openai: 'https://platform.openai.com/settings/organization/billing/overview',
  elevenlabs: 'https://elevenlabs.io/app/billing',
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function providerLabel(provider: OrbModelProviderId) {
  return PROVIDER_LABELS[provider]
}

export function providerConsoleUrl(provider: OrbModelProviderId) {
  return PROVIDER_CONSOLES[provider]
}

/**
 * One open ticket per incident summary is the notification latch. It prevents
 * retries or a provider outage from turning into an email/push storm; closing
 * the ticket deliberately arms notification for a future recurrence.
 */
export async function notifyOrbIncident(incident: OrbIncident) {
  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('tickets')
    .select('id')
    .eq('source', 'orb-auto')
    .eq('summary', incident.summary)
    .in('status', ACTIVE_TICKET_STATUSES)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    console.error('[orbModel] Incident de-duplication check failed:', existingError.message)
    return
  }
  if (existing) return

  const ticketResult = await createTicket({
    source: 'orb-auto',
    type: 'bug',
    summary: incident.summary,
    detail: { ...incident.detail, provider: incident.provider, role: incident.role, reason: incident.reason, timestamp: new Date().toISOString() },
  })
  if (ticketResult.error) return

  const { data: admins, error: adminsError } = await admin.from('users').select('id, email').in('role_id', [1, 3])
  if (adminsError || !admins?.length) return

  const provider = incident.provider ? providerLabel(incident.provider) : 'Orb'
  const role = incident.role ? `${incident.role} role` : 'AI service'
  const consoleAction = incident.consoleUrl
    ? `<p style="margin: 0; font-size: 15px;"><strong>Action:</strong> Review the <a href="${incident.consoleUrl}" style="color: #2d5a2d;">${provider} console</a>.</p>`
    : ''
  const html = `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2a332a; line-height: 1.6; background: #e8ede8;"><div style="background: #f2f5f2; border: 2px solid #b66a2b; border-radius: 8px; padding: 28px;"><h2 style="margin: 0 0 16px; color: #2a332a;">Orb AI attention needed</h2><p style="margin: 0 0 12px;"><strong>${escapeHtml(provider)} ${escapeHtml(role)}</strong> is unavailable or budget-blocked.</p><p style="margin: 0 0 12px;"><strong>Reason:</strong> ${escapeHtml(incident.reason)}</p>${consoleAction}</div></body></html>`

  const resend = getResend()
  await Promise.all([
    ...admins.filter(adminUser => adminUser.email).map(adminUser =>
      resend.emails.send({ from: FROM_EMAIL, to: adminUser.email!, subject: `[Orb] ${incident.summary}`, html })
        .catch(error => console.error('[orbModel] Incident email failed:', error)),
    ),
    ...admins.map(adminUser =>
      sendPushToUser(adminUser.id, { title: 'Orb AI attention needed', body: incident.summary, tag: 'orb-incident', url: '/settings/tickets' })
        .catch(error => console.error('[orbModel] Incident push failed:', error)),
    ),
  ])
}

export function classifyProviderFailure(error: any, provider: OrbModelProviderId, role: OrbModelRole) {
  const type = String(error?.type || error?.error?.type || '')
  const message = String(error?.message || error?.error?.message || '')
  const billing = /credit balance|billing|spend cap|usage limits|quota.*(?:exceeded|limit|billing)/i.test(message)
  const rateLimited = type === 'rate_limit_error' || /rate.?limit|\b429\b|resource has been exhausted/i.test(message)
  const unavailable = /overloaded|\b500\b|\b502\b|\b503\b|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(message)
  const reason = billing ? 'billing or spend limit' : rateLimited ? 'rate limit or provider quota' : unavailable ? 'provider unavailable' : 'provider error'
  const userMessage = role === 'strategic'
    ? `Strategic reads are temporarily unavailable through ${providerLabel(provider)}. Everyday task help remains available.`
    : role === 'voice'
      ? `Realtime voice is temporarily unavailable through ${providerLabel(provider)}. Try again in a moment — text input still works.`
      : `Orb's operational assistant is temporarily unavailable through ${providerLabel(provider)}. You can still manage tasks directly in the list.`
  return {
    type,
    message,
    reason,
    userMessage,
    summary: `${providerLabel(provider)} ${role} service unavailable — Orb AI`,
    consoleUrl: billing || rateLimited ? providerConsoleUrl(provider) : undefined,
  }
}
