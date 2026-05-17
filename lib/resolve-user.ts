import { createAdminClient } from '@/lib/supabase/admin'
import { createTicket } from '@/app/actions/ticket-actions'

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
    // Look up by email — the only stable identifier
    const { data: existing, error: lookupErr } = await admin
      .from('users')
      .select('id, email, first_name, last_name, role_id, onboarded_at')
      .eq('email', email)
      .maybeSingle()

    if (lookupErr) {
      console.error('[resolveUser] Lookup failed:', lookupErr)
      await autoTicket('User lookup failed during auth', lookupErr)
      return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
    }

    // Case 1: existing user, same auth ID — normal login
    if (existing && existing.id === authId) {
      return { ok: true, user: existing as ResolvedUser, isNew: false }
    }

    // Case 2: existing user, different auth ID — reconcile
    if (existing && existing.id !== authId) {
      console.log(`[resolveUser] Reconciling ${email}: ${existing.id} → ${authId}`)
      const { error: rpcErr } = await admin.rpc('reconcile_user_id', {
        old_id: existing.id,
        new_id: authId,
      })

      if (rpcErr) {
        console.error('[resolveUser] Reconciliation failed:', rpcErr)
        await autoTicket('User ID reconciliation failed', rpcErr)
        return { ok: false, redirectTo: '/auth/login?error=resolve_failed' }
      }

      return {
        ok: true as const,
        user: { ...existing, id: authId } as ResolvedUser,
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

      await admin
        .from('invitations')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return { ok: true as const, user: newUser as ResolvedUser, isNew: true }
    }

    // Case 4: no user, no invitation — send to create-account
    return { ok: false, redirectTo: '/auth/create-account' }
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
