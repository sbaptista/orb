import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { visibleProjectsQuery } from '@/lib/projects'
import { computeOrbState, type OrbState } from '@/lib/orb-state'

/**
 * GET /api/orb-state
 *
 * Returns the current orb state (active count + urgency per project).
 *
 * Auth: either Supabase session cookie (browser/PWA) or
 *       Authorization header matching ORB_API_SECRET (native widget).
 */
export async function GET(request: NextRequest) {
  let supabase: any
  let userId: string | null = null

  // Try session auth first (browser/PWA)
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  if (user) {
    supabase = sessionClient
    userId = user.id
  } else {
    // Fall back to API key auth (native widget)
    if (request.headers.get('Authorization') !== process.env.ORB_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = createServiceClient()
    // API key requests need a user_id param
    userId = request.nextUrl.searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 })
    }
  }

  // Fetch projects first so the todos query can be scoped in Postgres instead
  // of reading every non-deleted todo and filtering in the app.
  const [
    { data: projects },
    { data: priorities },
    { data: userSettings },
  ] = await Promise.all([
    visibleProjectsQuery(supabase, 'id, name, code'),
    supabase
      .from('priorities')
      .select('value, is_urgent'),
    supabase
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const projectList = projects ?? []
  const projectIds = projectList.map((p: any) => p.id).filter(Boolean)
  const { data: todos } = projectIds.length > 0
    ? await supabase
      .from('todos')
      .select('status, priority_value, due_at, due_timezone, product_id')
      .in('product_id', projectIds)
      .is('deleted_at', null)
    : { data: [] }
  const todoList = todos ?? []

  const urgentValues = new Set<number>(
    (priorities ?? []).filter((p: any) => p.is_urgent).map((p: any) => p.value as number)
  )
  // ORB-360: the user's stored timezone is canonical for due-date math —
  // previously this implicitly used the server's zone (UTC on Vercel).
  // ORB-361 Phase 2: urgency windows come from priority, not a global threshold.
  const timeZone = userSettings?.timezone || 'America/Los_Angeles'

  const state: OrbState = computeOrbState(todoList, projectList, urgentValues, timeZone)

  return NextResponse.json(state, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
