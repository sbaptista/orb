'use client'

import { startInteraction } from '@/lib/performance/telemetry'

const ASSET_BASE_PATH = '/vad/0.0.30/'
const SELF_HOSTED_ASSET_BYTES = 15_834_162
const FRAME_RETENTION_MS = 30_000
const PROVIDER_EVENT_LEAD_IN_MS = 1_000
const PLAYBACK_GUARD_MINIMUM_FRAMES = 20
const PLAYBACK_GUARD_MAXIMUM_TRANSCRIPTION_CONFIDENCE = 0.5

type FrameSample = {
  atMs: number
  speechProbability: number
}

type SpeechEvent = {
  atMs: number
  type: 'start' | 'real_start' | 'end' | 'misfire'
}

export type SileroShadowMetadata = Record<string, string | number | boolean | null>

export type SileroShadowController = {
  snapshot: (providerStartedAtMs: number | null, endedAtMs?: number) => SileroShadowMetadata
  destroy: () => Promise<void>
}

export function shouldSuppressPlaybackCoupledTurn(
  metadata: SileroShadowMetadata,
  transcriptionConfidence: number | null,
) {
  return metadata.sileroShadowState === 'ready'
    && typeof metadata.sileroFrameCount === 'number'
    && metadata.sileroFrameCount >= PLAYBACK_GUARD_MINIMUM_FRAMES
    && metadata.sileroRealStartCount === 0
    && transcriptionConfidence !== null
    && transcriptionConfidence < PLAYBACK_GUARD_MAXIMUM_TRANSCRIPTION_CONFIDENCE
}

function heapBytes() {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize?: number }
  }).memory
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null
}

function round(value: number) {
  return Number(value.toFixed(4))
}

