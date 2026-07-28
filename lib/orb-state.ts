import { isActive } from '@/lib/status-groups'
import { isDueWithinLead, dueAtToInstant } from '@/lib/due-time'

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
  /** Optional — only needed to *name* a driver in explainUrgency (Phase 3.3). */
  title?: string
  todo_number?: number | null
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
 *
 * Windows are expressed the same way reminder leads are — a number and a unit —
 * so "3 days" is stated as three days rather than as 72 hours. Months are
 * calendar months, not 30-day approximations: `isDueWithinLead` resolves them
 * with the same clamping rule reminders use (due Jul 31, one month → Jun 30).
 */
export const URGENCY_WINDOW_UNITS = ['hours', 'days', 'weeks', 'months'] as const
export type UrgencyWindowUnit = (typeof URGENCY_WINDOW_UNITS)[number]
export type WindowLead = { value: number; unit: UrgencyWindowUnit }
export type UrgencyWindows = { runway: WindowLead; imminent: WindowLead }

/** Keyed by `priorities.value`. Priority 1 is flagged `is_urgent`, so it never reaches these. */
export const DEFAULT_URGENCY_WINDOWS: Record<number, UrgencyWindows> = {
  // High — leans busy three days out, urgent within a day.
  2: { runway: { value: 3, unit: 'days' }, imminent: { value: 1, unit: 'days' } },
  // Medium — a day, then four hours.
  3: { runway: { value: 1, unit: 'days' }, imminent: { value: 4, unit: 'hours' } },
  // Low — quiet until the last working day, urgent only at the deadline itself.
  4: { runway: { value: 8, unit: 'hours' }, imminent: { value: 0, unit: 'hours' } },
}

/** Used for todos with no priority set — the most conservative windows. */
export const FALLBACK_URGENCY_WINDOWS: UrgencyWindows = {
  runway: { value: 8, unit: 'hours' },
  imminent: { value: 0, unit: 'hours' },
}

/**
 * Approximate hours for a lead, used **only** to order two leads against each
 * other during validation ("urgent must not start earlier than busy"). Never
 * used for the actual due-date comparison — that goes through
 * `isDueWithinLead`, which resolves months as real calendar months.
 */
export function approximateLeadHours(lead: WindowLead): number {
  const HOURS: Record<UrgencyWindowUnit, number> = {
    hours: 1,
    days: 24,
    weeks: 168,
    months: 730, // 30.42 days — close enough to compare, never to schedule
  }
  return lead.value * HOURS[lead.unit]
}

/**
 * The sentence a window actually means — "3 days before", "at the deadline".
 * Shared by the editor and Help so the two can never phrase it differently.
 */
export function describeWindowLead(lead: WindowLead): string {
  if (!Number.isInteger(lead.value) || lead.value < 0) return '—'
  if (lead.value === 0) return 'at the deadline'
  const unit = lead.value === 1 ? lead.unit.replace(/s$/, '') : lead.unit
  return `${lead.value} ${unit} before`
}

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

/** Matches the reminder control's Custom range, so both read the same way. */
export const MAX_WINDOW_VALUE = 99

/** Reads one `{ value, unit }` lead, or null if it is not a usable one. */
function parseLead(raw: unknown): WindowLead | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const value = Number(source.value)
  const unit = source.unit
  if (!Number.isInteger(value) || value < 0 || value > MAX_WINDOW_VALUE) return null
  if (typeof unit !== 'string' || !URGENCY_WINDOW_UNITS.includes(unit as UrgencyWindowUnit)) return null
  return { value, unit: unit as UrgencyWindowUnit }
}

/**
 * Parse `projects.urgency_windows` into the in-memory shape, or `null` for
 * "use the defaults". Returns `null` for anything malformed rather than
 * throwing: a bad row must not be able to break the dashboard for every
 * project, and falling back to the documented defaults is always safe.
 *
 * Used on **both** sides — readers parsing what the DB holds, and the write
 * path validating what a client sent — so stored data can never be a shape the
 * writer would have rejected. The DB CHECK only guarantees "object or NULL".
 *
 * **Legacy shape accepted:** v0.6.247 stored `{runway_hours, imminent_hours}`
 * before windows gained units. Rows written by that build read as an
 * equivalent hours lead and are rewritten in the new shape on their next save,
 * so nothing has to be migrated and nothing silently loses its setting.
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
    let runway: WindowLead | null
    let imminent: WindowLead | null

    if ('runway_hours' in source || 'runwayHours' in source) {
      const runwayHours = Number(source.runway_hours ?? source.runwayHours)
      const imminentHours = Number(source.imminent_hours ?? source.imminentHours)
      if (!Number.isInteger(runwayHours) || runwayHours < 0) return null
      if (!Number.isInteger(imminentHours) || imminentHours < 0) return null
      runway = { value: runwayHours, unit: 'hours' }
      imminent = { value: imminentHours, unit: 'hours' }
    } else {
      runway = parseLead(source.runway)
      imminent = parseLead(source.imminent)
    }

    if (!runway || !imminent) return null
    // Imminent is the inner window. If it were the wider of the two, everything
    // inside runway would already be urgent and 'busy' would be unreachable for
    // that priority — a silently broken mood rather than a configured one.
    // Ordered approximately, since months have no fixed length; the actual
    // due-date test uses real calendar arithmetic.
    if (approximateLeadHours(imminent) > approximateLeadHours(runway)) return null

    out[priority] = { runway, imminent }
  }

  // An empty object is indistinguishable in effect from "use the defaults", so
  // normalise it to null and keep exactly one representation of that state.
  return Object.keys(out).length > 0 ? out : null
}

/** Inverse of `parseUrgencyWindows` — the shape stored in jsonb. */
export function serializeUrgencyWindows(
  windows: UrgencyWindowsMap | null,
): Record<string, { runway: WindowLead; imminent: WindowLead }> | null {
  if (!windows || Object.keys(windows).length === 0) return null
  const out: Record<string, { runway: WindowLead; imminent: WindowLead }> = {}
  for (const [priority, w] of Object.entries(windows)) {
    out[priority] = {
      runway: { value: w.runway.value, unit: w.runway.unit },
      imminent: { value: w.imminent.value, unit: w.imminent.unit },
    }
  }
  return out
}

