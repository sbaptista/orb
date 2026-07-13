'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TtsProvider } from '@/lib/orb-model/tts'
import { synthesizeSpeech } from '@/app/actions/orb-tts'
import { startInteraction } from '@/lib/performance/telemetry'
import { useCapabilities, type Capabilities } from './useCapabilities'

export type TtsConfig = {
  provider: TtsProvider
  model: string | null
  voiceId: string | null
}

// ── Text utilities ──────────────────────────────────────────────────

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

const MAX_CHUNK = 240
const LONG_RESPONSE = 500

function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text.length > MAX_CHUNK ? splitAtBoundaries(text) : [text]

  const chunks: string[] = []
  let buf = ''
  for (const s of sentences) {
    if ((buf + s).length > MAX_CHUNK && buf) { chunks.push(buf.trim()); buf = s }
    else buf += s
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.flatMap(c => c.length > MAX_CHUNK ? splitAtBoundaries(c) : [c])
}

function splitAtBoundaries(text: string): string[] {
  const chunks: string[] = []
  const pieces = text.split(/(?<=[,;:—–])\s+|\n+/)
  let buf = ''
  for (const p of pieces) {
    const part = p.trim()
    if (!part) continue
    if (part.length > MAX_CHUNK) {
      if (buf) { chunks.push(buf); buf = '' }
      let word = ''
      for (const w of part.split(/\s+/)) {
        const next = word ? `${word} ${w}` : w
        if (next.length > MAX_CHUNK && word) { chunks.push(word); word = w }
        else word = next
      }
      if (word) chunks.push(word)
      continue
    }
    const next = buf ? `${buf} ${part}` : part
    if (next.length > MAX_CHUNK && buf) { chunks.push(buf); buf = part }
    else buf = next
  }
  if (buf) chunks.push(buf)
  return chunks
}

function truncateForSpeech(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text
  let result = ''
  for (const s of sentences) {
    if ((result + s).length > LONG_RESPONSE) break
    result += s
  }
  return (result.trim() || sentences[0].trim()) + ' Check the transcript for the full details.'
}

function isRecognitionAlreadyStarted(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'InvalidStateError'
}

// ── Constants ───────────────────────────────────────────────────────

const LS_VOICE_KEY = 'orb_preferred_voice'
const LS_RATE_KEY = 'orb_voice_rate'
const SILENCE_MS = 2000
const TRANSCRIPT_DEBOUNCE_MS = 150
const SERVER_SILENCE_MS = 1600
const SERVER_MAX_RECORDING_MS = 30_000
const SERVER_VOICE_THRESHOLD = 0.018

// ── Types ───────────────────────────────────────────────────────────

export type VoiceState = {
  voiceActive: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  ttsError: string | null
  supportsVoice: boolean
  capabilities: Capabilities
  availableVoices: SpeechSynthesisVoice[]
  selectedVoiceName: string
  voiceRate: number
  wasInterrupted: boolean
}

export type VoiceActions = {
  startConversation: () => void
  resumeListening: () => void
  speak: (text: string) => void
  cancelSpeech: () => void
  exitVoiceMode: () => void
  setVoice: (name: string) => void
  setRate: (rate: number) => void
  setOnSend: (cb: (text: string) => void) => void
  updateTtsConfig: (config: TtsConfig) => void
}

// ── Queue state ─────────────────────────────────────────────────────
// One utterance per Orb response: speak() replaces the queue wholesale,
// drain() plays it out, then hands the mic back. No cross-call
// reconciliation — spoken text is derived once, upstream, per response.

type SpeechQueue = {
  chunks: string[]
  playing: boolean
}

const EMPTY_QUEUE: SpeechQueue = { chunks: [], playing: false }

// ── Hook ────────────────────────────────────────────────────────────

