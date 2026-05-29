import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsAccount from '@/components/settings/SettingsAccount'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import AppNav from '@/components/AppNav'

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
      <AppNav userInitial={userInitial} />
      <main style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-2xl) var(--sp-lg)' }}>
        <SettingsAccount />
      </main>
      <div className="tv-version-footer">
        <OrbVersionLabel className="tv-version-text" />
      </div>
    </>
  )
}
