'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function saveKnowledge(params: {
  product_id: string
  origin_todo_id: string | null
  title: string
  content: string
}) {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('knowledge_repo')
      .insert(params)
      .select()
      .single()

    if (error) throw error

    await logAuditEvent({ 
      action: 'knowledge_distill', 
      table_name: 'knowledge_repo',
      record_id: data.id,
      after: { title: data.title, todo_id: params.origin_todo_id }
    })

    revalidatePath('/settings/knowledge')
    return { ok: true, data }
  } catch (err: any) {
    console.error('[saveKnowledge] Error:', err)
    return { error: err.message }
  }
}
