import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsAccount from '@/components/settings/SettingsAccount'
import AppNav from '@/components/AppNav'
import MuralCanvas from '@/components/MuralCanvas'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('first_name, email')
    .eq('id', user.id)
    .single()

  const userInitial = (profile?.first_name || profile?.email || '?').charAt(0).toUpperCase()

  return (
    <>
      <MuralCanvas urgency="calm" />
      <AppNav userInitial={userInitial} />
      <main className="account-main">
        <SettingsAccount />
      </main>
    </>
  )
}
