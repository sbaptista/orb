'use server'

import { requireAdmin } from '@/lib/auth'

const SUPER_ADMIN_ROLE_ID = 3

export async function listUsers() {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message, users: [], roles: [] }
  }

  try {
    const [{ data: users }, { data: roles }] = await Promise.all([
      ctx.admin.from('users').select('id, email, first_name, last_name, role_id').order('email'),
      ctx.admin.from('roles').select('*').order('value'),
    ])

    const isSuperAdmin = ctx.roleId === SUPER_ADMIN_ROLE_ID
    const filtered = isSuperAdmin
      ? (users ?? [])
      : (users ?? []).filter((u: any) => u.role_id !== SUPER_ADMIN_ROLE_ID)

    return { users: filtered, roles: roles ?? [], currentUserId: ctx.user.id }
  } catch (e: any) {
    console.error('[listUsers] Unexpected error:', e)
    return { error: e.message ?? 'Failed to load users', users: [], roles: [] }
  }
}
