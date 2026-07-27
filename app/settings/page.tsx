import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  // ORB-361 Phase 2: /settings/urgency was deleted with the global urgency
  // threshold. Notifications is the first entry every user can see.
  redirect('/settings/notifications')
}
