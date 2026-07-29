import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { visibleProjectsQuery } from '@/lib/projects'

type CurrentProject = {
  id: string
  name: string
  is_dormant: boolean
}

type AppNavProfile = {
  role_id: number
  first_name: string | null
  last_name: string | null
  email: string
  current_project_id: string | null
  current_project: CurrentProject | CurrentProject[] | null
}

export type AppNavContext = {
  isAdmin: boolean
  userInitial: string
  userName?: string
  printContext: { productId: string; productName: string } | undefined
}

function relationRow(value: AppNavProfile['current_project']): CurrentProject | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Resolve the shared navigation context from the same per-user current-project
 * preference used by the dashboard. An invalid/dormant preference is repaired
 * to the first project this user can currently see.
 */
export async function getAppNavContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppNavContext> {
  const { data, error: profileError } = await supabase
    .from('users')
    .select(`
      role_id,
      first_name,
      last_name,
      email,
      current_project_id,
      current_project:projects!users_current_project_id_fkey(id, name, is_dormant)
    `)
    .eq('id', userId)
    .single()

  if (profileError) console.error('[AppNav] Failed to load navigation context:', profileError.message)

  const profile = data as AppNavProfile | null
  const isAdmin = profile?.role_id === 1 || profile?.role_id === 3
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  let currentProject = relationRow(profile?.current_project ?? null)

  if (!currentProject || currentProject.is_dormant) {
    let fallbackQuery = visibleProjectsQuery(supabase, 'id, name, is_dormant')
    if (!isAdmin) fallbackQuery = fallbackQuery.eq('created_by', userId)
    const { data: fallback, error: fallbackError } = await fallbackQuery.limit(1).maybeSingle()
    if (fallbackError) console.error('[AppNav] Failed to resolve fallback project:', fallbackError.message)
    currentProject = (fallback as CurrentProject | null) ?? null

    if (currentProject && profile?.current_project_id !== currentProject.id) {
      const { error } = await supabase
        .from('users')
        .update({ current_project_id: currentProject.id })
        .eq('id', userId)
      if (error) console.error('[AppNav] Failed to repair current project:', error.message)
    }
  }

  return {
    isAdmin,
    userInitial: (profile?.first_name || profile?.email || '?').charAt(0).toUpperCase(),
    userName: fullName || undefined,
    printContext: currentProject
      ? { productId: currentProject.id, productName: currentProject.name }
      : undefined,
  }
}
