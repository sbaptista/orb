import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const origin = host ? `${protocol}://${host}` : defaultOrigin
  const token_hash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  // 1. Process server-side OTP token_hash links first (Invitations)
  if (token_hash && type) {
    const allowedTypes: EmailOtpType[] = ['invite', 'signup', 'magiclink', 'recovery']
    if (!allowedTypes.includes(type as EmailOtpType)) {
      console.error('[auth/callback] Invalid OTP verification type:', type)
      return NextResponse.redirect(`${origin}/auth/login?error=invalid_type`)
    }

    const supabase = await createClient()

    // Force sign out any existing session to ensure a clean, isolated state
    await supabase.auth.signOut()

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })

    if (error) {
      console.error('[auth/callback] verifyOtp failed:', error.message)
      return NextResponse.redirect(`${origin}/auth/login?error=invite_expired`)
    }

    if (data.user) {
      const admin = createAdminClient()

      // Check for a pending invitation — if found, create user and accept
      const { data: invitation } = await admin
        .from('invitations')
        .select('id, first_name, last_name, role_id')
        .eq('email', data.user.email!)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(1)
        .single()

      if (invitation) {
        // Create user record from invitation data (onboarded_at NULL so welcome shows)
        await admin.from('users').upsert({
          id: data.user.id,
          email: data.user.email!,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          role_id: invitation.role_id ?? 2,
        })

        // Mark invitation as accepted
        await admin.from('invitations').update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        }).eq('id', invitation.id)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // 2. Handle OTP verification callbacks (email links)
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const admin = createAdminClient()

      // Check for a pending invitation — if found, create user and accept
      const { data: invitation } = await admin
        .from('invitations')
        .select('id, first_name, last_name, role_id')
        .eq('email', data.user.email!)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(1)
        .single()

      if (invitation) {
        // Create user record from invitation data (onboarded_at NULL so welcome shows)
        await admin.from('users').upsert({
          id: data.user.id,
          email: data.user.email!,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          role_id: invitation.role_id ?? 2,
        })

        // Mark invitation as accepted
        await admin.from('invitations').update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        }).eq('id', invitation.id)

        return NextResponse.redirect(`${origin}/dashboard`)
      }

      // No invitation — check if user already exists
      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existingUser) {
        // New user without invitation — send to create-account
        return NextResponse.redirect(`${origin}/auth/create-account`)
      }

      // Known user — send to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // If it's an OTP type from email link, redirect to verify page
  if (type === 'otp') {
    const email = searchParams.get('email')
    if (email) {
      return NextResponse.redirect(`${origin}/auth/verify-otp?email=${encodeURIComponent(email)}`)
    }
  }

  // Something went wrong — back to login
  return NextResponse.redirect(`${origin}/auth/login`)
}
