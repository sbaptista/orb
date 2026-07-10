export function sanitizeUserFacingSpeech(speech: string): string {
  return speech
    .replace(/\s*\[code:\s*[A-Z0-9_-]+\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}
