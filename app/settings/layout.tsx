import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsSidebar from '@/components/settings/SettingsSidebar'
import SettingsTopbar from '@/components/settings/SettingsTopbar'
import AppNav from '@/components/AppNav'
import { UnsavedChangesProvider } from '@/lib/hooks/useUnsavedChanges'
import { BreadcrumbOverridesProvider } from '@/lib/hooks/useBreadcrumbOverrides'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role_id, first_name, email')
    .eq('id', user.id)
    .single()

  const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === 3
  const userInitial = (currentUser?.first_name || currentUser?.email || '?').charAt(0).toUpperCase()

  return (
    <UnsavedChangesProvider>
      <BreadcrumbOverridesProvider>
        <div className="sl-page">
          <AppNav userInitial={userInitial} />
          <SettingsTopbar />

          <div className="sl-body settings-shell">
            <SettingsSidebar isAdmin={isAdmin} />
            <main className="sl-main">{children}</main>
          </div>
        </div>
      </BreadcrumbOverridesProvider>
    </UnsavedChangesProvider>
  )
}
