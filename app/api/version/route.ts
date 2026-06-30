import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'
import { createClient } from '@/lib/supabase/server'

interface CachedSettings {
  maintenance: boolean
  broadcast: { message: string; id: string; type: string } | null
  fetchedAt: number
}

let settingsCache: CachedSettings | null = null
const CACHE_TTL_MS = 60_000
const SERVER_BOOT_ID = process.env.NODE_ENV === 'development' ? `${Date.now()}` : null

async function getSystemSettings(): Promise<CachedSettings> {
  const now = Date.now()
  if (settingsCache && now - settingsCache.fetchedAt < CACHE_TTL_MS) {
    return settingsCache
  }

  let maintenance = false
  let broadcast: CachedSettings['broadcast'] = null

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
        maintenance = maintenanceSetting.value === true
      }

      if (broadcastSetting?.value && typeof broadcastSetting.value === 'object' && broadcastSetting.value.message) {
        broadcast = { message: broadcastSetting.value.message, id: broadcastSetting.value.id, type: broadcastSetting.value.type || 'info' }
      }
    }
  } catch (err) {
    console.error('[api/version] Supabase query exception:', err)
  }

  settingsCache = { maintenance, broadcast, fetchedAt: now }
  return settingsCache
}

export async function GET() {
  const { maintenance, broadcast } = await getSystemSettings()

  let lockedOut = false
  if (maintenance) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role_id')
          .eq('id', user.id)
          .single()

        lockedOut = !(dbUser && [1, 3].includes(dbUser.role_id))
      } else {
        lockedOut = true
      }
    } catch {
      lockedOut = true
    }
  }

  return NextResponse.json(
    {
      version: VERSION,
      serverBootId: SERVER_BOOT_ID,
      maintenance,
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
