import { ACTIVE_STATUSES, PARKED_STATUSES } from '@/lib/status-groups'
import type { AuthContext } from '@/lib/auth'
import { resolveProjectByReference } from '@/lib/projects'
import type { OrbRealtimeFactPacket } from './types'
import { explainUrgency, parseUrgencyWindows, describeWindowLead, type UrgencyWindowsByProject } from '@/lib/orb-state'

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
  const subject = project ? project.name : (auth.isAdmin ? 'all projects you can see' : 'your projects')
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
    .select('id, todo_number, title, status, priority_value, due_at, due_timezone,projects!inner(id, name, code, created_by)')
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
    offset?: number
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

  // ORB-372: this was capped at 10 because the only output was speech. The
  // transcript now renders a table, so FETCHING and DISPLAYING is not the same
  // cost as reading aloud — conflating them meant a 12-result search looked
  // like a 10-result one. query_db already allows 200 and query_projects 100;
  // list_todos was the outlier. The spoken summary stays short regardless.
  const maxResults = Math.min(Math.max(options.maxResults ?? 50, 1), 200)
  // ORB-372: paging. The previous build told the user to say "show the rest"
  // with nothing implementing it, so asking repeated the same page. An offset
  // is the smallest thing that makes that promise keepable.
  const offset = Math.max(options.offset ?? 0, 0)
  let query = auth.admin
    .from('todos')
    .select('id, todo_number, title, status, priority_value, due_at, due_timezone,created_at, projects!inner(id, name, code, created_by)', { count: 'exact' })
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
    .is('deleted_at', null)
    .order('priority_value', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + maxResults - 1)
  if (project) query = query.eq('product_id', project.id)
  // ORB-372: this branch filtered to owned projects UNCONDITIONALLY, unlike
  // every other query in this file (lines ~42, ~110, ~147 all guard with
  // !auth.isAdmin). For an admin it silently excluded projects they can see —
  // and contradicted the spoken subject, which now says "all projects you can
  // see". The filter belongs to non-admins only.
  else if (!auth.isAdmin) query = query.eq('projects.created_by', auth.user.id)
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
  // ORB-372: unprioritised todos sort LAST (nullsFirst: false), so a capped
  // list drops exactly the items a user is least likely to have in mind and
  // most likely to be hunting for. Stan searched "voice", got an accurate
  // count of 12 and a list of 10 — the two missing ones were the two he
  // meant. The omission is now stated with what to say to see them.
  const omitted = Math.max(0, exactCount - tasks.length)
  const subject = project ? project.name : (auth.isAdmin ? 'all projects you can see' : 'your projects')
  if (exactCount === 0) {
    return {
      kind: 'todo_list', observedAt: new Date().toISOString(), source: 'database',
      statuses: statusScope === 'all' ? [] : COUNT_STATUSES[statusScope], count: 0, tasks: [], project,
      spokenText: `${subject} has no matching ${scopeLabel(statusScope)} tasks.`,
    }
  }
  // "Here are the first 10" reads as a formatting note; it is actually a
  // statement that some results are missing, and the ones cut are the
  // lowest-priority — often exactly what the user is hunting for. Say what is
  // missing and how to get it, rather than leaving the user to notice.
  // The table on screen carries every row, so speaking all of them is
  // redundant — and the previous wording told the user to say "show the rest",
  // which nothing implements. Never advertise a capability that does not
  // exist: that is the same defect as the rest of this ticket.
  const shownFrom = offset + 1
  const shownTo = offset + tasks.length
  const spokenSummary = exactCount > tasks.length
    ? `${subject} has ${exactCount} matching ${exactCount === 1 ? 'task' : 'tasks'}. Showing ${shownFrom} to ${shownTo} on screen — say "show the next page" for more.`
    : `${subject} has ${exactCount} matching ${exactCount === 1 ? 'task' : 'tasks'}, on screen now.`
  return {
    kind: 'todo_list', observedAt: new Date().toISOString(), source: 'database',
    statuses: statusScope === 'all' ? [] : COUNT_STATUSES[statusScope], count: exactCount, tasks,
    project: project ? { id: project.id, name: project.name } : undefined,
    spokenText: spokenSummary,
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
      spokenText: `You have no active tasks in ${auth.isAdmin ? 'any project you can see' : 'your projects'}, so there is no verified next task to recommend.`,
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


/**
 * ORB-368 — the orb's mood, and why, for voice.
 *
 * Text has had this since ORB-361 Phase 3.3: the project-health packet carries
 * orb_state and orb_state_because, so the Orb can name the task and rule
 * driving a colour. Voice never got it — buildOrbContext serves the serial
 * conversation and the eval route only — so asked "why is it urgent?", voice
 * fell back to querying todos and guessed. That is the confabulation Phase 3.3
 * was built to eliminate, still fully present in the other channel.
 *
 * Deliberately a TOOL rather than session instructions: a Realtime session is
 * long-lived, so a mood baked in at session creation would describe the past.
 * This is computed when asked, from the same explainUrgency() the dashboard and
 * the text packet use — one implementation, three surfaces.
 */
export async function getOrbStatePacket(
  auth: AuthContext,
  options: { projectName?: string } = {},
): Promise<OrbRealtimeFactPacket> {
  let project: { id: string; name: string; code: string } | null = null
  if (options.projectName) {
    let lookup = auth.admin.from('projects').select('id, name, code, created_by')
      .eq('is_dormant', false).is('deleted_at', null)
    if (!auth.isAdmin) lookup = lookup.eq('created_by', auth.user.id)
    const { data, error } = await lookup
    if (error) throw error
    project = resolveProjectByReference(data ?? [], options.projectName) ?? null
    if (!project) throw new Error(`Could not resolve one accessible project named “${options.projectName}”.`)
  }

  let projectQuery = auth.admin
    .from('projects')
    .select('id, name, code, urgency_windows')
    .eq('is_dormant', false)
    .is('deleted_at', null)
  if (!auth.isAdmin) projectQuery = projectQuery.eq('created_by', auth.user.id)
  if (project) projectQuery = projectQuery.eq('id', project.id)
  const { data: projectRows, error: projectError } = await projectQuery
  if (projectError) throw projectError
  const projects = projectRows ?? []
  const projectIds = projects.map((p: any) => p.id)

  const [{ data: todoRows, error: todoError }, { data: priorityRows }, { data: userRow }] = await Promise.all([
    projectIds.length
      ? auth.admin.from('todos')
        .select('status, priority_value, due_at, due_timezone, product_id, title, todo_number')
        .in('product_id', projectIds).is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    auth.admin.from('priorities').select('value, is_urgent'),
    auth.admin.from('users').select('timezone').eq('id', auth.user.id).maybeSingle(),
  ])
  if (todoError) throw todoError

  const urgentValues = new Set<number>((priorityRows ?? []).filter((p: any) => p.is_urgent).map((p: any) => p.value))
  const timeZone = (userRow as any)?.timezone || 'America/Los_Angeles'
  const windowsByProject: UrgencyWindowsByProject = {}
  for (const p of projects) windowsByProject[p.id] = parseUrgencyWindows((p as any).urgency_windows)

  const codeFor = (t: any) => {
    const p = projects.find((pp: any) => pp.id === t.product_id)
    return p ? `${p.code}-${t.todo_number}` : `#${t.todo_number}`
  }

  const scope = project ? project.name : (auth.isAdmin ? 'all projects you can see' : 'your projects')
  const explained = explainUrgency(todoRows ?? [], urgentValues, timeZone, windowsByProject, 3)

  if (explained.urgency === 'calm' || explained.drivers.length === 0) {
    return {
      kind: 'orb_state', observedAt: new Date().toISOString(), source: 'database',
      statuses: [], count: 0,
      spokenText: `The orb is calm for ${scope}. Nothing is pressing — no urgent priority, nothing past due, and nothing inside its warning window.`,
    }
  }

  const reasons = explained.drivers.map(d => {
    if (d.rule === 'volume') return 'there are more than five active tasks'
    const name = d.title ? `${codeFor(d)}, ${d.title},` : 'a task'
    switch (d.rule) {
      case 'urgent-priority': return `${name} is set to an urgent priority`
      case 'past-due': return `${name} is past due`
      case 'imminent': return `${name} is inside its urgent window`
      default: return `${name} is inside its busy window`
    }
  })
  const more = explained.truncated > 0 ? `, and ${explained.truncated} more` : ''

  return {
    kind: 'orb_state', observedAt: new Date().toISOString(), source: 'database',
    statuses: [], count: explained.drivers.length,
    project: project ? { id: project.id, name: project.name } : undefined,
    spokenText: `The orb is ${explained.urgency} for ${scope} because ${reasons.join('; ')}${more}.`,
  }
}
