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

/**
 * Relevance score for ranking search results across a title + body pair.
 * Unlike fuzzyMatch (a boolean recall filter — deliberately loose so a
 * partial/typo'd query still finds something), this is for ranking: with a
 * large corpus and short queries, "does this match at all" isn't enough —
 * results need to be ordered so the best match survives any result cap.
 * Exact/title hits are weighted far above content hits, which can be huge
 * blocks of prose where a query word appears incidentally.
 */
// Generic meta-nouns that describe knowledge/task records themselves rather
// than their topic ("update the disk IO budget entry" — "entry" isn't the
// subject). Excluded from word-level scoring so a title that happens to
// literally contain "entry"/"issue" doesn't outrank the real topical match.
const GENERIC_META_WORDS = new Set(['entry', 'entries', 'issue', 'issues', 'item', 'items', 'record', 'records', 'note', 'notes', 'thing', 'things'])

export function scoreTextMatch(query: string, title: string, body: string): number {
  const q = query.toLowerCase().trim()
  const t = title.toLowerCase()
  const b = body.toLowerCase()
  if (!q) return 0
  if (t === q) return 100
  if (t.includes(q)) return 80
  if (b.includes(q)) return 40

  const qWords = q.split(/\s+/).filter(w => w.length > 2 && !GENERIC_META_WORDS.has(w))
  if (qWords.length === 0) return 0
  const titleHits = qWords.filter(w => t.includes(w)).length
  const bodyHits = qWords.filter(w => b.includes(w)).length
  if (titleHits === 0 && bodyHits === 0) return 0
  return titleHits * 10 + bodyHits
}
