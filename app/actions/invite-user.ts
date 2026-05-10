'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export async function inviteUser(email: string, firstName: string, lastName: string, roleId: number) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const supabase = createAdminClient()

  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authErr) throw authErr
    if (!authData.user) return { error: 'Failed to create user' }

    const { error: userErr } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
      })

    if (userErr) throw userErr

    await logAuditEvent({
      action: 'user_invite',
      table_name: 'users',
      record_id: authData.user.id,
      after: { email, first_name: firstName, last_name: lastName, role_id: roleId },
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[inviteUser] Error:', err)
    return { error: err.message }
  }
}
