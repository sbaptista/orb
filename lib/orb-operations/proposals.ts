import type { AuthContext } from '@/lib/auth'
import { signOrbOperationCapability } from '@/lib/orb-operations/capabilities'
import { appendOrbConversationEvent, isOrbTurnInterrupted, stableOrbConversationEventId } from '@/lib/orb-interaction/conversation-store'

export const ORB_PROPOSAL_TTL_MS = 5 * 60_000

export type OrbMutationKind =
  | 'create_todo'
  | 'update_todo'
  | 'delete_todo'
  | 'move_todo'
  | 'close_todo'
  | 'batch_todo_action'
  | 'create_project'
  | 'update_project'
  | 'delete_project'
  | 'add_knowledge'
  | 'update_knowledge'
  | 'create_ticket'

export type PersistOrbProposalInput = {
  kind: OrbMutationKind
  title: string
  projectId?: string | null
  targetTodoId?: string | null
  destinationProjectId?: string | null
  params?: Record<string, unknown>
  channel?: 'serial' | 'realtime'
  summary?: string | null
  proposalId?: string
  expiresAt?: number
  conversationId?: string | null
  requestedEventId?: string | null
  originModality?: 'text' | 'voice' | null
}

export type PersistedOrbProposal = {
  proposalId: string
  expiresAt: number
  proposalToken: string
}

export async function persistOrbMutationProposal(
  auth: AuthContext,
  input: PersistOrbProposalInput,
): Promise<PersistedOrbProposal> {
  if (auth.interaction && await isOrbTurnInterrupted(
    auth,
    auth.interaction.conversationId,
    auth.interaction.turnId,
  )) {
    throw new Error('This turn was interrupted before the mutation could be proposed.')
  }
  const proposalId = input.proposalId ?? crypto.randomUUID()
  const expiresAt = input.expiresAt ?? Date.now() + ORB_PROPOSAL_TTL_MS
  const { error } = await auth.admin.from('orb_realtime_proposals').insert({
    id: proposalId,
    user_id: auth.user.id,
    project_id: input.projectId ?? null,
    kind: input.kind,
    title: input.title,
    params: input.params ?? {},
    channel: input.channel ?? 'realtime',
    summary: input.summary ?? null,
    target_todo_id: input.targetTodoId ?? null,
    destination_project_id: input.destinationProjectId ?? null,
    expires_at: new Date(expiresAt).toISOString(),
    conversation_id: input.conversationId ?? auth.interaction?.conversationId ?? null,
    requested_event_id: input.requestedEventId ?? auth.interaction?.userEventId ?? null,
    origin_modality: input.originModality ?? auth.interaction?.modality ?? null,
  })
  if (error) throw error
  const conversationId = input.conversationId ?? auth.interaction?.conversationId
  const requestedEventId = input.requestedEventId ?? auth.interaction?.userEventId
  const originModality = input.originModality ?? auth.interaction?.modality
  if (conversationId && requestedEventId && originModality) {
    try {
      await appendOrbConversationEvent(auth, {
        id: stableOrbConversationEventId(proposalId, 'mutation_proposed'),
        conversationId,
        turnId: auth.interaction?.turnId ?? requestedEventId,
        actor: 'system',
        eventType: 'mutation_proposed',
        modality: originModality,
        visibility: 'control',
        proposalId,
        payload: {
          kind: input.kind,
          title: input.title,
          summary: input.summary ?? null,
        },
      })
    } catch (eventError) {
      // The proposal itself is the authorization source of truth. Do not lose
      // a valid proposal response because its secondary history projection
      // needs repair.
      console.error('[persistOrbMutationProposal] Proposal event append failed:', eventError)
    }
  }
  return {
    proposalId,
    expiresAt,
    proposalToken: signOrbOperationCapability({
      type: 'proposal',
      proposalId,
      userId: auth.user.id,
      expiresAt,
    }),
  }
}
