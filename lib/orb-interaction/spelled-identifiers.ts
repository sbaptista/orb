const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

/** Preserve explicit voice spelling as model context without rewriting history. */
export function withExplicitSpellingClarification(input: string): string {
  const match = input.match(
    /\bspelled\s+(?:(uppercase|lowercase)\s+)?([a-z0-9](?:\s*-\s*[a-z0-9])+)(?:\s*(?:,|and)?\s*(?:then\s+)?(?:numeral|number|digit)\s+([a-z0-9-]+))?/i,
  )
  if (!match) return input

  const spelled = match[2].replace(/[^a-z0-9]/gi, '')
  if (spelled.length < 2) return input
  const letters = match[1]?.toLowerCase() === 'lowercase'
    ? spelled.toLowerCase()
    : spelled.toUpperCase()
  const digitToken = match[3]?.toLowerCase()
  const digits = digitToken
    ? DIGIT_WORDS[digitToken] ?? (/^\d+$/.test(digitToken) ? digitToken : '')
    : ''
  const canonical = `${letters}${digits}`

  return `${input}\n\n[SYSTEM: The user explicitly spelled the intended name or identifier as "${canonical}". Preserve that exact spelling in any tool call and confirmation. Do not substitute an earlier homophone.]`
}
