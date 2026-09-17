import type { OrbMutationKind } from './proposals'

export const ORB_COMMAND_BATCH_LIMIT = 20
// Ordinary conversational detours and interruptions must not silently discard
// a pending confirmation. Explicit decline, replacement, and /clear still win.
export const ORB_COMMAND_BATCH_TTL_MS = 30 * 60_000

export type PreparedOrbMutationCommand = {
  toolUseId: string
  kind: OrbMutationKind
  title: string
  summary: string
  projectId?: string | null
  targetTodoId?: string | null
  destinationProjectId?: string | null
  params: Record<string, unknown>
}

export function validatePreparedOrbCommandBatch(commands: PreparedOrbMutationCommand[]): void {
  if (commands.length < 1 || commands.length > ORB_COMMAND_BATCH_LIMIT) {
    throw new Error(`A command batch must contain between 1 and ${ORB_COMMAND_BATCH_LIMIT} commands.`)
  }
  const toolUseIds = new Set<string>()
  for (const command of commands) {
    if (!command.toolUseId.trim()) throw new Error('Every command requires a tool-use identity.')
    if (toolUseIds.has(command.toolUseId)) throw new Error(`Duplicate command identity: ${command.toolUseId}.`)
    if (!command.title.trim() || !command.summary.trim()) throw new Error('Every command requires a title and summary.')
    toolUseIds.add(command.toolUseId)
  }
}

export function buildOrbCommandBatchConfirmationSpeech(
  commands: PreparedOrbMutationCommand[],
): string {
  validatePreparedOrbCommandBatch(commands)
  return buildOrbConfirmationSpeechFromSummaries(commands.map(command => command.summary))
}

/**
 * The one wording of a go-ahead question. Built from stored command summaries
 * so a pending batch can be restated exactly as it was first shown.
 */
export function buildOrbConfirmationSpeechFromSummaries(summaries: string[]): string {
  if (summaries.length === 1) {
    return `I'm about to ${summaries[0]}.\n\nWant me to go ahead?`
  }
  const lines = summaries.map((summary, index) => `${index + 1}. ${summary}`)
  return `I'm about to perform these ${summaries.length} actions as one batch:\n\n${lines.join('\n')}\n\nWant me to go ahead?`
}

/** Prefix used when Orb restates what is really pending instead of confirming. */
export const ORB_PENDING_RESTATEMENT_PREFIX = 'To be sure we agree, this is exactly what is waiting for your go-ahead:'
