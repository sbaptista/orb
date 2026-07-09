import type { AuthContext } from '@/lib/auth'
import { DEFAULT_ORB_AI_POLICY, type OrbAiPolicy, type OrbModelRateCard } from '@/lib/orb-model/policy'

// Pure fetch/mapping for Orb AI settings, decoupled from the auth gate so callers
// that already hold an AuthContext (e.g. getAiMetricsBundle) can reuse it without a
// second requireAdmin()/getUser() round-trip. (ORB-312)

function mapPolicy(row: any): OrbAiPolicy {
  if (!row) return DEFAULT_ORB_AI_POLICY
  return {
    routingEnabled: row.routing_enabled,
    strategicReadsEnabled: row.strategic_reads_enabled,
    operationalProvider: row.operational_provider,
    operationalModel: row.operational_model,
    strategicProvider: row.strategic_provider,
    strategicModel: row.strategic_model,
    monthlyBudgetUsd: Number(row.monthly_budget_usd),
    strategicBudgetUsd: Number(row.strategic_budget_usd),
    operationalBudgetUsd: Number(row.operational_budget_usd),
    ttsProvider: row.tts_provider ?? 'browser',
    ttsModel: row.tts_model ?? null,
    ttsVoiceId: row.tts_voice_id ?? null,
  }
}

function mapRateCard(row: any): OrbModelRateCard {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    effectiveFrom: row.effective_from,
    inputPerMillion: Number(row.input_per_million),
    outputPerMillion: Number(row.output_per_million),
    cachedInputPerMillion: row.cached_input_per_million == null ? null : Number(row.cached_input_per_million),
    cacheWritePerMillion: row.cache_write_per_million == null ? null : Number(row.cache_write_per_million),
    notes: row.notes ?? null,
  }
}

export type OrbAiSettingsResult = { policy: OrbAiPolicy; rateCards: OrbModelRateCard[] }

export async function fetchOrbAiSettings(ctx: AuthContext): Promise<OrbAiSettingsResult> {
  const [{ data: policy, error: policyError }, { data: rateCards, error: rateCardsError }] = await Promise.all([
    ctx.admin.from('orb_ai_policy').select('*').eq('id', true).maybeSingle(),
    ctx.admin.from('orb_model_rate_cards').select('*').order('provider').order('model').order('effective_from', { ascending: false }),
  ])
  if (policyError) throw policyError
  if (rateCardsError) throw rateCardsError
  return { policy: mapPolicy(policy), rateCards: (rateCards ?? []).map(mapRateCard) }
}
