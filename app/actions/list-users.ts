'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'

export async function listUsers() {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message, users: [], roles: [] }
  }

  const admin = createAdminClient()
  const [{ data: users }, { data: roles }] = await Promise.all([
    admin.from('users').select('id, email, first_name, last_name, role_id').order('email'),
    admin.from('roles').select('*').order('value'),
  ])

  return { users: users ?? [], roles: roles ?? [] }
}
