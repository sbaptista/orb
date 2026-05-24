import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  let isMaintenance = false
  let lockedOut = false

  try {
    const supabase = await createClient()
    const { data: setting, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle()

    if (error) {
      console.error('[api/version] Error fetching system settings:', error)
      isMaintenance = true
      lockedOut = true
    } else if (setting) {
      isMaintenance = setting.value === true
      if (isMaintenance) {
        lockedOut = true
        
        // Check if user is Admin/Super Admin to allow bypass
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
  } catch (err) {
    console.error('[api/version] Supabase query exception:', err)
    isMaintenance = true
    lockedOut = true
  }

  return NextResponse.json(
    { 
      version: VERSION,
      maintenance: isMaintenance,
      lockedOut
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