/**
 * Which rule pushed the orb off calm. Named so the Orb can *say* it rather
 * than infer it — ORB-361 Phase 3.3.
 */
export type UrgencyRule =
  | 'urgent-priority' // priority flagged is_urgent
  | 'past-due'        // deadline already passed
  | 'imminent'        // inside the inner window
  | 'runway'          // inside the outer window
  | 'volume'          // more than 5 active tasks

export type UrgencyDriver = {
  rule: UrgencyRule
  /** The state this driver pushes the orb to. */
  contributes: Exclude<Urgency, 'calm'>
  title?: string
  todoNumber?: number | null
  priorityValue?: number | null
  dueAt?: string | null
}

const RULE_SEVERITY: Record<UrgencyRule, number> = {
  'past-due': 4, 'urgent-priority': 3, imminent: 2, runway: 1, volume: 0,
}

/**
 * The orb's mood **and why**, from one pass over the same rules.
 *
 * `computeUrgency` returns only the mood, which is all most callers need — but
 * it meant the reasons were computed and then discarded, leaving the Orb to
 * guess when asked "why is the orb busy?". Guessing there is exactly the
 * confabulation the ORB-325 honesty rule prohibits, so the reasons are now
 * returned rather than recomputed by a second, driftable implementation.
 *
 * Drivers are sorted most-severe-first. `limit` caps how many are kept: the
 * packet that carries these into the Orb's context is paid for on every
 * request, and after the first two or three the marginal explanation is worth
 * less than the tokens.
 */
export function explainUrgency(
  todos: MinimalTodo[],
  urgentValues: Set<number>,
  timeZone: string,
  windowsByProject?: UrgencyWindowsByProject | null,
  limit = 3,
): { urgency: Urgency; drivers: UrgencyDriver[]; truncated: number } {
  const active = todos.filter(t => isActive(t.status))
  const drivers: UrgencyDriver[] = []

  for (const todo of active) {
    if (todo.priority_value !== null && urgentValues.has(todo.priority_value)) {
      drivers.push({
        rule: 'urgent-priority', contributes: 'urgent',
        title: todo.title, todoNumber: todo.todo_number,
        priorityValue: todo.priority_value, dueAt: todo.due_at,
      })
    }
  }

  for (const todo of active) {
    if (!todo.due_at) continue
    // The todo's own zone wins; the caller's is the fallback for rows written
    // before due_timezone existed, or by writers that omit it.
    const zone = todo.due_timezone || timeZone
    // Each todo resolves against its OWN project's windows, so a mixed-project
    // list stays correct. Resolution order is project override → global default.
    const overrides = windowsByProject?.[todo.product_id] ?? null
    const { runway, imminent } = windowsForPriority(todo.priority_value, overrides)

    // isDueWithinLead is true for anything already past due, so "overdue is
    // always urgent" falls out of the imminent check at any lead >= 0.
    // That is what makes a todo with no reminder safe: nothing can blind the orb.
    // Past due is split out only for the explanation — it is the same branch.
    let rule: UrgencyRule | null = null
    let contributes: Exclude<Urgency, 'calm'> | null = null
    if (isDueWithinLead(todo.due_at, imminent, zone)) {
      rule = dueAtToInstant(todo.due_at, zone).getTime() < Date.now() ? 'past-due' : 'imminent'
      contributes = 'urgent'
    } else if (isDueWithinLead(todo.due_at, runway, zone)) {
      rule = 'runway'
      contributes = 'busy'
    }
    if (!rule || !contributes) continue

    drivers.push({
      rule, contributes,
      title: todo.title, todoNumber: todo.todo_number,
      priorityValue: todo.priority_value, dueAt: todo.due_at,
    })
  }

  const hasUrgent = drivers.some(d => d.contributes === 'urgent')
  const hasBusy = drivers.some(d => d.contributes === 'busy')

  if (!hasUrgent && active.length > 5) {
    drivers.push({ rule: 'volume', contributes: 'busy' })
  }

  const urgency: Urgency = hasUrgent ? 'urgent' : (hasBusy || active.length > 5) ? 'busy' : 'calm'

  drivers.sort((a, b) => RULE_SEVERITY[b.rule] - RULE_SEVERITY[a.rule])
  return {
    urgency,
    drivers: drivers.slice(0, limit),
    truncated: Math.max(0, drivers.length - limit),
  }
}

export function computeUrgency(
  todos: MinimalTodo[],
  urgentValues: Set<number>,
  timeZone: string,
  windowsByProject?: UrgencyWindowsByProject | null,
): Urgency {
  // Deliberately delegates rather than duplicating the rules — one
  // implementation, two views of it.
  return explainUrgency(todos, urgentValues, timeZone, windowsByProject, 0).urgency
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
