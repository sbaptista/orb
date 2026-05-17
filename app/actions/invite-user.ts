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
  console.log('[inviteUser] origin resolved to:', origin)
  console.log('[inviteUser] generating link with redirectTo:', `${origin}/auth/callback`)

  const supabase = createAdminClient()
  const adminId = await getCurrentUserId()

  try {
    // Clean up any existing Auth user with this email (allows re-inviting)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find(u => u.email === email)
    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id)
    }

    // Generate the invite link without sending Supabase's default email
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${origin}/auth/callback` },
    })

    if (linkErr) throw linkErr
    if (!linkData.user) return { error: 'Failed to generate invite link' }

    const inviteLink = linkData.properties.action_link

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
