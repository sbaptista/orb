/** Repair a missing boundary emitted between adjacent transcript fragments. */
export function normalizeSpokenTurnText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function restartRemainder(input: string): string | null {
  const normalized = normalizeSpokenTurnText(input)
  const match = normalized.match(
    /^(?:(?:okay|ok)[,.!\s]+)?(?:let me (?:try again|start over)|try again|start over|scratch that|no[,\s]+i mean|what i meant was)\b[,.!:;\s-]*/i,
  )
  if (!match) return null
  return normalized.slice(match[0].length).trim()
}

export function isRestartOnlyCommand(input: string): boolean {
  return restartRemainder(input) === ''
}

export function restartReplacementText(input: string): string | null {
  const remainder = restartRemainder(input)
  return remainder ? remainder : null
}
