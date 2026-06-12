'use server'

import { requireAdmin } from '@/lib/auth'

type KnowledgeSortKey = 'project' | 'title'

type KnowledgeEntry = {
  id: string
  product_id: string
  origin_todo_id: string | null
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
  projects: { name: string; code: string } | null
}

export async function getKnowledgeEntries(options: {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
} = {}) {
  const ctx = await requireAdmin()
  const page = Math.max(0, options.page ?? 0)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25))
  const search = options.search?.trim().toLowerCase() ?? ''
  const sortKey: KnowledgeSortKey | null = options.sortKey === 'project' || options.sortKey === 'title'
    ? options.sortKey
    : null
  const sortDir = options.sortDir === 'desc' ? 'desc' : 'asc'

  try {
    const projectsPromise = ctx.admin
      .from('projects')
      .select('id, name, code')
      .eq('is_dormant', false)
      .order('sort_order')

    if (!search && sortKey !== 'project') {
      const from = page * pageSize
      let entriesQuery = ctx.admin
        .from('knowledge_repo')
        .select('*, projects(name, code)', { count: 'exact' })

      if (sortKey === 'title') {
        entriesQuery = entriesQuery
          .order('title', { ascending: sortDir === 'asc' })
          .order('created_at', { ascending: false })
      } else {
        entriesQuery = entriesQuery.order('created_at', { ascending: false })
      }

      const [{ data, error, count }, { data: projects, error: projectsError }] = await Promise.all([
        entriesQuery.range(from, from + pageSize - 1),
        projectsPromise,
      ])

      if (error) throw error
      if (projectsError) throw projectsError

      return {
        ok: true,
        data: data ?? [],
        count: count ?? 0,
        projects: projects ?? [],
      }
    }

    const [{ data: entries, error }, { data: projects, error: projectsError }] = await Promise.all([
      ctx.admin
        .from('knowledge_repo')
        .select('*, projects(name, code)'),
      projectsPromise,
    ])

    if (error) throw error
    if (projectsError) throw projectsError

    let filtered = (entries ?? []) as KnowledgeEntry[]

    if (search) {
      filtered = filtered.filter(entry => {
        const searchable = [
          entry.title,
          entry.content,
          entry.projects?.code,
          entry.projects?.name,
          ...(entry.tags ?? []),
        ]
        return searchable.some(value => value?.toLowerCase().includes(search))
      })
    }

    filtered.sort((a, b) => {
      if (!sortKey) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

      const aValue = sortKey === 'project' ? a.projects?.code ?? '' : a.title
      const bValue = sortKey === 'project' ? b.projects?.code ?? '' : b.title
      const comparison = aValue.localeCompare(bValue)
      return sortDir === 'asc' ? comparison : -comparison
    })

    const from = page * pageSize
    return {
      ok: true,
      data: filtered.slice(from, from + pageSize),
      count: filtered.length,
      projects: projects ?? [],
    }
  } catch (err: any) {
    console.error('[getKnowledgeEntries] Error:', err)
    return { error: err.message }
  }
}
