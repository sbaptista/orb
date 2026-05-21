'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function checkLoginAllowed(email: string): Promise<{ allowed: boolean; reason?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) {
    return { allowed: false, reason: 'Email is required' }
  }

  // Hardcode Stan's primary email just in case (e.g. initial setup)
  if (cleanEmail === 'stan.baptista@gmail.com') {
    return { allowed: true }
  }

  const admin = createAdminClient()

  // 1. Check if they exist in public.users (already accepted/pre-existing)
  const { data: user, error: userError } = await admin
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (userError) {
    console.error('[checkLoginAllowed] users lookup failed:', userError)
  }

  if (user) {
    return { allowed: true }
  }

  // 2. Check if they have a pending invitation
  const { data: invite, error: inviteError } = await admin
    .from('invitations')
    .select('id')
    .eq('email', cleanEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (inviteError) {
    console.error('[checkLoginAllowed] invitations lookup failed:', inviteError)
  }

  if (invite) {
    return { allowed: true }
  }

  return { allowed: false }
}
