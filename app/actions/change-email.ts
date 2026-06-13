'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

export async function changeEmail(newEmail: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const cleanEmail = newEmail.trim().toLowerCase()
  if (cleanEmail === user.email?.toLowerCase()) {
    return { ok: false, error: 'New email must be different from current email' }
  }

  const admin = createAdminClient()

  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email: cleanEmail,
    email_confirm: true,
  })
  if (authErr) return { ok: false, error: authErr.message }

  const { error: dbErr } = await admin
    .from('users')
    .update({ email: cleanEmail })
    .eq('id', user.id)
  if (dbErr) {
    console.error('[changeEmail] Failed to sync users table:', dbErr)
  }

  const { error: invErr } = await admin
    .from('invitations')
    .update({ email: cleanEmail })
    .eq('email', user.email!)
  if (invErr) {
    console.error('[changeEmail] Failed to sync invitations:', invErr)
  }

  await logAuditEvent({
    action: 'user_update',
    table_name: 'users',
    record_id: user.id,
    before: { email: user.email },
    after: { email: cleanEmail },
    actor: 'user',
    user_id: user.id,
  })

  // Delete all webauthn factors server-side
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  if (factors?.factors) {
    for (const factor of factors.factors) {
      if (factor.factor_type === 'webauthn') {
        await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id })
      }
    }
  }

  return { ok: true }
}
