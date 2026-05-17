'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin, getCurrentUserId } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { sendInviteEmail } from '@/lib/email'
import { headers } from 'next/headers'

export async function inviteUser(
  email: string,
  firstName: string,
  lastName: string,
  roleId: number,
  originInput?: string,
  releaseStage?: string
) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const origin = originInput || (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orb-eight-lake.vercel.app')

  const supabase = createAdminClient()
  const adminId = await getCurrentUserId()

  try {
    // Block inviting existing users — this would replace their auth identity
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return { error: 'This email is already a registered user.' }
    }

    // Block duplicate pending invitations
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      return { error: 'This email already has a pending invitation.' }
    }

    // Clean up any stale auth entry so generateLink can create a fresh one
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
    const existingAuth = existingAuthUsers?.users?.find(u => u.email === email)
    if (existingAuth) {
      await supabase.auth.admin.deleteUser(existingAuth.id)
    }

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${origin}/auth/callback` },
    })

    if (linkErr) throw linkErr
    if (!linkData.user) return { error: 'Failed to generate invite link' }

    const inviteLink = `${origin}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=invite`
    console.log('[inviteUser] Generated custom invite link:', inviteLink)

    // Create invitation record (user record is NOT created until acceptance)
    const { data: invitation, error: invErr } = await supabase
      .from('invitations')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
        release_stage: releaseStage ?? 'pre-alpha',
        invited_by: adminId ?? null,
      })
      .select('id')
      .single()

    if (invErr) throw invErr

    const declineLink = `${origin}/invite/decline?id=${invitation.id}`

    // Send the custom invite email via Resend
    const emailResult = await sendInviteEmail({
      to: email,
      firstName,
      inviteLink,
      declineLink,
    })

    if (emailResult.error) throw new Error(emailResult.error)

    await logAuditEvent({
      action: 'user_invite',
      table_name: 'users',
      record_id: linkData.user.id,
      after: { email, release_stage: releaseStage ?? 'pre-alpha' },
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[inviteUser] Error:', err)
    return { error: err.message }
  }
}
