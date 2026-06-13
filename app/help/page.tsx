import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrbHelp from '@/components/OrbHelp'
import AppNav from '@/components/AppNav'

export default async function HelpPage() {
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
      <OrbHelp />
    </>
  )
}
