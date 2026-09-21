import type { OrbCommandBatchReceipt, OrbRealtimeMutationReceipt } from '../orb-realtime/types'

export type OrbMutationConfirmation = {
  receipt: OrbRealtimeMutationReceipt | OrbCommandBatchReceipt
  replayed: boolean
}

export type ConfirmationPorts = {
  findBatch: (id: string, userId: string) => Promise<boolean>
  findProposal: (id: string, userId: string) => Promise<{ kind: string } | null>
  rpc: (name: string, params: Record<string, string>) => Promise<OrbMutationConfirmation | null>
  recordReceipt: (result: OrbMutationConfirmation) => Promise<void>
  receiptLogFailed: (error: unknown) => void
}

/** Shared orchestration; transaction authorization/replay remains inside the RPC. */
export async function executeConfirmation(
  request: { userId: string; proposalId: string; durable: boolean; confirmingEventId?: string },
  ports: ConfirmationPorts,
): Promise<OrbMutationConfirmation> {
  const { userId, proposalId, durable, confirmingEventId } = request
  if (durable && !confirmingEventId) throw new Error('A durable confirmation requires a confirming user event.')
  const batch = durable && await ports.findBatch(proposalId, userId)
  let result: OrbMutationConfirmation | null
  if (batch) {
    result = await ports.rpc('confirm_orb_command_batch', {
      p_batch_id: proposalId, p_user_id: userId, p_confirming_event_id: confirmingEventId!,
    })
  } else {
    const proposal = await ports.findProposal(proposalId, userId)
    if (!proposal) throw new Error('Invalid proposal')
    const rpc = confirmingEventId ? 'confirm_orb_mutation'
      : proposal.kind === 'create_ticket' ? 'confirm_realtime_ticket_mutation' : 'confirm_realtime_mutation'
    result = await ports.rpc(rpc, {
      p_proposal_id: proposalId, p_user_id: userId,
      ...(confirmingEventId ? { p_confirming_event_id: confirmingEventId } : {}),
    })
  }
  if (!result?.receipt) throw new Error('The database did not return a mutation receipt.')
  if (durable) {
    try { await ports.recordReceipt(result) } catch (error) {
      // A committed database receipt survives secondary projection failure.
      ports.receiptLogFailed(error)
    }
  }
  return result
}
