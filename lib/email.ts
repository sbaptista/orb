import { Resend } from 'resend'
import { createHmac } from 'crypto'

let _resend: Resend | null = null
export function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export const FROM_EMAIL = 'Stan Baptista <noreply@stanbaptista.me>'
function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.NODE_ENV === 'development') return 'https://localhost:3001'
  return 'https://orb-eight-lake.vercel.app'
}
const SITE_URL = getSiteUrl()
export const ICON_URL = `${SITE_URL}/apple-icon`

export async function sendInviteEmail({
  to,
  firstName,
  inviteLink,
  declineLink,
}: {
  to: string
  firstName: string
  inviteLink: string
  declineLink: string
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
  <div style="text-align: center; margin-bottom: 28px;">
    <img src="${ICON_URL}" alt="Orb" width="64" height="64" style="border-radius: 50%;" />
  </div>

  <p>Hi ${firstName},</p>

  <p>I'm inviting you to try Orb, a web application I've been building. It's a conversational task manager — you talk to it like a chat and it manages your backlog. It's still in its early stages and may contain bugs. If something breaks, tell me. If something works well, tell me that too!</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: #2d5a2d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Get started with Orb</a>
  </div>

  <h3 style="margin-top: 28px; margin-bottom: 12px;">A few things to know:</h3>
  <p style="margin-bottom: 12px;"><strong>Your data is visible to me.</strong> As the developer and admin, I can see your projects and tasks. This helps me improve the app and troubleshoot issues. I won't share your data with anyone. Please do not put any confidential information in Orb.</p>
  <p style="margin-bottom: 12px;"><strong>Availability is not guaranteed.</strong> Orb is a personal project under active development. Features may change, and access may be modified or discontinued at any time. Think of it as an early preview — not a permanent service.</p>

  <p style="font-size: 14px; color: #555;">Orb works on most modern browsers. For example: Safari, Chrome, Firefox, and Edge.</p>

  <h3 style="margin-top: 28px; margin-bottom: 12px;">How to give feedback:</h3>
  <p>Just tell Orb. Say something like <em>"I have a suggestion"</em> or <em>"something's broken"</em> — it'll log it automatically and it goes straight to me.</p>

  <p style="margin-top: 28px;"><strong>Not interested?</strong><br/>No pressure — <a href="${declineLink}" style="color: #666;">click here to decline</a>.</p>

  <p style="margin-top: 28px;">I'm watching closely and iterating fast. I hope you'll give it a try!</p>

  <p>— Stan</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'An invitation to try Orb',
    html,
  })

  if (error) {
    console.error('[sendInviteEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

export async function sendTicketNotificationEmail({
  to,
  ticket,
  origin,
}: {
  to: string
  ticket: {
    source: string
    type: string
    summary: string
    detail?: any
    conversation_snippet?: string | null
  }
  origin?: string
}) {
  let typeBg = '#4a5568'
  switch (ticket.type) {
    case 'bug': typeBg = '#e53e3e'; break
    case 'suggestion': typeBg = '#3182ce'; break
    case 'capability_gap': typeBg = '#805ad5'; break
    case 'workflow_friction': typeBg = '#dd6b20'; break
  }

  const detailHtml = ticket.detail && Object.keys(ticket.detail).length > 0
    ? `<div style="margin-top: 16px;">
        <strong style="font-size: 14px; color: #4a5568; display: block; margin-bottom: 4px;">Detail JSON:</strong>
        <pre style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto; margin: 0; color: #2d3748;">${JSON.stringify(ticket.detail, null, 2)}</pre>
       </div>`
    : ''

  const snippetHtml = ticket.conversation_snippet
    ? `<div style="margin-top: 16px;">
        <strong style="font-size: 14px; color: #4a5568; display: block; margin-bottom: 4px;">Conversation Context:</strong>
        <div style="background: #f7fafc; border-left: 4px solid #cbd5e0; border-radius: 0 6px 6px 0; padding: 12px; font-style: italic; font-size: 14px; color: #2d3748; line-height: 1.5;">
          "${ticket.conversation_snippet}"
        </div>
       </div>`
    : ''

  const siteUrl = origin ?? SITE_URL
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2d3748; line-height: 1.6; background-color: #f7fafc;">
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${ICON_URL}" alt="Orb" width="48" height="48" style="border-radius: 50%;" />
      <h2 style="margin-top: 12px; margin-bottom: 4px; color: #1a202c; font-size: 20px; font-weight: 700;">New Feedback Received</h2>
      <p style="margin: 0; color: #718096; font-size: 14px;">A new feedback item has been added to the Tickets project.</p>
    </div>

    <div style="border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 20px 0; margin: 20px 0;">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; padding: 4px 10px; background-color: ${typeBg}; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px;">
          ${ticket.type.replace('_', ' ')}
        </span>
        <span style="display: inline-block; padding: 4px 10px; background-color: #edf2f7; color: #4a5568; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
          Source: ${ticket.source}
        </span>
      </div>

      <h3 style="margin: 0 0 12px 0; color: #2d3748; font-size: 18px; font-weight: 600; line-height: 1.4;">
        ${ticket.summary}
      </h3>

      ${snippetHtml}
      ${detailHtml}
    </div>

    <div style="text-align: center; margin-top: 28px;">
      <a href="${siteUrl}/dashboard" style="display: inline-block; padding: 12px 28px; background: #5a3090; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(90, 48, 144, 0.2);">
        View in Orb
      </a>
    </div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">
    Sent automatically by Orb task manager.
  </p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Orb Feedback] ${ticket.type.replace(/_/g, ' ').toUpperCase()}: ${ticket.summary}`,
    html,
  })

  if (error) {
    console.error('[sendTicketNotificationEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function invitationDisplayName(inv: {
  first_name: string | null
  last_name: string | null
  email: string
}): string {
  const full = [inv.first_name, inv.last_name].filter(Boolean).join(' ').trim()
  return full || inv.email
}

type InvitationEmailPayload = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  release_stage: string | null
  responded_at: string
  decline_reason?: string | null
}

function invitationNotificationHtml(
  title: string,
  subtitle: string,
  accentBg: string,
  inv: InvitationEmailPayload,
  extraBody?: string,
): string {
  const name = escapeHtml(invitationDisplayName(inv))
  const email = escapeHtml(inv.email)
  const stage = escapeHtml(inv.release_stage ?? 'alpha')
  const responded = escapeHtml(new Date(inv.responded_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2d3748; line-height: 1.6; background-color: #f7fafc;">
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${ICON_URL}" alt="Orb" width="48" height="48" style="border-radius: 50%;" />
      <h2 style="margin-top: 12px; margin-bottom: 4px; color: #1a202c; font-size: 20px; font-weight: 700;">${title}</h2>
      <p style="margin: 0; color: #718096; font-size: 14px;">${subtitle}</p>
    </div>

    <div style="border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 20px 0; margin: 20px 0;">
      <span style="display: inline-block; padding: 4px 10px; background-color: ${accentBg}; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
        ${stage}
      </span>
      <h3 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px; font-weight: 600;">${name}</h3>
      <p style="margin: 0 0 4px 0; color: #4a5568; font-size: 15px;"><a href="mailto:${email}" style="color: #2d5a2d;">${email}</a></p>
      <p style="margin: 12px 0 0 0; color: #718096; font-size: 14px;">Responded: ${responded}</p>
      ${extraBody ?? ''}
    </div>

  </div>
  <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">
    Sent automatically by Orb.
  </p>
</body>
</html>`
}

export async function sendInvitationAcceptedEmail({
  to,
  invitation,
}: {
  to: string
  invitation: InvitationEmailPayload
}) {
  const name = invitationDisplayName(invitation)
  const html = invitationNotificationHtml(
    'Invitation Accepted',
    'Someone accepted an Orb invitation and can now sign in.',
    '#2d5a2d',
    invitation,
  )

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Orb] Invitation accepted: ${name}`,
    html,
  })

  if (error) {
    console.error('[sendInvitationAcceptedEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

export async function sendInvitationDeclinedEmail({
  to,
  invitation,
}: {
  to: string
  invitation: InvitationEmailPayload
}) {
  const name = invitationDisplayName(invitation)
  const reasonHtml = invitation.decline_reason
    ? `<div style="margin-top: 16px; background: #f7fafc; border-left: 4px solid #cbd5e0; border-radius: 0 6px 6px 0; padding: 12px;">
        <strong style="font-size: 14px; color: #4a5568; display: block; margin-bottom: 4px;">Decline reason</strong>
        <p style="margin: 0; font-size: 14px; color: #2d3748;">${escapeHtml(invitation.decline_reason)}</p>
       </div>`
    : ''

  const html = invitationNotificationHtml(
    'Invitation Declined',
    'Someone declined an Orb invitation.',
    '#4a5568',
    invitation,
    reasonHtml,
  )

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Orb] Invitation declined: ${name}`,
    html,
  })

  if (error) {
    console.error('[sendInvitationDeclinedEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

// ── Orb Digest ──

type DigestProject = {
  code: string
  name: string
  count: number
  urgency: 'calm' | 'busy' | 'urgent'
}

const URGENCY_COLOR: Record<string, string> = {
  calm: '#6a9a7a',
  busy: '#B8860B',
  urgent: '#c0392b',
}

const URGENCY_BG: Record<string, string> = {
  calm: '#e8f0e8',
  busy: '#fdf6e3',
  urgent: '#fde8e8',
}

export async function sendDigestEmail({
  to,
  firstName,
  projects,
  overallCount,
  overallUrgency,
}: {
  to: string
  firstName: string
  projects: DigestProject[]
  overallCount: number
  overallUrgency: 'calm' | 'busy' | 'urgent'
}) {
  const projectRows = projects
    .filter(p => p.count > 0)
    .map(p => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #edf2f7; font-family: monospace; font-weight: 600; font-size: 14px; color: #2d3748;">${escapeHtml(p.code)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568;">${escapeHtml(p.name)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #edf2f7; text-align: center; font-weight: 600; font-size: 14px;">${p.count}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #edf2f7; text-align: center;">
          <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${URGENCY_BG[p.urgency]}; color: ${URGENCY_COLOR[p.urgency]};">
            ${p.urgency}
          </span>
        </td>
      </tr>
    `)
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2d3748; line-height: 1.6; background-color: #f7fafc;">
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${ICON_URL}" alt="Orb" width="48" height="48" style="border-radius: 50%;" />
    </div>

    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; width: 72px; height: 72px; border-radius: 50%; background: radial-gradient(circle at 36% 30%, #ffffff, ${URGENCY_BG[overallUrgency]} 45%, ${URGENCY_COLOR[overallUrgency]} 100%); line-height: 72px; text-align: center; font-size: 24px; font-weight: 700; color: #ffffff; box-shadow: 0 0 20px ${URGENCY_COLOR[overallUrgency]}40;">
        ${overallCount}
      </div>
      <p style="margin: 12px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: ${URGENCY_COLOR[overallUrgency]};">${overallUrgency}</p>
    </div>

    <p style="margin: 0 0 20px; color: #4a5568; font-size: 15px;">Hi ${escapeHtml(firstName)}, here's your Orb snapshot — ${overallCount} active task${overallCount !== 1 ? 's' : ''} across ${projects.filter(p => p.count > 0).length} project${projects.filter(p => p.count > 0).length !== 1 ? 's' : ''}.</p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f7fafc;">
          <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #718096; border-bottom: 2px solid #e2e8f0;">Code</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #718096; border-bottom: 2px solid #e2e8f0;">Project</th>
          <th style="padding: 8px 12px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #718096; border-bottom: 2px solid #e2e8f0;">Active</th>
          <th style="padding: 8px 12px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #718096; border-bottom: 2px solid #e2e8f0;">State</th>
        </tr>
      </thead>
      <tbody>
        ${projectRows || '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #a0aec0;">All clear — nothing active.</td></tr>'}
      </tbody>
    </table>

    <div style="text-align: center; margin-top: 28px;">
      <a href="${SITE_URL}" style="display: inline-block; padding: 12px 28px; background: #2d5a2d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Open Orb
      </a>
    </div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">
    Sent automatically by Orb.
  </p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Orb] ${overallUrgency === 'urgent' ? '🔴' : overallUrgency === 'busy' ? '🟡' : '🟢'} ${overallCount} active — ${overallUrgency}`,
    html,
  })

  if (error) {
    console.error('[sendDigestEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}


// ── Welcome Email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({
  to,
  firstName,
}: {
  to: string
  firstName: string
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
  <div style="text-align: center; margin-bottom: 28px;">
    <img src="${ICON_URL}" alt="Orb" width="64" height="64" style="border-radius: 50%;" />
  </div>

  <p>Hi ${escapeHtml(firstName)},</p>

  <p>You're all set! Orb is a conversational task manager — just talk to it and it'll manage your backlog.</p>

  <p>To give feedback or report a bug, just tell Orb.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${SITE_URL}" style="display: inline-block; padding: 14px 32px; background: #2d5a2d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Open Orb</a>
  </div>

  <p>— Stan</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Welcome to Orb',
    html,
  })

  if (error) {
    console.error('[sendWelcomeEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

// ── Ticket Acknowledgment Email (step 1 — reporter) ─────────────────────────

export async function sendTicketAcknowledgmentEmail({
  to,
  firstName,
  summary,
  ticketCode,
}: {
  to: string
  firstName: string
  summary: string
  ticketCode: string
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
  <div style="text-align: center; margin-bottom: 28px;">
    <img src="${ICON_URL}" alt="Orb" width="64" height="64" style="border-radius: 50%;" />
  </div>

  <p>Hi ${escapeHtml(firstName)},</p>

  <p>Thanks for letting us know. Your feedback has been logged and we'll take a look.</p>

  <p style="background: #f7fafc; border-left: 4px solid #cbd5e0; border-radius: 0 6px 6px 0; padding: 12px; font-style: italic; color: #2d3748;">&ldquo;${escapeHtml(summary)}&rdquo;</p>

  <p style="font-size: 13px; color: #888; margin-top: 24px;">Ref: ${escapeHtml(ticketCode)}</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: '[Orb] We received your feedback',
    html,
  })

  if (error) {
    console.error('[sendTicketAcknowledgmentEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

// ── Ticket Status Email (steps 3 & 5a — reporter) ───────────────────────────

export async function sendTicketStatusEmail({
  to,
  firstName,
  status,
  summary,
  ticketCode,
  version,
  dismissReason,
  emailMessageOverride,
}: {
  to: string
  firstName: string
  status: string
  summary: string
  ticketCode: string
  version?: string
  dismissReason?: string
  emailMessageOverride?: string
}) {
  let subject = '[Orb] Update on your feedback'
  if (status === 'in_progress') {
    subject = "[Orb] We're working on your feedback"
  } else if (status === 'closed') {
    subject = '[Orb] Your feedback has been addressed'
  } else if (status === 'dismissed') {
    subject = '[Orb] Update on your feedback'
  }

  let bodyText: string
  if (emailMessageOverride) {
    // Override raw text converts newlines to HTML breaks
    bodyText = escapeHtml(emailMessageOverride).replace(/\n/g, '<br/>')
  } else {
    switch (status) {
      case 'in_progress':
        bodyText = `We've started working on your feedback: &ldquo;${escapeHtml(summary)}&rdquo;. We'll let you know when it's resolved.`
        break
      case 'closed':
        if (version) {
          bodyText = `We have addressed your feedback: &ldquo;${escapeHtml(summary)}&rdquo;</p><p>This change is included in version ${escapeHtml(version)}.</p><p>Thanks for helping us improve Orb.`
        } else {
          bodyText = `We have addressed your feedback: &ldquo;${escapeHtml(summary)}&rdquo;. Thanks for helping us improve Orb.`
        }
        break
      case 'dismissed':
        bodyText = `We reviewed your feedback: &ldquo;${escapeHtml(summary)}&rdquo;. After consideration, we've decided not to act on this at this time.`
        if (dismissReason) {
          bodyText += `</p><p><strong>Explanation:</strong><br/>${escapeHtml(dismissReason)}`
        }
        break
      default:
        bodyText = `We reviewed your feedback: &ldquo;${escapeHtml(summary)}&rdquo; and placed it on status ${escapeHtml(status.replace('_', ' '))}.`
        break
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
  <div style="text-align: center; margin-bottom: 28px;">
    <img src="${ICON_URL}" alt="Orb" width="64" height="64" style="border-radius: 50%;" />
  </div>

  <p>Hi ${escapeHtml(firstName)},</p>

  <p>${bodyText}</p>

  <p style="font-size: 13px; color: #888; margin-top: 24px;">Ref: ${escapeHtml(ticketCode)}</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[sendTicketStatusEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

// ── Ticket Declined Email (step 5b — reporter) ──────────────────────────────
// Only sent when dismiss_reason is provided. Silent dismiss = no email.

export async function sendTicketDeclinedEmail({
  to,
  firstName,
  summary,
  dismissReason,
  ticketCode,
  emailMessageOverride,
}: {
  to: string
  firstName: string
  summary: string
  dismissReason: string
  ticketCode: string
  emailMessageOverride?: string
}) {
  const bodyContent = emailMessageOverride
    ? escapeHtml(emailMessageOverride).replace(/\n/g, '<br/>')
    : `After consideration, we've decided not to act on this at this time.</p><p><strong>Explanation:</strong><br/>${escapeHtml(dismissReason)}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
  <div style="text-align: center; margin-bottom: 28px;">
    <img src="${ICON_URL}" alt="Orb" width="64" height="64" style="border-radius: 50%;" />
  </div>

  <p>Hi ${escapeHtml(firstName)},</p>

  <p>We reviewed your feedback: &ldquo;${escapeHtml(summary)}&rdquo;</p>

  <p>${bodyContent}</p>

  <p>We appreciate you taking the time to share your thoughts.</p>

  <p style="font-size: 13px; color: #888; margin-top: 24px;">Ref: ${escapeHtml(ticketCode)}</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: '[Orb] Update on your feedback',
    html,
  })

  if (error) {
    console.error('[sendTicketDeclinedEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

// ── Adaptation Emails (ORB-266) ────────────────────────────────────────

export function signAdaptationAction(id: string, action: string): string {
  const secret = process.env.SUPABASE_SECRET_KEY ?? ''
  return createHmac('sha256', secret).update(`${id}:${action}`).digest('hex').slice(0, 16)
}

export async function sendAdaptationEmail({
  to,
  adaptation,
  origin,
}: {
  to: string
  adaptation: {
    id: string
    title: string
    rule: string
    rationale: string
    category: string
  }
  origin?: string
}) {
  const siteUrl = origin ?? SITE_URL
  const activateSig = signAdaptationAction(adaptation.id, 'activate')
  const rejectSig = signAdaptationAction(adaptation.id, 'reject')
  const activateUrl = `${siteUrl}/api/orb-adaptation?id=${adaptation.id}&action=activate&sig=${activateSig}`
  const rejectUrl = `${siteUrl}/api/orb-adaptation?id=${adaptation.id}&action=reject&sig=${rejectSig}`

  const categoryLabel = adaptation.category.charAt(0).toUpperCase() + adaptation.category.slice(1)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2d3748; line-height: 1.6; background-color: #f7fafc;">
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${ICON_URL}" alt="Orb" width="48" height="48" style="border-radius: 50%;" />
      <h2 style="margin-top: 12px; margin-bottom: 4px; color: #1a202c; font-size: 20px; font-weight: 700;">Orb Proposed an Adaptation</h2>
      <p style="margin: 0; color: #718096; font-size: 14px;">The Orb wants to improve how it works with you.</p>
    </div>

    <div style="border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 20px 0; margin: 20px 0;">
      <span style="display: inline-block; padding: 4px 10px; background-color: #5a3090; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
        ${escapeHtml(categoryLabel)}
      </span>

      <h3 style="margin: 0 0 12px 0; color: #2d3748; font-size: 18px; font-weight: 600; line-height: 1.4;">
        ${escapeHtml(adaptation.title)}
      </h3>

      <div style="margin-bottom: 16px;">
        <strong style="font-size: 14px; color: #4a5568; display: block; margin-bottom: 4px;">Rule:</strong>
        <div style="background: #f7fafc; border-left: 4px solid #5a3090; border-radius: 0 6px 6px 0; padding: 12px; font-size: 14px; color: #2d3748; line-height: 1.5;">
          ${escapeHtml(adaptation.rule)}
        </div>
      </div>

      <div>
        <strong style="font-size: 14px; color: #4a5568; display: block; margin-bottom: 4px;">Why:</strong>
        <p style="margin: 0; font-size: 14px; color: #4a5568; font-style: italic;">
          ${escapeHtml(adaptation.rationale)}
        </p>
      </div>
    </div>

    <div style="text-align: center; margin-top: 28px;">
      <a href="${activateUrl}" style="display: inline-block; padding: 12px 28px; background: #2d5a2d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin-right: 12px;">
        Activate
      </a>
      <a href="${rejectUrl}" style="display: inline-block; padding: 12px 28px; background: #e2e8f0; color: #4a5568; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Reject
      </a>
    </div>
  </div>
  <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">
    Sent automatically by Orb. Only activated adaptations influence the Orb's behavior.
  </p>
</body>
</html>`

  const { data, error: emailErr } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Orb] Adaptation proposed: ${adaptation.title}`,
    html,
  })

  if (emailErr) {
    console.error('[sendAdaptationEmail] Resend error:', emailErr)
    return { error: emailErr.message }
  }

  return { ok: true, messageId: data?.id }
}
