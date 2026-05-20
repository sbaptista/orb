import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export const FROM_EMAIL = 'Stan Baptista <noreply@stanbaptista.me>'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orb-eight-lake.vercel.app'
const ICON_URL = `${SITE_URL}/apple-icon`

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

  <p style="font-size: 14px; color: #555;">Orb works on most modern browsers: Safari, Chrome, Firefox, Edge, and Comet. On iPhone or iPad, you can install it as an app — open the link above in Safari, then tap Share → Add to Home Screen.</p>

  <h3 style="margin-top: 28px; margin-bottom: 12px;">How to give feedback:</h3>
  <p>Just tell Orb. Say something like <em>"I have a suggestion"</em> or <em>"something's broken"</em> — it'll log a ticket automatically and it goes straight to me.</p>

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
}: {
  to: string
  ticket: {
    id: string
    source: string
    type: string
    summary: string
    detail?: any
    conversation_snippet?: string | null
  }
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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #2d3748; line-height: 1.6; background-color: #f7fafc;">
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${ICON_URL}" alt="Orb" width="48" height="48" style="border-radius: 50%;" />
      <h2 style="margin-top: 12px; margin-bottom: 4px; color: #1a202c; font-size: 20px; font-weight: 700;">New Ticket Received</h2>
      <p style="margin: 0; color: #718096; font-size: 14px;">A new feedback or issue ticket has been submitted to the backlog.</p>
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
      <a href="${SITE_URL}/settings/tickets" style="display: inline-block; padding: 12px 28px; background: #5a3090; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(90, 48, 144, 0.2);">
        View Tickets Dashboard
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
    subject: `[Orb Ticket] ${ticket.type.toUpperCase()}: ${ticket.summary}`,
    html,
  })

  if (error) {
    console.error('[sendTicketNotificationEmail] Resend error:', error)
    return { error: error.message }
  }

  return { ok: true, messageId: data?.id }
}

