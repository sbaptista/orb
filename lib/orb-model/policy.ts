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
  voiceBudgetUsd: number
  ttsProvider: TtsProvider
  ttsModel: string | null
  ttsVoiceId: string | null
  // ORB-353: "approaching limit" warning threshold, shared across every
  // usage scope below (Orb's own ledger + real provider spend).
  warningThresholdPct: number
  // None of these three providers expose a configured spend cap
  // programmatically (confirmed against Anthropic's and OpenAI's own admin
  // APIs, and the Gemini BigQuery billing export) — admin-entered here. A
  // value of 0 means "not configured" and disables the check for that
  // provider rather than firing a false-positive warning. ElevenLabs needs
  // no cap field: its API already returns the real configured limit.
  anthropicSpendCapUsd: number
  openaiSpendCapUsd: number
  geminiSpendCapUsd: number
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
  voiceBudgetUsd: 0,
  ttsProvider: 'browser',
  ttsModel: null,
  ttsVoiceId: null,
  warningThresholdPct: 80,
  anthropicSpendCapUsd: 0,
  openaiSpendCapUsd: 0,
  geminiSpendCapUsd: 0,
}

export const ORB_MODEL_OPTIONS = {
  operational: getOrbModelOptions('operational'),
  strategic: getOrbModelOptions('strategic'),
} as const
