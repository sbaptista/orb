'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
import { acceptInvitation } from './invitation-actions'
import { createTicket } from '@/app/actions/ticket-actions'
import { sendWelcomeEmail } from '@/lib/email'

export async function completeOnboarding(firstName: string, lastName: string) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.email) {
      return { error: 'Session expired or not authenticated. Please sign in again.' }
    }

    // Reconcile auth ID if needed (handles orphaned rows from invite flow)
    const resolveResult = await resolveUser(user.id, user.email)
    if (!resolveResult.ok) {
      return { error: 'You are not authorized to onboard. Orb is by invitation only.' }
    }

    const admin = createAdminClient()
    const { error: upsertError } = await admin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        onboarded_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('[completeOnboarding] Upsert failed:', upsertError)
      await createTicket({
        source: 'orb-auto',
        type: 'bug',
        summary: 'Onboarding upsert failed',
        detail: { error: upsertError.message, email: user.email },
      }).catch(() => {})
      return { error: 'Something went wrong setting up your account. We\'ve logged this and will look into it.' }
    }

    // Welcome email — fire-and-forget, never blocks onboarding
    sendWelcomeEmail({ to: user.email, firstName }).catch(err =>
      console.error('[completeOnboarding] Welcome email failed:', err)
    )

    await acceptInvitation(user.email)

    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[completeOnboarding] Unexpected error:', message)
    await createTicket({
      source: 'orb-auto',
      type: 'bug',
      summary: 'Unexpected onboarding error',
      detail: { error: message },
    }).catch(() => {})
    return { error: 'Something went wrong setting up your account. We\'ve logged this and will look into it.' }
  }
}
