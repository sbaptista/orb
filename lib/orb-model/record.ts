import type { OrbModelUsage } from './types'
import type { OrbModelRole } from './policy'

export type OrbModelRequestRecord = {
  userId: string
  usage: OrbModelUsage
  evaluationCaseId?: string
  promptVersion?: string
  contextPacketVersion?: string
  responseText?: string
  correlationId?: string
  routeRole?: OrbModelRole
}

function configuredCost(usage: OrbModelUsage, rateCard: any): OrbModelUsage {
  if (!rateCard) return usage
  const rateSnapshot = {
    version: `configured-${rateCard.effective_from}`,
    effectiveDate: rateCard.effective_from,
    inputPerMillion: Number(rateCard.input_per_million),
    outputPerMillion: Number(rateCard.output_per_million),
    cachedInputPerMillion: rateCard.cached_input_per_million == null ? null : Number(rateCard.cached_input_per_million),
    cacheWritePerMillion: rateCard.cache_write_per_million == null ? null : Number(rateCard.cache_write_per_million),
  }
  // Gemini reports cached input inside promptTokenCount; Anthropic reports it
  // separately. Preserve each provider's accounting semantics when applying
  // the configurable rate card.
  const billableInputTokens = usage.provider === 'google'
    ? Math.max(0, usage.inputTokens - (usage.cachedInputTokens ?? 0))
    : usage.inputTokens
  const estimatedCostUsd =
    (billableInputTokens / 1_000_000) * rateSnapshot.inputPerMillion
    + (usage.outputTokens / 1_000_000) * rateSnapshot.outputPerMillion
    + ((usage.cachedInputTokens ?? 0) / 1_000_000) * (rateSnapshot.cachedInputPerMillion ?? 0)
    + ((usage.cacheWriteTokens ?? 0) / 1_000_000) * (rateSnapshot.cacheWritePerMillion ?? 0)
  return { ...usage, rateSnapshot, estimatedCostUsd }
}

export async function recordOrbModelRequest(admin: any, record: OrbModelRequestRecord) {
  const { data: rateCard, error: rateCardError } = await admin
    .from('orb_model_rate_cards')
    .select('effective_from, input_per_million, output_per_million, cached_input_per_million, cache_write_per_million')
    .eq('provider', record.usage.provider)
    .eq('model', record.usage.model)
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rateCardError) throw rateCardError
  const usage = configuredCost(record.usage, rateCard)
  const { error } = await admin.from('orb_model_requests').insert({
    user_id: record.userId,
    provider: usage.provider,
    model: usage.model,
    source: usage.source,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    cache_write_tokens: usage.cacheWriteTokens,
    reasoning_tokens: usage.reasoningTokens,
    total_tokens: usage.totalTokens,
    client_tool_calls: usage.clientToolCalls,
    latency_ms: usage.latencyMs,
    attempt_count: usage.attemptCount,
    success: usage.success,
    failure_code: usage.failureCode,
    estimated_cost_usd: usage.estimatedCostUsd,
    rate_snapshot: usage.rateSnapshot,
    provider_usage: usage.providerUsage,
    correlation_id: record.correlationId ?? null,
    evaluation_case_id: record.evaluationCaseId ?? null,
    prompt_version: record.promptVersion ?? null,
    context_packet_version: record.contextPacketVersion ?? null,
    response_text: record.responseText ?? null,
    route_role: record.routeRole ?? 'operational',
  })
  if (error) throw error
}
