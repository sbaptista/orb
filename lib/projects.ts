/**
 * Shared project query helpers.
 * Every "list visible projects" query goes through here so dormancy
 * filtering is applied in exactly one place.
 */

type SupabaseClient = { from: (table: string) => any }

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

