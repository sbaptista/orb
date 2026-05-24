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

/**
 * Canonical status vocabulary for AI prompts.
 *
 * Import this into any system prompt that reports counts or references
 * status groups. This is the ONLY place these definitions should live —
 * never hardcode status language in prompt strings.
 */
export const STATUS_VOCABULARY = [
  'STATUS DEFINITIONS (canonical — use these exactly):',
  `  "active" = ${[...ACTIVE_STATUSES].join(', ')} — work being done or that should be done`,
  `  "parked" = ${[...PARKED_STATUSES].join(', ')} — acknowledged but deliberately not active`,
  '  "done" / "closed" = any status marked is_closed in the database',
  '',
  'RULES:',
  '  - Never count parked items as active. They are separate categories.',
  '  - When citing any count, parenthetically state which statuses were included.',
  '    Correct: "9 active tasks (open + in progress)"',
  '    Wrong:   "9 active tasks"',
  '  - When both active and parked exist, report them separately.',
  '    Example: "9 active (open + in progress), 5 parked (deferred + on hold)"',
  '  - "open" as a user query means status=open specifically, not "all non-closed".',
].join('\n')
