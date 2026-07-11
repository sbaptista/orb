import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// TEMPORARY DIAGNOSTIC (ORB-321): read-only endpoint to see what getUser()
// resolves to on the corrupt-cookie WebKit login loop, without needing devtools.
// Returns NO secrets — only booleans, an 8-char user-id prefix, error text, and
// auth-cookie NAMES + SIZES (never values). Proxy bypasses this path so the
// cookie is read exactly as the browser sent it (no refresh/rewrite first).
// REMOVE once the root cause is found.
export async function GET() {
  const cookieStore = await cookies()
  const authCookies = cookieStore
    .getAll()
    .filter((c) => c.name.includes('-auth-token'))
    .map((c) => ({ name: c.name, size: c.value.length }))

  let result: Record<string, unknown>
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    result = {
      hasUser: !!data.user,
      userIdPrefix: data.user?.id?.slice(0, 8) ?? null,
      getUserError: error?.message ?? null,
    }
  } catch (e) {
    result = { threw: true, message: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(
    { ...result, authCookies, totalCookieCount: cookieStore.getAll().length },
    { headers: { 'cache-control': 'no-store' } }
  )
}
