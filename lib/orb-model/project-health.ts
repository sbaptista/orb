import { isActive, isParked } from '@/lib/status-groups'

export type ProjectActivityMomentum = 'none' | 'quiet' | 'active' | 'high'

export type ProjectRecentActivity = {
  windowDays: number
  createdCount: number
  closedCount: number
  updatedCount: number
  movedToInProgressCount: number
  parkedCount: number
  lastActivityAt: string | null
  momentum: ProjectActivityMomentum
  signals: string[]
}

export type ProjectHealthItem = {
  name: string
  ownerName: string | null
  ownedByCurrentUser: boolean
  description: string | null
  dormant: boolean
  activeCount: number
  parkedCount: number
  closedCount: number
  urgentCount: number
  inProgressCount: number
  staleActiveCount: number
  recentActivity: ProjectRecentActivity
}

export type ProjectHealthPacket = {
  generatedAt: string
  windowDays: number
  projects: ProjectHealthItem[]
}

type BuildProjectHealthPacketInput = {
  projects: any[]
  dormantProjects: any[]
  todos: any[]
  statuses: any[]
  priorities: any[]
  auditEvents: any[]
  userMap: Map<string, string>
  currentUserId?: string
  generatedAt?: Date
  windowDays?: number
}

const DAY_MS = 86_400_000

function isClosedStatus(statuses: any[], status: string): boolean {
  return Boolean(statuses.find((s: any) => s.name === status)?.is_closed)
}

function isDueWithinWarning(dueAt: string | null, now: Date, warningHours: number): boolean {
  if (!dueAt) return false
  const due = new Date(dueAt).getTime()
  if (Number.isNaN(due)) return false
  return due <= now.getTime() + warningHours * 60 * 60 * 1000
}

function actionChangedToStatus(event: any, status: string): boolean {
  return event?.after?.status === status && event?.before?.status !== status
}

function momentumFor(changeCount: number): ProjectActivityMomentum {
  if (changeCount === 0) return 'none'
  if (changeCount <= 2) return 'quiet'
  if (changeCount <= 8) return 'active'
  return 'high'
}

