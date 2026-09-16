import type { AuthContext } from '@/lib/auth'
import { signOrbOperationCapability } from '@/lib/orb-operations/capabilities'
import {
  ORB_COMMAND_BATCH_TTL_MS,
  validatePreparedOrbCommandBatch,
  type PreparedOrbMutationCommand,
} from '@/lib/orb-operations/command-batch-contract'
import {
  appendOrbConversationEvent,
  isOrbTurnInterrupted,
  stableOrbConversationEventId,
} from '@/lib/orb-interaction/conversation-store'

export {
  buildOrbCommandBatchConfirmationSpeech,
  type PreparedOrbMutationCommand,
} from '@/lib/orb-operations/command-batch-contract'

export type PersistedOrbCommandBatch = {
  batchId: string
  commandCount: number
  expiresAt: number
  proposalToken: string
}

export async function persistOrbCommandBatch(
  auth: AuthContext,
  commands: PreparedOrbMutationCommand[],
  summary: string,
): Promise<PersistedOrbCommandBatch> {
  if (!auth.interaction) {
    throw new Error('Canonical command batches require a unified interaction turn.')
  }
  validatePreparedOrbCommandBatch(commands)
  if (await isOrbTurnInterrupted(
    auth,
    auth.interaction.conversationId,
    auth.interaction.turnId,
  )) {
    throw new Error('This turn was interrupted before the command batch could be proposed.')
  }

  const batchId = crypto.randomUUID()
  const expiresAt = Date.now() + ORB_COMMAND_BATCH_TTL_MS
  const persistedCommands = commands.map(command => ({
    proposal_id: crypto.randomUUID(),
    tool_use_id: command.toolUseId,
    kind: command.kind,
    title: command.title.slice(0, 240),
    summary: command.summary.slice(0, 1000),
    project_id: command.projectId ?? null,
    target_todo_id: command.targetTodoId ?? null,
    destination_project_id: command.destinationProjectId ?? null,
    params: command.params,
  }))

  const { error } = await auth.admin.rpc('prepare_orb_command_batch', {
    p_batch_id: batchId,
    p_user_id: auth.user.id,
    p_conversation_id: auth.interaction.conversationId,
    p_requested_event_id: auth.interaction.userEventId,
    p_origin_modality: auth.interaction.modality,
    p_summary: summary.slice(0, 4000),
    p_expires_at: new Date(expiresAt).toISOString(),
    p_commands: persistedCommands,
  })
  if (error) throw error

  try {
    await appendOrbConversationEvent(auth, {
      id: stableOrbConversationEventId(batchId, 'mutation_proposed'),
      conversationId: auth.interaction.conversationId,
      turnId: auth.interaction.turnId,
      actor: 'system',
      eventType: 'mutation_proposed',
      modality: auth.interaction.modality,
      visibility: 'control',
      proposalId: batchId,
      payload: {
        kind: 'command_batch',
        commandCount: commands.length,
        summary,
        commands: commands.map((command, sequence) => ({
          sequence,
          kind: command.kind,
          title: command.title,
          summary: command.summary,
        })),
      },
    })
  } catch (eventError) {
    console.error('[persistOrbCommandBatch] Proposal event append failed:', eventError)
  }

  return {
    batchId,
    commandCount: commands.length,
    expiresAt,
    proposalToken: signOrbOperationCapability({
      type: 'proposal',
      proposalId: batchId,
      userId: auth.user.id,
      expiresAt,
    }),
  }
}
