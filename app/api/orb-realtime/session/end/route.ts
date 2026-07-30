import { getAuthContext } from '@/lib/auth'

/**
 * ORB-372 — end a Realtime call at OpenAI when the user stops voice.
 *
 * Closing the RTCPeerConnection ends our transport but leaves OpenAI's call
 * object live until it times out, so a quick restart collided with it and
 * returned 409 "A live session already exists for the provided call_id".
 *
 * Deliberately BEST-EFFORT: this runs during teardown, and a failure here
 * must never surface to the user or block stopping voice. The worst case
 * without it is the pre-existing behaviour — the call expires on its own.
 */
export async function POST(request: Request) {
  try {
    await getAuthContext()
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callId } = await request.json().catch(() => ({ callId: '' })) as { callId?: string }
  // Goes straight into a URL path, so accept only OpenAI's id shape.
  if (!callId || !/^[A-Za-z0-9_-]{1,128}$/.test(callId)) {
    return Response.json({ error: 'Invalid call id' }, { status: 400 })
  }

  try {
    const response = await fetch(`https://api.openai.com/v1/realtime/calls/${callId}/hangup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    })
    if (!response.ok) {
      // Not an incident: a call that already ended is the expected common case.
      console.warn('[orb-realtime] hangup returned', response.status, (await response.text()).slice(0, 200))
    }
  } catch (error) {
    console.error('[orb-realtime] hangup failed:', error)
  }
  return Response.json({ ok: true })
}