export function buildProjectHealthPacket(input: BuildProjectHealthPacketInput): ProjectHealthPacket {
  const generatedAt = input.generatedAt ?? new Date()
  const windowDays = input.windowDays ?? 14
  const staleCreatedBefore = generatedAt.getTime() - 30 * DAY_MS
  const staleUpdatedBefore = generatedAt.getTime() - 14 * DAY_MS
  const urgentPriorityValues = new Set<number>(
    (input.priorities ?? []).filter((p: any) => p.is_urgent).map((p: any) => p.value as number)
  )
  const dormantIds = new Set((input.dormantProjects ?? []).map((p: any) => p.id))
  const projectRows = [
    ...(input.projects ?? []).map((p: any) => ({ ...p, is_dormant: false })),
    ...(input.dormantProjects ?? []).map((p: any) => ({ ...p, is_dormant: true })),
  ]

  const projects = projectRows.map((project: any): ProjectHealthItem => {
    const projectTodos = (input.todos ?? []).filter((todo: any) => todo.product_id === project.id)
    const nonClosedTodos = projectTodos.filter((todo: any) => !isClosedStatus(input.statuses, todo.status))
    const activeTodos = nonClosedTodos.filter((todo: any) => isActive(todo.status))
    const parkedTodos = nonClosedTodos.filter((todo: any) => isParked(todo.status))
    const closedCount = projectTodos.length - nonClosedTodos.length
    const projectTodoIds = new Set(projectTodos.map((todo: any) => todo.id))
    const projectEvents = (input.auditEvents ?? []).filter((event: any) => projectTodoIds.has(event.record_id))
    const createdCount = projectEvents.filter((event: any) => event.action === 'todo_create').length
    const closedActivityCount = projectEvents.filter((event: any) =>
      event.action === 'todo_close' || isClosedStatus(input.statuses, event?.after?.status)
    ).length
    const movedToInProgressCount = projectEvents.filter((event: any) => actionChangedToStatus(event, 'in progress')).length
    const parkedActivityCount = projectEvents.filter((event: any) => event?.after?.status && isParked(event.after.status)).length
    const updatedCount = projectEvents.filter((event: any) =>
      !['todo_create', 'todo_close', 'todo_delete'].includes(event.action)
    ).length
    const lastActivityAt = projectEvents.reduce<string | null>((latest, event: any) => {
      if (!event.created_at) return latest
      if (!latest) return event.created_at
      return new Date(event.created_at).getTime() > new Date(latest).getTime() ? event.created_at : latest
    }, null)
    const changeCount = createdCount + closedActivityCount + updatedCount
    const momentum = momentumFor(changeCount)
    const urgentCount = activeTodos.filter((todo: any) =>
      (todo.priority_value != null && urgentPriorityValues.has(todo.priority_value)) ||
      isDueWithinWarning(todo.due_at ?? null, generatedAt, 0)
    ).length
    const inProgressCount = activeTodos.filter((todo: any) => todo.status === 'in progress').length
    const staleActiveCount = activeTodos.filter((todo: any) => {
      const createdAt = new Date(todo.created_at).getTime()
      const updatedAt = new Date(todo.updated_at ?? todo.created_at).getTime()
      return createdAt <= staleCreatedBefore && updatedAt <= staleUpdatedBefore
    }).length

    const signals: string[] = []
    if (project.is_dormant || dormantIds.has(project.id)) signals.push('dormant')
    if (momentum === 'none') signals.push('no_recent_activity')
    if (momentum === 'quiet' && activeTodos.length > 0) signals.push('quiet_with_active_work')
    if (momentum === 'high') signals.push('high_recent_activity')
    if (createdCount > closedActivityCount + 2) signals.push('growing_active_load')
    if (closedActivityCount > 0) signals.push('recent_closures')
    if (parkedTodos.length > activeTodos.length && parkedTodos.length > 0) signals.push('mostly_parked')
    if (urgentCount > 0) signals.push('urgent_work_present')
    if (staleActiveCount > 0) signals.push('stale_active_work')

    return {
      name: project.name,
      ownerName: input.userMap.get(project.created_by) ?? null,
      ownedByCurrentUser: input.currentUserId ? project.created_by === input.currentUserId : false,
      description: project.description ?? null,
      dormant: Boolean(project.is_dormant || dormantIds.has(project.id)),
      activeCount: activeTodos.length,
      parkedCount: parkedTodos.length,
      closedCount,
      urgentCount,
      inProgressCount,
      staleActiveCount,
      recentActivity: {
        windowDays,
        createdCount,
        closedCount: closedActivityCount,
        updatedCount,
        movedToInProgressCount,
        parkedCount: parkedActivityCount,
        lastActivityAt,
        momentum,
        signals,
      },
    }
  })

  return {
    generatedAt: generatedAt.toISOString(),
    windowDays,
    projects,
  }
}

export function renderProjectHealthPacket(packet: ProjectHealthPacket): string {
  const lines = packet.projects.map(project => {
    const description = project.description ? `; role_hint="${project.description}"` : ''
    const owner = project.ownerName ? `owner="${project.ownerName}"` : 'owner=unknown'
    const signals = project.recentActivity.signals.length > 0
      ? project.recentActivity.signals.join(', ')
      : 'none'
    const lastActivity = project.recentActivity.lastActivityAt ?? 'none'
    return `- ${project.name}: ${owner}; owned_by_current_user=${project.ownedByCurrentUser}; dormant=${project.dormant}; active=${project.activeCount}; parked=${project.parkedCount}; closed=${project.closedCount}; urgent=${project.urgentCount}; in_progress=${project.inProgressCount}; stale_active=${project.staleActiveCount}; recent_${packet.windowDays}d={momentum:${project.recentActivity.momentum}, created:${project.recentActivity.createdCount}, closed:${project.recentActivity.closedCount}, updated:${project.recentActivity.updatedCount}, moved_to_in_progress:${project.recentActivity.movedToInProgressCount}, parked:${project.recentActivity.parkedCount}, last:${lastActivity}, signals:[${signals}]}${description}`
  })

  return `PROJECT HEALTH PACKET (generated ${packet.generatedAt}; ${packet.windowDays}-day activity window):
Use this as the neutral project-health data surface for broad project summaries. Signals are evidence cues, not verdicts; turn them into careful judgment only when supported.
${lines.join('\n')}`
}
