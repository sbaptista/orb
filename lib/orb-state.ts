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

/** One project's overrides, keyed by `priorities.value`. */
export type UrgencyWindowsMap = Record<number, UrgencyWindows>

/**
 * Overrides keyed by `projects.id`. A missing or null entry means that project
 * uses the global defaults — which is the overwhelmingly common case, so every
 * reader treats an absent map as "no overrides anywhere" rather than an error.
 *
 * This is keyed by project rather than passed as one flat map because most
 * callers evaluate todos spanning several projects at once (the dashboard orb,
 * `computeOrbState`, the push escalation snapshot). A single override map would
 * silently apply one project's windows to every other project's todos.
 */
export type UrgencyWindowsByProject = Record<string, UrgencyWindowsMap | null | undefined>

export function windowsForPriority(
  priority: number | null,
  overrides?: UrgencyWindowsMap | null,
): UrgencyWindows {
  if (priority === null) return FALLBACK_URGENCY_WINDOWS
  return overrides?.[priority] ?? DEFAULT_URGENCY_WINDOWS[priority] ?? FALLBACK_URGENCY_WINDOWS
}

// ──────────────────────────────────────────────────────────────────────────
// Validation — the single gate between stored JSON and the derivation above
// ──────────────────────────────────────────────────────────────────────────

/** A year. Past this, "runway" stops meaning anything and the input is junk. */
const MAX_WINDOW_HOURS = 8760

/**
 * Parse `projects.urgency_windows` into the in-memory shape, or `null` for
 * "use the defaults". Returns `null` for anything malformed rather than
 * throwing: a bad row must not be able to break the dashboard for every
 * project, and falling back to the documented defaults is always safe.
 *
 * Used on **both** sides — readers parsing what the DB holds, and the write
 * path validating what a client sent — so stored data can never be a shape the
 * writer would have rejected. The DB CHECK only guarantees "object or NULL".
 */
export function parseUrgencyWindows(raw: unknown): UrgencyWindowsMap | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null

  const out: UrgencyWindowsMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const priority = Number(key)
    if (!Number.isInteger(priority) || priority < 1 || priority > 99) return null
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

    const source = value as Record<string, unknown>
    // Accept both spellings so a value that has been through the client and one
    // read straight from jsonb parse identically.
    const runway = Number(source.runway_hours ?? (source as any).runwayHours)
    const imminent = Number(source.imminent_hours ?? (source as any).imminentHours)

    if (!Number.isInteger(runway) || runway < 0 || runway > MAX_WINDOW_HOURS) return null
    if (!Number.isInteger(imminent) || imminent < 0 || imminent > MAX_WINDOW_HOURS) return null
    // Imminent is the inner window. If it were the wider of the two, everything
    // inside runway would already be urgent and 'busy' would be unreachable for
    // that priority — a silently broken mood rather than a configured one.
    if (imminent > runway) return null

    out[priority] = { runwayHours: runway, imminentHours: imminent }
  }

  // An empty object is indistinguishable in effect from "use the defaults", so
  // normalise it to null and keep exactly one representation of that state.
  return Object.keys(out).length > 0 ? out : null
}

/** Inverse of `parseUrgencyWindows` — the snake_case shape stored in jsonb. */
export function serializeUrgencyWindows(
  windows: UrgencyWindowsMap | null,
): Record<string, { runway_hours: number; imminent_hours: number }> | null {
  if (!windows || Object.keys(windows).length === 0) return null
  const out: Record<string, { runway_hours: number; imminent_hours: number }> = {}
  for (const [priority, w] of Object.entries(windows)) {
    out[priority] = { runway_hours: w.runwayHours, imminent_hours: w.imminentHours }
  }
  return out
}

export function computeUrgency(
  todos: MinimalTodo[],
  urgentValues: Set<number>,
  timeZone: string,
  windowsByProject?: UrgencyWindowsByProject | null,
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
    // Each todo resolves against its OWN project's windows, so a mixed-project
    // list stays correct. Resolution order is project override → global default.
    const overrides = windowsByProject?.[todo.product_id] ?? null
    const { runwayHours, imminentHours } = windowsForPriority(todo.priority_value, overrides)
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
 *
 * `projects` may carry `urgency_windows` straight from the DB row — it is
 * parsed here rather than by each caller, so there is one place where stored
 * JSON becomes derivation input. Projects without the field, or with NULL,
 * use the global defaults.
 */
export function computeOrbState(
  todos: MinimalTodo[],
  projects: { id: string; code: string; name: string; urgency_windows?: unknown }[],
  urgentValues: Set<number>,
  timeZone: string,
): OrbState {
  const windowsByProject: UrgencyWindowsByProject = {}
  for (const p of projects) windowsByProject[p.id] = parseUrgencyWindows(p.urgency_windows)

  const projectStates: OrbProjectState[] = projects.map(p => {
    const projectTodos = todos.filter(t => t.product_id === p.id)
    const activeCount = projectTodos.filter(t => isActive(t.status)).length
    const urgency = computeUrgency(projectTodos, urgentValues, timeZone, windowsByProject)
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
