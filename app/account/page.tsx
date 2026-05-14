import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SettingsAccount from '@/components/settings/SettingsAccount'
import { VERSION } from '@/lib/version'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <>
      <div className="tv-topbar">
        <Link href="/dashboard" className="tv-back">← Dashboard</Link>
        <div className="sl-title">Account</div>
      </div>
      <main style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-2xl) var(--sp-lg)' }}>
        <SettingsAccount />
      </main>
      <div className="tv-version-footer">
        <span className="tv-version-text">Orb {VERSION}</span>
      </div>
    </>
  )
}
