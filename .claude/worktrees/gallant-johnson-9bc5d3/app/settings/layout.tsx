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
      flexDirection: 'column',
      fontFamily: 'var(--font-ui)',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Full-width top bar */}
      <div style={{
        height: '52px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-md)',
        padding: '0 var(--sp-2xl)',
        flexShrink: 0,
      }}>
        <Link
          href="/dashboard"
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ← back
        </Link>
        <span style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 'var(--fs-sm)',
          fontWeight: 500,
          color: 'var(--text2)',
        }}>
          Settings
        </span>
      </div>

      {/* Sidebar + content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <SettingsSidebar />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
