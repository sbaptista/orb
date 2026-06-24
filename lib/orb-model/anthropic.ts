import type Anthropic from '@anthropic-ai/sdk'
import type { OrbModelInvocationSource, OrbModelRateSnapshot, OrbModelUsage } from './types'

export const ANTHROPIC_HAIKU_REFERENCE_MODEL = 'claude-haiku-4-5'

const HAIKU_4_5_RATE_SNAPSHOT: OrbModelRateSnapshot = {
  version: 'anthropic-2026-06-22',
  effectiveDate: '2026-06-22',
  inputPerMillion: 1,
  outputPerMillion: 5,
  cachedInputPerMillion: 0.1,
  cacheWritePerMillion: 1.25,
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function estimateCost(
  usage: Anthropic.Message['usage'],
  rateSnapshot: OrbModelRateSnapshot,
): number {
  const extendedUsage = usage as Anthropic.Message['usage'] & {
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  return (
    (numberOrZero(usage.input_tokens) / 1_000_000) * rateSnapshot.inputPerMillion
    + (numberOrZero(usage.output_tokens) / 1_000_000) * rateSnapshot.outputPerMillion
    + (numberOrZero(extendedUsage.cache_creation_input_tokens) / 1_000_000) * (rateSnapshot.cacheWritePerMillion ?? 0)
    + (numberOrZero(extendedUsage.cache_read_input_tokens) / 1_000_000) * (rateSnapshot.cachedInputPerMillion ?? 0)
  )
}

export function normalizeAnthropicUsage(
  usage: Anthropic.Message['usage'],
  options: {
    model?: string
    source: OrbModelInvocationSource
    latencyMs: number
    clientToolCalls: number
    attemptCount?: number
  },
): OrbModelUsage {
  const extendedUsage = usage as Anthropic.Message['usage'] & {
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  const model = options.model ?? ANTHROPIC_HAIKU_REFERENCE_MODEL
  const rateSnapshot = model === ANTHROPIC_HAIKU_REFERENCE_MODEL
    ? HAIKU_4_5_RATE_SNAPSHOT
    : null

  return {
    provider: 'anthropic',
    model,
    source: options.source,
    inputTokens: numberOrZero(usage.input_tokens),
    outputTokens: numberOrZero(usage.output_tokens),
    cachedInputTokens: numberOrZero(extendedUsage.cache_read_input_tokens),
    cacheWriteTokens: numberOrZero(extendedUsage.cache_creation_input_tokens),
    reasoningTokens: null,
    totalTokens: numberOrZero(usage.input_tokens)
      + numberOrZero(usage.output_tokens)
      + numberOrZero(extendedUsage.cache_creation_input_tokens)
      + numberOrZero(extendedUsage.cache_read_input_tokens),
    clientToolCalls: options.clientToolCalls,
    latencyMs: options.latencyMs,
    attemptCount: options.attemptCount ?? 1,
    success: true,
    failureCode: null,
    estimatedCostUsd: rateSnapshot ? estimateCost(usage, rateSnapshot) : null,
    rateSnapshot,
    providerUsage: {
      input_tokens: numberOrZero(usage.input_tokens),
      output_tokens: numberOrZero(usage.output_tokens),
      cache_creation_input_tokens: numberOrZero(extendedUsage.cache_creation_input_tokens),
      cache_read_input_tokens: numberOrZero(extendedUsage.cache_read_input_tokens),
    },
  }
}
