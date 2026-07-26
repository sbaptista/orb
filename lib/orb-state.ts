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
  product_id: string
}

export function computeUrgency(
  todos: MinimalTodo[],
  urgentValues: Set<number>,
  urgencyThresholdHours: number,
  timeZone: string,
): Urgency {
  const active = todos.filter(t => isActive(t.status))
  const hasUrgentPriority = active.some(t => t.priority_value !== null && urgentValues.has(t.priority_value))
  const hasUrgentDueDate = active.some(t => t.due_at && isDueWithinWarning(t.due_at, urgencyThresholdHours, timeZone))

  if (hasUrgentPriority || hasUrgentDueDate) return 'urgent'
  if (active.length > 5) return 'busy'
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
  urgencyThresholdHours: number,
  timeZone: string,
): OrbState {
  const projectStates: OrbProjectState[] = projects.map(p => {
    const projectTodos = todos.filter(t => t.product_id === p.id)
    const activeCount = projectTodos.filter(t => isActive(t.status)).length
    const urgency = computeUrgency(projectTodos, urgentValues, urgencyThresholdHours, timeZone)
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
