'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

const SUPER_ADMIN_ROLE_ID = 3
const PROTECTED_EMAILS = ['dev@localhost.me', 'owner@test.local']

export async function updateUser(userId: string, data: {
  first_name?: string
  last_name?: string
  role_id?: number
}) {
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
    if (target.role_id === SUPER_ADMIN_ROLE_ID) return { error: 'Cannot modify Super Admin' }

    const isProtected = PROTECTED_EMAILS.includes(target.email)
    const update: Record<string, any> = {}

    if (data.first_name !== undefined && !isProtected) update.first_name = data.first_name
    if (data.last_name !== undefined && !isProtected) update.last_name = data.last_name
    if (data.role_id !== undefined) update.role_id = data.role_id

    if (Object.keys(update).length === 0) return { error: 'No changes to apply' }

    const { error } = await supabase
      .from('users')
      .update(update)
      .eq('id', userId)

    if (error) throw error

    await logAuditEvent({
      action: 'user_update',
      table_name: 'users',
      record_id: userId,
      after: update,
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[updateUser] Error:', err)
    return { error: err.message }
  }
}
