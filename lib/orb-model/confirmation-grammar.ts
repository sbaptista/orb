/**
 * A reply that is nothing but agreement — "yes", "go ahead", "Yes Yes." — with
 * no other content. Lives here rather than in mutation-authorization.ts so the
 * browser can use it too: the client must recognise a repeated confirmation to
 * avoid sending the same decision twice (2026-09-17).
 */
export function isBareMutationAffirmation(input: string): boolean {
  return /^(?:(?:yes|yep|yeah|yup|sure|okay|ok|affirmative|absolutely|definitely|approved|approve|confirmed|confirm|go ahead|do it|go|please do|please|proceed|sounds good|correct|that['’]?s right|that is right)[,.!\s]*)+$/i.test(input.trim())
}

const TYPO_TOLERANT_CONFIRMATIONS = [
  'yes',
  'yep',
  'yeah',
  'sure',
  'okay',
  'confirm',
  'confirmed',
  'approve',
  'approved',
  'go ahead',
  'do it',
  'please do',
  'proceed',
] as const

function normalizeConfirmation(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false
  if (left === right) return true

  let leftIndex = 0
  let rightIndex = 0
  let edits = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1
      rightIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) leftIndex += 1
    else if (right.length > left.length) rightIndex += 1
    else {
      leftIndex += 1
      rightIndex += 1
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits += 1
  return edits <= 1
}

/**
 * Accepts an otherwise-bare confirmation with one likely transcription or
 * typing error. Sentence-shaped or mixed-content input never enters this path.
 */
export function isTypoTolerantBareMutationAffirmation(input: string): boolean {
  const normalized = normalizeConfirmation(input)
  if (!normalized || normalized.length > 12) return false
  return TYPO_TOLERANT_CONFIRMATIONS.some(candidate =>
    editDistanceAtMostOne(normalized, candidate),
  )
}
