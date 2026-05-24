import { createClient } from '@/lib/supabase/server'
import SettingsProjects from '@/components/settings/SettingsProjects'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', user.id)
      .single()
    isAdmin = data?.role_id === 1 || data?.role_id === 3
  }

  return <SettingsProjects isAdmin={isAdmin} userId={user?.id} />
}
