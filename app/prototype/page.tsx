import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
import { redirect } from 'next/navigation'
import { visibleProjectsQuery } from '@/lib/projects'
import UnifiedView from '@/components/UnifiedView'

type Product = { id: string; name: string; code: string | null; view_mode: 'list' | 'checklist' }

export default async function PrototypePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/auth/login')

  const result = await resolveUser(user.id, user.email)
  if (!result.ok) redirect(result.redirectTo)

  const isAdmin = result.user.role_id === 1 || result.user.role_id === 3

  const { data } = await visibleProjectsQuery(supabase, 'id, name, code, view_mode')
    .eq('created_by', user.id)

  return <UnifiedView initialProducts={(data ?? []) as Product[]} isAdmin={isAdmin} />
}
