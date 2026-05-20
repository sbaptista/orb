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

    const { error: dbError } = await ctx.admin
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) throw dbError

    const { error: authError } = await ctx.admin.auth.admin.deleteUser(userId)
    if (authError) {
      console.warn('[deleteUser] Warning: Auth user deletion failed or already deleted:', authError.message)
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
