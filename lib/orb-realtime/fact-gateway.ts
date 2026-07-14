import { ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import type { AuthContext } from '@/lib/auth'
import { resolveProjectByReference } from '@/lib/projects'
import type { OrbRealtimeFactPacket } from './types'

type JoinedProject = { name: string; code: string }
type CountScope = 'open' | 'active' | 'parked' | 'all'
type TodoProject = { id: string; name: string; code: string; created_by: string }

const COUNT_STATUSES: Record<Exclude<CountScope, 'all'>, string[]> = {
  open: ['open'],
  active: [...ACTIVE_STATUSES],
  parked: [...PARKED_STATUSES],
}

function scopeLabel(scope: CountScope) {
  if (scope === 'active') return 'active (open plus in progress)'
  if (scope === 'parked') return 'parked (deferred plus on hold)'
  return scope
}

export async function getTaskCountPacket(
  auth: AuthContext,
  options: { projectScope?: 'named_project' | 'all_owned'; projectName?: string; statusScope?: CountScope },
): Promise<OrbRealtimeFactPacket> {
  const projectName = options.projectName?.trim()
  if (!options.projectScope) throw new Error('A project scope is required; the count was not widened to all projects.')
  if (options.projectScope === 'named_project' && !projectName) {
    throw new Error('A project name is required for a named-project count.')
  }
  if (options.projectScope === 'all_owned' && projectName) {
    throw new Error('The project scope is inconsistent; choose the named project or an explicit all-project total.')
  }
  const statusScope = options.statusScope ?? 'active'
  let project: { id: string; name: string; code: string } | undefined
  if (options.projectScope === 'named_project') {
    let projectQuery = auth.admin
      .from('projects')
      .select('id, name, code, created_by')
      .eq('is_dormant', false)
      .is('deleted_at', null)
    if (!auth.isAdmin) projectQuery = projectQuery.eq('created_by', auth.user.id)
    const { data: projects, error: projectError } = await projectQuery
    if (projectError) throw projectError
    project = resolveProjectByReference(projects ?? [], projectName!) ?? undefined
    if (!project) throw new Error(`Could not resolve one accessible project named “${projectName}”.`)
  }

  let countQuery = auth.admin
    .from('todos')
    .select('id, projects!inner(id)', { count: 'exact', head: true })
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
    .is('deleted_at', null)
  if (project) countQuery = countQuery.eq('product_id', project.id)
  else countQuery = countQuery.eq('projects.created_by', auth.user.id)
  if (statusScope !== 'all') countQuery = countQuery.in('status', COUNT_STATUSES[statusScope])
  const { count, error } = await countQuery
  if (error) throw error
  const exactCount = count ?? 0
  const subject = project ? project.name : 'projects you own'
  const taskWord = exactCount === 1 ? 'task' : 'tasks'
  const countPhrase = statusScope === 'all'
    ? `${exactCount} ${taskWord} total`
    : `${exactCount} ${scopeLabel(statusScope)} ${taskWord}`
  return {
    kind: 'task_count', observedAt: new Date().toISOString(), source: 'database',
    statuses: statusScope === 'all' ? [] : COUNT_STATUSES[statusScope], count: exactCount,
    project: project ? { id: project.id, name: project.name } : undefined,
    spokenText: `${subject} ${project ? 'has' : 'have'} ${countPhrase}.`,
  }
}

export async function getProjectDirectoryPacket(auth: AuthContext): Promise<OrbRealtimeFactPacket> {
  const { data, error } = await auth.admin
    .from('projects')
    .select('id, name')
    .eq('created_by', auth.user.id)
    .eq('is_dormant', false)
    .is('deleted_at', null)
    .order('sort_order')
    .order('name')
  if (error) throw error
  const projects = data ?? []
  const count = projects.length
  const names = projects.map(project => project.name).join(', ')
  return {
    kind: 'project_directory', observedAt: new Date().toISOString(), source: 'database',
    statuses: [], count, projects,
    spokenText: count === 0
      ? 'You have no current, non-dormant projects that you own.'
      : `You have ${count} current, non-dormant ${count === 1 ? 'project' : 'projects'} that you own: ${names}.`,
  }
}

export async function getTodoDetailsPacket(
  auth: AuthContext,
  options: { code?: string; todoId?: string },
): Promise<OrbRealtimeFactPacket> {
  const match = options.code?.trim().toUpperCase().match(/^(.+)-(\d+)$/)
  if (!options.todoId && !match) throw new Error('Name one todo or use its code, such as ORB-330.')
  let query = auth.admin
    .from('todos')
    .select('id, todo_number, title, status, priority_value, due_at, projects!inner(id, name, code, created_by)')
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
    .is('deleted_at', null)
  if (options.todoId) query = query.eq('id', options.todoId)
  else query = query.eq('todo_number', Number(match![2])).ilike('projects.code', match![1])
  if (!auth.isAdmin) query = query.eq('projects.created_by', auth.user.id)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Could not find that accessible todo.`)
  const project = data.projects as unknown as TodoProject
  const code = `${project.code}-${data.todo_number}`
  const task = {
    id: data.id, code, title: data.title, status: data.status,
    priority: data.priority_value, dueAt: data.due_at, project: project.name,
  }
  const priority = task.priority == null ? '' : ` Priority ${task.priority}.`
  const due = task.dueAt ? ` Due ${task.dueAt}.` : ''
  return {
    kind: 'todo_details', observedAt: new Date().toISOString(), source: 'database',
    statuses: [task.status], count: 1, task,
    spokenText: `${task.code}: ${task.title}. Status: ${task.status}. Project: ${task.project}.${priority}${due}`,
  }
}

export async function getTodoListPacket(
  auth: AuthContext,
  options: {
    projectScope?: 'named_project' | 'all_owned'
    projectName?: string
    statusScope?: CountScope
    textMatch?: string
    maxResults?: number
  },
): Promise<OrbRealtimeFactPacket> {
  const projectName = options.projectName?.trim()
  if (!options.projectScope) throw new Error('A project scope is required; the list was not widened to all projects.')
  if (options.projectScope === 'named_project' && !projectName) throw new Error('A project name is required for a named-project list.')
  if (options.projectScope === 'all_owned' && projectName) throw new Error('The project scope is inconsistent.')
  const statusScope = options.statusScope ?? 'active'
  let project: TodoProject | undefined
  if (options.projectScope === 'named_project') {
    let projectQuery = auth.admin.from('projects').select('id, name, code, created_by').eq('is_dormant', false).is('deleted_at', null)
    if (!auth.isAdmin) projectQuery = projectQuery.eq('created_by', auth.user.id)
    const { data: projects, error } = await projectQuery
    if (error) throw error
    project = resolveProjectByReference(projects ?? [], projectName!) ?? undefined
    if (!project) throw new Error(`Could not resolve one accessible project named “${projectName}”.`)
  }

  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 10)
  let query = auth.admin
    .from('todos')
    .select('id, todo_number, title, status, priority_value, due_at, created_at, projects!inner(id, name, code, created_by)', { count: 'exact' })
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
    .is('deleted_at', null)
    .order('priority_value', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(maxResults)
  if (project) query = query.eq('product_id', project.id)
  else query = query.eq('projects.created_by', auth.user.id)
  if (statusScope !== 'all') query = query.in('status', COUNT_STATUSES[statusScope])
  if (options.textMatch?.trim()) query = query.ilike('title', `%${options.textMatch.trim()}%`)
  const { data, count, error } = await query
  if (error) throw error
  const tasks = (data ?? []).map(row => {
    const joined = row.projects as unknown as TodoProject
    return {
      id: row.id, code: `${joined.code}-${row.todo_number}`, title: row.title,
      status: row.status, priority: row.priority_value, dueAt: row.due_at, project: joined.name,
    }
  })
  const exactCount = count ?? tasks.length
  const subject = project ? project.name : 'projects you own'
  if (exactCount === 0) {
    return {
      kind: 'todo_list', observedAt: new Date().toISOString(), source: 'database',
      statuses: statusScope === 'all' ? [] : COUNT_STATUSES[statusScope], count: 0, tasks: [], project,
      spokenText: `${subject} has no matching ${scopeLabel(statusScope)} tasks.`,
    }
  }
  const list = tasks.map(task => `${task.code}, ${task.title} (${task.status})`).join('; ')
  const prefix = exactCount > tasks.length
    ? `${subject} has ${exactCount} matching tasks. Here are the first ${tasks.length}:`
    : `${subject} has ${exactCount} matching ${exactCount === 1 ? 'task' : 'tasks'}:`
  return {
    kind: 'todo_list', observedAt: new Date().toISOString(), source: 'database',
    statuses: statusScope === 'all' ? [] : COUNT_STATUSES[statusScope], count: exactCount, tasks,
    project: project ? { id: project.id, name: project.name } : undefined,
    spokenText: `${prefix} ${list}.`,
  }
}

export async function getNextStepPacket(auth: AuthContext): Promise<OrbRealtimeFactPacket> {
  const { data, count, error } = await auth.admin
    .from('todos')
    .select('id, todo_number, title, status, priority_value, projects!inner(name, code)', { count: 'exact' })
    .eq('projects.created_by', auth.user.id)
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
    .in('status', [...ACTIVE_STATUSES])
    .is('deleted_at', null)
    .order('priority_value', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  const todo = data?.[0]
  if (!todo) {
    return {
      kind: 'next_step', observedAt: new Date().toISOString(), source: 'database',
      statuses: ['open', 'in progress'], count: count ?? 0,
      spokenText: 'You have no active tasks in projects you own, so there is no verified next task to recommend.',
    }
  }
  const project = todo.projects as unknown as JoinedProject
  const code = `${project.code}-${todo.todo_number}`
  return {
    kind: 'next_step', observedAt: new Date().toISOString(), source: 'database',
    statuses: ['open', 'in progress'], count: count ?? 1,
    task: {
      id: todo.id, code, title: todo.title, status: todo.status,
      priority: todo.priority_value, project: project.name,
    },
    spokenText: `Start with ${code}, ${todo.title}, in ${project.name}. It is the highest-priority active task in the current database snapshot.`,
  }
}