export async function startSileroShadow(
  stream: MediaStream,
): Promise<SileroShadowController> {
  const measurement = startInteraction({
    focus: 'voice',
    flow: 'voice-realtime-vad-shadow',
    interaction: 'initialize',
    surface: 'orb-realtime-spike',
    immediateFlush: true,
    metadata: {
      packageVersion: '0.0.30',
      model: 'silero_v5',
      assetBytes: SELF_HOSTED_ASSET_BYTES,
      wasmThreads: 1,
    },
  })
  const initialHeapBytes = heapBytes()
  const frames: FrameSample[] = []
  const speechEvents: SpeechEvent[] = []
  let totalFrames = 0
  let previousFrameAtMs: number | null = null
  let frameIntervalTotalMs = 0
  let maximumFrameGapMs = 0

  const prune = (nowMs: number) => {
    const cutoff = nowMs - FRAME_RETENTION_MS
    while (frames[0]?.atMs < cutoff) frames.shift()
    while (speechEvents[0]?.atMs < cutoff) speechEvents.shift()
  }

  const recordEvent = (type: SpeechEvent['type']) => {
    const nowMs = performance.now()
    speechEvents.push({ atMs: nowMs, type })
    prune(nowMs)
  }

  try {
    const { MicVAD } = await import('@ricky0123/vad-web')
    measurement.mark('module_loaded')
    const vad = await MicVAD.new({
      model: 'v5',
      baseAssetPath: ASSET_BASE_PATH,
      onnxWASMBasePath: ASSET_BASE_PATH,
      startOnLoad: true,
      processorType: 'auto',
      getStream: async () => stream,
      // The Realtime session owns this stream. Shadow teardown may disconnect
      // its audio graph, but it must never pause, replace, or stop the track.
      pauseStream: async () => {},
      resumeStream: async () => stream,
      ortConfig: ort => {
        ort.env.logLevel = 'error'
        ort.env.wasm.numThreads = 1
      },
      onFrameProcessed: probabilities => {
        const nowMs = performance.now()
        if (previousFrameAtMs !== null) {
          const intervalMs = nowMs - previousFrameAtMs
          frameIntervalTotalMs += intervalMs
          maximumFrameGapMs = Math.max(maximumFrameGapMs, intervalMs)
        }
        previousFrameAtMs = nowMs
        totalFrames += 1
        frames.push({ atMs: nowMs, speechProbability: probabilities.isSpeech })
        prune(nowMs)
      },
      onSpeechStart: () => recordEvent('start'),
      onSpeechRealStart: () => recordEvent('real_start'),
      onSpeechEnd: () => recordEvent('end'),
      onVADMisfire: () => recordEvent('misfire'),
    })
    measurement.mark('classifier_running')
    const finalHeapBytes = heapBytes()
    measurement.end(true, null, {
      heapDeltaBytes: initialHeapBytes === null || finalHeapBytes === null
        ? null
        : finalHeapBytes - initialHeapBytes,
      processor: vad.options.processorType,
    })
    totalFrames = 0
    previousFrameAtMs = null
    frameIntervalTotalMs = 0
    maximumFrameGapMs = 0
    const runtimeStartedAtMs = performance.now()
    const runtimeInitialHeapBytes = heapBytes()
    const runtimeMeasurement = startInteraction({
      focus: 'voice',
      flow: 'voice-realtime-vad-shadow',
      interaction: 'session_runtime',
      surface: 'orb-realtime-spike',
      immediateFlush: true,
      metadata: {
        packageVersion: '0.0.30',
        model: 'silero_v5',
        expectedFrameIntervalMs: 32,
        wasmThreads: 1,
      },
    })
    let destroyed = false

    return {
      snapshot(providerStartedAtMs, endedAtMs = performance.now()) {
        const startedAtMs = providerStartedAtMs === null
          ? endedAtMs - FRAME_RETENTION_MS
          : providerStartedAtMs - PROVIDER_EVENT_LEAD_IN_MS
        const matchingFrames = frames.filter(frame =>
          frame.atMs >= startedAtMs && frame.atMs <= endedAtMs
        )
        const matchingEvents = speechEvents.filter(event =>
          event.atMs >= startedAtMs && event.atMs <= endedAtMs
        )
        const probabilities = matchingFrames.map(frame => frame.speechProbability)
        const positiveFrames = probabilities.filter(value =>
          value >= vad.options.positiveSpeechThreshold
        ).length
        const probabilityTotal = probabilities.reduce((total, value) => total + value, 0)
        return {
          sileroShadowState: 'ready',
          sileroFrameCount: probabilities.length,
          sileroSpeechObserved: positiveFrames > 0,
          sileroPositiveFrameCount: positiveFrames,
          sileroPositiveFrameRatio: probabilities.length
            ? round(positiveFrames / probabilities.length)
            : 0,
          sileroMaximumProbability: probabilities.length
            ? round(Math.max(...probabilities))
            : 0,
          sileroAverageProbability: probabilities.length
            ? round(probabilityTotal / probabilities.length)
            : 0,
          sileroSpeechStartCount: matchingEvents.filter(event => event.type === 'start').length,
          sileroRealStartCount: matchingEvents.filter(event => event.type === 'real_start').length,
          sileroSpeechEndCount: matchingEvents.filter(event => event.type === 'end').length,
          sileroMisfireCount: matchingEvents.filter(event => event.type === 'misfire').length,
          sileroPositiveThreshold: vad.options.positiveSpeechThreshold,
          sileroNegativeThreshold: vad.options.negativeSpeechThreshold,
        }
      },
      async destroy() {
        if (destroyed) return
        destroyed = true
        const runtimeMs = performance.now() - runtimeStartedAtMs
        const finalHeapBytes = heapBytes()
        runtimeMeasurement.end(true, null, {
          totalFrames,
          framesPerSecond: runtimeMs > 0 ? round(totalFrames / (runtimeMs / 1_000)) : 0,
          averageFrameIntervalMs: totalFrames > 1
            ? round(frameIntervalTotalMs / (totalFrames - 1))
            : 0,
          maximumFrameGapMs: round(maximumFrameGapMs),
          heapDeltaBytes: runtimeInitialHeapBytes === null || finalHeapBytes === null
            ? null
            : finalHeapBytes - runtimeInitialHeapBytes,
        })
        await vad.destroy()
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    measurement.end(false, 'silero_shadow_init_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: message.slice(0, 160),
    })
    throw error
  }
}
