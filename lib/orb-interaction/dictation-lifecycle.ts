/** One outstanding recording/transcription; invalidation rejects late responses. */
export class DictationLifecycle {
  private generation = 0
  private active: number | null = null
  begin(): number | null {
    if (this.active !== null) return null
    this.active = ++this.generation
    return this.active
  }
  isCurrent(id: number): boolean { return this.active === id }
  finish(id: number): boolean {
    if (!this.isCurrent(id)) return false
    this.active = null
    return true
  }
  cancel(): void { this.active = null; this.generation++ }
  get busy(): boolean { return this.active !== null }
}

export function appendDictation(current: string, transcript: string): string | null {
  const text = transcript.trim()
  if (!text) return null
  return current + (current && !/\s$/.test(current) ? ' ' : '') + text
}
