import { isActive, isParked } from '@/lib/status-groups'
import { isDueWithinLead } from '@/lib/due-time'
import {
  windowsForPriority, parseUrgencyWindows, explainUrgency, describeWindowLead,
  approximateLeadHours, DEFAULT_URGENCY_WINDOWS, FALLBACK_URGENCY_WINDOWS,
  type Urgency, type UrgencyDriver, type UrgencyWindowsMap,
} from '@/lib/orb-state'

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
  /** Needed to render task references like "ORB-361" in urgency drivers. */
  code: string | null
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
  /** ORB-361 Phase 3.3 — the orb's mood for this project, and what caused it. */
  urgency: Urgency
  urgencyDrivers: UrgencyDriver[]
  /** Drivers omitted beyond the cap, so the Orb can say "and N more". */
  urgencyDriversTruncated: number
  /**
   * Human-readable windows for this project, but ONLY where they differ from
   * the global defaults. Empty means "this project uses the defaults", which
   * the Orb already knows from its prompt — so an unmodified project costs
   * nothing here.
   */
  urgencyWindowOverrides: string[]
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
  timeZone: string
}

const DAY_MS = 86_400_000

function isClosedStatus(statuses: any[], status: string): boolean {
  return Boolean(statuses.find((s: any) => s.name === status)?.is_closed)
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

/**
 * ORB-361 Phase 3.4a — describe only the windows a project actually CHANGED.
 *
 * Phase 3.3 told the Orb which task drove a mood but not the threshold behind
 * it, so when asked "what is its urgent window?" the Orb had nothing but the
 * defaults and stated them as fact for a project that overrides them. Found in
 * live use (2026-07-28): chech check sets Low to 8 days / 3 days, and the Orb
 * confidently answered "8 hours / at the due time".
 *
 * Only differences are emitted. Most projects override nothing, and a project
 * that matches the defaults adds no tokens — the defaults are already in the
 * prompt. Compared by approximate hours so "1 day" and "24 hours" are not
 * reported as a change.
 */
function describeWindowOverrides(
  windows: UrgencyWindowsMap | null,
  priorities: any[],
): string[] {
  if (!windows) return []
  const out: string[] = []
  for (const [key, w] of Object.entries(windows)) {
    const value = Number(key)
    const priority = (priorities ?? []).find((p: any) => p.value === value)
    // A priority flagged is_urgent never consults a window, so reporting one
    // would describe a control that does nothing.
    if (priority?.is_urgent) continue
    const base = DEFAULT_URGENCY_WINDOWS[value] ?? FALLBACK_URGENCY_WINDOWS
    const same = approximateLeadHours(w.runway) === approximateLeadHours(base.runway)
      && approximateLeadHours(w.imminent) === approximateLeadHours(base.imminent)
    if (same) continue
    const label = priority?.label ?? `priority ${value}`
    out.push(`${label}: busy ${describeWindowLead(w.runway)}, urgent ${describeWindowLead(w.imminent)}`)
  }
  return out
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
    // ORB-361 Phase 3: this project's own windows, if it overrides the defaults.
    const projectWindows = parseUrgencyWindows(project.urgency_windows)
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
    // ORB-361 Phase 2: "urgent" here means what the orb means by it — urgent
    // priority, past due, or inside the todo's own priority-derived imminent
    // window. Previously a hardcoded 0 (already-overdue only), then a global
    // threshold; now the same derivation the mood uses, so the Orb's spoken
    // reports and the orb's colour can no longer disagree.
    const urgentCount = activeTodos.filter((todo: any) =>
      (todo.priority_value != null && urgentPriorityValues.has(todo.priority_value)) ||
      (todo.due_at != null && (() => {
        const { imminent } = windowsForPriority(todo.priority_value ?? null, projectWindows)
        return isDueWithinLead(todo.due_at, imminent, todo.due_timezone || input.timeZone)
      })())
    ).length
    // ORB-361 Phase 3.3: the same rules that colour the orb, but keeping the
    // reasons. Without this the Orb had to guess which task caused a mood —
    // exactly the confabulation the ORB-325 honesty rule prohibits.
    const explained = explainUrgency(
      nonClosedTodos,
      urgentPriorityValues,
      input.timeZone,
      { [project.id]: projectWindows },
    )
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
      code: project.code ?? null,
      urgency: explained.urgency,
      urgencyDrivers: explained.drivers,
      urgencyDriversTruncated: explained.truncated,
      urgencyWindowOverrides: describeWindowOverrides(projectWindows, input.priorities),
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

/**
 * One driver as a phrase the Orb can read out — "ORB-361 \"Ship v2\" is past due".
 * Deliberately compact: this rides in the system prompt on every request.
 */
function renderDriver(projectCode: string | null | undefined, driver: UrgencyDriver): string {
  if (driver.rule === 'volume') return 'more than 5 active tasks'
  const ref = driver.todoNumber != null && projectCode ? `${projectCode}-${driver.todoNumber}` : null
  const name = [ref, driver.title ? `"${driver.title}"` : null].filter(Boolean).join(' ')
  const subject = name || 'a task'
  switch (driver.rule) {
    case 'urgent-priority': return `${subject} is set to an urgent priority`
    case 'past-due':        return `${subject} is past due (${driver.dueAt})`
    case 'imminent':        return `${subject} is inside its urgent window (due ${driver.dueAt})`
    case 'runway':          return `${subject} is inside its busy window (due ${driver.dueAt})`
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
    // Only non-calm projects spend tokens on an explanation — a calm project's
    // reason is "nothing is pressing", which needs no evidence.
    // Emitted whenever the project overrides a default, even when calm — the
    // user can ask "what is the window for X?" without the orb having shifted.
    const windows = project.urgencyWindowOverrides.length > 0
      ? `; orb_windows=[${project.urgencyWindowOverrides.join('; ')}]`
      : ''
    const why = project.urgency === 'calm' || project.urgencyDrivers.length === 0
      ? ''
      : `; orb_state=${project.urgency}; orb_state_because=[${
        project.urgencyDrivers.map(d => renderDriver(project.code, d)).join('; ')
      }${project.urgencyDriversTruncated > 0 ? `; and ${project.urgencyDriversTruncated} more` : ''}]`
    return `- ${project.name}: ${owner}; owned_by_current_user=${project.ownedByCurrentUser}; dormant=${project.dormant}; active=${project.activeCount}; parked=${project.parkedCount}; closed=${project.closedCount}; urgent=${project.urgentCount}; in_progress=${project.inProgressCount}; stale_active=${project.staleActiveCount}${windows}${why}; recent_${packet.windowDays}d={momentum:${project.recentActivity.momentum}, created:${project.recentActivity.createdCount}, closed:${project.recentActivity.closedCount}, updated:${project.recentActivity.updatedCount}, moved_to_in_progress:${project.recentActivity.movedToInProgressCount}, parked:${project.recentActivity.parkedCount}, last:${lastActivity}, signals:[${signals}]}${description}`
  })

  return `PROJECT HEALTH PACKET (generated ${packet.generatedAt}; ${packet.windowDays}-day activity window):
Use this as the neutral project-health data surface for broad project summaries. Signals are evidence cues, not verdicts; turn them into careful judgment only when supported.
${lines.join('\n')}`
}
