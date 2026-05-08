'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'

/**
 * Strips out joined objects/arrays that aren't real columns in the table.
 * Supabase upsert fails if we include relation data.
 */
function cleanForUpsert(data: any[]) {
  return data.map((row: any) => {
    const clean = { ...row }
    Object.keys(clean).forEach(key => {
      // If it's an object/array (and not null), it's likely a joined relation
      if (clean[key] && typeof clean[key] === 'object') {
        delete clean[key]
      }
    })
    return clean
  })
}

export async function importData(payload: any) {
  const supabase = createAdminClient()

  try {
    // Wrap recognized raw arrays; reject anything else that's a raw array
    if (Array.isArray(payload)) {
      const first = payload[0] ?? {}
      if (payload.length === 0) return { error: 'File contains an empty array — nothing to import.' }
      if (first.title && first.content && !first.status) {
        // knowledge_repo entries (have title + content, no todo status field)
        payload = { knowledge_repo: payload }
      } else if (first.todos) {
        // Shouldn't happen (array of objects each with a todos key), reject
        return { error: 'Unrecognized file format. Use a file exported by this app.' }
      } else {
        return { error: 'Unrecognized file format. Use a file exported by this app.' }
      }
    }

    // Import in dependency order to respect foreign keys
    // 1. Projects/Products
    if (payload.products || payload.projects) {
      const data = cleanForUpsert(payload.products || payload.projects)
      const { error } = await supabase.from('projects').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    // 2. Statuses & Priorities & Platforms
    if (payload.statuses) {
      const data = cleanForUpsert(payload.statuses)
      const { error } = await supabase.from('statuses').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.priorities) {
      const data = cleanForUpsert(payload.priorities)
      const { error } = await supabase.from('priorities').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.platforms) {
      const data = cleanForUpsert(payload.platforms)
      const { error } = await supabase.from('platforms').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    // 3. Groups & Categories
    if (payload.groups) {
      const data = cleanForUpsert(payload.groups)
      const { error } = await supabase.from('groups').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }
    if (payload.categories) {
      const data = cleanForUpsert(payload.categories)
      const { error } = await supabase.from('categories').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    // 4. Todos
    if (payload.todos) {
      const data = cleanForUpsert(payload.todos)
      const { error } = await supabase.from('todos').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    // 5. Todo Platforms
    if (payload.todo_platforms) {
      const data = cleanForUpsert(payload.todo_platforms)
      const { error } = await supabase.from('todo_platforms').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    // 6. Knowledge Repo
    if (payload.knowledge_repo || payload.knowledge) {
      const data = cleanForUpsert(payload.knowledge_repo || payload.knowledge)
      const { error } = await supabase.from('knowledge_repo').upsert(data, { onConflict: 'id' })
      if (error) throw error
    }

    await logAuditEvent({ 
      action: 'data_import', 
      table_name: 'system',
      after: { tables: Object.keys(payload) }
    })

    revalidatePath('/settings/data')
    return { ok: true }

  } catch (err: any) {
    console.error('[importData] Error:', err)
    return { error: err.message }
  }
}
