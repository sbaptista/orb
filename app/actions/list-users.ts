'use server'

import { requireAdmin } from '@/lib/auth'

const SUPER_ADMIN_ROLE_ID = 3

export async function listUsers(options?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message, users: [], roles: [], count: 0 }
  }

  try {
    let usersQuery = ctx.admin.from('users').select('id, email, first_name, last_name, role_id', options?.pageSize ? { count: 'exact' } : undefined).order('email')

    const search = options?.search?.trim().toLowerCase()
    if (search) {
      usersQuery = usersQuery.or(`email.ilike.*${search}*,first_name.ilike.*${search}*,last_name.ilike.*${search}*`)
    }

    if (options?.pageSize) {
      const page = Math.max(0, options.page ?? 0)
      const from = page * options.pageSize
      usersQuery = usersQuery.range(from, from + options.pageSize - 1)
    }

    const [{ data: users, count }, { data: roles }] = await Promise.all([
      usersQuery,
      ctx.admin.from('roles').select('*').order('value'),
    ])

    const isSuperAdmin = ctx.roleId === SUPER_ADMIN_ROLE_ID
    const filtered = isSuperAdmin
      ? (users ?? [])
      : (users ?? []).filter((u: any) => u.role_id !== SUPER_ADMIN_ROLE_ID)

    return { users: filtered, roles: roles ?? [], currentUserId: ctx.user.id, count: count ?? filtered.length }
  } catch (e: any) {
    console.error('[listUsers] Unexpected error:', e)
    return { error: e.message ?? 'Failed to load users', users: [], roles: [], count: 0 }
  }
}
