import { getAuthContext } from '@/lib/auth'
import { recordOrbModelRequest } from '@/lib/orb-model/record'
import { sanitizeModelRequestPlatform } from '@/lib/client-environment'
import { DEFAULT_ORB_AI_POLICY } from '@/lib/orb-model/policy'
import { supportsOrbRole } from '@/lib/orb-model/catalog'

export const runtime = 'nodejs'

type RealtimeUsage = {
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
  input_token_details?: { cached_tokens?: number; text_tokens?: number; audio_tokens?: number }
  output_token_details?: { text_tokens?: number; audio_tokens?: number }
}

// Fire-and-forget sink for the client hook's response.done usage report
// (ORB-353). The realtime session itself never touches Orb's server after
// the initial SDP handshake, so this is the only place voice token usage
// ever reaches the ledger. Best-effort: never surface a failure to the call.
export async function POST(request: Request) {
  try {
    const auth = await getAuthContext()
    const body = await request.json() as { usage?: RealtimeUsage; platform?: unknown; model?: unknown }
    const usage = body.usage
    if (!usage) return Response.json({ ok: true })
    const model = typeof body.model === 'string' && supportsOrbRole('openai', body.model, 'voice')
      ? body.model
      : DEFAULT_ORB_AI_POLICY.voiceModel

    await recordOrbModelRequest(auth.admin, {
      userId: auth.user.id,
      routeRole: 'voice',
      platform: sanitizeModelRequestPlatform(body.platform),
      usage: {
        provider: 'openai',
        model,
        source: 'voice_realtime',
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cachedInputTokens: usage.input_token_details?.cached_tokens ?? null,
        cacheWriteTokens: null,
        reasoningTokens: null,
        totalTokens: usage.total_tokens ?? null,
        clientToolCalls: 0,
        latencyMs: 0,
        attemptCount: 1,
        success: true,
        failureCode: null,
        estimatedCostUsd: null,
        rateSnapshot: null,
        providerUsage: usage as Record<string, unknown>,
      },
    })
    return Response.json({ ok: true })
  } catch (error) {
    console.error('[orb-realtime/usage] Failed to record voice usage:', error)
    return Response.json({ ok: true })
  }
}
