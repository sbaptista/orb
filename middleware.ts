import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Module-level in-memory cache for maintenance state
let cachedMaintenance: boolean | null = null
let lastCacheTime = 0
const CACHE_TTL = 15000 // 15 seconds

export async function middleware(request: NextRequest) {
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
        console.error('[middleware] Error querying maintenance setting:', error)
        isMaintenance = true // Fallback to true if database query fails (e.g. database down)
      } else {
        isMaintenance = setting?.value === true
        cachedMaintenance = isMaintenance
        lastCacheTime = now
      }
    } catch (err) {
      console.error('[middleware] Exception querying maintenance setting:', err)
      isMaintenance = true // Fallback to true on connection errors
    }
  }

  // Fetch authenticated user
  let user: any = null
  let isAdmin = false
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
  } catch (err) {
    console.error('[middleware] Auth lookup error:', err)
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
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
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

