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
