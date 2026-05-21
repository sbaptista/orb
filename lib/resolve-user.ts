import { createAdminClient } from '@/lib/supabase/admin'
import { createTicket } from '@/app/actions/ticket-actions'
import { acceptInvitation } from '@/app/actions/invitation-actions'
import { logAuditEvent } from '@/lib/audit'

export type ResolvedUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  role_id: number
  onboarded_at: string | null
}

export type ResolveSuccess = { ok: true; user: ResolvedUser; isNew: boolean }
type ResolveRedirect = { ok: false; redirectTo: string }
type ResolveResult = ResolveSuccess | ResolveRedirect

export async function resolveUser(authId: string, email: string): Promise<ResolveResult> {
  const admin = createAdminClient()

  try {
    // 1. Look up by stable auth ID first
    const { data: existing, error: lookupErr } = await admin
      .from('users')
      .select('id, email, first_name, last_name, role_id, onboarded_at')
      .eq('id', authId)
      .maybeSingle()

    if (lookupErr) {
      console.error('[resolveUser] Lookup by ID failed:', lookupErr)
      await autoTicket('User lookup by ID failed during auth', lookupErr)
      return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
    }

    // Case 1: existing user found by auth ID
    if (existing) {
      const cleanAuthEmail = email.trim().toLowerCase()
      const cleanDbEmail = existing.email.trim().toLowerCase()
      
      if (cleanAuthEmail !== cleanDbEmail) {
        console.log(`[resolveUser] Email change detected for user ${authId}: ${existing.email} → ${cleanAuthEmail}`)
        
        // Update email in users table
        const { error: userUpdateErr } = await admin
          .from('users')
          .update({ email: cleanAuthEmail })
          .eq('id', authId)

        if (userUpdateErr) {
          console.error('[resolveUser] Failed to update user email:', userUpdateErr)
          await autoTicket('Failed to update user email during email change sync', userUpdateErr)
        }

        // Update email in invitations table where matching the old email
        const { error: inviteUpdateErr } = await admin
          .from('invitations')
          .update({ email: cleanAuthEmail })
          .eq('email', existing.email)

        if (inviteUpdateErr) {
          console.error('[resolveUser] Failed to update invitation email:', inviteUpdateErr)
          await autoTicket('Failed to update invitation email during email change sync', inviteUpdateErr)
        }

        // Log audit event
        await logAuditEvent({
          action: 'user_update',
          table_name: 'users',
          record_id: authId,
          before: { email: existing.email },
          after: { email: cleanAuthEmail },
          actor: 'system',
          user_id: authId,
        })

        existing.email = cleanAuthEmail
      }

      return { ok: true, user: existing as ResolvedUser, isNew: false }
    }

    // Case 2: no user row found by ID — search by email (handles reconciliation)
    const { data: byEmail, error: emailLookupErr } = await admin
      .from('users')
      .select('id, email, first_name, last_name, role_id, onboarded_at')
      .eq('email', email)
      .maybeSingle()

    if (emailLookupErr) {
      console.error('[resolveUser] Email lookup failed:', emailLookupErr)
      await autoTicket('User email lookup failed during auth', emailLookupErr)
      return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
    }

    if (byEmail) {
      console.log(`[resolveUser] Reconciling ${email}: ${byEmail.id} → ${authId}`)
      const { error: rpcErr } = await admin.rpc('reconcile_user_id', {
        old_id: byEmail.id,
        new_id: authId,
      })

      if (rpcErr) {
        console.error('[resolveUser] Reconciliation failed:', rpcErr)
        await autoTicket('User ID reconciliation failed', rpcErr)
        return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
      }

      return {
        ok: true as const,
        user: { ...byEmail, id: authId } as ResolvedUser,
        isNew: false,
      }
    }

    // Case 3: no user row — check for pending invitation
    const { data: invitation } = await admin
      .from('invitations')
      .select('id, first_name, last_name, role_id, release_stage')
      .eq('email', email)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invitation) {
      const { data: newUser, error: insertErr } = await admin
        .from('users')
        .insert({
          id: authId,
          email,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          role_id: invitation.role_id ?? 2,
          release_stage: invitation.release_stage ?? 'pre-alpha',
        })
        .select('id, email, first_name, last_name, role_id, onboarded_at')
        .single()

      if (insertErr) {
        console.error('[resolveUser] User creation from invitation failed:', insertErr)
        await autoTicket('User creation from invitation failed', insertErr)
        return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
      }

      const acceptResult = await acceptInvitation(email, authId)
      if ('error' in acceptResult && acceptResult.error) {
        console.error('[resolveUser] acceptInvitation failed:', acceptResult.error)
      }

      return { ok: true as const, user: newUser as ResolvedUser, isNew: true }
    }

    // Case 4: no user, no invitation — send to login page with error
    return { ok: false, redirectTo: '/auth/login?error=not_invited' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[resolveUser] Unexpected error:', message)
    await autoTicket('Unexpected error in resolveUser', { message })
    return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
  }
}

async function autoTicket(summary: string, detail: unknown) {
  try {
    await createTicket({
      source: 'orb-auto',
      type: 'bug',
      summary,
      detail,
    })
  } catch {
    // Don't let ticket creation failure cascade
  }
}
