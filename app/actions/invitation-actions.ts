'use server'

import { requireAdmin, getAuthContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import {
  dispatchNotification,
  type InvitationNotificationPayload,
} from '@/lib/notifications'

export type Invitation = {
    id: string
    email: string
    release_stage: string
    status: 'pending' | 'accepted' | 'declined'
    invited_by: string | null
    invited_at: string
    responded_at: string | null
    decline_reason: string | null
}

const INVITATION_NOTIFY_SELECT =
  'id, email, first_name, last_name, release_stage, responded_at, decline_reason'

function toNotificationPayload(row: {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  release_stage: string
  responded_at: string
  decline_reason?: string | null
}): InvitationNotificationPayload {
  return {
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    release_stage: row.release_stage,
    responded_at: row.responded_at,
    decline_reason: row.decline_reason ?? null,
  }
}

export async function getInvitations(status?: string) {
    const ctx = await requireAdmin()
    let query = ctx.admin.from('invitations').select('*').order('invited_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
        console.error('getInvitations error:', error)
        return { error: error.message, data: null }
    }
    return { data: data as Invitation[], error: null }
}

export async function resendInvitation(invitationId: string) {
    const ctx = await requireAdmin()

    const { data: inv, error: fetchErr } = await ctx.admin
        .from('invitations')
        .select('email, first_name, last_name')
        .eq('id', invitationId)
        .single()
    if (fetchErr || !inv) return { error: fetchErr?.message ?? 'Invitation not found' }

    const isDev = process.env.NODE_ENV === 'development'
    const defaultOrigin = isDev ? 'https://localhost:3001' : 'https://orb-eight-lake.vercel.app'
    let origin = process.env.NEXT_PUBLIC_SITE_URL ?? defaultOrigin
    if (origin.startsWith('http://') && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0'))) {
        origin = origin.replace('http://', 'https://')
    }

    const { data: linkData, error: linkErr } = await ctx.admin.auth.admin.generateLink({
        type: 'invite',
        email: inv.email,
        options: { redirectTo: `${origin}/auth/callback` },
    })
    if (linkErr) return { error: linkErr.message }
    if (!linkData.user) return { error: 'Failed to generate invite link' }

    const inviteLink = `${origin}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=invite`
    const declineLink = `${origin}/invite/decline?id=${invitationId}`

    const emailResult = await sendInviteEmail({
        to: inv.email,
        firstName: inv.first_name ?? '',
        inviteLink,
        declineLink,
    })

    if (emailResult.error) return { error: emailResult.error }
    return { ok: true }
}

export async function deleteInvitation(invitationId: string) {
    const ctx = await requireAdmin()
    const { error } = await ctx.admin.from('invitations').delete().eq('id', invitationId)
    if (error) {
        console.error('deleteInvitation error:', error)
        return { error: error.message }
    }
    return { ok: true }
}

export async function deleteInvitations(ids: string[]) {
    const ctx = await requireAdmin()
    const { error } = await ctx.admin.from('invitations').delete().in('id', ids)
    if (error) {
        console.error('deleteInvitations error:', error)
        return { error: error.message }
    }
    return { ok: true }
}

export async function acceptInvitation(email: string, userId?: string) {
    const admin = createAdminClient()
    const { data: inv, error: fetchErr } = await admin
        .from('invitations')
        .select(INVITATION_NOTIFY_SELECT)
        .eq('email', email)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (fetchErr) {
        console.error('acceptInvitation fetch error:', fetchErr)
        return { error: fetchErr.message }
    }

    if (!inv) {
        return { ok: true, changed: false }
    }

    const respondedAt = new Date().toISOString()
    const { data: updated, error: updateErr } = await admin
        .from('invitations')
        .update({ status: 'accepted', responded_at: respondedAt })
        .eq('id', inv.id)
        .eq('status', 'pending')
        .select('id')

    if (updateErr) {
        console.error('acceptInvitation error:', updateErr)
        return { error: updateErr.message }
    }

    const changed = (updated?.length ?? 0) > 0
    if (changed) {
        logAuditEvent({
            action: 'invitation_accept',
            table_name: 'invitations',
            record_id: inv.id,
            before: { status: 'pending' },
            after: { status: 'accepted' },
            actor: 'invitee',
            user_id: userId,
        }).catch(err => console.error('[invitation] Audit log failed:', err))
        dispatchNotification('invitation.accepted', toNotificationPayload({
            ...inv,
            responded_at: respondedAt,
        })).catch(err => console.error('[invitation] Notification dispatch failed:', err))
    }

    return { ok: true, changed }
}

export async function declineInvitation(token: string, reason?: string) {
    const admin = createAdminClient()
    const { data: inv, error: fetchErr } = await admin
        .from('invitations')
        .select(INVITATION_NOTIFY_SELECT)
        .eq('id', token)
        .eq('status', 'pending')
        .maybeSingle()

    if (fetchErr) {
        console.error('declineInvitation fetch error:', fetchErr)
        return { error: fetchErr.message }
    }
    if (!inv) {
        return { error: 'Invitation not found or already responded.' }
    }

    const respondedAt = new Date().toISOString()
    const { data: updated, error: updateErr } = await admin
        .from('invitations')
        .update({
            status: 'declined',
            responded_at: respondedAt,
            decline_reason: reason || null,
        })
        .eq('id', inv.id)
        .eq('status', 'pending')
        .select('id')

    if (updateErr) {
        console.error('declineInvitation error:', updateErr)
        return { error: updateErr.message }
    }

    if (!updated?.length) {
        console.warn('[declineInvitation] Update matched 0 rows for', token)
        return { error: 'This invitation has already been responded to.' }
    }

    logAuditEvent({
        action: 'invitation_decline',
        table_name: 'invitations',
        record_id: inv.id,
        before: { status: 'pending' },
        after: { status: 'declined', decline_reason: reason || null },
        actor: 'invitee',
    }).catch(err => console.error('[invitation] Audit log failed:', err))

    dispatchNotification('invitation.declined', toNotificationPayload({
        ...inv,
        responded_at: respondedAt,
        decline_reason: reason || null,
    })).catch(err => console.error('[invitation] Notification dispatch failed:', err))

    return { ok: true, changed: true }
}
