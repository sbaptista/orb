import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  let isMaintenance = false
  let lockedOut = false
  let broadcast: { message: string; id: string; type: string } | null = null

  try {
    const supabase = await createClient()
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['maintenance_mode', 'broadcast_message'])

    if (error) {
      console.error('[api/version] Error fetching system settings:', error)
    } else if (settings) {
      const maintenanceSetting = settings.find((s: any) => s.key === 'maintenance_mode')
      const broadcastSetting = settings.find((s: any) => s.key === 'broadcast_message')

      if (maintenanceSetting) {
        isMaintenance = maintenanceSetting.value === true
        if (isMaintenance) {
          lockedOut = true

          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: dbUser } = await supabase
              .from('users')
              .select('role_id')
              .eq('id', user.id)
              .single()

            const isAdmin = dbUser && [1, 3].includes(dbUser.role_id)
            if (isAdmin) {
              lockedOut = false
            }
          }
        }
      }

      if (broadcastSetting?.value && typeof broadcastSetting.value === 'object' && broadcastSetting.value.message) {
        broadcast = { message: broadcastSetting.value.message, id: broadcastSetting.value.id, type: broadcastSetting.value.type || 'info' }
      }
    }
  } catch (err) {
    console.error('[api/version] Supabase query exception:', err)
  }

  return NextResponse.json(
    {
      version: VERSION,
      maintenance: isMaintenance,
      lockedOut,
      broadcast,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}

