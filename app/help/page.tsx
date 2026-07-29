import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrbHelp from '@/components/OrbHelp'
import AppNav from '@/components/AppNav'
import { getAppNavContext } from '@/lib/app-nav-context'

export default async function HelpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navContext = await getAppNavContext(supabase, user.id)

  return (
    <>
      <AppNav
        userInitial={navContext.userInitial}
        userName={navContext.userName}
        printContext={navContext.printContext}
      />
      <OrbHelp />
    </>
  )
}
