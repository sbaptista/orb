'use server'

import { getAuthContext } from '@/lib/auth'
import {
  acknowledgeOrbConversationResponse,
  appendOrbInterrupt,
  closeOrbConversation,
  getOrbConversationSnapshot,
} from '@/lib/orb-interaction/conversation-store'
import type { OrbInputModality } from '@/lib/orb-interaction/types'

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
  reason: 'stop' | 'replacement' | 'barge_in' | 'exit_voice'
}) {
  const auth = await getAuthContext()
  await appendOrbInterrupt(auth, input)
}
