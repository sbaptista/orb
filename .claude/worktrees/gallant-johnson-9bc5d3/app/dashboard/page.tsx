import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AmbientDashboard from '@/components/AmbientDashboard'

type Product = { id: string; name: string; code: string | null; description: string | null }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('projects')
    .select('id, name, code, description')
    .order('sort_order')

  return <AmbientDashboard initialProducts={(data ?? []) as Product[]} />
}
