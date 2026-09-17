import 'server-only'

import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { AuthContext } from '@/lib/auth'
import { TURN_CANCELLING_INTERRUPT_REASONS, type OrbInterruptReason } from '@/lib/orb-interaction/interrupt-intent'
import {
  projectConversationMessages,
  projectModelHistory,
  mutationReceiptRefreshScopes,
  type OrbConversationEvent,
  type OrbConversationEventType,
  type OrbConversationMessage,
  type OrbConversationVisibility,
  type OrbInputModality,
  type OrbResponseArtifact,
} from '@/lib/orb-interaction/types'

type ConversationRow = {
  id: string
  user_id: string
  status: 'active' | 'closed'
  created_at: string
  updated_at: string
  closed_at: string | null
}

type EventRow = {
  id: string
  sequence: number
  conversation_id: string
  user_id: string
  turn_id: string
  actor: 'user' | 'orb' | 'system'
  event_type: OrbConversationEventType
  modality: OrbInputModality | null
  visibility: OrbConversationVisibility
  payload: Record<string, unknown>
  proposal_id: string | null
  response_id: string | null
  created_at: string
}

function shapeEvent(row: EventRow): OrbConversationEvent {
  return {
    id: row.id,
    sequence: Number(row.sequence),
    conversationId: row.conversation_id,
    userId: row.user_id,
    turnId: row.turn_id,
    actor: row.actor,
    eventType: row.event_type,
    modality: row.modality,
    visibility: row.visibility,
    payload: row.payload ?? {},
    proposalId: row.proposal_id,
    responseId: row.response_id,
    createdAt: row.created_at,
  }
}

