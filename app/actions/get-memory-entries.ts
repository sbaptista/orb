'use server'

import { getAuthContext } from '@/lib/auth'

type MemoryEntry = {
  id: string
  track: string
  category: string
  content: string
  context: string | null
  confidence: number
  expires_at: string | null
  created_at: string
  updated_at: string
}

export async function getMemoryEntries(options: {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
} = {}) {
  const auth = await getAuthContext()
  const supabase = auth.supabase
  const page = Math.max(0, options.page ?? 0)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25))
  const search = options.search?.trim().toLowerCase() ?? ''

  try {
    const from = page * pageSize

    if (!search) {
      let query = supabase
        .from('orb_memory')
        .select('*', { count: 'exact' })
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })

      if (options.createdFrom) query = query.gte('created_at', options.createdFrom)
      if (options.createdTo) query = query.lte('created_at', options.createdTo)
      if (options.createdBefore) query = query.lt('created_at', options.createdBefore)

      const { data, error, count } = await query.range(from, from + pageSize - 1)
      if (error) throw error
      return { ok: true, data: data ?? [], count: count ?? 0 }
    }

    let query = supabase
      .from('orb_memory')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })

    if (options.createdFrom) query = query.gte('created_at', options.createdFrom)
    if (options.createdTo) query = query.lte('created_at', options.createdTo)
    if (options.createdBefore) query = query.lt('created_at', options.createdBefore)

    const { data: entries, error } = await query

    if (error) throw error

    let filtered = (entries ?? []) as MemoryEntry[]
    filtered = filtered.filter(entry => {
      const searchable = [entry.content, entry.category, entry.track, entry.context]
      return searchable.some(v => v?.toLowerCase().includes(search))
    })

    return {
      ok: true,
      data: filtered.slice(from, from + pageSize),
      count: filtered.length,
    }
  } catch (err: any) {
    console.error('[getMemoryEntries] Error:', err)
    return { error: err.message }
  }
}

export async function updateMemoryEntry(id: string, content: string) {
  const auth = await getAuthContext()
  const { error } = await auth.supabase
    .from('orb_memory')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteMemoryEntry(id: string) {
  const auth = await getAuthContext()
  const { error } = await auth.supabase
    .from('orb_memory')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)
  if (error) return { error: error.message }
  return { ok: true }
}
