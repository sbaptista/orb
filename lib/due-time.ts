/**
 * Due-date time math — the single source of truth (ORB-360).
 *
 * `todos.due_at` is a timezone-agnostic wall-clock string (YYYY-MM-DDTHH:mm),
 * so it cannot answer "is this due soon?" on its own: something must supply
 * the zone that wall-clock reading belongs to. Before ORB-360, four duplicate
 * parsers supplied four different zones (browser, server, user row, and a
 * hardcoded zero-hour threshold), so the dashboard, push notifications, the
 * Orb's spoken reports, and the task-card badges could all disagree about the
 * same todo at the same moment.
 *
 * Every helper here takes an explicit IANA `timeZone` — deliberately with no
 * default, so the compiler enumerates every call site instead of letting any
 * path silently fall back to its ambient zone. The user's stored timezone is
 * canonical (Stan, 2026-07-24); ORB-361 later moves the zone onto the todo
 * itself, changing only where callers source it from.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

/**
 * Interpret a timezone-agnostic due_at string as a wall-clock reading in
 * `timeZone` and return the true UTC instant. Because the result is an
 * absolute instant, client and server produce identical answers — that
 * property is the entire fix.
 *
 * Algorithm promoted from lib/reminders.ts (production-proven there): format
 * a UTC guess back into the target zone, measure the offset the formatter
 * reveals, and correct the guess by it.
 */
/** True when the string carries an explicit UTC offset (timestamptz ISO form). */
function hasExplicitOffset(dueAtStr: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(dueAtStr)
}

export function dueAtToInstant(dueAtStr: string, timeZone: string): Date {
  // ORB-361: due_at is now timestamptz — PostgREST returns an absolute instant
  // with an explicit offset, which needs no zone interpretation at all. The
  // wall-clock branch below remains for any naive string still in flight
  // (form drafts, the deploy window, older exports).
  if (hasExplicitOffset(dueAtStr)) return new Date(dueAtStr)
  const [datePart, timePart] = dueAtStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours = 0, minutes = 0] = (timePart ?? '00:00').split(':').map(Number)

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes))
  const parts = zoneFormatter(timeZone).formatToParts(utcGuess)
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }

  const fYear = Number(partMap.year)
  const fMonth = Number(partMap.month)
  const fDay = Number(partMap.day)
  const fHour = Number(partMap.hour) === 24 ? 0 : Number(partMap.hour)
  const fMinute = Number(partMap.minute)

  const targetTime = Date.UTC(year, month - 1, day, hours, minutes)
  const formattedTime = Date.UTC(fYear, fMonth - 1, fDay, fHour, fMinute)

  const offsetMs = formattedTime - targetTime
  return new Date(utcGuess.getTime() - offsetMs)
}

/** True when the due instant is within `warningHours` of now (or already past). */
export function isDueWithinWarning(dueAtStr: string, warningHours: number, timeZone: string): boolean {
  const due = dueAtToInstant(dueAtStr, timeZone)
  const thresholdMs = warningHours * 60 * 60 * 1000
  return due.getTime() - Date.now() <= thresholdMs
}

function calendarDayInZone(instant: Date, timeZone: string): string {
  const parts = zoneFormatter(timeZone).formatToParts(instant)
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }
  return `${partMap.year}-${String(partMap.month).padStart(2, '0')}-${String(partMap.day).padStart(2, '0')}`
}

/** True when the due date falls on today's calendar date in `timeZone`. */
export function isDueToday(dueAtStr: string, timeZone: string): boolean {
  return calendarDayInZone(dueAtToInstant(dueAtStr, timeZone), timeZone)
    === calendarDayInZone(new Date(), timeZone)
}

/**
 * The wall-clock reading of an instant in `timeZone`, shaped for a
 * datetime-local input (YYYY-MM-DDTHH:mm). Inverse of dueAtToInstant.
 */
