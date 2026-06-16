'use server'

import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export async function updateUserStage(
  targetUserId: string,
  stage: 'pre-alpha' | 'alpha' | 'beta' | null
) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message as string }
  }

  const { data: current } = await ctx.admin
    .from('users')
    .select('program_joined_at')
    .eq('id', targetUserId)
    .single()

  const updates: Record<string, any> = { release_stage: stage }

  if (stage !== null && !current?.program_joined_at) {
    updates.program_joined_at = new Date().toISOString()
  }

  const { error } = await ctx.admin
    .from('users')
    .update(updates)
    .eq('id', targetUserId)

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'user_stage_change', table_name: 'users', record_id: targetUserId, after: updates, actor: 'admin-ui', user_id: ctx.user.id })
  return { success: true }
}
