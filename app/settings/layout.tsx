import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsSidebar from '@/components/settings/SettingsSidebar'
import SettingsTopbar from '@/components/settings/SettingsTopbar'
import { UnsavedChangesProvider } from '@/lib/hooks/useUnsavedChanges'
import { BreadcrumbOverridesProvider } from '@/lib/hooks/useBreadcrumbOverrides'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentUser } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()

  const isAdmin = currentUser?.role_id === 1 || currentUser?.role_id === 3

  return (
    <UnsavedChangesProvider>
      <BreadcrumbOverridesProvider>
        <div className="sl-page">
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
