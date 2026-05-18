'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

async function checkCodeConflict(admin: ReturnType<typeof createAdminClient>, code: string, excludeId?: string) {
  const query = admin.from('projects').select('id').ilike('code', code)
  if (excludeId) query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  return !!data
}

export async function createProject(data: {
  name: string
  code?: string | null
  description?: string | null
  color?: string | null
  sort_order?: number
  ownerId?: string | null
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const code = data.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!code) return { error: 'Project code is required' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  if (await checkCodeConflict(admin, code)) {
    return { error: `Code "${code}" is already in use` }
  }

  const { data: project, error } = await admin
    .from('projects')
    .insert({
      name: data.name,
      code,
      description: data.description ?? null,
      color: data.color ?? null,
      sort_order: data.sort_order ?? 0,
      created_by: data.ownerId ?? user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { project }
}

export async function getAdminProjects() {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message as string, projects: [] as any[] }
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('projects')
    .select('id, name, code, description, is_shared, sort_order, created_by')
    .order('sort_order')
  if (error) return { error: error.message, projects: [] as any[] }
  return { projects: data ?? [] }
}

export async function updateProject(id: string, data: {
  name?: string
  code?: string | null
  description?: string | null
  color?: string | null
  sort_order?: number
  is_shared?: boolean
  created_by?: string | null
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()

  if (data.code !== undefined) {
    const code = data.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) return { error: 'Project code is required' }
    if (await checkCodeConflict(admin, code, id)) {
      return { error: `Code "${code}" is already in use` }
    }
    data = { ...data, code }
  }

  const { data: project, error } = await admin
    .from('projects')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { project }
}

export async function deleteProjects(ids: string[]) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('projects').delete().in('id', ids)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteProject(id: string) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('projects').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
