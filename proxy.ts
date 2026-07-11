import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Module-level in-memory cache for maintenance state
let cachedMaintenance: boolean | null = null
let lastCacheTime = 0
const CACHE_TTL = 15000 // 15 seconds

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Bypasses: static files, favicon, manifest, etc.
  const isStatic = pathname.startsWith('/_next') ||
                   pathname.startsWith('/api/health') ||
                   pathname.startsWith('/api/version') ||
                   pathname.startsWith('/api/auth-debug') || // TEMP ORB-321 diagnostic — bypass so cookie is read raw
                   pathname === '/maintenance' ||
                   pathname.includes('.')

  if (isStatic) {
    return supabaseResponse
  }

  // Retrieve maintenance flag with in-memory caching
  let isMaintenance = false
  const now = Date.now()
  if (now - lastCacheTime < CACHE_TTL && cachedMaintenance !== null) {
    isMaintenance = cachedMaintenance
  } else {
    try {
      const { data: setting, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle()

      if (error) {
        console.error('[proxy] Error querying maintenance setting:', error)
      } else {
        isMaintenance = setting?.value === true
        cachedMaintenance = isMaintenance
        lastCacheTime = now
      }
    } catch (err) {
      console.error('[proxy] Exception querying maintenance setting:', err)
    }
  }

  // Fetch authenticated user (retry once on failure for wake-from-sleep resilience)
  let user: any = null
  let isAdmin = false
  let authFailed = false
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      user = userData.user
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role_id')
          .eq('id', user.id)
          .single()
        isAdmin = !!dbUser && [1, 3].includes(dbUser.role_id)
      }
      authFailed = false
      break
    } catch (err) {
      console.error(`[proxy] Auth lookup error (attempt ${attempt + 1}):`, err)
      authFailed = true
      if (attempt === 0) await new Promise(r => setTimeout(r, 500))
    }
  }

  // Intercept if under maintenance and not admin
  if (isMaintenance && !isAdmin) {
    // 1. API Route: return 503 JSON response
    if (pathname.startsWith('/api/')) {
      // Allow bypass if correct authorization header matching secret
      if (request.headers.get('Authorization') === process.env.ORB_API_SECRET) {
        return supabaseResponse
      }
      return new NextResponse(
        JSON.stringify({ error: 'MAINTENANCE_MODE_ACTIVE' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 2. Standard page route: redirect to /maintenance
    // Avoid redirecting Server Actions to prevent JSON parsing crashes on client
    if (!request.headers.get('Next-Action')) {
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

  // Standard authentication redirects
  // Server actions carry a Next-Action header — a redirect here produces an
  // unparseable response on the client. Actions handle their own auth checks.
  if (request.headers.get('Next-Action')) {
    return supabaseResponse
  }

  // Redirect unauthenticated users away from protected routes
  // Skip redirect if auth check itself failed (transient network error on wake)
  if (!user && !authFailed && pathname.startsWith('/dashboard')) {
    const res = NextResponse.redirect(new URL('/auth/login', request.url))
    // Self-heal: if an sb-*-auth-token cookie exists but getUser found no user
    // (and did NOT throw — authFailed is excluded above, so a transient network
    // blip won't reach here), the session cookie is corrupt/invalid. On WebKit
    // (Safari + all iPad browsers) this otherwise flip-flops /dashboard <->
    // /auth/login forever — the loop users currently "fix" by clearing site data.
    // Expire the auth cookies so the next request is clean and lands on login once.
    for (const c of request.cookies.getAll()) {
      if (c.name.includes('-auth-token')) {
        res.cookies.set(c.name, '', { maxAge: 0, path: '/' })
      }
    }
    return res
  }

  // Redirect authenticated users away from auth screens
  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
