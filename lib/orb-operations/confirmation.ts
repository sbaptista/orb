import type { AuthContext } from '@/lib/auth'
import type { OrbRealtimeMutationReceipt } from '@/lib/orb-realtime/types'

export type OrbMutationConfirmation = {
  receipt: OrbRealtimeMutationReceipt
  replayed: boolean
}

export async function confirmOrbMutation(
  auth: AuthContext,
  proposalId: string,
): Promise<OrbMutationConfirmation> {
  const { data: proposal, error: proposalError } = await auth.admin
    .from('orb_realtime_proposals')
    .select('kind')
    .eq('id', proposalId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (proposalError) throw proposalError
  if (!proposal) throw new Error('Invalid proposal')

  const rpc = proposal.kind === 'create_ticket'
    ? 'confirm_realtime_ticket_mutation'
    : 'confirm_realtime_mutation'
  const { data, error } = await auth.admin.rpc(rpc, {
    p_proposal_id: proposalId,
    p_user_id: auth.user.id,
  })
  if (error) throw error
  const result = data as OrbMutationConfirmation | null
  if (!result?.receipt) throw new Error('The database did not return a mutation receipt.')
  return result
}
