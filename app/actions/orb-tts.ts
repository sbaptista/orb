'use server'

import { requireAdmin } from '@/lib/auth'
import { synthesizeOpenAI, synthesizeElevenLabs, buildTtsUsage, type TtsProvider } from '@/lib/orb-model/tts'
import { recordOrbModelRequest } from '@/lib/orb-model/record'

export type TtsSynthesizeRequest = {
  text: string
  provider: TtsProvider
  model: string
  voiceId: string
}

export type TtsSynthesizeResponse = {
  audioBase64: string
  contentType: string
}

export async function synthesizeSpeech(req: TtsSynthesizeRequest): Promise<TtsSynthesizeResponse> {
  const ctx = await requireAdmin()

  if (req.provider === 'browser') {
    throw new Error('Browser TTS does not use the server action.')
  }

  const start = Date.now()
  let characters = 0

  try {
    const result = req.provider === 'openai'
      ? await synthesizeOpenAI(req.text, req.model, req.voiceId)
      : await synthesizeElevenLabs(req.text, req.model, req.voiceId)

    characters = result.characters

    const usage = buildTtsUsage(req.provider, req.model || 'tts-1', characters, result.latencyMs, true)
    recordOrbModelRequest(ctx.admin, {
      userId: ctx.user.id,
      usage,
      routeRole: 'operational',
    }).catch(err => console.error('[tts] failed to record usage:', err))

    return {
      audioBase64: result.audioBase64,
      contentType: result.contentType,
    }
  } catch (err) {
    const latencyMs = Date.now() - start
    const failureCode = err instanceof Error ? err.message.slice(0, 200) : 'unknown'
    const usage = buildTtsUsage(req.provider, req.model || 'tts-1', characters, latencyMs, false, failureCode)
    recordOrbModelRequest(ctx.admin, {
      userId: ctx.user.id,
      usage,
      routeRole: 'operational',
    }).catch(recordErr => console.error('[tts] failed to record failure:', recordErr))

    throw err
  }
}
