export type KnowledgeSearchMode = 'all' | 'any'

export function knowledgeSearchTerms(query: string) {
  return Array.from(new Set(
    query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  ))
}

export function matchingKnowledgeTerms(values: Array<string | null | undefined>, query: string) {
  const haystack = values.filter(Boolean).join('\n').toLocaleLowerCase()
  return knowledgeSearchTerms(query).filter(term => haystack.includes(term))
}

export function matchesKnowledgeSearch(
  values: Array<string | null | undefined>,
  query: string,
  mode: KnowledgeSearchMode,
) {
  const terms = knowledgeSearchTerms(query)
  if (terms.length === 0) return true
  const matched = new Set(matchingKnowledgeTerms(values, query))
  return mode === 'all'
    ? terms.every(term => matched.has(term))
    : terms.some(term => matched.has(term))
}
