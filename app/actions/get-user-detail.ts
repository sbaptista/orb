'use server'

import { requireAdmin } from '@/lib/auth'

const SUPER_ADMIN_ROLE_ID = 3

/**
 * ORB-312: single bundled fetch for the admin User Detail page.
 *
 * Replaces the old getUserDetail + getUserProjects pair, which the client fired
 * via Promise.all — but Next.js serializes server actions, so each paid its own
 * requireAdmin() (getUser round-trip) AND separately re-queried the target's
 * role for the super-admin gate. This does one auth gate, one target-user query
 * (covering both the profile fields and the role gate), then the project/todo
 * fetches. Same server-side data model, one round-trip instead of two.
 */
export async function getUserDetailBundle(targetUserId: string) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message, profile: null, projects: [], todoCounts: {} }
  }

  const { data: target, error: targetErr } = await ctx.admin
    .from('users')
    .select('first_name, last_name, email, role_id, release_stage, program_joined_at')
    .eq('id', targetUserId)
    .single()

  if (targetErr) console.error('[getUserDetailBundle] target lookup failed:', { targetUserId, code: targetErr.code, message: targetErr.message })
  if (!target) return { error: 'User not found', profile: null, projects: [], todoCounts: {} }

  if (target.role_id === SUPER_ADMIN_ROLE_ID && ctx.roleId !== SUPER_ADMIN_ROLE_ID) {
    return { error: 'Access denied', profile: null, projects: [], todoCounts: {} }
  }

  const prodRes = await ctx.admin.from('projects').select('*').eq('created_by', targetUserId).order('sort_order')
  const projectIds = (prodRes.data ?? []).map((p: any) => p.id)
  const todoRes = projectIds.length > 0
    ? await ctx.admin.from('todos').select('product_id').in('product_id', projectIds)
    : { data: [], error: null }

  const counts: Record<string, number> = {}
  todoRes.data?.forEach((t: any) => {
    counts[t.product_id] = (counts[t.product_id] || 0) + 1
  })

  return {
    error: null,
    profile: {
      first_name: target.first_name,
      last_name: target.last_name,
      email: target.email,
      release_stage: target.release_stage as 'pre-alpha' | 'alpha' | 'beta' | null,
      program_joined_at: target.program_joined_at as string | null,
    },
    projects: prodRes.data ?? [],
    todoCounts: counts,
  }
}

export async function getProjectTodos(projectId: string) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message, project: null, todos: [], statuses: [], priorities: [] }
  }

  const { data: project, error: projErr } = await ctx.admin
    .from('projects')
    .select('id, name, created_by')
    .eq('id', projectId)
    .single()

  if (projErr) console.error('[getProjectTodos] project lookup failed:', { projectId, code: projErr.code, message: projErr.message })
  if (!project) return { error: 'Project not found', project: null, todos: [], statuses: [], priorities: [] }

  const { data: owner } = await ctx.admin
    .from('users')
    .select('role_id')
    .eq('id', project.created_by)
    .single()

  if (owner?.role_id === SUPER_ADMIN_ROLE_ID && ctx.roleId !== SUPER_ADMIN_ROLE_ID) {
    return { error: 'Access denied', project: null, todos: [], statuses: [], priorities: [] }
  }

  const [{ data: todos }, { data: statuses }, { data: priorities }] = await Promise.all([
    ctx.admin.from('todos').select('id, title, status, priority_value, created_at').eq('product_id', projectId).order('created_at', { ascending: false }),
    ctx.admin.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order'),
    ctx.admin.from('priorities').select('value, label').order('value'),
  ])

  return { error: null, project, todos: todos ?? [], statuses: statuses ?? [], priorities: priorities ?? [] }
}
