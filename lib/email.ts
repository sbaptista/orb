import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM = 'Stan Baptista <noreply@stanbaptista.me>'
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
  <p>Just tell Orb. Say <em>"Add task to Orb Feedback: [your observation]."</em> That's it — it goes straight to me.</p>

  <p style="margin-top: 28px;"><strong>Not interested?</strong><br/>No pressure — <a href="${declineLink}" style="color: #666;">click here to decline</a>.</p>

  <p style="margin-top: 28px;">I'm watching closely and iterating fast. I hope you'll give it a try!</p>

  <p>— Stan</p>
</body>
</html>`

  const { data, error } = await getResend().emails.send({
    from: FROM,
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
