import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendInvitationAcceptedEmail,
  sendInvitationDeclinedEmail,
} from '@/lib/email'

export type NotificationEvent =
  | 'invitation.accepted'
  | 'invitation.declined'

export type InvitationNotificationPayload = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  release_stage: string | null
  responded_at: string
  decline_reason?: string | null
}

const ADMIN_ROLE_IDS = [1, 3]

export async function getAdminEmails(): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('email')
    .in('role_id', ADMIN_ROLE_IDS)

  if (error) {
    console.error('[getAdminEmails] Failed to fetch admins:', error)
    return []
  }

  return (data ?? []).map(u => u.email).filter(Boolean) as string[]
}

export async function dispatchNotification(
  event: NotificationEvent,
  payload: InvitationNotificationPayload,
): Promise<void> {
  console.log(`[dispatchNotification] Event: ${event}, Payload:`, JSON.stringify(payload))
  try {
    let origin: string | undefined
    try {
      const headersList = await headers()
      const host = headersList.get('x-forwarded-host') || headersList.get('host')
      const protocol = headersList.get('x-forwarded-proto') || 'https'
      if (host) {
        origin = `${protocol}://${host}`
      }
    } catch {
      // Ignore if headers() throws outside request context (e.g. scripts/cron)
    }

    const recipients = await getAdminEmails()
    console.log(`[dispatchNotification] Resolved admin emails:`, recipients, `Origin:`, origin)
    if (recipients.length === 0) {
      console.warn(`[dispatchNotification] No admin emails for event ${event}`)
      return
    }

    const send = event === 'invitation.accepted'
      ? sendInvitationAcceptedEmail
      : sendInvitationDeclinedEmail

    await Promise.all(
      recipients.map(async email => {
        try {
          console.log(`[dispatchNotification] Sending ${event} email to ${email} (origin: ${origin || 'default'})...`)
          const result = await send({ to: email, invitation: payload, origin })
          console.log(`[dispatchNotification] Send result for ${email}:`, JSON.stringify(result))
          if (result && 'error' in result && result.error) {
            console.error(`[dispatchNotification] ${event} email failed for ${email}:`, result.error)
          }
        } catch (err) {
          console.error(`[dispatchNotification] ${event} email failed for ${email}:`, err)
        }
      }),
    )
  } catch (err) {
    console.error(`[dispatchNotification] Unexpected error for ${event}:`, err)
  }
}
