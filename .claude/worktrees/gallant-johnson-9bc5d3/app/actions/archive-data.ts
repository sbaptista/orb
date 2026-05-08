'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

export type ArchiveResult = {
  success: boolean
  count: number
  data?: any[]
  error?: string
}

/**
 * Fetches closed tasks older than 30 days for archival.
 * Does NOT delete them yet—that happens after the client confirms the download.
 */
export async function prepareArchive() {
  const supabase = createAdminClient()
  
  const THRESHOLD_DAYS = 30
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS)

  // Get closed status names
  const { data: closedStatuses } = await supabase
    .from('statuses')
    .select('name')
    .eq('is_closed', true)

  const closedStatusNames = closedStatuses?.map(s => s.name) || ['done', 'closed']

  const { data: toArchive, error: fetchError } = await supabase
    .from('todos')
    .select('*, projects(code, name)')
    .in('status', closedStatusNames)
    .lt('closed_at', thresholdDate.toISOString())
    .is('archived_at', null)

  if (fetchError) return { success: false, error: fetchError.message, count: 0 }
  if (!toArchive || toArchive.length === 0) return { success: true, count: 0 }

  return { success: true, count: toArchive.length, data: toArchive }
}

/**
 * Permanently deletes tasks after they've been successfully downloaded by the user.
 */
export async function purgeArchivedTasks(ids: string[]) {
  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('todos')
    .delete()
    .in('id', ids)

  if (error) return { success: false, error: error.message }
  
  await logAuditEvent({ 
    action: 'task_purge', 
    table_name: 'todos',
    before: { count: ids.length } 
  })
  
  return { success: true }
}
