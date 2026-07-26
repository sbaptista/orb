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
export function dueAtToInstant(dueAtStr: string, timeZone: string): Date {
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

/** True when the due date falls on today's calendar date in `timeZone`. */
export function isDueToday(dueAtStr: string, timeZone: string): boolean {
  const [dueDatePart] = dueAtStr.split('T')
  const parts = zoneFormatter(timeZone).formatToParts(new Date())
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }
  const todayPart = `${partMap.year}-${String(partMap.month).padStart(2, '0')}-${String(partMap.day).padStart(2, '0')}`
  return dueDatePart === todayPart
}
