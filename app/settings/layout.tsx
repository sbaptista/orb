import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsSidebar from '@/components/settings/SettingsSidebar'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="settings-layout">
      <SettingsSidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
      <style>{`
        .settings-layout {
          min-height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 640px) {
          .settings-layout {
            flex-direction: row;
          }
        }
      `}</style>
    </div>
  )
}
