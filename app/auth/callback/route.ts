import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
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

  const supabase = await createClient()

  // 1. Server-side OTP token_hash links (invitations)
  if (token_hash && type) {
    const allowedTypes: EmailOtpType[] = ['invite', 'signup', 'magiclink', 'recovery']
    if (!allowedTypes.includes(type as EmailOtpType)) {
      return NextResponse.redirect(`${origin}/auth/login?error=invalid_type`)
    }

    await supabase.auth.signOut()

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })

    if (error || !data.user?.email) {
      console.error('[auth/callback] verifyOtp failed:', error?.message)
      return NextResponse.redirect(`${origin}/auth/login?error=invite_expired`)
    }

    const result = await resolveUser(data.user.id, data.user.email)
    return NextResponse.redirect(`${origin}${result.ok ? '/dashboard' : result.redirectTo}`)
  }

  // 2. Code exchange (magic link / OTP email links)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user?.email) {
      console.error('[auth/callback] code exchange failed:', error?.message)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }

    const result = await resolveUser(data.user.id, data.user.email)
    return NextResponse.redirect(`${origin}${result.ok ? '/dashboard' : result.redirectTo}`)
  }

  // 3. OTP type from email link — redirect to verify page
  if (type === 'otp') {
    const email = searchParams.get('email')
    if (email) {
      return NextResponse.redirect(`${origin}/auth/verify-otp?email=${encodeURIComponent(email)}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
