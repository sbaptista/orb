'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRoleInspectRepository } from '@/lib/repository-access'

const ADMIN_ROLE_IDS = [1, 3] // Admin, Super Admin

export type AuthContext = {
  user: { id: string; email: string }
  role: string
  roleId: number
  isAdmin: boolean
  canInspectRepository: boolean
  supabase: Awaited<ReturnType<typeof createClient>>
  admin: ReturnType<typeof createAdminClient>
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  // ORB-312: verify the JWT locally (ES256 via cached JWKS) instead of a network
  // getUser() round-trip on every authed server action. getClaims() falls back to
  // getUser() automatically if local verification isn't possible (symmetric key /
  // no WebCrypto), so this cannot break auth — worst case, no speedup.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (claimsError || !claims?.sub) throw new Error('Not authenticated')
  const userId = claims.sub
  const userEmail = typeof claims.email === 'string' ? claims.email : ''

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', userId)
    .single()

  const roleId = data?.role_id ?? 0
  const roleName = (data as any)?.roles?.name ?? 'unknown'

  return {
    user: { id: userId, email: userEmail },
    role: roleName,
    roleId,
    isAdmin: ADMIN_ROLE_IDS.includes(roleId),
    canInspectRepository: canRoleInspectRepository(roleName),
    supabase: supabase as any,
    admin,
  }
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx.isAdmin) throw new Error('Admin access required')
  return ctx
}
