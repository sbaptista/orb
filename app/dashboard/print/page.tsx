import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, isParked } from '@/lib/status-groups'
import PrintStyles from '@/components/print/PrintStyles'

type Project = { id: string; name: string; code: string | null; description: string | null }
type Todo = {
  id: string
  todo_number: number
  title: string
  description: string | null
  status: string
  priority_value: number | null
  due_at: string | null
  created_at: string
  closed_at: string | null
  resolution_notes: string | null
  product_id: string
}
type Priority = { value: number; label: string }

const STATUS_ORDER: Record<string, number> = {
  'open': 0,
  'in progress': 1,
  'deferred': 2,
  'on hold': 3,
  'closed': 4,
}

const GROUP_LABELS: Record<string, string> = {
  active: 'Active (open + in progress)',
  parked: 'Parked (deferred + on hold)',
  closed: 'Closed',
}

function getStatusGroup(status: string): 'active' | 'parked' | 'closed' {
  if (isActive(status)) return 'active'
  if (isParked(status)) return 'parked'
  return 'closed'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const scope = sp.scope === 'project' ? 'project' : 'all'
  const projectId = typeof sp.id === 'string' ? sp.id : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch projects
  let projects: Project[]
  if (scope === 'project' && projectId) {
    const { data } = await supabase
      .from('projects')
      .select('id, name, code, description')
      .eq('id', projectId)
      .single()
    projects = data ? [data] : []
  } else {
    const { data } = await visibleProjectsQuery(supabase, 'id, name, code, description')
    projects = (data ?? []) as Project[]
  }

  if (projects.length === 0) {
    return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>No projects found.</div>
  }

  const projectIds = projects.map(p => p.id)

  // Fetch all non-deleted todos for these projects
  const { data: todosRaw } = await supabase
    .from('todos')
    .select('id, todo_number, title, description, status, priority_value, due_at, created_at, closed_at, resolution_notes, product_id')
    .in('product_id', projectIds)
    .is('deleted_at', null)
    .order('priority_value', { ascending: true })
    .order('created_at', { ascending: true })

  const todos = (todosRaw ?? []) as Todo[]

  // Fetch priorities for labels
  const { data: prioritiesRaw } = await supabase
    .from('priorities')
    .select('value, label')
    .order('value')

  const priorityMap = new Map<number, string>()
  for (const p of (prioritiesRaw ?? []) as Priority[]) {
    priorityMap.set(p.value, p.label)
  }

  // Group todos by project, then by status group
  const projectMap = new Map<string, Project>()
  for (const p of projects) projectMap.set(p.id, p)

  type GroupedProject = {
    project: Project
    groups: { key: string; label: string; todos: Todo[] }[]
    total: number
  }

  const grouped: GroupedProject[] = projects.map(project => {
    const projectTodos = todos.filter(t => t.product_id === project.id)

    // Sort: by status group order, then priority (lower = higher priority), then created_at
    projectTodos.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99
      const sb = STATUS_ORDER[b.status] ?? 99
      if (sa !== sb) return sa - sb
      const pa = a.priority_value ?? 999
      const pb = b.priority_value ?? 999
      if (pa !== pb) return pa - pb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    const groupOrder: ('active' | 'parked' | 'closed')[] = ['active', 'parked', 'closed']
    const groups = groupOrder
      .map(key => ({
        key,
        label: GROUP_LABELS[key],
        todos: projectTodos.filter(t => getStatusGroup(t.status) === key),
      }))
      .filter(g => g.todos.length > 0)

    return { project, groups, total: projectTodos.length }
  })

  // Summary counts
  const totalTodos = todos.length
  const totalActive = todos.filter(t => getStatusGroup(t.status) === 'active').length
  const totalParked = todos.filter(t => getStatusGroup(t.status) === 'parked').length
  const totalClosed = todos.filter(t => getStatusGroup(t.status) === 'closed').length

  const scopeLabel = scope === 'project' && projects.length === 1
    ? `Project: ${projects[0].name}`
    : 'All Projects'

  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="print-root">
      <PrintStyles />

      {/* Screen-only action bar */}
      <div className="print-actions">
        <span>Orb Print Preview — {scopeLabel}</span>
        <button onClick={undefined} id="print-trigger">Print / Save PDF</button>
      </div>
      <div style={{ height: '56px' }} className="no-print" />

      {/* Page header */}
      <div className="print-page-header">
        <h1>Orb — Project Backlog Export</h1>
        <div className="print-meta">
          {scopeLabel} &middot; Printed {printDate}
        </div>
      </div>

      {/* Projects */}
      {grouped.map(({ project, groups, total }) => (
        <section key={project.id} className="print-project">
          <div className="print-project-header">
            <h2>{project.name}</h2>
            {project.description && (
              <div className="print-project-desc">{project.description}</div>
            )}
          </div>

          {total === 0 && (
            <p style={{ fontSize: '10pt', color: '#888', fontStyle: 'italic' }}>No todos in this project.</p>
          )}

          {groups.map(group => (
            <div key={group.key} className="print-status-group">
              <h3>{group.label} ({group.todos.length})</h3>

              {group.todos.map(todo => {
                const ref = project.code
                  ? `${project.code}-${todo.todo_number}`
                  : `#${todo.todo_number}`

                return (
                  <div key={todo.id} className="print-todo">
                    <div className="print-todo-header">
                      <span className="print-todo-ref">{ref}</span>
                      <span className="print-todo-title">{todo.title}</span>
                      <div className="print-todo-badges">
                        <span className="print-badge print-badge-status">{todo.status}</span>
                        {todo.priority_value != null && (
                          <span className="print-badge">
                            {priorityMap.get(todo.priority_value) ?? `P${todo.priority_value}`}
                          </span>
                        )}
                        {todo.due_at && (
                          <span className="print-badge">Due {formatDate(todo.due_at)}</span>
                        )}
                      </div>
                    </div>

                    {todo.description && (
                      <div className="print-todo-description">{todo.description}</div>
                    )}

                    {todo.resolution_notes && (
                      <div className="print-todo-resolution">
                        <div className="print-todo-resolution-label">Resolution</div>
                        {todo.resolution_notes}
                      </div>
                    )}

                    <div className="print-todo-dates">
                      Created {formatDateTime(todo.created_at)}
                      {todo.closed_at && <> &middot; Closed {formatDateTime(todo.closed_at)}</>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      ))}

      {/* Summary */}
      <div className="print-summary">
        <h2>Summary</h2>
        {grouped.map(({ project, groups, total }) => (
          <div key={project.id} className="print-summary-row">
            <span>{project.name}</span>
            <span>
              {total} todo{total !== 1 ? 's' : ''}
              {' — '}
              {groups.map(g => `${g.todos.length} ${g.label.toLowerCase()}`).join(', ')}
            </span>
          </div>
        ))}
        <div className="print-summary-row print-summary-total">
          <span>Total across {projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          <span>{totalTodos} todos — {totalActive} active (open + in progress), {totalParked} parked (deferred + on hold), {totalClosed} closed</span>
        </div>
      </div>

      {/* Auto-print trigger */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded', function() {
          var btn = document.getElementById('print-trigger');
          if (btn) btn.addEventListener('click', function() { window.print(); });
          setTimeout(function() { window.print(); }, 600);
        });
      ` }} />
    </div>
  )
}
