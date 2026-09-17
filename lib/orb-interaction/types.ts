import {
  frameModelHistoryEntry,
  unbackedAssistantProvenance,
  type OrbModelHistoryProvenance,
} from './model-history'

export type OrbInputModality = 'text' | 'voice'
export type OrbConversationActor = 'user' | 'orb' | 'system'
export type OrbConversationVisibility = 'visible' | 'control'
export type OrbConversationEventType =
  | 'user_message'
  | 'assistant_message'
  | 'interrupt'
  | 'mutation_proposed'
  | 'mutation_rejected'
  | 'mutation_receipt'

export type OrbInsight = {
  type: 'observation' | 'coaching' | 'strategic'
  summary: string
}

export type OrbResponseArtifact = {
  responseId: string
  turnId: string
  markdown: string
  spokenText: string
  insight?: OrbInsight
  isServiceError?: boolean
  refresh?: boolean
  refreshProjects?: boolean
  refreshTodos?: boolean
  deletedProjectIds?: string[]
  mutatedProductId?: string
  mutationType?: string
  newProject?: {
    id: string
    name: string
    code: string
    description: string | null
    created_by: string
  }
  newProjects?: Array<{
    id: string
    name: string
    code: string
    description: string | null
    created_by: string
  }>
  proposalId?: string
}

export type OrbConversationEvent = {
  id: string
  sequence: number
  conversationId: string
  userId: string
  turnId: string
  actor: OrbConversationActor
  eventType: OrbConversationEventType
  modality: OrbInputModality | null
  visibility: OrbConversationVisibility
  payload: Record<string, unknown>
  proposalId: string | null
  responseId: string | null
  createdAt: string
}

export type OrbConversationMessage = {
  eventId: string
  conversationId: string
  turnId: string
  role: 'user' | 'assistant'
  text: string
  spokenText?: string
  insight?: OrbInsight
  isServiceError?: boolean
  modality?: OrbInputModality
  refresh?: boolean
  refreshProjects?: boolean
  refreshTodos?: boolean
  deletedProjectIds?: string[]
  mutatedProductId?: string
  mutationType?: string
  newProject?: OrbResponseArtifact['newProject']
  newProjects?: OrbResponseArtifact['newProjects']
}

export type OrbInteractionIdentity = {
  conversationId?: string | null
  turnId: string
  userEventId: string
  modality: OrbInputModality
}

const PROJECT_MUTATION_RECEIPTS = new Set(['create_project', 'update_project', 'delete_project'])
const TODO_MUTATION_RECEIPTS = new Set(['create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo'])

export function mutationReceiptRefreshScopes(receipt: Record<string, unknown>): {
  projects: boolean
  todos: boolean
} {
  const items = Array.isArray(receipt.receipts)
    ? receipt.receipts.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [receipt]
  const kinds = items.map(item => String(item.kind ?? ''))
  return {
    projects: kinds.some(kind => PROJECT_MUTATION_RECEIPTS.has(kind)),
    todos: kinds.some(kind => TODO_MUTATION_RECEIPTS.has(kind)),
  }
}

export function isVisibleConversationMessage(
  event: OrbConversationEvent,
): event is OrbConversationEvent & { payload: { text: string } } {
  if (event.visibility !== 'visible') return false
  if (event.eventType !== 'user_message' && event.eventType !== 'assistant_message') return false
  return typeof event.payload.text === 'string' && event.payload.text.trim().length > 0
}

export function projectConversationMessages(
  events: OrbConversationEvent[],
): OrbConversationMessage[] {
  // A turn merged into its successor has its words repeated there; showing the
  // fragment too would duplicate them. Its receipts, if any, stay visible.
  const mergedTurnIds = new Set(events
    .filter(event => event.eventType === 'interrupt' && event.payload.reason === 'merge')
    .map(event => event.turnId))
  return events
    .filter(event => !(event.eventType === 'user_message' && mergedTurnIds.has(event.turnId)))
    .filter(isVisibleConversationMessage).map(event => ({
    eventId: event.id,
    conversationId: event.conversationId,
    turnId: event.turnId,
    role: event.actor === 'user' ? 'user' : 'assistant',
    text: event.payload.text,
    ...(typeof event.payload.spokenText === 'string'
      ? { spokenText: event.payload.spokenText }
      : {}),
    ...(event.payload.insight && typeof event.payload.insight === 'object'
      ? { insight: event.payload.insight as OrbInsight }
      : {}),
    ...(event.payload.isServiceError === true ? { isServiceError: true } : {}),
    ...(event.modality ? { modality: event.modality } : {}),
    ...(event.payload.refresh === true ? { refresh: true } : {}),
    ...(event.payload.refreshProjects === true ? { refreshProjects: true } : {}),
    ...(event.payload.refreshTodos === true ? { refreshTodos: true } : {}),
    ...(Array.isArray(event.payload.deletedProjectIds)
      ? { deletedProjectIds: event.payload.deletedProjectIds.filter((id): id is string => typeof id === 'string') }
      : {}),
    ...(typeof event.payload.mutatedProductId === 'string'
      ? { mutatedProductId: event.payload.mutatedProductId }
      : {}),
    ...(typeof event.payload.mutationType === 'string'
      ? { mutationType: event.payload.mutationType }
      : {}),
    ...(event.payload.newProject
      && typeof event.payload.newProject === 'object'
      && typeof (event.payload.newProject as Record<string, unknown>).id === 'string'
      ? { newProject: event.payload.newProject as OrbResponseArtifact['newProject'] }
      : {}),
    ...(Array.isArray(event.payload.newProjects)
      ? { newProjects: event.payload.newProjects.filter((project): project is NonNullable<OrbResponseArtifact['newProject']> =>
          Boolean(project) && typeof project === 'object' && typeof (project as Record<string, unknown>).id === 'string') }
      : {}),
  }))
}

export function projectModelHistory(
  events: OrbConversationEvent[],
  excludeEventId?: string,
): Array<{ role: 'user' | 'assistant'; text: string }> {
  const proposalTurnIds = new Set(events
    .filter(event => event.eventType === 'mutation_proposed')
    .map(event => event.turnId))
  const receiptEventIds = new Set(events
    .filter(event => event.eventType === 'assistant_message' && event.proposalId)
    .map(event => event.id))
  return projectConversationMessages(events)
    .filter(message => message.eventId !== excludeEventId)
    .map(message => {
      if (message.role !== 'assistant') return { role: message.role, text: message.text }
      const provenance: OrbModelHistoryProvenance | undefined = receiptEventIds.has(message.eventId)
        ? 'server_receipt'
        : proposalTurnIds.has(message.turnId)
          ? 'server_proposal'
          : unbackedAssistantProvenance(message.text)
      return frameModelHistoryEntry({ role: message.role, text: message.text, provenance })
    })
}
