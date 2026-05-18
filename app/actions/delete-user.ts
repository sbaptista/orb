'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

const SUPER_ADMIN_ROLE_ID = 3
const PROTECTED_EMAILS = ['dev@localhost.me', 'owner@test.local']

export async function deleteUsers(userIds: string[]) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const results = await Promise.all(userIds.map(id => deleteUser(id)))
  const failed = results.filter(r => r.error)
  if (failed.length > 0) return { error: `${failed.length} of ${userIds.length} deletions failed` }
  return { ok: true }
}

export async function deleteUser(userId: string) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const supabase = createAdminClient()

  try {
    const { data: target } = await supabase
      .from('users')
      .select('role_id, email')
      .eq('id', userId)
      .single()

    if (!target) return { error: 'User not found' }
    if (target.role_id === SUPER_ADMIN_ROLE_ID) return { error: 'Cannot delete Super Admin' }
    if (PROTECTED_EMAILS.includes(target.email)) return { error: 'This test user cannot be deleted' }

    // Reassign shared projects to super admin before cascade delete
    const { data: superAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', SUPER_ADMIN_ROLE_ID)
      .limit(1)
      .single()

    if (superAdmin) {
      await supabase
        .from('projects')
        .update({ created_by: superAdmin.id })
        .eq('created_by', userId)
        .eq('is_shared', true)
    }

    // Delete user — cascades to their non-shared projects, todos, groups, etc.
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) throw dbError

    // Also delete from Supabase Auth so they can be re-invited cleanly
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.warn('[deleteUser] Warning: Auth user deletion failed or already deleted:', authError.message)
    }

    await logAuditEvent({
      action: 'user_delete',
      table_name: 'users',
      record_id: userId,
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[deleteUser] Error:', err)
    return { error: err.message }
  }
}