export function instantToWallClock(dueAtStr: string, timeZone: string): string {
  const parts = zoneFormatter(timeZone).formatToParts(dueAtToInstant(dueAtStr, timeZone))
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }
  const hour = Number(partMap.hour) === 24 ? 0 : Number(partMap.hour)
  return `${partMap.year}-${String(partMap.month).padStart(2, '0')}-${String(partMap.day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(partMap.minute).padStart(2, '0')}`
}

// ── Reminders (ORB-361) ────────────────────────────────────────────────────

export const REMINDER_LEAD_UNITS = ['minutes', 'hours', 'days', 'weeks', 'months'] as const
export type ReminderLeadUnit = (typeof REMINDER_LEAD_UNITS)[number]

/** Returns an error message, or null when the pair is valid (both absent is valid = no reminder). */
export function validateReminderLead(value: unknown, unit: unknown): string | null {
  if (value == null && unit == null) return null
  if (value == null || unit == null) return 'reminder_lead_value and reminder_lead_unit must be set together'
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 99) {
    return 'reminder_lead_value must be an integer between 0 and 99'
  }
  if (!REMINDER_LEAD_UNITS.includes(unit as ReminderLeadUnit)) {
    return `reminder_lead_unit must be one of: ${REMINDER_LEAD_UNITS.join(', ')}`
  }
  return null
}

const UNIT_MS: Record<Exclude<ReminderLeadUnit, 'months'>, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
}

/**
 * When the reminder fires: due minus lead. Months use calendar subtraction in
 * the todo's zone with the day clamped (due July 31, 1 month before → June 30)
 * — the rule pinned in docs/per-todo-due-time-and-reminders-plan.md §5. All
 * other units are exact arithmetic on the instant.
 */
export function reminderTriggerInstant(dueAtStr: string, value: number, unit: ReminderLeadUnit, timeZone: string): Date {
  const due = dueAtToInstant(dueAtStr, timeZone)
  if (unit !== 'months') return new Date(due.getTime() - value * UNIT_MS[unit])

  const wall = instantToWallClock(dueAtStr, timeZone) // YYYY-MM-DDTHH:mm in zone
  const [datePart, timePart] = wall.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const totalMonths = year * 12 + (month - 1) - value
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonth = ((totalMonths % 12) + 12) % 12 // 0-based
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, daysInTarget)
  const targetWall = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}T${timePart}`
  return dueAtToInstant(targetWall, timeZone)
}

/** Short zone label for display, e.g. "PDT", "HST" — at the moment of `instant`. */
export function zoneAbbreviation(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(instant)
  return parts.find(p => p.type === 'timeZoneName')?.value ?? timeZone
}

/**
 * IANA zones presented Apple-Reminders style: "Vancouver — Pacific Time (PDT)".
 * Only real IANA city zones exist (Vancouver yes, Seattle no) — accepted v1
 * limitation per docs/per-todo-due-time-and-reminders-plan.md §4.3.
 */
export type CityZone = { zone: string; city: string; label: string }

let cityZoneCache: CityZone[] | null = null
const zoneLabelCache = new Map<string, string>()

/** "Pacific Time (PDT)"-style label for a zone, memoized per zone. */
export function zoneDisplayLabel(zone: string): string {
  let label = zoneLabelCache.get(zone)
  if (label !== undefined) return label
  const now = new Date()
  let generic = ''
  try {
    generic = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longGeneric' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch { /* zone unsupported by this engine — skip label detail */ }
  const abbrev = zoneAbbreviation(now, zone)
  label = generic ? `${generic} (${abbrev})` : abbrev
  zoneLabelCache.set(zone, label)
  return label
}

export function listCityZones(): CityZone[] {
  if (cityZoneCache) return cityZoneCache
  cityZoneCache = Intl.supportedValuesOf('timeZone')
    .filter(zone => zone.includes('/') && !zone.startsWith('Etc/'))
    .map(zone => ({
      zone,
      city: zone.split('/').pop()!.replace(/_/g, ' '),
      label: zoneDisplayLabel(zone),
    }))
    .sort((a, b) => a.city.localeCompare(b.city))
  return cityZoneCache
}
