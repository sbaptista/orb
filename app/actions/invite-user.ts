'use server'

import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { sendInviteEmail } from '@/lib/email'

export async function inviteUser(
  email: string,
  firstName: string,
  lastName: string,
  roleId: number,
  originInput?: string,
  releaseStage?: string
) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const isDev = process.env.NODE_ENV === 'development'
  const defaultOrigin = isDev ? 'https://localhost:3001' : 'https://orb-eight-lake.vercel.app'
  let origin = originInput || (process.env.NEXT_PUBLIC_SITE_URL ?? defaultOrigin)
  if (origin.startsWith('http://') && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0'))) {
    origin = origin.replace('http://', 'https://')
  }

  try {
    const cleanEmail = email.trim().toLowerCase()

    const { data: existingUser } = await ctx.admin
      .from('users')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle()

    if (existingUser) {
      return { error: 'This email is already a registered user.' }
    }

    const { data: existingInvite } = await ctx.admin
      .from('invitations')
      .select('id')
      .ilike('email', cleanEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      return { error: 'This email already has a pending invitation.' }
    }

    const { data: existingAuthUsers } = await ctx.admin.auth.admin.listUsers()
    const existingAuth = existingAuthUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail)
    if (existingAuth) {
      await ctx.admin.auth.admin.deleteUser(existingAuth.id)
    }

    // Delete any existing stale invitations (accepted or declined) for this email
    const { error: inviteCleanError } = await ctx.admin
      .from('invitations')
      .delete()
      .ilike('email', cleanEmail)

    if (inviteCleanError) {
      console.warn('[inviteUser] Warning: Failed to clean up stale invitations:', inviteCleanError.message)
    }

    const { data: linkData, error: linkErr } = await ctx.admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${origin}/auth/callback` },
    })

    if (linkErr) throw linkErr
    if (!linkData.user) return { error: 'Failed to generate invite link' }

    const inviteLink = `${origin}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=invite`
    console.log('[inviteUser] Generated custom invite link:', inviteLink)

    const { data: invitation, error: invErr } = await ctx.admin
      .from('invitations')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
        release_stage: releaseStage ?? 'pre-alpha',
        invited_by: ctx.user.id,
      })
      .select('id')
      .single()

    if (invErr) throw invErr

    const declineLink = `${origin}/invite/decline?id=${invitation.id}`

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
      actor: 'admin-ui',
      user_id: ctx.user.id,
    })

    return { ok: true }
  } catch (err: any) {
    console.error('[inviteUser] Error:', err)
    return { error: err.message }
  }
}
