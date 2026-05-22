'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLE_IDS = [1, 3] // Admin, Super Admin

export type AuthContext = {
  user: { id: string; email: string }
  role: string
  roleId: number
  isAdmin: boolean
  supabase: Awaited<ReturnType<typeof createClient>>
  admin: ReturnType<typeof createAdminClient>
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', user.id)
    .single()

  const roleId = data?.role_id ?? 0
  const roleName = (data as any)?.roles?.name ?? 'unknown'

  return {
    user: { id: user.id, email: user.email ?? '' },
    role: roleName,
    roleId,
    isAdmin: ADMIN_ROLE_IDS.includes(roleId),
    supabase: supabase as any,
    admin,
  }
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx.isAdmin) throw new Error('Admin access required')
  return ctx
}
