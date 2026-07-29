import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsSidebar from '@/components/settings/SettingsSidebar'
import AppNav from '@/components/AppNav'
import { UnsavedChangesProvider } from '@/lib/hooks/useUnsavedChanges'
import { getAppNavContext } from '@/lib/app-nav-context'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navContext = await getAppNavContext(supabase, user.id)

  return (
    <UnsavedChangesProvider>
      <div className="sl-page">
        <AppNav
          userInitial={navContext.userInitial}
          userName={navContext.userName}
          printContext={navContext.printContext}
        />

        <div className="sl-body settings-shell">
          <SettingsSidebar isAdmin={navContext.isAdmin} />
          <main className="sl-main">{children}</main>
        </div>
      </div>
    </UnsavedChangesProvider>
  )
}
