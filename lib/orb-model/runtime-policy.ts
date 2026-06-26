import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ORB_AI_POLICY, type OrbAiPolicy } from './policy'

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

/**
 * Read the control-plane policy on every conversation. This is a single
 * primary-key lookup, and immediate application matters more than caching a
 * toggle that an administrator may have just changed.
 */
export async function getRuntimeOrbAiPolicy(): Promise<OrbAiPolicy> {
  const { data, error } = await createAdminClient()
    .from('orb_ai_policy')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[orbModel] Could not load routing policy; retaining operational-only routing:', error.message)
    return DEFAULT_ORB_AI_POLICY
  }

  return mapPolicy(data)
}
