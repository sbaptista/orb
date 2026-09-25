export type TerminalToolResponse = {
  toolUseId: string
  speech: string
  spokenText?: string
  clientAction?: { action: string; target?: string; projectId?: string }
}

export type CompletedToolRound = {
  speech: string
  spokenText?: string
  clientAction?: TerminalToolResponse['clientAction']
}

/**
 * A tool round is complete only when every requested tool has supplied a
 * canonical, presentation-ready result. This is the shared data-sufficiency
 * boundary: one incomplete, ambiguous, failed, or unpresented result keeps the
 * round on the model path.
 */
export function completeToolRound(
  toolUseIds: string[],
  terminalResponses: Iterable<TerminalToolResponse>,
): CompletedToolRound | null {
  if (toolUseIds.length === 0) return null
  const byId = new Map<string, TerminalToolResponse>()
  for (const response of terminalResponses) {
    if (!response.toolUseId || byId.has(response.toolUseId) || !response.speech.trim()) return null
    byId.set(response.toolUseId, response)
  }
  if (byId.size !== toolUseIds.length || toolUseIds.some(id => !byId.has(id))) return null

  const ordered = toolUseIds.map(id => byId.get(id)!)
  const clientActions = ordered.flatMap(response => response.clientAction ? [response.clientAction] : [])
  const spokenTexts = ordered.map(response => response.spokenText?.trim()).filter(Boolean) as string[]
  if (clientActions.length > 1) return null
  return {
    speech: ordered.map(response => response.speech.trim()).join('\n\n'),
    ...(spokenTexts.length === ordered.length ? { spokenText: spokenTexts.join(' ') } : {}),
    ...(clientActions[0] ? { clientAction: clientActions[0] } : {}),
  }
}
