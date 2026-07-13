import type { OrbModelUsage } from './types'

export const ORB_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

type TranscriptionResult = {
  text: string
  latencyMs: number
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    audioTokens: number
  }
}

export async function transcribeOpenAIAudio(file: File): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const body = new FormData()
  body.append('file', file, file.name || 'orb-voice.webm')
  body.append('model', ORB_TRANSCRIPTION_MODEL)
  body.append('language', 'en')
  body.append('prompt', 'Orb is the name of a personal project and todo assistant. Preserve project names and task identifiers exactly when spoken.')

  const startedAt = Date.now()
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  })
  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    console.error('[stt] OpenAI transcription failed:', response.status, await response.text())
    throw new Error('Speech transcription failed')
  }

  const result = await response.json() as {
    text?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
      input_token_details?: { audio_tokens?: number }
    }
  }
  const text = result.text?.trim() ?? ''
  if (!text) throw new Error('No speech was recognized')

  return {
    text,
    latencyMs,
    usage: {
      inputTokens: result.usage?.input_tokens ?? 0,
      outputTokens: result.usage?.output_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
      audioTokens: result.usage?.input_token_details?.audio_tokens ?? 0,
    },
  }
}

export function buildSttUsage(result: TranscriptionResult): OrbModelUsage {
  return {
    provider: 'openai',
    model: ORB_TRANSCRIPTION_MODEL,
    source: 'voice_stt',
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    reasoningTokens: null,
    totalTokens: result.usage.totalTokens,
    clientToolCalls: 0,
    latencyMs: result.latencyMs,
    attemptCount: 1,
    success: true,
    failureCode: null,
    estimatedCostUsd: null,
    rateSnapshot: null,
    providerUsage: { audio_tokens: result.usage.audioTokens },
  }
}
