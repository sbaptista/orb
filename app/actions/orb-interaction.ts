'use server'

import { getAuthContext } from '@/lib/auth'
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
