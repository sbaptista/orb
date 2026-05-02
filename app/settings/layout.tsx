import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SettingsSidebar from '@/components/settings/SettingsSidebar'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      fontFamily: 'var(--font-ui)',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <SettingsSidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: '52px',
          padding: '0 var(--sp-2xl)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--muted)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← back
          </Link>
        </div>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
