'use server'

import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * Admin-side edits for Settings → Knowledge.
 *
 * Why these are server actions (2026-09-17): the screen used the browser
 * Supabase client, so RLS applied. The update and delete policies on
 * `knowledge_repo` require a matching `projects` row, which no entry with a
 * NULL `product_id` can satisfy — the documented shape for a cross-project
 * entry, and what `orb-agent-approve` produced until v0.6.329. The update
 * matched zero rows, PostgREST reported success, and the UI said the entry was
 * saved while nothing changed. The 2026-07-04 migration that widened only the
 * SELECT policy assumed this screen already wrote through the service role;
 * these actions make that true rather than granting every signed-in user write
 * access to cross-project entries.
 *
 * Each action asks the database which rows it touched and fails when the answer
 * is none: a write that changes nothing must never be reported as saved.
 */

export type KnowledgeRecord = {
  title: string
  content: string
  tags: string[]
  product_id: string | null
}

export async function updateKnowledgeEntry(id: string, record: KnowledgeRecord) {
  const ctx = await requireAdmin()
  try {
    const { data, error } = await ctx.admin
      .from('knowledge_repo')
      // updated_at is maintained by the table's BEFORE UPDATE trigger
      // (20260805_knowledge_repo_updated_at.sql); do not set it here.
      .update(record)
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No knowledge entry was updated — it may have been deleted.')
    revalidatePath('/settings/knowledge')
    return { ok: true as const, id: data[0].id as string }
  } catch (err: any) {
    console.error('[updateKnowledgeEntry] Error:', err)
    return { error: err.message as string }
  }
}

export async function deleteKnowledgeEntries(ids: string[]) {
  const ctx = await requireAdmin()
  try {
    if (ids.length === 0) throw new Error('No knowledge entries were selected.')
    const { data, error } = await ctx.admin
      .from('knowledge_repo')
      .delete()
      .in('id', ids)
      .select('id')
    if (error) throw error
    const deleted = data?.length ?? 0
    if (deleted !== ids.length) {
      throw new Error(`Deleted ${deleted} of ${ids.length} knowledge entries — the rest were not found.`)
    }
    revalidatePath('/settings/knowledge')
    return { ok: true as const, deleted }
  } catch (err: any) {
    console.error('[deleteKnowledgeEntries] Error:', err)
    return { error: err.message as string }
  }
}
