'use server'

import { getAuthContext, requireAdmin } from '@/lib/auth'
import {
  acknowledgeOrbConversationResponse,
  appendOrbInterrupt,
  closeOrbConversation,
  getOrbConversationSnapshot,
} from '@/lib/orb-interaction/conversation-store'
import type { OrbInputModality } from '@/lib/orb-interaction/types'
import { isOrbInterruptReason, type OrbInterruptReason } from '@/lib/orb-interaction/interrupt-intent'

export async function loadOrbConversation(conversationId?: string | null, clientId?: string | null) {
  const auth = await getAuthContext()
  return getOrbConversationSnapshot(auth, conversationId, clientId)
}

export async function clearOrbConversation(conversationId?: string | null) {
  const auth = await getAuthContext()
  await closeOrbConversation(auth, conversationId)
  return getOrbConversationSnapshot(auth)
}

export async function acknowledgeOrbResponse(input: {
  conversationId: string
  eventId: string
  clientId: string
}) {
  const auth = await getAuthContext()
  await acknowledgeOrbConversationResponse(auth, input)
}

export async function interruptOrbConversation(input: {
  conversationId: string
  turnId: string
  eventId: string
  modality: OrbInputModality
  reason: OrbInterruptReason
}) {
  // Acoustic barge-in is presentation-only and never reaches here; reject
  // anything that is not a deliberate reason (a click event once did).
  if (!isOrbInterruptReason(input.reason)) throw new Error('Invalid interrupt reason')
  const auth = await getAuthContext()
  await appendOrbInterrupt(auth, input)
}

export async function exportOrbConversationDiagnostics(conversationId?: string | null) {
  const auth = await requireAdmin()
  const conversationQuery = auth.admin
    .from('orb_conversations')
    .select('id, status, created_at, updated_at, closed_at')
    .eq('user_id', auth.user.id)
  const { data: conversation, error: conversationError } = conversationId
    ? await conversationQuery.eq('id', conversationId).maybeSingle()
    : await conversationQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (conversationError) throw conversationError
  if (!conversation) throw new Error('Conversation not found')

  const [{ data: events, error: eventsError }, { data: batches, error: batchesError }, { data: acknowledgements, error: acknowledgementsError }] = await Promise.all([
    auth.admin.from('orb_conversation_events').select('*').eq('conversation_id', conversation.id).order('sequence'),
    auth.admin.from('orb_command_batches').select('*, orb_command_batch_items(*)').eq('conversation_id', conversation.id).order('created_at'),
    auth.admin.from('orb_conversation_acknowledgements').select('client_id, event_id, acknowledged_at').eq('conversation_id', conversation.id).order('acknowledged_at'),
  ])
  if (eventsError) throw eventsError
  if (batchesError) throw batchesError
  if (acknowledgementsError) throw acknowledgementsError
  return JSON.stringify({ exportedAt: new Date().toISOString(), conversation, events, batches, acknowledgements }, null, 2)
}
