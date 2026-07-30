/**
 * ORB-339 — how a spoken or typed todo *reference* becomes exactly one todo.
 *
 * The Realtime path has resolved references server-side since ORB-325; the
 * serial (text) path never has. update_todo takes a code, so which code got
 * picked was the model's unaided judgment against the backlog — and Haiku
 * picked wrong on near-exact titles (Tier 1, 2026-07-14: "voice permission
 * tests" against three "voice" todos). ORB-342 converged what a mutation
 * DOES; this converges what a task NAME means, which is the half it left.
 *
 * Only the POLICY lives here. Row access and error reporting stay with each
 * channel: Realtime throws RealtimeInputError over HTTP, serial returns a
 * tool result the model reads. Forcing those together would drag auth and
 * transport into a decision function that needs neither.
 *
 * The rule is deliberately strict and must not be softened into a "best
 * guess": a tie resolves to AMBIGUOUS, never to the first candidate. Picking
 * one of two equally-good matches is how a mutation lands on the wrong todo,
 * and the user cannot tell that happened until the damage is visible.
 */

import { fuzzyMatch, scoreTextMatch } from '@/lib/fuzzy-search'

/** The minimum shape the policy needs. Callers pass their own richer rows. */
export type TodoReferenceRow = {
  todo_number: number
  title: string
  projects: { code: string; name: string }
}

export type TodoReferenceResult<T> =
  | { kind: 'resolved'; row: T }
  | { kind: 'ambiguous'; candidates: T[] }
  | { kind: 'not_found' }

/** True when the reference looks like a task code (ORB-73), not a title. */
export function isCodeLikeReference(reference: string): boolean {
  return /^(.+)-(\d+)$/.test(reference.trim().toUpperCase())
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Resolve a reference against candidate rows.
 *
 * Order: exact code or exact title first — an exact match is never overridden
 * by a fuzzy one. Only if nothing matches exactly does fuzzy matching run.
 * With several candidates, rank by `scoreTextMatch` and accept the top one
 * ONLY if it is strictly stronger than the runner-up.
 */
export function selectTodoByReference<T extends TodoReferenceRow>(
  reference: string,
  rows: T[],
): TodoReferenceResult<T> {
  const normalized = normalize(reference)
  if (!normalized) return { kind: 'not_found' }

  const exact = rows.filter(row =>
    `${row.projects.code}-${row.todo_number}`.toLowerCase() === normalized
    || normalize(row.title) === normalized
  )
  const candidates = exact.length > 0 ? exact : rows.filter(row => fuzzyMatch(reference, row.title))

  if (candidates.length === 1) return { kind: 'resolved', row: candidates[0] }
  if (candidates.length === 0) return { kind: 'not_found' }

  const ranked = candidates
    .map(row => ({ row, score: scoreTextMatch(reference, row.title, '') }))
    .sort((a, b) => b.score - a.score)

  // Strictly greater, and non-zero. A tie is ambiguous, not a coin flip.
  if (ranked[0].score > 0 && ranked[0].score > ranked[1].score) {
    return { kind: 'resolved', row: ranked[0].row }
  }
  return { kind: 'ambiguous', candidates: ranked.slice(0, 5).map(r => r.row) }
}

/** Shared phrasing for an ambiguous result, so both channels name the same options. */
export function describeTodoCandidates(candidates: TodoReferenceRow[]): string {
  return candidates
    .map(row => `${row.projects.code}-${row.todo_number}, “${row.title}”, in ${row.projects.name}`)
    .join('; ')
}
