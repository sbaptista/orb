import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import { visibleProjectsQuery } from '@/lib/projects'
import { computeOrbState, computeUrgency, type Urgency } from '@/lib/orb-state'
import { isActive } from '@/lib/status-groups'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orb-eight-lake.vercel.app'

webpush.setVapidDetails(SITE_URL, VAPID_PUBLIC, VAPID_PRIVATE)

type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send a push notification to all subscriptions for a user.
 * Automatically removes stale subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createServiceClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0 }

  const staleIds: string[] = []
  let sent = 0

  await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      }

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify(payload),
          { TTL: 60 * 60 } // 1 hour
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — mark for cleanup
          staleIds.push(sub.id)
        } else {
          console.error(`[push] Failed to send to ${sub.endpoint.slice(0, 60)}…:`, err.statusCode ?? err.message)
        }
      }
    })
  )

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  return { sent, stale: staleIds.length }
}

// ──────────────────────────────────────────────────────────────────────────
// Urgency escalation detection + push
// ──────────────────────────────────────────────────────────────────────────

/**
 * Snapshot the current urgency level for a user.
 * Call before a mutation, then pass the result to `checkAndNotifyEscalation` after.
 */
export async function snapshotUrgency(supabase: any, userId: string): Promise<Urgency> {
  const [
    { data: projects },
    { data: priorities },
    { data: userSettings },
  ] = await Promise.all([
    visibleProjectsQuery(supabase, 'id, name, code'),
    supabase.from('priorities').select('value, is_urgent'),
    supabase.from('users').select('urgency_threshold_hours').eq('id', userId).maybeSingle(),
  ])

  const projectList = projects ?? []
  const projectIds = projectList.map((p: any) => p.id).filter(Boolean)
  const { data: todos } = projectIds.length > 0
    ? await supabase
      .from('todos')
      .select('status, priority_value, due_at, product_id')
      .in('product_id', projectIds)
      .is('deleted_at', null)
    : { data: [] }
  const todoList = todos ?? []
  const urgentValues = new Set<number>(
    (priorities ?? []).filter((p: any) => p.is_urgent).map((p: any) => p.value as number)
  )
  const thresholdHours = userSettings?.urgency_threshold_hours ?? 24

  return computeUrgency(todoList, urgentValues, thresholdHours)
}

/**
 * Compare before/after urgency and send a push notification if it escalated.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function checkAndNotifyEscalation(
  userId: string,
  beforeUrgency: Urgency,
  supabase: any,
): Promise<void> {
  try {
    const afterUrgency = await snapshotUrgency(supabase, userId)

    const SEVERITY: Record<Urgency, number> = { calm: 0, busy: 1, urgent: 2 }
    if (SEVERITY[afterUrgency] <= SEVERITY[beforeUrgency]) return

    // Count active todos for the notification body, scoped to visible projects.
    const { data: projects } = await visibleProjectsQuery(supabase, 'id')
    const projectIds = (projects ?? []).map((p: any) => p.id).filter(Boolean)
    const { data: todos } = projectIds.length > 0
      ? await supabase
        .from('todos')
        .select('status')
        .in('product_id', projectIds)
        .is('deleted_at', null)
      : { data: [] }

    const activeCount = (todos ?? []).filter((t: any) => isActive(t.status)).length

    await sendPushToUser(userId, {
      title: afterUrgency === 'urgent' ? 'Orb is urgent' : 'Orb shifted to busy',
      body: afterUrgency === 'urgent'
        ? `${activeCount} active task${activeCount !== 1 ? 's' : ''} — urgent items need attention`
        : `${activeCount} active task${activeCount !== 1 ? 's' : ''} in your backlog`,
      tag: `orb-state-${afterUrgency}`,
      url: '/',
    })
  } catch (err) {
    console.error('[push] Urgency escalation check failed:', err)
  }
}
