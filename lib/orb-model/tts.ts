import type { OrbModelUsage, OrbModelProviderId } from './types'

export type TtsProvider = 'browser' | 'openai'

export type TtsVoiceOption = {
  id: string
  name: string
  preview?: string
}

export const OPENAI_VOICES: TtsVoiceOption[] = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'ash', name: 'Ash' },
  { id: 'coral', name: 'Coral' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'nova', name: 'Nova' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'sage', name: 'Sage' },
  { id: 'shimmer', name: 'Shimmer' },
]

export const TTS_MODELS: Record<TtsProvider, { provider: OrbModelProviderId; model: string; label: string }[]> = {
  browser: [],
  openai: [
    { provider: 'openai', model: 'tts-1', label: 'OpenAI TTS Standard' },
    { provider: 'openai', model: 'tts-1-hd', label: 'OpenAI TTS HD' },
  ],
}

export function getVoicesForProvider(provider: TtsProvider): TtsVoiceOption[] {
  if (provider === 'openai') return OPENAI_VOICES
  return []
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type TtsSynthesisResult = {
  audioBase64: string
  contentType: string
  characters: number
  latencyMs: number
}

export async function synthesizeOpenAI(
  text: string,
  model: string,
  voiceId: string,
): Promise<TtsSynthesisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const cleaned = stripMarkdown(text)
  if (!cleaned) throw new Error('No text to synthesize')

  const start = Date.now()
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'tts-1',
      input: cleaned,
      voice: voiceId || 'nova',
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI TTS error: ${response.status} ${err}`)
  }

  const buffer = await response.arrayBuffer()
  const latencyMs = Date.now() - start

  return {
    audioBase64: Buffer.from(buffer).toString('base64'),
    contentType: 'audio/mpeg',
    characters: cleaned.length,
    latencyMs,
  }
}

export function buildTtsUsage(
  provider: TtsProvider,
  model: string,
  characters: number,
  latencyMs: number,
  success: boolean,
  failureCode?: string,
): OrbModelUsage {
  return {
    provider: provider as OrbModelProviderId,
    model,
    source: 'voice_tts',
    inputTokens: characters,
    outputTokens: 0,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    reasoningTokens: null,
    totalTokens: characters,
    clientToolCalls: 0,
    latencyMs,
    attemptCount: 1,
    success,
    failureCode: failureCode ?? null,
    estimatedCostUsd: null,
    rateSnapshot: null,
    providerUsage: { characters },
  }
}
