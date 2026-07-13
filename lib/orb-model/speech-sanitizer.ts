export function sanitizeUserFacingSpeech(speech: string): string {
  return speech
    .replace(/\s*\[code:\s*[A-Z0-9_-]+\]/gi, '')
    // Collapse repeated horizontal spacing without destroying Markdown line
    // breaks. Using \s here flattened "Confirm?\n\n- first item" into one
    // paragraph, making the first target look like part of the heading.
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}
