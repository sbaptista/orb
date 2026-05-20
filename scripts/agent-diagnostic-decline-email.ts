/**
 * Agent diagnostic only — sends one test email via Resend to verify decline notifications can be delivered.
 * Usage: npx tsx scripts/agent-diagnostic-decline-email.ts [recipient@email.com]
 * Subject is always: "Agent Diagnostic: Email decline"
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { Resend } from 'resend'

config({ path: resolve(__dirname, '../.env.local') })

const TO = process.argv[2] ?? process.env.DIAGNOSTIC_EMAIL_TO
const FROM = 'Stan Baptista <noreply@stanbaptista.me>'
const SUBJECT = 'Agent Diagnostic: Email decline'

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set in .env.local')
    process.exit(1)
  }
  if (!TO) {
    console.error('Usage: npx tsx scripts/agent-diagnostic-decline-email.ts <recipient@email.com>')
    process.exit(1)
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: SUBJECT,
    html: '<p>Agent diagnostic — Resend delivery check for Orb invitation-decline notifications. Not a real decline event.</p>',
  })

  if (error) {
    console.error('Resend error:', error)
    process.exit(1)
  }

  console.log('Sent:', SUBJECT, '→', TO, 'id:', data?.id)
}

main()
