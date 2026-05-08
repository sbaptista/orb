'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'

export async function purgeKnowledge(ids: string[]) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('knowledge_repo')
      .delete()
      .in('id', ids)

    if (error) throw error

    await logAuditEvent({ 
      action: 'knowledge_purge', 
      table_name: 'knowledge_repo',
      before: { count: ids.length } 
    })

    revalidatePath('/settings/knowledge')
    return { ok: true }
  } catch (err: any) {
    console.error('[purgeKnowledge] Error:', err)
    return { error: err.message }
  }
}
