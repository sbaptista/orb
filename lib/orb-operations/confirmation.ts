import type { AuthContext } from '@/lib/auth'
import { appendOrbConversationEvent, stableOrbConversationEventId } from '@/lib/orb-interaction/conversation-store'
import { executeConfirmation, type OrbMutationConfirmation } from './confirmation-execution'
export type { OrbMutationConfirmation } from './confirmation-execution'

export async function confirmOrbMutation(
  auth: AuthContext,
  proposalId: string,
  confirmingEventId = auth.interaction?.userEventId,
): Promise<OrbMutationConfirmation> {
  return executeConfirmation({
    userId: auth.user.id, proposalId, confirmingEventId, durable: Boolean(auth.interaction),
  }, {
    findBatch: async (id, userId) => {
      const { data, error } = await auth.admin.from('orb_command_batches')
        .select('id').eq('id', id).eq('user_id', userId).maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
    findProposal: async (id, userId) => {
      const { data, error } = await auth.admin.from('orb_realtime_proposals')
        .select('kind').eq('id', id).eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data
    },
    rpc: async (name, params) => {
      const { data, error } = await auth.admin.rpc(name, params)
      if (error) throw error
      return data as OrbMutationConfirmation | null
    },
    recordReceipt: async result => {
      const interaction = auth.interaction!
      await appendOrbConversationEvent(auth, {
        id: stableOrbConversationEventId(proposalId, 'mutation_receipt'),
        conversationId: interaction.conversationId,
        turnId: interaction.turnId,
        actor: 'system', eventType: 'mutation_receipt', modality: interaction.modality,
        visibility: 'control', proposalId,
        payload: {
          receiptId: result.receipt.receiptId,
          kind: result.receipt.kind,
          ...(result.receipt.kind === 'command_batch'
            ? { commandCount: result.receipt.commandCount }
            : { code: result.receipt.code ?? null }),
          spokenText: result.receipt.spokenText,
          replayed: result.replayed,
        },
      })
    },
    receiptLogFailed: error => console.error('[confirmOrbMutation] Receipt event append failed:', error),
  })
}
