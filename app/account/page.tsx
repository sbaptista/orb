import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsAccount from '@/components/settings/SettingsAccount'
import AppNav from '@/components/AppNav'
import MuralCanvas from '@/components/MuralCanvas'
import { getAppNavContext } from '@/lib/app-nav-context'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navContext = await getAppNavContext(supabase, user.id)

  return (
    <>
      <MuralCanvas urgency="calm" />
      <AppNav
        userInitial={navContext.userInitial}
        userName={navContext.userName}
        printContext={navContext.printContext}
      />
      <main className="account-main">
        <SettingsAccount />
      </main>
    </>
  )
}
