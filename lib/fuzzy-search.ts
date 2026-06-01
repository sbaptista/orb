/**
 * Fuzzy search: matches a query against a haystack string.
 * Handles typos (edit distance ≤ 2), partial word matches, and multi-word queries.
 * Returns true if the haystack is a fuzzy match for the query.
 */
export function fuzzyMatch(query: string, haystack: string): boolean {
  const q = query.toLowerCase()
  const h = haystack.toLowerCase()

  // Exact substring match
  if (h.includes(q)) return true

  // Word-level fuzzy matching
  const qWords = q.split(/\s+/).filter(w => w.length > 2)
  if (qWords.length === 0) return false

  const hWords = h.split(/\s+/)
  const matched = qWords.filter(qw => {
    // Direct word inclusion
    if (h.includes(qw)) return true
    // Typo tolerance: find a haystack word within edit distance 2
    return hWords.some(hw => {
      if (Math.abs(hw.length - qw.length) > 2) return false
      let dist = 0
      const maxLen = Math.max(hw.length, qw.length)
      for (let i = 0; i < maxLen; i++) {
        if (hw[i] !== qw[i]) dist++
        if (dist > 2) return false
      }
      return true
    })
  })

  return matched.length >= Math.max(1, Math.ceil(qWords.length * 0.5))
}
