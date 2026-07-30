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
  const { data, error } = await auth.admin.rpc('confirm_realtime_mutation', {
    p_proposal_id: proposalId,
    p_user_id: auth.user.id,
  })
  if (error) throw error
  const result = data as OrbMutationConfirmation | null
  if (!result?.receipt) throw new Error('The database did not return a mutation receipt.')
  return result
}

