import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardProducts from '@/components/DashboardProducts'

export default async function ClassicDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <DashboardProducts />
}
