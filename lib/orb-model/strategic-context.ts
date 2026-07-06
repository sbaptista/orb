import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_STRATEGIC_REASONING, buildCoachingPrompt } from '@/lib/orb-prompt'
import type { StrategicContextPacket } from './strategic-eval-packets'

export const STRATEGIC_ORB_CONTEXT_PACKET_VERSION = 'strategic-orb-context-v1'

export type StrategicOrbContextPacket = {
  version: string
  packetId: string
  currentDate: string
  currentUser: {
    name: string | null
    email: string | null
  }
  currentProject: {
    name: string
  }
  backlog: string
  knowledge: string
  preferences: string
  observations: string
}

export function buildStrategicContextPacket(packet: StrategicContextPacket): StrategicOrbContextPacket {
  return {
    version: STRATEGIC_ORB_CONTEXT_PACKET_VERSION,
    packetId: packet.id,
    currentDate: packet.currentDate,
    currentUser: {
      name: packet.userName,
      email: null,
    },
    currentProject: {
      name: packet.currentProject,
    },
    backlog: packet.backlog,
    knowledge: packet.knowledge,
    preferences: packet.preferences,
    observations: packet.observations,
  }
}

export function renderStrategicEvaluationPrompt(packet: StrategicOrbContextPacket): string {
  return [
    'You are the voice of the Orb - the conversational layer of Orb.',
    ORB_PRINCIPLES,
    ORB_RESOLUTION_LAWS,
    ORB_STRATEGIC_REASONING,
    buildCoachingPrompt('natural'),
    `EVALUATION MODE: This is a strategic-quality comparison. The supplied packet is complete and is the only dynamic evidence for this answer. Do not use or infer live backlog, knowledge, memory, preferences, or audit data. Do not call tools. State uncertainty when the packet lacks evidence.`,
    `CONTEXT PACKET VERSION: ${packet.version}. PACKET: ${packet.packetId}.`,
    `CURRENT DATE: ${packet.currentDate}. USER: ${packet.currentUser.name ?? packet.currentUser.email ?? 'Unknown'}. CURRENT PROJECT: ${packet.currentProject.name}.`,
    `BACKLOG:\n${packet.backlog}`,
    `RELEVANT KNOWLEDGE:\n${packet.knowledge}`,
    `PREFERENCES:\n${packet.preferences}`,
    `OBSERVATIONS:\n${packet.observations}`,
  ].join('\n\n')
}
