import type { AuthContext } from '@/lib/auth'
import type { OrbCommandBatchReceipt, OrbRealtimeMutationReceipt } from '@/lib/orb-realtime/types'
import { appendOrbConversationEvent, stableOrbConversationEventId } from '@/lib/orb-interaction/conversation-store'

export type OrbMutationConfirmation = {
  receipt: OrbRealtimeMutationReceipt | OrbCommandBatchReceipt
  replayed: boolean
}

export async function confirmOrbMutation(
  auth: AuthContext,
  proposalId: string,
  confirmingEventId = auth.interaction?.userEventId,
): Promise<OrbMutationConfirmation> {
  const { data: batch, error: batchError } = auth.interaction
    ? await auth.admin
        .from('orb_command_batches')
        .select('id')
        .eq('id', proposalId)
        .eq('user_id', auth.user.id)
        .maybeSingle()
    : { data: null, error: null }
  if (batchError) throw batchError

  if (batch) {
    if (!confirmingEventId) throw new Error('A command batch requires a distinct confirming event.')
    const { data, error } = await auth.admin.rpc('confirm_orb_command_batch', {
      p_batch_id: proposalId,
      p_user_id: auth.user.id,
      p_confirming_event_id: confirmingEventId,
    })
    if (error) throw error
    const result = data as OrbMutationConfirmation | null
    if (!result?.receipt) throw new Error('The database did not return a command batch receipt.')
    if (auth.interaction) {
      try {
        await appendOrbConversationEvent(auth, {
          id: stableOrbConversationEventId(proposalId, 'mutation_receipt'),
          conversationId: auth.interaction.conversationId,
          turnId: auth.interaction.turnId,
          actor: 'system',
          eventType: 'mutation_receipt',
          modality: auth.interaction.modality,
          visibility: 'control',
          proposalId,
          payload: {
            receiptId: result.receipt.receiptId,
            kind: result.receipt.kind,
            commandCount: result.receipt.kind === 'command_batch' ? result.receipt.commandCount : 1,
            spokenText: result.receipt.spokenText,
            replayed: result.replayed,
          },
        })
      } catch (eventError) {
        console.error('[confirmOrbMutation] Batch receipt event append failed:', eventError)
      }
    }
    return result
  }

  const { data: proposal, error: proposalError } = await auth.admin
    .from('orb_realtime_proposals')
    .select('kind')
    .eq('id', proposalId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (proposalError) throw proposalError
  if (!proposal) throw new Error('Invalid proposal')

  const rpc = confirmingEventId
    ? 'confirm_orb_mutation'
    : proposal.kind === 'create_ticket'
      ? 'confirm_realtime_ticket_mutation'
      : 'confirm_realtime_mutation'
  const { data, error } = await auth.admin.rpc(rpc, confirmingEventId ? {
    p_proposal_id: proposalId,
    p_user_id: auth.user.id,
    p_confirming_event_id: confirmingEventId,
  } : {
    p_proposal_id: proposalId,
    p_user_id: auth.user.id,
  })
  if (error) throw error
  const result = data as { receipt: OrbRealtimeMutationReceipt; replayed: boolean } | null
  if (!result?.receipt) throw new Error('The database did not return a mutation receipt.')
  if (confirmingEventId && auth.interaction) {
    try {
      await appendOrbConversationEvent(auth, {
        id: stableOrbConversationEventId(proposalId, 'mutation_receipt'),
        conversationId: auth.interaction.conversationId,
        turnId: auth.interaction.turnId,
        actor: 'system',
        eventType: 'mutation_receipt',
        modality: auth.interaction.modality,
        visibility: 'control',
        proposalId,
        payload: {
          receiptId: result.receipt.receiptId,
          kind: result.receipt.kind,
          code: result.receipt.code ?? null,
          spokenText: result.receipt.spokenText,
          replayed: result.replayed,
        },
      })
    } catch (eventError) {
      // The proposal row already contains the database-issued durable receipt.
      // Event-log repair may recover this projection; never turn a committed
      // mutation into a reported failure because its secondary append failed.
      console.error('[confirmOrbMutation] Receipt event append failed:', eventError)
    }
  }
  return result
}
