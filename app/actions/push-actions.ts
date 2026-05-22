'use server'

import { getAuthContext } from '@/lib/auth'
import { snapshotUrgency, checkAndNotifyEscalation } from '@/lib/push'
import type { Urgency } from '@/lib/orb-state'

/**
 * Snapshot the current urgency level. Call before a mutation.
 * Returns the urgency string so the client can pass it back after mutating.
 * Returns null on auth failure (session expired) — caller should handle gracefully.
 */
export async function getUrgencySnapshot(): Promise<Urgency | null> {
  try {
    const ctx = await getAuthContext()
    return snapshotUrgency(ctx.admin, ctx.user.id)
  } catch {
    return null
  }
}

/**
 * Check if urgency escalated since the given snapshot and send a push if so.
 * Call after a mutation completes. Fire-and-forget on the client side.
 * Silently fails on auth errors — urgency checks are non-critical.
 */
export async function notifyIfEscalated(beforeUrgency: Urgency): Promise<void> {
  try {
    const ctx = await getAuthContext()
    await checkAndNotifyEscalation(ctx.user.id, beforeUrgency, ctx.admin)
  } catch {
    // Auth expired — skip urgency check silently
  }
}
