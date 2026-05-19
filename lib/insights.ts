import { filterActive, filterParked } from './status-groups'

type Todo = {
  id: string
  todo_number: number
  title: string
  status: string
  priority_value: number | null
  product_id: string
  created_at: string
  updated_at: string
  closed_at: string | null
}

type Product = { id: string; name: string; code: string | null; created_by?: string }
type Status = { name: string; is_closed: boolean; is_open: boolean }
type AuditEvent = { action: string; record_id: string; created_at: string; before: any; after: any }

export type InsightSeverity = 'info' | 'nudge' | 'warning'

export type Insight = {
  type: string
  severity: InsightSeverity
  message: string
}

export type InsightReport = {
  insights: Insight[]
  summary: string
}

const DAY_MS = 86_400_000

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
}

export function computeInsights(
  todos: Todo[],
  products: Product[],
  statuses: Status[],
  auditEvents: AuditEvent[],
  userId?: string,
  isAdmin?: boolean,
): InsightReport {
  const closedStatuses = new Set(statuses.filter(s => s.is_closed).map(s => s.name))
  const nonClosedTodos = todos.filter(t => !closedStatuses.has(t.status))
  const activeTodos = filterActive(nonClosedTodos)
  const parkedTodos = filterParked(nonClosedTodos)
  const insights: Insight[] = []

  const productCode = (pid: string) => products.find(p => p.id === pid)?.code ?? '???'
  const todoCode = (t: Todo) => `${productCode(t.product_id)}-${t.todo_number}`

  // ── Stale tasks (not closed, 30+ days old, no updates in 14+ days) ──
  const staleTasks = nonClosedTodos.filter(t => {
    const age = daysSince(t.created_at)
    const lastTouch = daysSince(t.updated_at)
    return age >= 30 && lastTouch >= 14
  }).sort((a, b) => daysSince(b.created_at) - daysSince(a.created_at))

  if (staleTasks.length > 0) {
    const top = staleTasks.slice(0, 3)
    const codes = top.map(t => `${todoCode(t)} (${daysSince(t.created_at)}d)`).join(', ')
    const severity: InsightSeverity = staleTasks.length >= 5 ? 'warning' : 'nudge'
    insights.push({
      type: 'stale_tasks',
      severity,
      message: `${staleTasks.length} stale task${staleTasks.length > 1 ? 's' : ''} (open 30+ days, untouched 14+ days): ${codes}${staleTasks.length > 3 ? ` and ${staleTasks.length - 3} more` : ''}.`,
    })
  }

  // ── Priority distribution (active only — excludes on hold/deferred) ──
  const urgentTodos = activeTodos.filter(t => t.priority_value !== null && t.priority_value <= 2)
  const lowTodos = activeTodos.filter(t => t.priority_value === null || t.priority_value >= 4)

  if (urgentTodos.length >= 4) {
    insights.push({
      type: 'priority_overload',
      severity: 'warning',
      message: `${urgentTodos.length} active tasks at P1/P2. That's a heavy urgent queue — consider whether all of them are truly urgent.`,
    })
  } else if (activeTodos.length > 0 && urgentTodos.length === 0 && lowTodos.length === activeTodos.length) {
    insights.push({
      type: 'all_low_priority',
      severity: 'info',
      message: `All ${activeTodos.length} active tasks are P4 or lower. Quiet sprint, or should something be elevated?`,
    })
  }

  // ── Churn (opened vs closed in last 7 days) ──
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString()
  const recentCreates = auditEvents.filter(e => e.action === 'todo_create' && e.created_at >= sevenDaysAgo).length
  const recentCloses = auditEvents.filter(e => e.action === 'todo_close' && e.created_at >= sevenDaysAgo).length

  if (recentCreates > 0 || recentCloses > 0) {
    if (recentCreates > recentCloses + 3) {
      insights.push({
        type: 'churn_growing',
        severity: 'nudge',
        message: `Opened ${recentCreates}, closed ${recentCloses} in the last 7 days. Backlog is growing.`,
      })
    } else if (recentCloses > recentCreates + 2) {
      insights.push({
        type: 'churn_shrinking',
        severity: 'info',
        message: `Closed ${recentCloses}, opened ${recentCreates} in the last 7 days. Backlog is shrinking.`,
      })
    }
  }

  // ── Focus gap (nothing in progress) ──
  const inProgress = activeTodos.filter(t => t.status === 'in progress')
  if (activeTodos.length >= 3 && inProgress.length === 0) {
    insights.push({
      type: 'focus_gap',
      severity: 'nudge',
      message: `${activeTodos.length} active tasks but nothing is "in progress". Want to pick one to focus on?`,
    })
  }

  // ── Completion velocity (last 14 days) ──
  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS).toISOString()
  const closedRecently = todos.filter(t => t.closed_at && t.closed_at >= fourteenDaysAgo)
  if (closedRecently.length > 0) {
    const perWeek = Math.round(closedRecently.length / 2 * 10) / 10
    insights.push({
      type: 'velocity',
      severity: 'info',
      message: `Velocity: ${closedRecently.length} tasks closed in 14 days (~${perWeek}/week).`,
    })
  }

  // ── Neglected projects (no activity in 14+ days) ──
  const recentlyTouchedProductIds = new Set<string>()
  for (const e of auditEvents) {
    if (e.created_at >= fourteenDaysAgo) {
      const todo = todos.find(t => t.id === e.record_id)
      if (todo) recentlyTouchedProductIds.add(todo.product_id)
    }
  }
  const productsWithNonClosedTodos = new Set(nonClosedTodos.map(t => t.product_id))
  const productsWithActiveTodos = new Set(activeTodos.map(t => t.product_id))
  const neglected = products.filter(p => productsWithNonClosedTodos.has(p.id) && !recentlyTouchedProductIds.has(p.id))
  if (neglected.length > 0) {
    const names = neglected.map(p => p.code ?? p.name).join(', ')
    insights.push({
      type: 'neglected_projects',
      severity: 'nudge',
      message: `No activity in 14+ days on projects with active tasks: ${names}.`,
    })
  }

  // ── Stagnant urgent tasks (P1/P2 open 7+ days, no updates in 7+ days) ──
  const stagnantUrgent = urgentTodos.filter(t => daysSince(t.created_at) >= 7 && daysSince(t.updated_at) >= 7)
  if (stagnantUrgent.length > 0) {
    const codes = stagnantUrgent.slice(0, 3).map(t => todoCode(t)).join(', ')
    insights.push({
      type: 'stagnant_urgent',
      severity: 'warning',
      message: `${stagnantUrgent.length} urgent task${stagnantUrgent.length > 1 ? 's' : ''} untouched for 7+ days: ${codes}.`,
    })
  }

  // ── Build summary ──
  const parkedNote = parkedTodos.length > 0 ? `, ${parkedTodos.length} on hold/deferred` : ''

  // For admins who see all users' data, split "yours" vs "all"
  const ownProjectIds = isAdmin && userId
    ? new Set(products.filter(p => p.created_by === userId).map(p => p.id))
    : null
  const ownActiveTodos = ownProjectIds
    ? activeTodos.filter(t => ownProjectIds.has(t.product_id))
    : activeTodos
  const ownParkedTodos = ownProjectIds
    ? parkedTodos.filter(t => ownProjectIds.has(t.product_id))
    : parkedTodos
  const ownParkedNote = ownParkedTodos.length > 0 ? `, ${ownParkedTodos.length} on hold/deferred` : ''

  let summary: string
  if (ownProjectIds && activeTodos.length !== ownActiveTodos.length) {
    summary = `${ownActiveTodos.length} active tasks in your projects${ownParkedNote}. ${activeTodos.length} active across all projects${parkedNote}.`
  } else {
    summary = `${activeTodos.length} active tasks${parkedNote} across ${productsWithActiveTodos.size} project${productsWithActiveTodos.size !== 1 ? 's' : ''}.`
  }

  return { insights, summary }
}
