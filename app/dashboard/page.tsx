import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
import { redirect } from 'next/navigation'
import { visibleProjectsQuery } from '@/lib/projects'
import UnifiedDashboard from '@/components/UnifiedDashboard'
import PasskeyGate from '@/components/PasskeyGate'

type Product = { id: string; name: string; code: string | null; description?: string | null; created_by?: string; view_mode: 'list' | 'checklist' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/auth/login')

  const result = await resolveUser(user.id, user.email)
  if (!result.ok) redirect(result.redirectTo)

  const isAdmin = result.user.role_id === 1 || result.user.role_id === 3

  const { data } = await visibleProjectsQuery(supabase, 'id, name, code, description, created_by, view_mode')
    .eq('created_by', user.id)

  return (
    <PasskeyGate>
      <UnifiedDashboard
        initialProducts={(data ?? []) as Product[]}
        isAdmin={isAdmin}
        user={result.user}
      />
    </PasskeyGate>
  )
}
