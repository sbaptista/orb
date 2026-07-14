import { createClient } from '@/lib/supabase/server'
import { getRealtimeVoiceAccess } from '@/lib/orb-realtime/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ enabled: false }, { status: 401 })
  const access = getRealtimeVoiceAccess(user.email)
  return Response.json(
    { enabled: access.enabled },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
