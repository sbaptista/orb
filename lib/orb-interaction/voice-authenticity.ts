export type VoiceAcousticMetadata = Record<string, string | number | boolean | null>

const MINIMUM_FRAMES = 20
const FALLBACK_PROVIDER_CONFIDENCE = 0.8
const SHORT_SPEECH_MINIMUM_POSITIVE_FRAMES = 2
const SHORT_SPEECH_MINIMUM_POSITIVE_RATIO = 0.18
const SHORT_SPEECH_MINIMUM_MAXIMUM_PROBABILITY = 0.65

/** Fail-closed boundary for transcripts entering the shared conversation. */
export function isAuthenticVoiceTurn(
  metadata: VoiceAcousticMetadata,
  transcriptionConfidence: number | null,
) {
  if (metadata.sileroShadowState === 'ready') {
    const frameCount = typeof metadata.sileroFrameCount === 'number'
      ? metadata.sileroFrameCount
      : 0
    const realStartCount = typeof metadata.sileroRealStartCount === 'number'
      ? metadata.sileroRealStartCount
      : 0
    const speechObserved = metadata.sileroSpeechObserved === true
    if (!speechObserved) return false
    if (realStartCount > 0) return true
    const positiveFrames = typeof metadata.sileroPositiveFrameCount === 'number'
      ? metadata.sileroPositiveFrameCount
      : 0
    const positiveRatio = typeof metadata.sileroPositiveFrameRatio === 'number'
      ? metadata.sileroPositiveFrameRatio
      : 0
    const maximumProbability = typeof metadata.sileroMaximumProbability === 'number'
      ? metadata.sileroMaximumProbability
      : 0
    return positiveFrames >= (frameCount >= MINIMUM_FRAMES
      ? SHORT_SPEECH_MINIMUM_POSITIVE_FRAMES + 1
      : SHORT_SPEECH_MINIMUM_POSITIVE_FRAMES)
      && positiveRatio >= SHORT_SPEECH_MINIMUM_POSITIVE_RATIO
      && maximumProbability >= SHORT_SPEECH_MINIMUM_MAXIMUM_PROBABILITY
  }
  return transcriptionConfidence !== null
    && transcriptionConfidence >= FALLBACK_PROVIDER_CONFIDENCE
}
