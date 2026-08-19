'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { synthesizeOpenAI, buildTtsUsage, type TtsProvider } from '@/lib/orb-model/tts'
import { recordOrbModelRequest } from '@/lib/orb-model/record'
import type { ClientEnvironmentSnapshot } from '@/lib/client-environment'

export type TtsSynthesizeRequest = {
  text: string
  provider: TtsProvider
  model: string
  voiceId: string
  clientEnvironment?: ClientEnvironmentSnapshot
}

export type TtsSynthesizeResponse = {
  audioBase64: string
  contentType: string
}

export async function synthesizeSpeech(req: TtsSynthesizeRequest): Promise<TtsSynthesizeResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (req.provider !== 'openai') {
    throw new Error(req.provider === 'browser' ? 'Browser TTS does not use the server action.' : 'Unsupported TTS provider.')
  }

  const result = await synthesizeOpenAI(req.text, req.model, req.voiceId)

  // Fire-and-forget usage recording — don't block the audio response
  const admin = createAdminClient()
  const usage = buildTtsUsage(req.provider, req.model || 'tts-1', result.characters, result.latencyMs, true)
  recordOrbModelRequest(admin, {
    userId: user.id,
    usage,
    routeRole: 'operational',
    platform: req.clientEnvironment?.platform,
  }).catch(err => console.error('[tts] failed to record usage:', err))

  return {
    audioBase64: result.audioBase64,
    contentType: result.contentType,
  }
}
