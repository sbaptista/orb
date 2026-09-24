/**
 * Shared project query helpers.
 * Every "list visible projects" query goes through here so dormancy
 * filtering is applied in exactly one place.
 */

import { fuzzyMatch } from './fuzzy-search'

type SupabaseClient = { from: (table: string) => any }

// Resolves a user-typed or Orb-spoken project reference to exactly one
// project. Exact name → exact code → fuzzy/partial name, so "Stokely" and
// "Mr. Stokely from Boston" both resolve to the same project. A tier is used
// only if it yields exactly one match — ambiguous or empty tiers fall
// through rather than guessing, since a misfire here silently switches the
// user's project (client-side) or fails a switch_project tool call
// (server-side). Shared between the client (UnifiedDashboard.tsx: /switch,
// /drop, /edit, and rendering the switch_project result) and the server
// (orb-converse.ts: resolving switch_project's target before it succeeds) —
// previously two separate implementations that had silently diverged in
// strength (server was exact-match-only).
export function resolveProjectByReference<T extends { name: string; code?: string | null }>(
  products: T[],
  reference: string,
): T | null {
  const ref = reference.trim().toUpperCase()
  if (!ref) return null

  const byName = products.filter(p => p.name.toUpperCase() === ref)
  if (byName.length === 1) return byName[0]

  const byCode = products.filter(p => (p.code ?? '').toUpperCase() === ref)
  if (byCode.length === 1) return byCode[0]

  const byFuzzy = products.filter(p => fuzzyMatch(reference, p.name))
  if (byFuzzy.length === 1) return byFuzzy[0]

  return null
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current.push(Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      ))
    }
    previous = current
  }
  return previous[right.length]
}

/**
 * Returns one plausible project-name correction for clarification only. It
 * never authorizes an action: exact/fuzzy resolution above remains the gate.
 */
export function suggestProjectByReference<T extends { name: string; code?: string | null }>(
  products: T[],
  reference: string,
): T | null {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const ref = normalize(reference)
  if (ref.length < 3) return null
  const ranked = products
    .map(project => ({ project, distance: editDistance(ref, normalize(project.name)) }))
    .sort((left, right) => left.distance - right.distance)
  const best = ranked[0]
  if (!best || best.distance > Math.max(2, Math.floor(Math.max(ref.length, normalize(best.project.name).length) / 2))) return null
  if (ranked[1]?.distance === best.distance) return null
  return best.project
}

/**
 * The project fields the dashboard needs, in one place.
 *
 * This list was hand-copied across four call sites — two server pages that
 * seed `initialProducts`, and two client refetches. ORB-361 Phase 3 added
 * `urgency_windows` to the client ones and missed the server ones, so a fresh
 * page load silently fell back to the default urgency windows: the setting
 * looked like it "reverted" on refresh while the database was correct all
 * along. Any field the dashboard reads belongs here, not in a call site.
 */
export const DASHBOARD_PROJECT_FIELDS =
  'id, name, code, description, created_by, view_mode, urgency_windows'

export function visibleProjectsQuery(supabase: SupabaseClient, select = '*') {
  return supabase
    .from('projects')
    .select(select)
    .eq('is_dormant', false)
    .order('sort_order')
}

/**
 * Calculates the width of uppercase DM Sans text with font-size: 11px and letter-spacing: 3px.
 * Estimates are based on character proportions.
 */
export function getDMStyleTextWidth(text: string): number {
  const charWidths: Record<string, number> = {
    'A': 7.5, 'B': 7.5, 'C': 8, 'D': 8, 'E': 6.5, 'F': 6, 'G': 8.5, 'H': 8, 'I': 3, 'J': 5.5,
    'K': 7.5, 'L': 6.5, 'M': 9.5, 'N': 8, 'O': 8.5, 'P': 7, 'Q': 8.5, 'R': 7.5, 'S': 7, 'T': 6.5,
    'U': 8, 'V': 7.5, 'W': 10.5, 'X': 7.5, 'Y': 7.5, 'Z': 7,
    ' ': 4, '-': 4.5, '_': 7, '.': 3, '&': 8.5, '…': 9
  }
  let width = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase()
    const charW = charWidths[char] || 7.5 // fallback
    width += charW + 3 // letter-spacing of 3px
  }
  return width
}

/**
 * Clamps the project name to fit inside half the circumference of the Orb (approx 182px).
 * Uses character-by-character width estimation to guarantee it fits.
 */
export function clampProjectName(name: string): string {
  const raw = name.trim().toUpperCase()
  const limit = 182 // Half the circumference of radius 58 circle (pi * 58 approx 182.2)

  if (getDMStyleTextWidth(raw) <= limit) {
    return raw
  }

  let prefix = raw
  while (prefix.length > 0) {
    prefix = prefix.slice(0, -1)
    const trimmedPrefix = prefix.trimEnd()
    if (getDMStyleTextWidth(trimmedPrefix + '…') <= limit) {
      return trimmedPrefix + '…'
    }
  }
  return '…'
}
