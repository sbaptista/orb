type RealtimeVoiceAccess = {
  enabled: boolean
  reason: 'development' | 'allowlisted' | 'disabled' | 'not_allowlisted' | 'not_configured'
}

function allowlistedEmails() {
  return new Set(
    (process.env.ORB_REALTIME_VOICE_ALLOWLIST || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function getRealtimeVoiceAccess(email: string | null | undefined): RealtimeVoiceAccess {
  if (!process.env.OPENAI_API_KEY) return { enabled: false, reason: 'not_configured' }
  if (process.env.NODE_ENV === 'development') return { enabled: true, reason: 'development' }
  if (process.env.ORB_REALTIME_VOICE_ENABLED !== 'true') return { enabled: false, reason: 'disabled' }
  if (!email || !allowlistedEmails().has(email.toLowerCase())) {
    return { enabled: false, reason: 'not_allowlisted' }
  }
  return { enabled: true, reason: 'allowlisted' }
}
