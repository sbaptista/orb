type MemoryInput = { track?: unknown; category?: unknown; content?: unknown; evidence?: unknown }

/** Evidence proves that observations were recorded, not that an inference is true. */
export function validateMemory(input: MemoryInput, level: string, userTexts: string[]): string | null {
  if (level === 'off') return 'Memory is disabled.'
  if (!['session', 'full'].includes(level)) return 'Unknown memory mode.'
  if (!['autonomous', 'offered'].includes(String(input.track))) return 'Invalid memory track.'
  if (!['pattern', 'rhythm', 'preference', 'emotional', 'milestone'].includes(String(input.category))) return 'Invalid memory category.'
  if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 4000) return 'Memory content must contain 1–4000 characters.'
  if (input.track === 'autonomous') {
    const quotes = Array.isArray(input.evidence) ? input.evidence : []
    const remaining = new Set(userTexts.map(text => text.trim()).filter(Boolean))
    const matched = new Set<string>()
    for (const quote of quotes) {
      if (typeof quote !== 'string' || quote.trim().length < 12 || matched.has(quote.trim())) continue
      const text = [...remaining].find(text => text.includes(quote.trim()))
      if (text) { matched.add(quote.trim()); remaining.delete(text) }
    }
    if (matched.size < 2) return 'Autonomous memory requires quotes from two distinct recorded user observations. With insufficient evidence, offer to remember it instead.'
  }
  return null
}
