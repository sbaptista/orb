'use server'

import { getAuthContext, requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { checkCodeConflict, generateUniqueCode } from '@/lib/project-codes'

export async function createProject(data: {
  name: string
  code?: string | null
  description?: string | null
  color?: string | null
  sort_order?: number
  ownerId?: string | null
}) {
  const ctx = await getAuthContext()
  
  const ownerId = ctx.isAdmin ? (data.ownerId ?? ctx.user.id) : ctx.user.id

  const { data: nameConflict } = await ctx.admin.from('projects').select('id, code')
    .ilike('name', data.name.trim()).eq('created_by', ownerId).is('deleted_at', null).maybeSingle()
  if (nameConflict) {
    return { error: `A project named "${data.name.trim()}" already exists (${nameConflict.code})` }
  }

  let code = data.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!code) {
    code = await generateUniqueCode(ctx.admin, data.name, ownerId)
  } else {
    if (await checkCodeConflict(ctx.admin, code, ownerId)) {
      return { error: `Code "${code}" is already in use` }
    }
  }

  const { data: project, error } = await ctx.admin
    .from('projects')
    .insert({
      name: data.name,
      code,
      description: data.description ?? null,
      color: data.color ?? null,
      sort_order: data.sort_order ?? 0,
      created_by: ownerId,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'project_create', table_name: 'projects', record_id: project.id, after: { name: project.name, code: project.code }, actor: 'web-ui', user_id: ownerId })
  return { project }
}

export async function getAdminProjects(options?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message as string, projects: [] as any[], superAdminProjectId: null, count: 0 }
  }

  let query = ctx.admin
    .from('projects')
    .select(`
      id, name, code, description, is_dormant, sort_order, created_by,
      users!created_by ( role_id )
    `, options?.pageSize ? { count: 'exact' } : undefined)
    .order('sort_order')

  const search = options?.search?.trim().toLowerCase()
  if (search) {
    query = query.or(`name.ilike.*${search}*,code.ilike.*${search}*,description.ilike.*${search}*`)
  }

  if (options?.pageSize) {
    const page = Math.max(0, options.page ?? 0)
    const from = page * options.pageSize
    query = query.range(from, from + options.pageSize - 1)
  }

  const { data, error, count } = await query

  if (error) return { error: error.message, projects: [] as any[], superAdminProjectId: null, count: 0 }

  const projects = data ?? []
  const superAdminProject = projects.find((p: any) => p.users?.role_id === 3 && p.code === 'ORB')
  const superAdminProjectId = superAdminProject?.id ?? null

  return { projects, superAdminProjectId, count: count ?? projects.length }
}

export async function getUserProjects(options?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  const ctx = await getAuthContext()

  let query = ctx.supabase
    .from('projects')
    .select('id, name, code, description, is_dormant, sort_order, created_by', options?.pageSize ? { count: 'exact' } : undefined)
    .order('sort_order')

  const search = options?.search?.trim().toLowerCase()
  if (search) {
    query = query.or(`name.ilike.*${search}*,code.ilike.*${search}*,description.ilike.*${search}*`)
  }

  if (options?.pageSize) {
    const page = Math.max(0, options.page ?? 0)
    const from = page * options.pageSize
    query = query.range(from, from + options.pageSize - 1)
  }

  const { data, error, count } = await query
  if (error) return { error: error.message, projects: [] as any[], count: 0 }
  return { projects: data ?? [], count: count ?? (data ?? []).length }
}

export async function updateProject(id: string, data: {
  name?: string
  code?: string | null
  description?: string | null
  color?: string | null
  sort_order?: number
  is_dormant?: boolean
  created_by?: string | null
}) {
  const ctx = await getAuthContext()
  const client = ctx.isAdmin ? ctx.admin : ctx.supabase

  if (data.code !== undefined) {
    const code = data.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) return { error: 'Project code is required' }
    // Resolve owner for user-scoped conflict check
    const { data: existing, error: existErr } = await ctx.admin.from('projects').select('created_by').eq('id', id).single()
    if (existErr) return { error: 'Failed to look up project' }
    const ownerId = data.created_by ?? existing?.created_by ?? ctx.user.id
    if (await checkCodeConflict(ctx.admin, code, ownerId, id)) {
      return { error: `Code "${code}" is already in use` }
    }
    data = { ...data, code }
  }

  const { data: project, error } = await client
    .from('projects')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'project_update', table_name: 'projects', record_id: id, after: data, actor: 'web-ui', user_id: ctx.user.id })
  return { project }
}

export async function toggleProjectDormancy(id: string, isDormant: boolean) {
  const ctx = await getAuthContext()
  const { data: project, error } = await ctx.supabase
    .from('projects')
    .update({ is_dormant: isDormant })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'project_dormancy', table_name: 'projects', record_id: id, after: { is_dormant: isDormant }, actor: 'web-ui', user_id: ctx.user.id })
  return { project }
}

export async function deleteProjects(ids: string[]) {
  const ctx = await getAuthContext()
  const client = ctx.isAdmin ? ctx.admin : ctx.supabase
  const { error } = await client.from('projects').delete().in('id', ids)
  if (error) return { error: error.message }
  await logAuditEvent({ action: 'project_bulk_delete', table_name: 'projects', after: { count: ids.length, ids }, actor: 'web-ui', user_id: ctx.user.id })
  return { success: true }
}

export async function deleteProject(id: string) {
  const ctx = await getAuthContext()
  const client = ctx.isAdmin ? ctx.admin : ctx.supabase
  const { error } = await client.from('projects').delete().eq('id', id)
  if (error) return { error: error.message }
  await logAuditEvent({ action: 'project_delete', table_name: 'projects', record_id: id, actor: 'web-ui', user_id: ctx.user.id })
  return { success: true }
}
