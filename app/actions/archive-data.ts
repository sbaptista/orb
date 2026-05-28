'use server'

import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export type ArchiveResult = {
  success: boolean
  count: number
  data?: any[]
  error?: string
}

export async function prepareArchive() {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { success: false, error: e.message, count: 0 }
  }

  const THRESHOLD_DAYS = 30
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS)

  const { data: closedStatuses } = await ctx.admin
    .from('statuses')
    .select('name')
    .eq('is_closed', true)

  const closedStatusNames = closedStatuses?.map(s => s.name) || ['closed']

  const { data: toArchive, error: fetchError } = await ctx.admin
    .from('todos')
    .select('*, projects(code, name)')
    .in('status', closedStatusNames)
    .lt('closed_at', thresholdDate.toISOString())
    .is('archived_at', null)

  if (fetchError) return { success: false, error: fetchError.message, count: 0 }
  if (!toArchive || toArchive.length === 0) return { success: true, count: 0 }

  return { success: true, count: toArchive.length, data: toArchive }
}

export async function purgeArchivedTasks(ids: string[]) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const { error } = await ctx.admin
    .from('todos')
    .delete()
    .in('id', ids)

  if (error) return { success: false, error: error.message }

  logAuditEvent({
    action: 'task_purge',
    table_name: 'todos',
    before: { count: ids.length },
    actor: 'admin-ui',
    user_id: ctx.user.id,
  }).catch(err => console.error('[archive-data] Audit log failed:', err))

  return { success: true }
}
