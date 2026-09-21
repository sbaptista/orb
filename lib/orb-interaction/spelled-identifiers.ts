const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

// Letters spoken one at a time ("T-E-S-T"), optionally preceded by "spell…"
// and a case word, optionally followed by "numeral/number/digit N". Real
// phrasing rarely says "spelled": on 2026-09-16 Stan said "spell it
// differently, T-E-S-T numeral 8", "Let me spell that: T-E-S-T numeral 9", and
// "Yes, T-E-S-T numeral eight" — none of which the "spelled"-only form matched.
// Each hyphen-separated part must be a single character, so ordinary hyphenated
// words ("twenty-one", "e-mail") never match.
const SPELLED_IDENTIFIER = /(?:\bspell(?:ed|ing|s)?\b[^A-Za-z0-9]*(?:(?:it|that|the project|the name)\b[^A-Za-z0-9]*)?(?:(uppercase|lowercase)\s+)?)?(?<![A-Za-z0-9])([a-z0-9](?:\s*-\s*[a-z0-9])+)(?![A-Za-z0-9])(?:\s*(?:,|and)?\s*(?:then\s+)?(?:numeral|number|digit)\s+([a-z0-9]+))?/i

const LOWERCASE_REQUEST = /\b(?:all\s+)?lower\s*-?\s*case\b|\bsmall letters\b/i

/** Preserve explicit voice spelling as model context without rewriting history. */
export function explicitSpelledIdentifier(input: string): string | null {
  const match = input.match(SPELLED_IDENTIFIER)
  if (!match) return null

  const spelled = match[2].replace(/[^a-z0-9]/gi, '')
  if (spelled.length < 2) return null
  const lowercase = match[1]?.toLowerCase() === 'lowercase'
    || (match[1]?.toLowerCase() !== 'uppercase' && LOWERCASE_REQUEST.test(input))
  const letters = lowercase ? spelled.toLowerCase() : spelled.toUpperCase()
  const digitToken = match[3]?.toLowerCase()
  const digits = digitToken
    ? DIGIT_WORDS[digitToken] ?? (/^\d+$/.test(digitToken) ? digitToken : '')
    : ''
  return `${letters}${digits}`
}

export function withExplicitSpellingClarification(input: string): string {
  const canonical = explicitSpelledIdentifier(input)
  if (!canonical) return input

  return `${input}\n\n[SYSTEM: The user explicitly spelled the intended name or identifier as "${canonical}". Preserve that exact spelling in any tool call and confirmation. Do not substitute an earlier homophone.]`
}

/** Bind only explicitly named fields; never replace unrelated tool arguments. */
export function validateSpelledProjectField(input: string, tool: string, params: Record<string, unknown>): string | null {
  if (!['create_project', 'update_project'].includes(tool)) return null
  const canonical = explicitSpelledIdentifier(input)
  if (!canonical) return null
  // Multiple spellings or multiple projects require interpretation, not a global override.
  const segments = input.match(/(?<![A-Za-z0-9])[a-z0-9](?:\s*-\s*[a-z0-9])+(?![A-Za-z0-9])/gi) ?? []
  if (segments.length !== 1) return 'Multiple spelled identifiers need separate, explicit field bindings before proposing this change.'
  const codeRequested = /\b(?:project code|with code|code is|code should)\b/i.test(input)
  const nameRequested = /\b(?:project (?:called|named)|project name|name (?:is|should)|rename)\b/i.test(input)
  if (!codeRequested && !nameRequested) return 'The spelling is explicit but its field is unclear. Ask whether it is the project name or code before proposing a change.'
  if (codeRequested && nameRequested) return 'Clarify which project field the explicit spelling refers to.'
  if (tool === 'update_project' && codeRequested) return 'Project codes cannot be changed.'
  const field = codeRequested ? 'code' : tool === 'create_project' ? 'name' : 'new_name'
  return params[field] === canonical ? null : `The user explicitly spelled ${field} as "${canonical}". Use that exact value and present a new proposal; nothing has executed.`
}

/**
 * The same clarification for earlier user turns, model-facing only. A later
 * turn such as "All lowercase." refines a name spelled one turn before, so the
 * spelling must still be visible exactly when that turn is interpreted.
 */
export function withHistorySpellingClarifications<T extends { role: 'user' | 'assistant'; text: string }>(
  history: T[],
): T[] {
  return history.map(entry => entry.role === 'user'
    ? { ...entry, text: withExplicitSpellingClarification(entry.text) }
    : entry)
}
