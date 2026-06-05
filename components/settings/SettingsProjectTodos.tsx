'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { getProjectTodos } from '@/app/actions/get-user-detail'
import { useBreadcrumbOverrides } from '@/lib/hooks/useBreadcrumbOverrides'
import Link from 'next/link'

type Project = {
  id: string
  name: string
  created_by: string
}

type Todo = {
  id: string
  title: string
  status: string
  priority_value: number | null
  created_at: string
}

type Status = {
  id: string
  name: string
  sort_order: number
  is_closed: boolean
}

type Priority = {
  value: number
  label: string
}

export default function SettingsProjectTodos({ projectId }: { projectId: string }) {
  const { setOverride } = useBreadcrumbOverrides()

  const [project, setProject] = useState<Project | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    const res = await getProjectTodos(projectId)

    if (res.error) {
      if (res.error === 'Access denied') setAccessDenied(true)
      setLoading(false)
      return
    }

    if (res.project) {
      setProject(res.project as Project)
      setOverride('/settings/projects', `/settings/users/${(res.project as Project).created_by}`)
    }
    setTodos(res.todos as Todo[])
    setStatuses(res.statuses as Status[])
    setPriorities(res.priorities as Priority[])
    setLoading(false)
    loaded.current = true
  }, [projectId, setOverride])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  if (loading) return <div className="s-loading">Loading…</div>
  if (accessDenied) return (
    <div className="settings-page s-page" style={{ alignItems: 'center', justifyContent: 'center', paddingTop: '10vh' }}>
      <div className="s-card" style={{ maxWidth: '500px', textAlign: 'center', padding: 'var(--sp-2xl)' }}>
        <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--sp-sm)', fontWeight: 600 }}>Access Denied</h3>
        <p style={{ color: 'var(--text2)', marginBottom: 'var(--sp-xl)', lineHeight: 1.6 }}>
          You do not have permission to view this project&apos;s todos.
        </p>
        <Link href="/settings/users" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Back to Users
        </Link>
      </div>
    </div>
  )
  if (!project) return <div className="s-error">Project not found</div>

  return (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
          <h2 className="s-title" style={{ marginBottom: '4px' }}>{project.name} — Todos</h2>
          <p className="text-sm text-muted">{todos.length} total tasks</p>
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="s-card s-empty">No todos found for this project.</div>
      ) : (
        <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  <th className="audit-th" style={{ width: '50%' }}>Title</th>
                  <th className="audit-th">Status</th>
                  <th className="audit-th">Priority</th>
                  <th className="audit-th">Created</th>
                </tr>
              </thead>
              <tbody>
                {todos.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="audit-td" style={{ fontWeight: 500 }} title={t.title}>{t.title}</td>
                    <td className="audit-td">
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        background: statuses.find(s => s.name === t.status)?.is_closed ? 'var(--success)' : t.status === 'in progress' ? 'var(--pill-active-bg)' : 'var(--bg3)',
                        color: statuses.find(s => s.name === t.status)?.is_closed ? '#fff' : t.status === 'in progress' ? 'var(--pill-active-color)' : 'var(--text2)'
                      }}>
                        {t.status}
                      </span>
                    </td>
                    <td className="audit-td">
                      {t.priority_value ? `${t.priority_value}-${priorities.find(p => p.value === t.priority_value)?.label ?? ''}` : '—'}
                    </td>
                    <td className="audit-td" style={{ color: 'var(--muted)' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
