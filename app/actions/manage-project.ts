'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function createProject(data: {
  name: string
  code: string | null
  description: string | null
  ownerId?: string | null
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: project, error } = await admin
    .from('projects')
    .insert({
      name: data.name,
      code: data.code,
      description: data.description,
      sort_order: 0,
      created_by: data.ownerId ?? user.id,
    })
    .select('id, name, code, description, created_by')
    .single()

  if (error) return { error: error.message }
  return { project }
}

export async function updateProject(id: string, data: {
  name: string
  code: string | null
  description: string | null
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { data: project, error } = await admin
    .from('projects')
    .update({
      name: data.name,
      code: data.code,
      description: data.description,
    })
    .eq('id', id)
    .select('id, name, code, description, created_by')
    .single()

  if (error) return { error: error.message }
  return { project }
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
