'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'

export async function devLogin(email: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV !== 'development') {
    return { ok: false, error: 'Dev login is only available in development' }
  }

  const admin = createAdminClient()
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    return { ok: false, error: linkErr?.message || 'Failed to generate link' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  if (error || !data.user?.email) {
    return { ok: false, error: error?.message || 'Failed to verify token' }
  }

  await resolveUser(data.user.id, data.user.email)
  return { ok: true }
}
