import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ROLE_IDS = [1, 3] // Admin, Super Admin

export async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()

  if (!data || !ADMIN_ROLE_IDS.includes(data.role_id)) {
    throw new Error('Admin access required')
  }
}

export async function getSessionRole(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()
  return data?.role_id ?? null
}
