import { NextRequest, NextResponse } from 'next/server'
import { canRoleInspectRepository } from '@/lib/repository-access'
import { queryBundledRepository, type RepositoryQuery } from '@/lib/repository-reader'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  if (request.headers.get('Authorization') !== process.env.ORB_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = request.headers.get('X-User-Id')
  if (!userId) return NextResponse.json({ error: 'X-User-Id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('roles(name)')
    .eq('id', userId)
    .single()
  const roleName = (user as any)?.roles?.name ?? ''
  if (error || !canRoleInspectRepository(roleName)) {
    return NextResponse.json({ error: 'Repository access requires an Admin, Super Admin, or Developer role' }, { status: 403 })
  }

  try {
    const input = await request.json() as RepositoryQuery
    return NextResponse.json(queryBundledRepository(input))
  } catch (queryError: any) {
    return NextResponse.json({ error: queryError.message || 'Repository query failed' }, { status: 400 })
  }
}