export function useVoiceMode(ttsConfig?: TtsConfig): VoiceState & VoiceActions {
  const cfgRef = useRef(ttsConfig)
  const [effectiveTtsConfig, setEffectiveTtsConfig] = useState<TtsConfig | undefined>(ttsConfig)

  useEffect(() => {
    cfgRef.current = ttsConfig
    setEffectiveTtsConfig(ttsConfig)
  }, [ttsConfig])

  const capabilities = useCapabilities(!!(effectiveTtsConfig && effectiveTtsConfig.provider !== 'browser'))

  // ── State ───────────────────────────────────────────────────────
  const [voiceActive, setVoiceActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, _setIsSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const setSpeaking = useCallback((v: boolean) => { speakingRef.current = v; _setIsSpeaking(v) }, [])
  const [transcript, setTranscript] = useState('')
  const supportsVoice = capabilities.voice !== 'unavailable'
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState('')
  const [voiceRate, setVoiceRate] = useState(1.0)
  const [wasInterrupted, setWasInterrupted] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)

  // ── Refs ─────────────────────────────────────────────────────────
  const recRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSendRef = useRef<((text: string) => void) | null>(null)
  const recognitionRunningRef = useRef(false)
  const recognitionStartPendingRef = useRef(false)
  const emptyAutoResumeCountRef = useRef(0)
  const autoResumeRef = useRef(false)
  const cancelledRef = useRef(false)
  const genRef = useRef(0)
  const queueRef = useRef<SpeechQueue>({ ...EMPTY_QUEUE })
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const prefetchRef = useRef<{ text: string; promise: Promise<{ audioBase64: string; contentType: string }>; provider: string } | null>(null)
  const recognitionMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const speechMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const turnMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const firstRecognitionResultRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingAudioCtxRef = useRef<AudioContext | null>(null)
  const recordingFrameRef = useRef<number | null>(null)
  const recordingCancelledRef = useRef(false)
  const startServerRecognitionRef = useRef<() => void>(() => {})

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const load = () => { const v = speechSynthesis.getVoices(); if (v.length) setAvailableVoices(v) }
      load()
      speechSynthesis.onvoiceschanged = load
    }

    try {
      const s = localStorage.getItem(LS_VOICE_KEY)
      if (s) setSelectedVoiceName(s)
      const r = localStorage.getItem(LS_RATE_KEY)
      if (r) setVoiceRate(parseFloat(r) || 1.0)
    } catch {}
  }, [])

  // ── Timers ──────────────────────────────────────────────────────
  const clearSilence = useCallback(() => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
  }, [])

  const debouncedTranscript = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setTranscript(text), TRANSCRIPT_DEBOUNCE_MS)
  }, [])

  // Safety timeout: if speaking is stuck for 30s, force-reset
  useEffect(() => {
    if (!isSpeaking) return
    const timer = setTimeout(() => {
      if (speakingRef.current) {
        console.warn('[voice] speaking stuck for 30s, force-resetting')
        setSpeaking(false)
        queueRef.current = { ...EMPTY_QUEUE }
      }
    }, 30_000)
    return () => clearTimeout(timer)
  }, [isSpeaking, setSpeaking])

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: Recognition — single instance per session
  // ═══════════════════════════════════════════════════════════════

  const stopRecognition = useCallback(() => {
    if (recRef.current) try { recRef.current.stop() } catch {}
    recordingCancelledRef.current = true
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current)
    recordingFrameRef.current = null
    mediaStreamRef.current?.getTracks().forEach(track => track.stop())
    mediaStreamRef.current = null
    if (recordingAudioCtxRef.current) void recordingAudioCtxRef.current.close().catch(() => {})
    recordingAudioCtxRef.current = null
    recognitionRunningRef.current = false
    recognitionStartPendingRef.current = false
    setIsListening(false)
  }, [])

  const createRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = capabilities.speech.continuous
    rec.interimResults = true
    rec.lang = 'en-US'

    let accumulated = ''
    let lastStartTime = 0

    rec.onstart = () => {
      lastStartTime = Date.now()
      accumulated = ''
      transcriptRef.current = ''
      setTranscript('')
      recognitionRunningRef.current = true
      recognitionStartPendingRef.current = false
      setIsListening(true)
      recognitionMeasurementRef.current?.mark('recognition_started')
    }

    rec.onresult = (e: any) => {
      if (!firstRecognitionResultRef.current) {
        firstRecognitionResultRef.current = true
        recognitionMeasurementRef.current?.mark('first_transcript_result')
      }
      emptyAutoResumeCountRef.current = 0
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulated += e.results[i][0].transcript
          transcriptRef.current = accumulated
          debouncedTranscript(accumulated)

          clearSilence()
          silenceRef.current = setTimeout(() => {
            const text = transcriptRef.current.trim()
            if (text && onSendRef.current) {
              recognitionMeasurementRef.current?.mark('utterance_submitted')
              recognitionMeasurementRef.current?.end(true, null, { transcriptLength: text.length })
              recognitionMeasurementRef.current = null
              turnMeasurementRef.current = startInteraction({
                focus: 'voice',
                flow: 'voice-turn',
                interaction: 'recognized_to_mic_return',
                surface: 'dashboard',
                metadata: { transcriptLength: text.length },
              })
              turnMeasurementRef.current.mark('recognized_text_submitted')
              emptyAutoResumeCountRef.current = 0
              onSendRef.current(text)
              transcriptRef.current = ''
              accumulated = ''
            }
            silenceRef.current = null
            stopRecognition()
          }, SILENCE_MS)
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (interim) {
        const visibleTranscript = accumulated + interim
        transcriptRef.current = visibleTranscript
        debouncedTranscript(visibleTranscript)
      }
    }

    rec.onerror = (e: any) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('[voice] recognition error:', e.error)
        if (e.error === 'network') {
          setTtsError('Speech recognition lost its network connection. Tap Listen to try again.')
        }
      }
      recognitionRunningRef.current = false
      recognitionStartPendingRef.current = false
      setIsListening(false)
      recognitionMeasurementRef.current?.end(false, `recognition_${e.error || 'error'}`)
      recognitionMeasurementRef.current = null
    }

    rec.onend = () => {
      recognitionRunningRef.current = false
      recognitionStartPendingRef.current = false
      setIsListening(false)
      if (capabilities.speech.continuous) return

      // Detect rapid end cycling (recognition starts but immediately ends without audio)
      const elapsed = Date.now() - lastStartTime
      if (elapsed < 500 && !transcriptRef.current.trim()) {
        emptyAutoResumeCountRef.current++
        if (emptyAutoResumeCountRef.current >= 2) {
          console.warn('[voice] recognition ending immediately — not supported in this browser')
          autoResumeRef.current = false
          setTtsError('Microphone started and stopped immediately. Tap Listen to try again.')
          return
        }
      }

      // iOS: continuous=false, so onend fires after each pause.
      // Reuse the same instance to avoid "Microphone access allowed" toasts.
      if (!autoResumeRef.current || silenceRef.current || speakingRef.current || cancelledRef.current) return
      const text = transcriptRef.current.trim()
      if (text) {
        if (onSendRef.current) {
          recognitionMeasurementRef.current?.mark('utterance_submitted')
          recognitionMeasurementRef.current?.end(true, null, { transcriptLength: text.length })
          recognitionMeasurementRef.current = null
          turnMeasurementRef.current = startInteraction({
            focus: 'voice',
            flow: 'voice-turn',
            interaction: 'recognized_to_mic_return',
            surface: 'dashboard',
            metadata: { transcriptLength: text.length },
          })
          turnMeasurementRef.current.mark('recognized_text_submitted')
          emptyAutoResumeCountRef.current = 0
          onSendRef.current(text)
          transcriptRef.current = ''
          accumulated = ''
        }
        return
      }
      if (emptyAutoResumeCountRef.current >= 1) return
      emptyAutoResumeCountRef.current++
      setTimeout(() => {
        if (!autoResumeRef.current || cancelledRef.current || speakingRef.current) return
        if (recognitionRunningRef.current || recognitionStartPendingRef.current) return
        try {
          recognitionStartPendingRef.current = true
          rec.start()
          setIsListening(true)
        } catch (e) {
          recognitionStartPendingRef.current = false
          console.warn('[voice] iOS auto-resume failed, retrying:', e)
          setTimeout(() => {
            if (!autoResumeRef.current || cancelledRef.current || speakingRef.current) return
            if (recognitionRunningRef.current || recognitionStartPendingRef.current) return
            try {
              recognitionStartPendingRef.current = true
              rec.start()
              setIsListening(true)
            } catch (e2) {
              recognitionStartPendingRef.current = false
              console.error('[voice] iOS auto-resume retry failed:', e2)
              setTtsError('Microphone lost. Tap to resume.')
            }
          }, 500)
        }
      }, 800)
    }

    recRef.current = rec
  }, [clearSilence, debouncedTranscript, capabilities.speech.continuous, stopRecognition])

  const startRecognition = useCallback(() => {
    if (capabilities.speech.recognitionPath === 'server') {
      startServerRecognitionRef.current()
      return
    }
    if (recognitionRunningRef.current || recognitionStartPendingRef.current) {
      setIsListening(true)
      cancelledRef.current = false
      setWasInterrupted(false)
      return
    }
    if (!recRef.current) createRecognition()
    if (!recRef.current) {
      console.error('[voice] SpeechRecognition unavailable')
      setTtsError('Voice input is not available in this browser.')
      return
    }
    try {
      recognitionMeasurementRef.current?.end(false, 'recognition_restarted')
      recognitionMeasurementRef.current = startInteraction({
        focus: 'voice',
        flow: 'voice-recognition',
        interaction: 'listen_to_submit',
        surface: 'dashboard',
        metadata: {
          continuous: capabilities.speech.continuous,
          browser: capabilities.browser,
          platform: capabilities.platform,
        },
      })
      firstRecognitionResultRef.current = false
      recognitionMeasurementRef.current.mark('recognition_start_requested')
      recognitionStartPendingRef.current = true
      recRef.current.start()
      setIsListening(true)
      transcriptRef.current = ''
      setTranscript('')
      cancelledRef.current = false
      setWasInterrupted(false)
    } catch (e) {
      if (isRecognitionAlreadyStarted(e)) {
        recognitionStartPendingRef.current = false
        recognitionRunningRef.current = true
        setIsListening(true)
        cancelledRef.current = false
        setWasInterrupted(false)
        return
      }
      recognitionStartPendingRef.current = false
      console.error('[voice] recognition.start() failed:', e)
      setTtsError('Could not start listening. Try again or switch browsers.')
    }
  }, [createRecognition, capabilities.browser, capabilities.platform, capabilities.speech.continuous, capabilities.speech.recognitionPath])

  const teardownRecognition = useCallback(() => {
    stopRecognition()
    recRef.current = null
  }, [stopRecognition])

  const startServerRecognition = useCallback(async () => {
    if (recognitionRunningRef.current || recognitionStartPendingRef.current) return
    recognitionMeasurementRef.current?.end(false, 'recognition_restarted')
    recognitionMeasurementRef.current = startInteraction({
      focus: 'voice',
      flow: 'voice-recognition',
      interaction: 'listen_to_submit',
      surface: 'dashboard',
      metadata: {
        recognitionPath: 'server',
        browser: capabilities.browser,
        platform: capabilities.platform,
      },
    })
    recognitionMeasurementRef.current.mark('recording_permission_requested')
    recognitionStartPendingRef.current = true
    recordingCancelledRef.current = false
    setTtsError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (recordingCancelledRef.current) {
        stream.getTracks().forEach(track => track.stop())
        recognitionStartPendingRef.current = false
        recognitionMeasurementRef.current?.end(false, 'voice_interrupted')
        recognitionMeasurementRef.current = null
        return
      }
      mediaStreamRef.current = stream
      recognitionMeasurementRef.current?.mark('recording_started')

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
      const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
        recognitionRunningRef.current = false
        recognitionStartPendingRef.current = false
        setIsListening(false)
        recognitionMeasurementRef.current?.end(false, 'recording_failed')
        recognitionMeasurementRef.current = null
        setTtsError('Microphone recording failed. Try again or switch to text.')
      }
      recorder.onstop = async () => {
        if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current)
        recordingFrameRef.current = null
        stream.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
        if (recordingAudioCtxRef.current) await recordingAudioCtxRef.current.close().catch(() => {})
        recordingAudioCtxRef.current = null
        recognitionRunningRef.current = false
        recognitionStartPendingRef.current = false
        setIsListening(false)
        if (recordingCancelledRef.current) return

        const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (audio.size === 0) {
          recognitionMeasurementRef.current?.end(false, 'empty_recording')
          recognitionMeasurementRef.current = null
          setTtsError('I did not hear anything. Tap Listen to try again.')
          return
        }
        recognitionMeasurementRef.current?.mark('audio_captured')
        try {
          const form = new FormData()
          form.append('audio', audio, recorder.mimeType.includes('ogg') ? 'orb-voice.ogg' : 'orb-voice.webm')
          const response = await fetch('/api/orb-transcribe', { method: 'POST', body: form })
          const result = await response.json() as { text?: string; error?: string }
          if (!response.ok || !result.text) throw new Error(result.error || 'Speech transcription failed')
          const text = result.text.trim()
          recognitionMeasurementRef.current?.mark('transcription_completed')
          recognitionMeasurementRef.current?.mark('utterance_submitted')
          recognitionMeasurementRef.current?.end(true, null, { transcriptLength: text.length, recognitionPath: 'server' })
          recognitionMeasurementRef.current = null
          setTranscript(text)
          turnMeasurementRef.current = startInteraction({
            focus: 'voice',
            flow: 'voice-turn',
            interaction: 'recognized_to_mic_return',
            surface: 'dashboard',
            metadata: { transcriptLength: text.length, recognitionPath: 'server' },
          })
          turnMeasurementRef.current.mark('recognized_text_submitted')
          onSendRef.current?.(text)
        } catch (error) {
          recognitionMeasurementRef.current?.end(false, 'transcription_failed')
          recognitionMeasurementRef.current = null
          setTtsError(error instanceof Error ? error.message : 'Could not transcribe speech. Try again or switch to text.')
        }
      }

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      recordingAudioCtxRef.current = ctx
      await ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const startedAt = performance.now()
      let heardSpeech = false
      let lastVoiceAt = startedAt
      const monitor = () => {
        if (recorder.state !== 'recording') return
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const value of samples) {
          const normalized = (value - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / samples.length)
        const now = performance.now()
        if (rms >= SERVER_VOICE_THRESHOLD) {
          heardSpeech = true
          lastVoiceAt = now
          if (!firstRecognitionResultRef.current) {
            firstRecognitionResultRef.current = true
            recognitionMeasurementRef.current?.mark('speech_detected')
          }
        }
        if ((heardSpeech && now - lastVoiceAt >= SERVER_SILENCE_MS) || now - startedAt >= SERVER_MAX_RECORDING_MS) {
          recorder.stop()
          return
        }
        recordingFrameRef.current = requestAnimationFrame(monitor)
      }

      firstRecognitionResultRef.current = false
      recorder.start(250)
      recognitionRunningRef.current = true
      recognitionStartPendingRef.current = false
      setIsListening(true)
      recordingFrameRef.current = requestAnimationFrame(monitor)
    } catch (error) {
      recognitionRunningRef.current = false
      recognitionStartPendingRef.current = false
      setIsListening(false)
      recognitionMeasurementRef.current?.end(false, 'microphone_unavailable')
      recognitionMeasurementRef.current = null
      setTtsError('Could not access the microphone. Check Firefox permissions and try again.')
      console.error('[voice] Firefox recording failed:', error)
    }
  }, [capabilities.browser, capabilities.platform])
  startServerRecognitionRef.current = () => { void startServerRecognition() }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 1: Output — playChunk(text): Promise<void>
  // ═══════════════════════════════════════════════════════════════

  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop() } catch {}
      activeSourceRef.current = null
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }, [])

  const playBrowserTts = useCallback((text: string): Promise<void> => {
    if (!('speechSynthesis' in window)) return Promise.resolve()
    return new Promise<void>(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        // Force-flush the synthesis queue the instant this utterance ends, rather
        // than trusting the browser to clean up on its own — some browsers can
        // intermittently replay the last queued utterance after a later audio/focus
        // state change (e.g. the mic starting for the next listening turn).
        try { speechSynthesis.cancel() } catch {}
        resolve()
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = voiceRate
      const voice = selectedVoiceName && availableVoices.length > 0
        ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
        : null
      if (voice) utterance.voice = voice
      utterance.onend = finish
      utterance.onerror = finish
      utterance.onstart = () => {
        speechMeasurementRef.current?.mark('playback_started')
        turnMeasurementRef.current?.mark('playback_started')
      }
      speechSynthesis.speak(utterance)
    })
  }, [voiceRate, selectedVoiceName, availableVoices])

  const playChunk = useCallback((text: string, gen: number): Promise<void> => {
    if (cancelledRef.current || gen !== genRef.current) return Promise.resolve()

    const cfg = cfgRef.current
    if (!cfg || cfg.provider === 'browser') return playBrowserTts(text)

    // API TTS path. Do not silently fall back to browser TTS: mixed voices
    // are more confusing than a clear, recoverable voice error.
    return (async () => {
      try {
        speechMeasurementRef.current?.mark('tts_request_started')
        let result: { audioBase64: string; contentType: string }
        if (prefetchRef.current && prefetchRef.current.provider !== cfg.provider) {
          prefetchRef.current = null
        }
        if (prefetchRef.current && prefetchRef.current.provider === cfg.provider && prefetchRef.current.text === text) {
          result = await prefetchRef.current.promise
          prefetchRef.current = null
        } else {
          result = await synthesizeSpeech({
            text,
            provider: cfg.provider,
            model: cfg.model || 'tts-1',
            voiceId: cfg.voiceId || 'nova',
          })
        }
        speechMeasurementRef.current?.mark('tts_response_received')

        if (cancelledRef.current || gen !== genRef.current) return

        const ctx = audioCtxRef.current
        if (!ctx) throw new Error('Audio output is not ready for API voice playback.')
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }

        const raw = atob(result.audioBase64)
        const arr = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
        const decoded = await ctx.decodeAudioData(arr.buffer.slice(0))
        speechMeasurementRef.current?.mark('audio_decoded')
        if (cancelledRef.current || gen !== genRef.current) return

        return new Promise<void>(resolve => {
          const source = ctx.createBufferSource()
          source.buffer = decoded
          source.playbackRate.value = voiceRate
          source.connect(ctx.destination)
          let settled = false
          const watchdogMs = Math.max(1500, (decoded.duration * 1000) / Math.max(voiceRate, 0.5) + 1500)
          const timeout = window.setTimeout(() => finish(), watchdogMs)
          const finish = () => {
            if (settled) return
            settled = true
            window.clearTimeout(timeout)
            activeSourceRef.current = null
            resolve()
          }
          source.onended = finish
          activeSourceRef.current = source
          speechMeasurementRef.current?.mark('playback_started')
          turnMeasurementRef.current?.mark('playback_started')
          source.start()
        })
      } catch (err) {
        console.warn('[voice] API TTS failed:', err)
        if (cancelledRef.current || gen !== genRef.current) return
        throw err
      }
    })()
  }, [voiceRate, playBrowserTts])

  // ═══════════════════════════════════════════════════════════════
  // LAYER 2: Speech Queue — single queue, single drain loop
  // ═══════════════════════════════════════════════════════════════

  const drain = useCallback(async () => {
    const q = queueRef.current
    if (q.playing) return
    q.playing = true
    const gen = genRef.current

    while (q.chunks.length > 0) {
      if (cancelledRef.current || gen !== genRef.current) break
      const chunk = q.chunks.shift()!

      // Prefetch next chunk for API TTS while current plays
      const currentCfg = cfgRef.current
      if (currentCfg && currentCfg.provider !== 'browser' && q.chunks.length > 0 && !prefetchRef.current) {
        const next = q.chunks[0]
        prefetchRef.current = {
          text: next,
          provider: currentCfg.provider,
          promise: synthesizeSpeech({
            text: next,
            provider: currentCfg.provider,
            model: currentCfg.model || 'tts-1',
            voiceId: currentCfg.voiceId || 'nova',
          }),
        }
      }

      try {
        await playChunk(chunk, gen)
      } catch (err) {
        console.error('[voice] TTS playback failed:', err)
        const msg = err instanceof Error ? err.message : 'Speech synthesis failed'
        setTtsError(msg.replace(/^Error:\s*/i, ''))
        q.chunks = []
        q.playing = false
        prefetchRef.current = null
        setSpeaking(false)
        speechMeasurementRef.current?.end(false, 'tts_playback_failed')
        speechMeasurementRef.current = null
        turnMeasurementRef.current?.end(false, 'tts_playback_failed')
        turnMeasurementRef.current = null
        return
      }

      if (cancelledRef.current || gen !== genRef.current) break
    }

    q.playing = false
    prefetchRef.current = null

    if (cancelledRef.current || gen !== genRef.current) return

    setSpeaking(false)
    speechMeasurementRef.current?.mark('playback_completed')
    speechMeasurementRef.current?.end(true)
    speechMeasurementRef.current = null
    if (autoResumeRef.current) {
      turnMeasurementRef.current?.mark('mic_return_requested')
      turnMeasurementRef.current?.end(true)
      turnMeasurementRef.current = null
      startRecognition()
    }
  }, [playChunk, setSpeaking, startRecognition])

  const beginSpeaking = useCallback(() => {
    genRef.current++
    clearSilence()
    cancelledRef.current = false
    emptyAutoResumeCountRef.current = 0
    setTtsError(null)
    stopPlayback()
    stopRecognition()
    prefetchRef.current = null
    queueRef.current = { ...EMPTY_QUEUE }
    setSpeaking(true)
  }, [clearSilence, stopPlayback, stopRecognition, setSpeaking])

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  const startConversation = useCallback(() => {
    setVoiceActive(true)
    autoResumeRef.current = true

    // Always unlock AudioContext within user gesture — needed for API TTS,
    // harmless if browser TTS ends up being used instead
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start()
      ctx.resume()
      audioCtxRef.current = ctx
    } catch {}

    // Also prime browser speechSynthesis for the browser TTS path
    if ('speechSynthesis' in window) {
      const primer = new SpeechSynthesisUtterance('')
      primer.volume = 0
      speechSynthesis.speak(primer)
    }
  }, [])

  const resumeListening = useCallback(() => {
    autoResumeRef.current = true
    setWasInterrupted(false)
    startRecognition()
  }, [startRecognition])

  const speak = useCallback((text: string) => {
    const cleaned = stripMarkdown(text)
    if (!cleaned) return
    beginSpeaking()
    const q = queueRef.current
    const spoken = cleaned.length > LONG_RESPONSE ? truncateForSpeech(cleaned) : cleaned
    q.chunks = chunkText(spoken)
    turnMeasurementRef.current?.mark('response_ready_for_speech')
    speechMeasurementRef.current?.end(false, 'speech_replaced')
    const cfg = cfgRef.current
    speechMeasurementRef.current = startInteraction({
      focus: 'voice',
      flow: 'voice-output',
      interaction: turnMeasurementRef.current ? 'answer_playback' : 'greeting_playback',
      surface: 'dashboard',
      metadata: {
        provider: cfg?.provider ?? 'browser',
        model: cfg?.model ?? null,
        voiceId: cfg?.voiceId ?? (selectedVoiceName || null),
        textLength: spoken.length,
        chunks: q.chunks.length,
        rate: voiceRate,
      },
    })
    speechMeasurementRef.current.mark('speech_queued')
    drain()
  }, [beginSpeaking, drain, selectedVoiceName, voiceRate])

  // ── Reset (shared by cancel + exit) ─────────────────────────────

  const reset = useCallback((keepActive: boolean) => {
    genRef.current++
    cancelledRef.current = true
    autoResumeRef.current = false
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    recognitionRunningRef.current = false
    recognitionStartPendingRef.current = false
    emptyAutoResumeCountRef.current = 0
    clearSilence()
    if (keepActive) stopRecognition()
    else teardownRecognition()
    stopPlayback()
    prefetchRef.current = null
    queueRef.current = { ...EMPTY_QUEUE }
    setSpeaking(false)
    setIsListening(false)
    setTranscript('')
    transcriptRef.current = ''
    recognitionMeasurementRef.current?.end(false, 'voice_interrupted')
    recognitionMeasurementRef.current = null
    speechMeasurementRef.current?.end(false, 'voice_interrupted')
    speechMeasurementRef.current = null
    turnMeasurementRef.current?.end(false, 'voice_interrupted')
    turnMeasurementRef.current = null
    if (!keepActive) { setVoiceActive(false); setWasInterrupted(false) }
  }, [clearSilence, stopRecognition, teardownRecognition, stopPlayback, setSpeaking])

  const cancelSpeech = useCallback(() => {
    reset(true)
    setWasInterrupted(true)
  }, [reset])

  const exitVoiceMode = useCallback(() => {
    reset(false)
  }, [reset])

  // ── Voice preferences ───────────────────────────────────────────

  const setVoice = useCallback((name: string) => {
    setSelectedVoiceName(name)
    try { localStorage.setItem(LS_VOICE_KEY, name) } catch {}
  }, [])

  const setOnSend = useCallback((cb: (text: string) => void) => {
    onSendRef.current = cb
  }, [])

  const updateTtsConfig = useCallback((config: TtsConfig) => {
    cfgRef.current = config
    setEffectiveTtsConfig(config)
  }, [])

  const setRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate))
    setVoiceRate(clamped)
    try { localStorage.setItem(LS_RATE_KEY, String(clamped)) } catch {}
  }, [])

  return {
    voiceActive, isListening, isSpeaking, transcript, ttsError,
    supportsVoice, capabilities, availableVoices, selectedVoiceName, voiceRate,
    wasInterrupted,
    startConversation, resumeListening, speak,
    cancelSpeech, exitVoiceMode, setVoice, setRate, setOnSend, updateTtsConfig,
  }
}
