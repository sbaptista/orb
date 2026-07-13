import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSttUsage, transcribeOpenAIAudio } from '@/lib/orb-model/stt'
import { recordOrbModelRequest } from '@/lib/orb-model/record'

export const runtime = 'nodejs'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_REQUESTS = 10
const recentRequests = new Map<string, number[]>()
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const now = Date.now()
  const recent = (recentRequests.get(user.id) ?? []).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_REQUESTS) {
    recentRequests.set(user.id, recent)
    return Response.json(
      { error: 'Voice transcription is receiving too many requests. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }
  recent.push(now)
  recentRequests.set(user.id, recent)

  try {
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return Response.json({ error: 'Audio file required' }, { status: 400 })
    }
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Audio recording is empty or too large' }, { status: 400 })
    }
    const baseType = audio.type.split(';')[0]
    if (baseType && !ALLOWED_AUDIO_TYPES.has(baseType)) {
      return Response.json({ error: 'Unsupported audio format' }, { status: 415 })
    }

    const result = await transcribeOpenAIAudio(audio)
    recordOrbModelRequest(createAdminClient(), {
      userId: user.id,
      usage: buildSttUsage(result),
      routeRole: 'operational',
    }).catch(error => console.error('[stt] request ledger insert failed:', error))

    return Response.json({ text: result.text })
  } catch (error) {
    console.error('[stt] transcription route failed:', error)
    return Response.json({ error: 'Could not transcribe speech. Try again or switch to text.' }, { status: 502 })
  }
}
