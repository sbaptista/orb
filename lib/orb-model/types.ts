export type OrbModelProviderId = 'anthropic' | 'openai' | 'google' | 'mistral' | 'elevenlabs' | 'local'

export type OrbModelInvocationSource =
  | 'conversation'
  | 'greeting'
  | 'distillation'
  | 'eval'
  | 'strategic_review'
  | 'proactive_observation'
  | 'adaptation_proposal'
  | 'voice_tts'
  | 'voice_stt'

export type OrbModelRateSnapshot = {
  version: string
  effectiveDate: string
  inputPerMillion: number
  outputPerMillion: number
  cachedInputPerMillion: number | null
  cacheWritePerMillion: number | null
}

export type OrbModelUsage = {
  provider: OrbModelProviderId
  model: string
  source: OrbModelInvocationSource
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number | null
  cacheWriteTokens: number | null
  reasoningTokens: number | null
  totalTokens: number | null
  clientToolCalls: number
  latencyMs: number
  attemptCount: number
  success: boolean
  failureCode: string | null
  estimatedCostUsd: number | null
  rateSnapshot: OrbModelRateSnapshot | null
  providerUsage: Record<string, unknown>
}
