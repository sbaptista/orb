'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPER_ADMIN_ROLE_ID = 3
const ADMIN_ROLE_IDS = [1, 3]

export async function getUserDetail(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', profile: null }

  const admin = createAdminClient()

  const { data: requester, error: reqErr } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()

  if (reqErr) console.error('[getUserDetail] requester lookup failed:', { userId: user.id, code: reqErr.code, message: reqErr.message })
  if (!requester || !ADMIN_ROLE_IDS.includes(requester.role_id)) {
    return { error: 'Admin access required', profile: null }
  }

  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('first_name, last_name, email, role_id')
    .eq('id', targetUserId)
    .single()

  if (targetErr) console.error('[getUserDetail] target lookup failed:', { targetUserId, code: targetErr.code, message: targetErr.message })
  if (!target) return { error: 'User not found', profile: null }

  if (target.role_id === SUPER_ADMIN_ROLE_ID && requester.role_id !== SUPER_ADMIN_ROLE_ID) {
    return { error: 'Access denied', profile: null }
  }

  return { error: null, profile: { first_name: target.first_name, last_name: target.last_name, email: target.email } }
}

export async function getUserProjects(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', projects: [], todoCounts: {} }

  const admin = createAdminClient()

  const { data: requester, error: reqErr } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()

  if (reqErr) console.error('[getUserProjects] requester lookup failed:', { userId: user.id, code: reqErr.code, message: reqErr.message })
  if (!requester || !ADMIN_ROLE_IDS.includes(requester.role_id)) {
    return { error: 'Admin access required', projects: [], todoCounts: {} }
  }

  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('role_id')
    .eq('id', targetUserId)
    .single()

  if (targetErr) console.error('[getUserProjects] target lookup failed:', { targetUserId, code: targetErr.code, message: targetErr.message })
  if (!target) return { error: 'User not found', projects: [], todoCounts: {} }

  if (target.role_id === SUPER_ADMIN_ROLE_ID && requester.role_id !== SUPER_ADMIN_ROLE_ID) {
    return { error: 'Access denied', projects: [], todoCounts: {} }
  }

  const [prodRes, todoRes] = await Promise.all([
    admin.from('projects').select('*').eq('created_by', targetUserId).order('sort_order'),
    admin.from('todos').select('product_id').in(
      'product_id',
      (await admin.from('projects').select('id').eq('created_by', targetUserId)).data?.map((p: any) => p.id) ?? []
    ),
  ])

  const counts: Record<string, number> = {}
  todoRes.data?.forEach((t: any) => {
    counts[t.product_id] = (counts[t.product_id] || 0) + 1
  })

  return { error: null, projects: prodRes.data ?? [], todoCounts: counts }
}

export async function getProjectTodos(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', project: null, todos: [], statuses: [], priorities: [] }

  const admin = createAdminClient()

  const { data: requester, error: reqErr } = await admin
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .single()

  if (reqErr) console.error('[getProjectTodos] requester lookup failed:', { userId: user.id, code: reqErr.code, message: reqErr.message })
  if (!requester || !ADMIN_ROLE_IDS.includes(requester.role_id)) {
    return { error: 'Admin access required', project: null, todos: [], statuses: [], priorities: [] }
  }

  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, name, created_by')
    .eq('id', projectId)
    .single()

  if (projErr) console.error('[getProjectTodos] project lookup failed:', { projectId, code: projErr.code, message: projErr.message })
  if (!project) return { error: 'Project not found', project: null, todos: [], statuses: [], priorities: [] }

  const { data: owner, error: ownerErr } = await admin
    .from('users')
    .select('role_id')
    .eq('id', project.created_by)
    .single()

  if (ownerErr) console.error('[getProjectTodos] owner lookup failed:', { ownerId: project.created_by, code: ownerErr.code, message: ownerErr.message })

  if (owner?.role_id === SUPER_ADMIN_ROLE_ID && requester.role_id !== SUPER_ADMIN_ROLE_ID) {
    return { error: 'Access denied', project: null, todos: [], statuses: [], priorities: [] }
  }

  const [{ data: todos }, { data: statuses }, { data: priorities }] = await Promise.all([
    admin.from('todos').select('id, title, status, priority_value, created_at').eq('product_id', projectId).order('created_at', { ascending: false }),
    admin.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order'),
    admin.from('priorities').select('value, label').order('value'),
  ])

  return { error: null, project, todos: todos ?? [], statuses: statuses ?? [], priorities: priorities ?? [] }
}
