import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
import { redirect } from 'next/navigation'
import { visibleProjectsQuery } from '@/lib/projects'
import AmbientDashboard from '@/components/AmbientDashboard'

type Product = { id: string; name: string; code: string | null; description: string | null; created_by: string }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/auth/login')

  const result = await resolveUser(user.id, user.email)
  if (!result.ok) redirect(result.redirectTo)

  const isAdmin = result.user.role_id === 1 || result.user.role_id === 3

  // Always scope dashboard to the user's own projects — admins use TodoView search for others
  const query = visibleProjectsQuery(supabase, 'id, name, code, description, created_by')
  const { data } = await query.eq('created_by', user.id)

  return <AmbientDashboard initialProducts={(data ?? []) as Product[]} isAdmin={isAdmin} />
}
