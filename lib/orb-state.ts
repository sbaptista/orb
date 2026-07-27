import { isActive } from '@/lib/status-groups'
import { isDueWithinWarning } from '@/lib/due-time'

export type Urgency = 'calm' | 'busy' | 'urgent'

export type OrbProjectState = {
  code: string
  name: string
  count: number
  urgency: Urgency
}

export type OrbState = {
  projects: OrbProjectState[]
  overall: {
    count: number
    urgency: Urgency
  }
}

type MinimalTodo = {
  status: string
  priority_value: number | null
  due_at: string | null
  due_timezone?: string | null
  product_id: string
}

/**
 * ORB-361 Phase 2: urgency is *derived from runway*, never from a reminder.
 *
 * A reminder is an act of planning — placed early precisely so the thing gets
 * handled while it is still calm. Letting it drive the mood would mean the
 * better you plan, the longer the orb shouts, which trains you to set
 * reminders later. So nothing here reads the reminder fields, deliberately.
 *
 * How close a deadline must be before it presses is derived from priority:
 * the user already says how much a thing matters, so they need not also say
 * how early it should start mattering. Phase 3 lets a project override these.
 */
export type UrgencyWindows = { runwayHours: number; imminentHours: number }

/** Keyed by `priorities.value`. Priority 1 is flagged `is_urgent`, so it never reaches these. */
export const DEFAULT_URGENCY_WINDOWS: Record<number, UrgencyWindows> = {
  2: { runwayHours: 72, imminentHours: 24 }, // High
  3: { runwayHours: 24, imminentHours: 4 },  // Medium
  4: { runwayHours: 8, imminentHours: 0 },   // Low
}

/** Used for todos with no priority set — the most conservative windows. */
export const FALLBACK_URGENCY_WINDOWS: UrgencyWindows = { runwayHours: 8, imminentHours: 0 }

export function windowsForPriority(
  priority: number | null,
  overrides?: Record<number, UrgencyWindows> | null,
): UrgencyWindows {
  if (priority === null) return FALLBACK_URGENCY_WINDOWS
  return overrides?.[priority] ?? DEFAULT_URGENCY_WINDOWS[priority] ?? FALLBACK_URGENCY_WINDOWS
}

export function computeUrgency(
  todos: MinimalTodo[],
  urgentValues: Set<number>,
  timeZone: string,
  windowOverrides?: Record<number, UrgencyWindows> | null,
): Urgency {
  const active = todos.filter(t => isActive(t.status))
  const hasUrgentPriority = active.some(t => t.priority_value !== null && urgentValues.has(t.priority_value))

  let hasImminent = false
  let hasRunway = false
  for (const todo of active) {
    if (!todo.due_at) continue
    // The todo's own zone wins; the caller's is the fallback for rows written
    // before due_timezone existed, or by writers that omit it.
    const zone = todo.due_timezone || timeZone
    const { runwayHours, imminentHours } = windowsForPriority(todo.priority_value, windowOverrides)
    // isDueWithinWarning is true for anything already past due, so "overdue is
    // always urgent" falls out of the imminent check at any threshold >= 0.
    // That is what makes a todo with no reminder safe: nothing can blind the orb.
    if (isDueWithinWarning(todo.due_at, imminentHours, zone)) hasImminent = true
    else if (isDueWithinWarning(todo.due_at, runwayHours, zone)) hasRunway = true
  }

  if (hasUrgentPriority || hasImminent) return 'urgent'
  if (hasRunway || active.length > 5) return 'busy'
  return 'calm'
}

/**
 * Compute full orb state across all projects.
 * Pass the full todo list, project list, urgent priority values, and urgency threshold.
 */
export function computeOrbState(
  todos: MinimalTodo[],
  projects: { id: string; code: string; name: string }[],
  urgentValues: Set<number>,
  timeZone: string,
): OrbState {
  const projectStates: OrbProjectState[] = projects.map(p => {
    const projectTodos = todos.filter(t => t.product_id === p.id)
    const activeCount = projectTodos.filter(t => isActive(t.status)).length
    const urgency = computeUrgency(projectTodos, urgentValues, timeZone)
    return { code: p.code, name: p.name, count: activeCount, urgency }
  })

  const totalCount = projectStates.reduce((sum, p) => sum + p.count, 0)

  // Overall urgency: worst across all projects
  let overall: Urgency = 'calm'
  if (projectStates.some(p => p.urgency === 'urgent')) overall = 'urgent'
  else if (projectStates.some(p => p.urgency === 'busy')) overall = 'busy'

  return {
    projects: projectStates,
    overall: { count: totalCount, urgency: overall },
  }
}
