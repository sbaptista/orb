'use server'

import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

const SUPER_ADMIN_ROLE_ID = 3

export async function deleteUsers(userIds: string[]) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  if (userIds.includes(ctx.user.id)) {
    return { error: 'Cannot delete yourself' }
  }

  const results = await Promise.all(userIds.map(id => deleteUser(id)))
  const failed = results.filter(r => r.error)
  if (failed.length > 0) return { error: `${failed.length} of ${userIds.length} deletions failed` }
  return { ok: true }
}

export async function deleteUser(userId: string) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  if (userId === ctx.user.id) {
    return { error: 'Cannot delete yourself' }
  }

  try {
    const { data: target } = await ctx.admin
      .from('users')
      .select('role_id, email')
      .eq('id', userId)
      .single()

    if (!target) return { error: 'User not found' }
    if (target.role_id === SUPER_ADMIN_ROLE_ID) return { error: 'Cannot delete Super Admin' }

    // Clean up user-scoped data (no FK cascade on these tables)
    for (const table of ['orb_memory', 'orb_preferences', 'orb_adaptations', 'push_subscriptions'] as const) {
      const { error } = await ctx.admin.from(table).delete().eq('user_id', userId)
      if (error) console.warn(`[deleteUser] Warning: Failed to clean ${table}:`, error.message)
    }

    const { error: dbError } = await ctx.admin
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) throw dbError

    // Also delete any invitations associated with the user's email
    if (target.email) {
      const { error: inviteDelError } = await ctx.admin
        .from('invitations')
        .delete()
        .ilike('email', target.email.trim().toLowerCase())

      if (inviteDelError) {
        console.warn('[deleteUser] Warning: Failed to delete user invitations:', inviteDelError.message)
      }
    }

    // Hard error (ORB-323 #2): a swallowed failure here is exactly what left
    // orphaned auth users with live passkeys behind ORB-321's login loop. With the
    // telemetry FKs corrected (ON DELETE SET NULL) and per-user tables cleaned above,
    // this delete is expected to succeed — so a genuine failure must surface, not warn.
    // The "already gone" case (no auth user to delete) is tolerated as success.
    const { error: authError } = await ctx.admin.auth.admin.deleteUser(userId)
    if (authError && !/not found|does not exist|user_not_found/i.test(authError.message ?? '')) {
      throw new Error(`Auth user deletion failed: ${authError.message}`)
    }

    await logAuditEvent({
      action: 'user_delete',
      table_name: 'users',
      record_id: userId,
      actor: 'admin-ui',
      user_id: ctx.user.id,
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[deleteUser] Error:', err)
    return { error: err.message }
  }
}