export function stableOrbConversationEventId(seed: string, purpose: string) {
  const hex = createHash('sha256').update(`${purpose}:${seed}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

async function ownedActiveConversation(
  auth: AuthContext,
  conversationId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await auth.admin
    .from('orb_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data as ConversationRow | null
}

async function ownedConversation(auth: AuthContext, conversationId: string) {
  const { data, error } = await auth.admin
    .from('orb_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data as ConversationRow | null
}

async function latestOwnedActiveConversation(auth: AuthContext): Promise<ConversationRow | null> {
  const { data, error } = await auth.admin
    .from('orb_conversations')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as ConversationRow | null
}

export async function getOrCreateOrbConversation(
  auth: AuthContext,
  requestedConversationId?: string | null,
): Promise<ConversationRow> {
  if (requestedConversationId) {
    const requested = await ownedActiveConversation(auth, requestedConversationId)
    if (requested) return requested
  }

  const active = await latestOwnedActiveConversation(auth)
  if (active) return active

  const { data: created, error: createError } = await auth.admin
    .from('orb_conversations')
    .insert({ user_id: auth.user.id })
    .select('*')
    .single()
  if (!createError && created) return created as ConversationRow

  // The partial unique index may have let another concurrent first turn win.
  if (createError?.code === '23505') {
    const { data: raced, error: raceError } = await auth.admin
      .from('orb_conversations')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .single()
    if (raceError) throw raceError
    return raced as ConversationRow
  }
  throw createError
}

export async function loadOrbConversationEvents(
  auth: AuthContext,
  conversationId: string,
  limit = 200,
): Promise<OrbConversationEvent[]> {
  const conversation = await ownedActiveConversation(auth, conversationId)
  if (!conversation) throw new Error('Conversation not found')
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)))
  const { data, error } = await auth.admin
    .from('orb_conversation_events')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .order('sequence', { ascending: false })
    .limit(boundedLimit)
  if (error) throw error
  return ((data ?? []) as EventRow[]).reverse().map(shapeEvent)
}

export async function appendOrbConversationEvent(
  auth: AuthContext,
  input: {
    id?: string
    conversationId: string
    turnId: string
    actor: 'user' | 'orb' | 'system'
    eventType: OrbConversationEventType
    modality?: OrbInputModality | null
    visibility: OrbConversationVisibility
    payload?: Record<string, unknown>
    proposalId?: string | null
    responseId?: string | null
    allowClosedReceiptRecovery?: boolean
  },
): Promise<OrbConversationEvent> {
  const conversation = input.allowClosedReceiptRecovery
    ? await ownedConversation(auth, input.conversationId)
    : await ownedActiveConversation(auth, input.conversationId)
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.status === 'closed' && !(
    input.allowClosedReceiptRecovery
    && input.proposalId
    && (input.eventType === 'mutation_receipt' || input.eventType === 'assistant_message')
  )) {
    throw new Error('Closed conversations only accept committed receipt recovery events')
  }
  const id = input.id ?? crypto.randomUUID()
  const row = {
    id,
    conversation_id: conversation.id,
    user_id: auth.user.id,
    turn_id: input.turnId,
    actor: input.actor,
    event_type: input.eventType,
    modality: input.modality ?? null,
    visibility: input.visibility,
    payload: input.payload ?? {},
    proposal_id: input.proposalId ?? null,
    response_id: input.responseId ?? null,
  }
  const { data, error } = await auth.admin
    .from('orb_conversation_events')
    .insert(row)
    .select('*')
    .single()
  if (!error && data) {
    await auth.admin
      .from('orb_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('user_id', auth.user.id)
    return shapeEvent(data as EventRow)
  }
  if (error?.code !== '23505') throw error

  const { data: existing, error: existingError } = await auth.admin
    .from('orb_conversation_events')
    .select('*')
    .eq('id', id)
    .eq('conversation_id', conversation.id)
    .eq('user_id', auth.user.id)
    .single()
  if (existingError) throw existingError
  const existingEvent = shapeEvent(existing as EventRow)
  const expected = {
    turnId: input.turnId,
    actor: input.actor,
    eventType: input.eventType,
    modality: input.modality ?? null,
    visibility: input.visibility,
    payload: input.payload ?? {},
    proposalId: input.proposalId ?? null,
    responseId: input.responseId ?? null,
  }
  const actual = {
    turnId: existingEvent.turnId,
    actor: existingEvent.actor,
    eventType: existingEvent.eventType,
    modality: existingEvent.modality,
    visibility: existingEvent.visibility,
    payload: existingEvent.payload,
    proposalId: existingEvent.proposalId,
    responseId: existingEvent.responseId,
  }
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error('Conversation event id was reused with different content')
  }
  return existingEvent
}

export async function beginOrbConversationTurn(
  auth: AuthContext,
  input: {
    conversationId?: string | null
    turnId: string
    userEventId: string
    modality: OrbInputModality
    text: string
  },
) {
  const text = input.text.trim()
  if (!text) throw new Error('A user turn cannot be empty')
  const conversation = await getOrCreateOrbConversation(auth, input.conversationId)
  const userEvent = await appendOrbConversationEvent(auth, {
    id: input.userEventId,
    conversationId: conversation.id,
    turnId: input.turnId,
    actor: 'user',
    eventType: 'user_message',
    modality: input.modality,
    visibility: 'visible',
    payload: { text },
  })
  const events = await loadOrbConversationEvents(auth, conversation.id)
  const existingResponse = events.find(event =>
    event.turnId === input.turnId
    && event.eventType === 'assistant_message'
    && event.actor === 'orb'
    && typeof event.payload.text === 'string'
  )
  return {
    conversationId: conversation.id,
    turnId: input.turnId,
    userEventId: userEvent.id,
    modality: input.modality,
    history: projectModelHistory(events, userEvent.id),
    existingResponse: existingResponse ? {
      responseEventId: existingResponse.id,
      speech: existingResponse.payload.text as string,
      spokenText: typeof existingResponse.payload.spokenText === 'string'
        ? existingResponse.payload.spokenText
        : undefined,
      insight: existingResponse.payload.insight && typeof existingResponse.payload.insight === 'object'
        ? existingResponse.payload.insight as OrbResponseArtifact['insight']
        : undefined,
      isServiceError: existingResponse.payload.isServiceError === true,
      refresh: existingResponse.payload.refresh === true,
      refreshProjects: existingResponse.payload.refreshProjects === true,
      refreshTodos: existingResponse.payload.refreshTodos === true,
      deletedProjectIds: Array.isArray(existingResponse.payload.deletedProjectIds)
        ? existingResponse.payload.deletedProjectIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      mutatedProductId: typeof existingResponse.payload.mutatedProductId === 'string'
        ? existingResponse.payload.mutatedProductId
        : undefined,
      mutationType: typeof existingResponse.payload.mutationType === 'string'
        ? existingResponse.payload.mutationType
        : undefined,
      newProject: existingResponse.payload.newProject
        && typeof existingResponse.payload.newProject === 'object'
        && typeof (existingResponse.payload.newProject as Record<string, unknown>).id === 'string'
        ? existingResponse.payload.newProject as OrbResponseArtifact['newProject']
        : undefined,
      newProjects: Array.isArray(existingResponse.payload.newProjects)
        ? existingResponse.payload.newProjects.filter((project): project is NonNullable<OrbResponseArtifact['newProject']> =>
            Boolean(project) && typeof project === 'object' && typeof (project as Record<string, unknown>).id === 'string')
        : undefined,
    } : null,
  }
}

export async function appendOrbResponseArtifact(
  auth: AuthContext,
  conversationId: string,
  modality: OrbInputModality,
  artifact: OrbResponseArtifact,
  allowClosedReceiptRecovery = false,
) {
  return appendOrbConversationEvent(auth, {
    id: artifact.responseId,
    conversationId,
    turnId: artifact.turnId,
    actor: 'orb',
    eventType: 'assistant_message',
    modality,
    visibility: 'visible',
    proposalId: artifact.proposalId ?? null,
    responseId: artifact.responseId,
    allowClosedReceiptRecovery,
    payload: {
      text: artifact.markdown,
      spokenText: artifact.spokenText,
      ...(artifact.insight ? { insight: artifact.insight } : {}),
      ...(artifact.isServiceError ? { isServiceError: true } : {}),
      ...(artifact.refresh ? { refresh: true } : {}),
      ...(artifact.refreshProjects ? { refreshProjects: true } : {}),
      ...(artifact.refreshTodos ? { refreshTodos: true } : {}),
      ...(artifact.deletedProjectIds?.length ? { deletedProjectIds: artifact.deletedProjectIds } : {}),
      ...(artifact.mutatedProductId ? { mutatedProductId: artifact.mutatedProductId } : {}),
      ...(artifact.mutationType ? { mutationType: artifact.mutationType } : {}),
      ...(artifact.newProject ? { newProject: artifact.newProject } : {}),
      ...(artifact.newProjects?.length ? { newProjects: artifact.newProjects } : {}),
    },
  })
}

function receiptMutationType(
  kind: string,
  receipt?: Record<string, unknown> | null,
): 'create' | 'update' | 'delete' | 'project_create' | 'project_update' | 'project_delete' | 'knowledge_update' | 'ticket_create' | undefined {
  if (kind === 'command_batch') {
    const receipts = Array.isArray(receipt?.receipts) ? receipt.receipts as Array<Record<string, unknown>> : []
    const kinds = new Set(receipts.map(item => String(item.kind ?? '')).filter(Boolean))
    return kinds.size === 1 ? receiptMutationType([...kinds][0]) : undefined
  }
  if (kind === 'create_project') return 'project_create'
  if (kind === 'update_project') return 'project_update'
  if (kind === 'delete_project') return 'project_delete'
  if (kind === 'create_ticket') return 'ticket_create'
  if (kind === 'add_knowledge' || kind === 'update_knowledge') return 'knowledge_update'
  if (kind === 'create_todo') return 'create'
  if (kind === 'delete_todo') return 'delete'
  return 'update'
}

async function repairOrbMutationReceiptEvents(auth: AuthContext, conversationId: string) {
  const [proposalResult, batchResult] = await Promise.all([
    auth.admin
      .from('orb_realtime_proposals')
      .select('id, confirmed_by_event_id, origin_modality, receipt')
      .eq('user_id', auth.user.id)
      .eq('conversation_id', conversationId)
      .eq('status', 'executed')
      .not('confirmed_by_event_id', 'is', null)
      .not('receipt', 'is', null),
    auth.admin
      .from('orb_command_batches')
      .select('id, confirmed_by_event_id, origin_modality, receipt')
      .eq('user_id', auth.user.id)
      .eq('conversation_id', conversationId)
      .eq('status', 'executed')
      .not('receipt', 'is', null),
  ])
  if (proposalResult.error) throw proposalResult.error
  if (batchResult.error) throw batchResult.error
  const data = [...(proposalResult.data ?? []), ...(batchResult.data ?? [])]

  for (const proposal of data ?? []) {
    const receipt = proposal.receipt as Record<string, unknown> | null
    const spokenText = typeof receipt?.spokenText === 'string' ? receipt.spokenText.trim() : ''
    if (!spokenText || !proposal.confirmed_by_event_id) continue
    const receiptItems = receipt?.kind === 'command_batch' && Array.isArray(receipt.receipts)
      ? receipt.receipts.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : receipt ? [receipt] : []
    const createdProjectCodes = receiptItems
      .filter(item => item.kind === 'create_project' && typeof item.code === 'string')
      .map(item => item.code as string)
    let newProjects: NonNullable<OrbResponseArtifact['newProjects']> = []
    if (createdProjectCodes.length > 0) {
      const { data: projects, error: projectError } = await auth.admin
        .from('projects')
        .select('id, name, code, description, created_by')
        .in('code', createdProjectCodes)
        .eq('created_by', auth.user.id)
        .is('deleted_at', null)
      if (projectError) throw projectError
      newProjects = projects ?? []
    }
    const newProject = newProjects.length === 1 ? newProjects[0] : undefined
    const { data: confirmationEvent, error: confirmationError } = await auth.admin
      .from('orb_conversation_events')
      .select('turn_id, modality')
      .eq('id', proposal.confirmed_by_event_id)
      .eq('conversation_id', conversationId)
      .eq('user_id', auth.user.id)
      .maybeSingle()
    if (confirmationError) throw confirmationError
    if (!confirmationEvent) continue

    const receiptEventId = stableOrbConversationEventId(proposal.id, 'mutation_receipt')
    const responseEventId = stableOrbConversationEventId(proposal.id, 'mutation_receipt_response')
    const { data: existing, error: existingError } = await auth.admin
      .from('orb_conversation_events')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', auth.user.id)
      .in('id', [receiptEventId, responseEventId])
    if (existingError) throw existingError
    const existingIds = new Set((existing ?? []).map(row => row.id as string))
    if (!existingIds.has(receiptEventId)) {
      await appendOrbConversationEvent(auth, {
        id: receiptEventId,
        conversationId,
        turnId: confirmationEvent.turn_id,
        actor: 'system',
        eventType: 'mutation_receipt',
        modality: confirmationEvent.modality,
        visibility: 'control',
        proposalId: proposal.id,
        payload: {
          receiptId: receipt?.receiptId ?? proposal.id,
          kind: receipt?.kind ?? null,
          code: receipt?.code ?? null,
          spokenText,
          replayed: true,
        },
        allowClosedReceiptRecovery: true,
      })
    }
    if (!existingIds.has(responseEventId)) {
      const refreshScopes = mutationReceiptRefreshScopes(receipt ?? {})
      await appendOrbResponseArtifact(
        auth,
        conversationId,
        (confirmationEvent.modality ?? proposal.origin_modality ?? 'text') as OrbInputModality,
        {
          responseId: responseEventId,
          turnId: confirmationEvent.turn_id,
          markdown: spokenText,
          spokenText,
          refresh: true,
          refreshProjects: refreshScopes.projects,
          refreshTodos: refreshScopes.todos,
          mutationType: receiptMutationType(String(receipt?.kind ?? ''), receipt),
          newProject,
          newProjects,
          proposalId: proposal.id,
        },
        true,
      )
    }
  }
}

export async function getOrbConversationSnapshot(
  auth: AuthContext,
  requestedConversationId?: string | null,
  clientId?: string | null,
): Promise<{
  conversationId: string
  messages: OrbConversationMessage[]
  unacknowledgedResponses: Array<{ eventId: string; conversationId: string }>
}> {
  const conversation = await getOrCreateOrbConversation(auth, requestedConversationId)
  const [proposalReceipts, batchReceipts] = await Promise.all([
    auth.admin
      .from('orb_realtime_proposals')
      .select('id, conversation_id')
      .eq('user_id', auth.user.id)
      .eq('status', 'executed')
      .not('confirmed_by_event_id', 'is', null)
      .not('conversation_id', 'is', null)
      .order('executed_at', { ascending: false })
      .limit(50),
    auth.admin
      .from('orb_command_batches')
      .select('id, conversation_id')
      .eq('user_id', auth.user.id)
      .eq('status', 'executed')
      .order('executed_at', { ascending: false })
      .limit(50),
  ])
  if (proposalReceipts.error) throw proposalReceipts.error
  if (batchReceipts.error) throw batchReceipts.error
  const receiptConversations = [...(proposalReceipts.data ?? []), ...(batchReceipts.data ?? [])]
  const expectedReceiptEventIds = (receiptConversations ?? []).flatMap(row => [
    stableOrbConversationEventId(row.id, 'mutation_receipt'),
    stableOrbConversationEventId(row.id, 'mutation_receipt_response'),
  ])
  let existingReceiptEventIds = new Set<string>()
  if (expectedReceiptEventIds.length > 0) {
    const { data: existingReceiptEvents, error: existingReceiptEventsError } = await auth.admin
      .from('orb_conversation_events')
      .select('id')
      .eq('user_id', auth.user.id)
      .in('id', expectedReceiptEventIds)
    if (existingReceiptEventsError) throw existingReceiptEventsError
    existingReceiptEventIds = new Set((existingReceiptEvents ?? []).map(row => row.id as string))
  }
  const repairConversationIds = new Set((receiptConversations ?? [])
    .filter(row => {
      const receiptEventId = stableOrbConversationEventId(row.id, 'mutation_receipt')
      const responseEventId = stableOrbConversationEventId(row.id, 'mutation_receipt_response')
      return !existingReceiptEventIds.has(receiptEventId)
        || !existingReceiptEventIds.has(responseEventId)
    })
    .map(row => row.conversation_id as string))
  for (const repairConversationId of repairConversationIds) {
    await repairOrbMutationReceiptEvents(auth, repairConversationId)
  }
  const events = await loadOrbConversationEvents(auth, conversation.id)
  let recoveryEvents: OrbConversationEvent[] = []
  let unacknowledgedResponses: Array<{ eventId: string; conversationId: string }> = []
  if (clientId) {
    const { data: receiptRows, error: receiptRowsError } = await auth.admin
      .from('orb_conversation_events')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('event_type', 'assistant_message')
      .not('proposal_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
    if (receiptRowsError) throw receiptRowsError
    const receiptEvents = (receiptRows ?? []).map(row => shapeEvent(row as EventRow))
    const responseEvents = [
      ...events.filter(event => event.eventType === 'assistant_message'),
      ...receiptEvents,
    ]
    const responseEventIds = [...new Set(responseEvents.map(event => event.id))]
    const { data, error } = await auth.admin
      .from('orb_conversation_acknowledgements')
      .select('event_id')
      .eq('user_id', auth.user.id)
      .eq('client_id', clientId)
      .in('event_id', responseEventIds)
    if (error) throw error
    const acknowledged = new Set((data ?? []).map(row => row.event_id as string))
    const unacknowledged = responseEvents.filter(event => !acknowledged.has(event.id))
    unacknowledgedResponses = [...new Map(unacknowledged.map(event => [event.id, {
      eventId: event.id,
      conversationId: event.conversationId,
    }])).values()]
    const currentIds = new Set(events.map(event => event.id))
    recoveryEvents = receiptEvents
      .filter(event => !acknowledged.has(event.id) && !currentIds.has(event.id))
      .reverse()
  }
  return {
    conversationId: conversation.id,
    messages: projectConversationMessages([...events, ...recoveryEvents]),
    unacknowledgedResponses,
  }
}

export async function closeOrbConversation(
  auth: AuthContext,
  requestedConversationId?: string | null,
) {
  const conversation = requestedConversationId
    ? await ownedActiveConversation(auth, requestedConversationId)
    : await latestOwnedActiveConversation(auth)
  if (!conversation) return
  const closedAt = new Date().toISOString()
  const { error } = await auth.admin
    .from('orb_conversations')
    .update({ status: 'closed', closed_at: closedAt, updated_at: closedAt })
    .eq('id', conversation.id)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
  if (error) throw error
}

export async function isOrbTurnInterrupted(
  auth: AuthContext,
  conversationId: string,
  turnId: string,
) {
  const conversation = await ownedActiveConversation(auth, conversationId)
  if (!conversation) return true
  const { count, error } = await auth.admin
    .from('orb_conversation_events')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('turn_id', turnId)
    .eq('event_type', 'interrupt')
    // Legacy acoustic `barge_in` rows and `exit_voice` do not cancel a turn;
    // see lib/orb-interaction/interrupt-intent.ts.
    .in('payload->>reason', [...TURN_CANCELLING_INTERRUPT_REASONS])
  if (error) throw error
  return (count ?? 0) > 0
}

export async function acknowledgeOrbConversationResponse(
  auth: AuthContext,
  input: { conversationId: string; eventId: string; clientId: string },
) {
  if (!input.clientId || input.clientId.length > 128) throw new Error('Invalid client id')
  const { data: event, error: eventError } = await auth.admin
    .from('orb_conversation_events')
    .select('id')
    .eq('id', input.eventId)
    .eq('conversation_id', input.conversationId)
    .eq('user_id', auth.user.id)
    .eq('event_type', 'assistant_message')
    .maybeSingle()
  if (eventError) throw eventError
  if (!event) throw new Error('Response event not found')
  const { error } = await auth.admin
    .from('orb_conversation_acknowledgements')
    .upsert({
      user_id: auth.user.id,
      conversation_id: input.conversationId,
      client_id: input.clientId,
      event_id: input.eventId,
      acknowledged_at: new Date().toISOString(),
    }, { onConflict: 'user_id,client_id,event_id' })
  if (error) throw error
}

export async function appendOrbInterrupt(
  auth: AuthContext,
  input: {
    conversationId: string
    turnId: string
    eventId: string
    modality: OrbInputModality
    reason: OrbInterruptReason
  },
) {
  const event = await appendOrbConversationEvent(auth, {
    id: input.eventId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    actor: 'system',
    eventType: 'interrupt',
    modality: input.modality,
    visibility: 'control',
    payload: { reason: input.reason },
  })
  if (TURN_CANCELLING_INTERRUPT_REASONS.includes(input.reason)) {
    await rejectProposalsFromInterruptedTurn(auth, input.conversationId, input.turnId, input.modality)
  }
  return event
}

/**
 * A proposal stored by a turn that was then stopped, replaced, or merged was
 * never shown to the user, so it must not stay pending (2026-09-16: a stopped
 * "Add a to-do called test. to do one." left a create the next reply talked
 * about). A proposal from an earlier, completed turn is untouched.
 *
 * "Never shown" is decided by whether this turn's reply was recorded, not by
 * the turn id alone. On 2026-09-17 a create proposal was displayed at 19:19:52,
 * the user's "Yes." replaced the still-finishing turn at 19:19:53, and this
 * function then rejected the very proposal that "Yes." was answering. A reply
 * in the conversation means the user saw it; interrupting the turn afterwards
 * must not cancel it.
 */
export async function rejectProposalsFromInterruptedTurn(
  auth: AuthContext,
  conversationId: string,
  turnId: string,
  modality: OrbInputModality | null,
) {
  const { data: requestEvents, error: requestEventsError } = await auth.admin
    .from('orb_conversation_events')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('turn_id', turnId)
    .eq('event_type', 'user_message')
  if (requestEventsError) throw requestEventsError
  const requestEventIds = (requestEvents ?? []).map(event => event.id as string)
  if (requestEventIds.length === 0) return

  const { count: shownReplies, error: replyError } = await auth.admin
    .from('orb_conversation_events')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('turn_id', turnId)
    .eq('event_type', 'assistant_message')
  if (replyError) throw replyError
  if ((shownReplies ?? 0) > 0) return

  const { data: batches, error: batchesError } = await auth.admin
    .from('orb_command_batches')
    .select('id, summary')
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('status', 'proposed')
    .in('requested_event_id', requestEventIds)
  if (batchesError) throw batchesError

  for (const batch of batches ?? []) {
    const { error: rejectError } = await auth.admin.rpc('reject_orb_command_batch', {
      p_batch_id: batch.id,
      p_user_id: auth.user.id,
    })
    if (rejectError) throw rejectError
    await appendOrbConversationEvent(auth, {
      id: stableOrbConversationEventId(batch.id as string, 'mutation_rejected'),
      conversationId,
      turnId,
      actor: 'system',
      eventType: 'mutation_rejected',
      modality,
      visibility: 'control',
      proposalId: batch.id as string,
      payload: { kind: 'command_batch', summary: batch.summary, reason: 'turn_interrupted' },
    })
  }
}
