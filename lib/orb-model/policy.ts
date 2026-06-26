import type { OrbModelProviderId } from './types'
import { getOrbModelOptions } from './catalog'
import type { TtsProvider } from './tts'

export type { OrbModelRole } from './catalog'

export type OrbAiPolicy = {
  routingEnabled: boolean
  strategicReadsEnabled: boolean
  operationalProvider: OrbModelProviderId
  operationalModel: string
  strategicProvider: OrbModelProviderId
  strategicModel: string
  monthlyBudgetUsd: number
  strategicBudgetUsd: number
  operationalBudgetUsd: number
  ttsProvider: TtsProvider
  ttsModel: string | null
  ttsVoiceId: string | null
}

export type OrbModelRateCard = {
  id: string
  provider: string
  model: string
  effectiveFrom: string
  inputPerMillion: number
  outputPerMillion: number
  cachedInputPerMillion: number | null
  cacheWritePerMillion: number | null
  notes: string | null
}

export const DEFAULT_ORB_AI_POLICY: OrbAiPolicy = {
  routingEnabled: false,
  strategicReadsEnabled: true,
  operationalProvider: 'anthropic',
  operationalModel: 'claude-haiku-4-5',
  strategicProvider: 'google',
  strategicModel: 'gemini-3.1-pro-preview',
  monthlyBudgetUsd: 40,
  strategicBudgetUsd: 24,
  operationalBudgetUsd: 16,
  ttsProvider: 'browser',
  ttsModel: null,
  ttsVoiceId: null,
}

export const ORB_MODEL_OPTIONS = {
  operational: getOrbModelOptions('operational'),
  strategic: getOrbModelOptions('strategic'),
} as const
