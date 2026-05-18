'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'

const SUPER_ADMIN_ROLE_ID = 3

export async function listUsers() {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message, users: [], roles: [] }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated', users: [], roles: [] }

    const admin = createAdminClient()

    const [{ data: requester }, { data: users }, { data: roles }] = await Promise.all([
      admin.from('users').select('role_id').eq('id', user.id).single(),
      admin.from('users').select('id, email, first_name, last_name, role_id').order('email'),
      admin.from('roles').select('*').order('value'),
    ])

    const isSuperAdmin = requester?.role_id === SUPER_ADMIN_ROLE_ID
    const filtered = isSuperAdmin
      ? (users ?? [])
      : (users ?? []).filter((u: any) => u.role_id !== SUPER_ADMIN_ROLE_ID)

    return { users: filtered, roles: roles ?? [] }
  } catch (e: any) {
    console.error('[listUsers] Unexpected error:', e)
    return { error: e.message ?? 'Failed to load users', users: [], roles: [] }
  }
}
