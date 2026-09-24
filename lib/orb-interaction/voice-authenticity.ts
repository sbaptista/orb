export type VoiceAcousticMetadata = Record<string, string | number | boolean | null>

const FALLBACK_PROVIDER_CONFIDENCE = 0.8

export function isStalledVoiceVerifier(metadata: VoiceAcousticMetadata) {
  return metadata.sileroShadowState === 'ready'
    && metadata.sileroFrameStreamFresh === false
}

/** Recover the local verifier without admitting a turn it disagreed with. */
export function shouldRecoverVoiceVerifier(
  metadata: VoiceAcousticMetadata,
  transcriptionConfidence: number | null,
) {
  if (isStalledVoiceVerifier(metadata)) return true
  return metadata.sileroShadowState === 'ready'
    && metadata.sileroSpeechObserved === false
    && transcriptionConfidence !== null
    && transcriptionConfidence >= FALLBACK_PROVIDER_CONFIDENCE
}

/**
 * A completed, non-empty provider transcript is usable input. Silero remains
 * diagnostic evidence and may be restarted when it disagrees, but it cannot
 * discard words the provider has already transcribed. The caller handles
 * failed and empty transcription events before reaching this boundary.
 */
export function isUsableProviderTranscript(transcript: string) {
  return transcript.trim().length > 0
}

/**
 * A lone character is evidence of a clipped transcription, not enough context
 * to infer a command. In particular, "S." must never be promoted to Stop.
 */
export function isClearlyFragmentaryProviderTranscript(transcript: string) {
  const spokenCharacters = transcript.normalize('NFKC').match(/[\p{L}\p{N}]/gu) ?? []
  return spokenCharacters.length <= 1
}
