/**
 * Single source of truth for status classification.
 *
 * Every component, server action, and insight engine that needs to know
 * whether a status is "active", "parked", or "closed" imports from here.
 *
 * Active  = open + in progress  (work you're doing or should be doing)
 * Parked  = deferred + on hold  (acknowledged but not active)
 * Closed  = whatever the DB marks is_closed (done/cancelled/etc.)
 */

export const ACTIVE_STATUSES = new Set(['open', 'in progress'])
export const PARKED_STATUSES = new Set(['deferred', 'on hold'])

export function isActive(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}

export function isParked(status: string): boolean {
  return PARKED_STATUSES.has(status)
}

export function filterActive<T extends { status: string }>(items: T[]): T[] {
  return items.filter(t => ACTIVE_STATUSES.has(t.status))
}

export function filterParked<T extends { status: string }>(items: T[]): T[] {
  return items.filter(t => PARKED_STATUSES.has(t.status))
}
