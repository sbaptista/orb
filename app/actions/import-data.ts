'use server'

import { requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'

/**
 * Real jsonb **object** columns, which must survive a restore.
 *
 * The strip below removes nested objects because Supabase returns joined
 * relationships that way (`select('*, projects(code, name)')`) and they are not
 * writable columns. A genuine jsonb object column is indistinguishable from a
 * relationship by shape alone, so it has to be named here or the restore
 * silently drops it — the row comes back, the column comes back empty.
 *
 * Array-valued JSON columns (todos.urls, knowledge_repo.tags) need no entry;
 * the strip already spares arrays.
 *
 * **Add to this set whenever a jsonb object column is added to an archived
 * table**, in the same change as the migration.
 */
const JSONB_OBJECT_COLUMNS = new Set([
  'urgency_windows', // projects — ORB-361 Phase 3
])

function cleanForUpsert(data: any[]) {
  return data.map((row: any) => {
    const clean = { ...row }
    Object.keys(clean).forEach(key => {
      if (JSONB_OBJECT_COLUMNS.has(key)) return
      // Supabase relationship objects are not writable columns, but JSON array
      // columns (todos.urls, knowledge_repo.tags) are part of the archive.
      if (clean[key] && typeof clean[key] === 'object' && !Array.isArray(clean[key])) {
        delete clean[key]
      }
    })
    return clean
  })
}

export async function importData(payload: any) {
  const ctx = await requireAdmin()

  try {
    if (Array.isArray(payload)) {
      const first = payload[0] ?? {}
      if (payload.length === 0) return { error: 'File contains an empty array — nothing to import.' }
      if (first.title && first.content && !first.status) {
        payload = { knowledge_repo: payload }
      } else if (first.todos) {
        return { error: 'Unrecognized file format. Use a file exported by this app.' }
      } else {
        return { error: 'Unrecognized file format. Use a file exported by this app.' }
      }
    }

    if (payload.products || payload.projects) {
      const data = cleanForUpsert(payload.products || payload.projects)
      const { error } = await ctx.admin.from('projects').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    if (payload.statuses) {
      const data = cleanForUpsert(payload.statuses)
      const { error } = await ctx.admin.from('statuses').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.priorities) {
      const data = cleanForUpsert(payload.priorities)
      const { error } = await ctx.admin.from('priorities').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.platforms) {
      const data = cleanForUpsert(payload.platforms)
      const { error } = await ctx.admin.from('platforms').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    if (payload.groups) {
      const data = cleanForUpsert(payload.groups)
      const { error } = await ctx.admin.from('groups').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.categories) {
      const data = cleanForUpsert(payload.categories)
      const { error } = await ctx.admin.from('categories').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    if (payload.todos) {
      const data = cleanForUpsert(payload.todos)
      const { error } = await ctx.admin.rpc('restore_todos_from_archive', { p_rows: data })
      if (error) throw error
    }

    if (payload.todo_platforms) {
      const data = cleanForUpsert(payload.todo_platforms)
      const { error } = await ctx.admin.from('todo_platforms').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    if (payload.knowledge_repo || payload.knowledge) {
      const data = cleanForUpsert(payload.knowledge_repo || payload.knowledge)
      const { error } = await ctx.admin.from('knowledge_repo').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    await logAuditEvent({
      action: 'data_import',
      table_name: 'system',
      after: { tables: Object.keys(payload) },
      actor: 'admin-ui',
      user_id: ctx.user.id,
    })

    revalidatePath('/settings/backup')
    return { ok: true }

  } catch (err: any) {
    console.error('[importData] Error:', err)
    return { error: err.message }
  }
}
