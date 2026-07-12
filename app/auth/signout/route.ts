import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// Server-side sign-out (ORB-323 #3). A valid auth session that cannot be resolved
// to a public.users row (phantom/orphaned session) must be terminated, not just
// redirected — a bare redirect loops because the proxy sees the still-valid session
// and bounces it back to /dashboard. Route handlers can write cookies (a Server
// Component cannot), so signOut here actually clears the session before login.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const requested = request.nextUrl.searchParams.get('redirect')
  // Only allow internal, non-protocol-relative paths to avoid open-redirects.
  const target = requested && requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : '/auth/login'

  return NextResponse.redirect(new URL(target, request.url))
}
