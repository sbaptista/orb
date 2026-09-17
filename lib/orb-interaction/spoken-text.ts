function stripVoiceMarkdown(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^\s)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstSentences(text: string, maxChars: number, maxSentences: number) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text.slice(0, maxChars).trim()
  let result = ''
  for (const sentence of sentences.slice(0, maxSentences)) {
    if ((result + sentence).length > maxChars && result) break
    result += sentence
  }
  return result.trim() || sentences[0].slice(0, maxChars).trim()
}

export function toOrbSpokenText(text: string) {
  const plain = stripVoiceMarkdown(text)
  if (!plain) return plain

  const bulkConfirm = plain.match(/\bconfirm:?\s+(.+?\b(?:\d+|all)\s+(?:todos|tasks|items)\b.*?)(?:\?|$)/i)
  if (bulkConfirm) {
    const summary = bulkConfirm[1].replace(/\s+/g, ' ').trim()
    return `Confirm ${summary}. See the transcript for the exact items. Confirm?`
  }

  const listStart = plain.search(/\n\s*(?:[-*+]|\d+\.)\s/)
  const narrative = listStart >= 0 ? plain.slice(0, listStart) : plain
  const lead = firstSentences(narrative, 400, 3)
  const hasMore = plain.length > lead.length + 30 || listStart >= 0
  return hasMore ? `${lead} I put the details on screen.` : lead
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
}

/**
 * The words a listener hears, for comparing Orb's intended speech with the
 * provider's transcript of what it actually said. Differences a listener
 * cannot hear are removed: case, punctuation, quotes, hyphens, letter/digit
 * joins ("test9" vs "test 9"), and small numbers as words vs digits. On
 * 2026-09-16 a strict comparison ended a voice session over replies such as
 * `"TEST-1" in test9`.
 */
export function comparableSpokenWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => NUMBER_WORDS[word] ?? word)
    .join(' ')
}
