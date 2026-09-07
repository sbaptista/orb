import type { AuthContext } from '@/lib/auth'
import { signOrbOperationCapability } from '@/lib/orb-operations/capabilities'

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
  })
  if (error) throw error
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
