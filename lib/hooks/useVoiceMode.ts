'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TtsProvider } from '@/lib/orb-model/tts'
import { synthesizeSpeech } from '@/app/actions/orb-tts'
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
  speakStatus: (text: string) => void
  speakStreaming: (text: string, done: boolean) => void
  cancelSpeech: () => void
  exitVoiceMode: () => void
  setVoice: (name: string) => void
  setRate: (rate: number) => void
  setOnSend: (cb: (text: string) => void) => void
  updateTtsConfig: (config: TtsConfig) => void
}

// ── Queue state ─────────────────────────────────────────────────────

type SpeechQueue = {
  chunks: string[]
  playing: boolean
  spokenChars: number
  done: boolean
  autoResume: boolean
}

const EMPTY_QUEUE: SpeechQueue = { chunks: [], playing: false, spokenChars: 0, done: false, autoResume: true }
type SpeechMode = 'full' | 'status' | 'stream'

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
  const autoResumeRef = useRef(false)
  const cancelledRef = useRef(false)
  const genRef = useRef(0)
  const queueRef = useRef<SpeechQueue>({ ...EMPTY_QUEUE })
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const prefetchRef = useRef<{ promise: Promise<{ audioBase64: string; contentType: string }>; provider: string } | null>(null)

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
    let rapidEndCount = 0

    rec.onstart = () => {
      lastStartTime = Date.now()
      rapidEndCount = 0
    }

    rec.onresult = (e: any) => {
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
              onSendRef.current(text)
              transcriptRef.current = ''
              accumulated = ''
              setTranscript('')
            }
            stopRecognition()
          }, SILENCE_MS)
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (interim) debouncedTranscript(accumulated + interim)
    }

    rec.onerror = (e: any) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.error('[voice] recognition error:', e.error)
      }
      setIsListening(false)
    }

    rec.onend = () => {
      setIsListening(false)
      if (capabilities.speech.continuous) return

      // Detect rapid end cycling (recognition starts but immediately ends without audio)
      const elapsed = Date.now() - lastStartTime
      if (elapsed < 500 && !transcriptRef.current.trim()) {
        rapidEndCount++
        if (rapidEndCount >= 3) {
          console.error('[voice] recognition ending immediately — not supported in this browser')
          setTtsError('Voice input is not working in this browser. Try Safari.')
          return
        }
      }

      // iOS: continuous=false, so onend fires after each pause.
      // Reuse the same instance to avoid "Microphone access allowed" toasts.
      if (!autoResumeRef.current || silenceRef.current || speakingRef.current || cancelledRef.current) return
      const text = transcriptRef.current.trim()
      if (text) {
        if (onSendRef.current) {
          onSendRef.current(text)
          transcriptRef.current = ''
          accumulated = ''
          setTranscript('')
        }
        return
      }
      setTimeout(() => {
        if (!autoResumeRef.current || cancelledRef.current || speakingRef.current) return
        try {
          rec.start()
          setIsListening(true)
        } catch (e) {
          console.warn('[voice] iOS auto-resume failed, retrying:', e)
          setTimeout(() => {
            if (!autoResumeRef.current || cancelledRef.current || speakingRef.current) return
            try {
              rec.start()
              setIsListening(true)
            } catch (e2) {
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
    if (!recRef.current) createRecognition()
    if (!recRef.current) {
      console.error('[voice] SpeechRecognition unavailable')
      setTtsError('Voice input is not available in this browser.')
      return
    }
    try {
      recRef.current.start()
      setIsListening(true)
      transcriptRef.current = ''
      setTranscript('')
      cancelledRef.current = false
      setWasInterrupted(false)
    } catch (e) {
      if (isRecognitionAlreadyStarted(e)) {
        setIsListening(true)
        cancelledRef.current = false
        setWasInterrupted(false)
        return
      }
      console.error('[voice] recognition.start() failed:', e)
      setTtsError('Could not start listening. Try again or switch browsers.')
    }
  }, [createRecognition])

  const teardownRecognition = useCallback(() => {
    stopRecognition()
    recRef.current = null
  }, [stopRecognition])

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
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = voiceRate
      const voice = selectedVoiceName && availableVoices.length > 0
        ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
        : null
      if (voice) utterance.voice = voice
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
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
        let result: { audioBase64: string; contentType: string }
        if (prefetchRef.current && prefetchRef.current.provider === cfg.provider) {
          result = await prefetchRef.current.promise
          prefetchRef.current = null
        } else {
          prefetchRef.current = null
          result = await synthesizeSpeech({
            text,
            provider: cfg.provider,
            model: cfg.model || 'tts-1',
            voiceId: cfg.voiceId || 'nova',
          })
        }

        if (cancelledRef.current || gen !== genRef.current) return

        const ctx = audioCtxRef.current
        if (!ctx) throw new Error('Audio output is not ready for API voice playback.')

        const raw = atob(result.audioBase64)
        const arr = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
        const decoded = await ctx.decodeAudioData(arr.buffer.slice(0))
        if (cancelledRef.current || gen !== genRef.current) return

        return new Promise<void>(resolve => {
          const source = ctx.createBufferSource()
          source.buffer = decoded
          source.playbackRate.value = voiceRate
          source.connect(ctx.destination)
          source.onended = () => { activeSourceRef.current = null; resolve() }
          activeSourceRef.current = source
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
        return
      }

      // If more chunks arrived while playing (streaming), keep going
      if (cancelledRef.current || gen !== genRef.current) break
    }

    q.playing = false
    prefetchRef.current = null

    if (cancelledRef.current || gen !== genRef.current) return

    if (q.done && q.chunks.length === 0) {
      q.done = false
      setSpeaking(false)
      if (q.autoResume && autoResumeRef.current) startRecognition()
    }
  }, [playChunk, setSpeaking, startRecognition])

  const beginSpeaking = useCallback(() => {
    clearSilence()
    cancelledRef.current = false
    setTtsError(null)
    stopPlayback()
    stopRecognition()
    setSpeaking(true)
    queueRef.current.spokenChars = 0
  }, [clearSilence, stopPlayback, stopRecognition, setSpeaking])

  const enqueueSpeech = useCallback((mode: SpeechMode, text: string, done: boolean) => {
    if (cancelledRef.current && mode === 'stream') return
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    const q = queueRef.current

    if (mode === 'full') {
      beginSpeaking()
      const spoken = cleaned.length > LONG_RESPONSE ? truncateForSpeech(cleaned) : cleaned
      q.chunks = chunkText(spoken)
      q.spokenChars = 0
      q.done = true
      q.autoResume = true
      drain()
      return
    }

    if (mode === 'status') {
      beginSpeaking()
      const spoken = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned
      q.chunks = [spoken]
      q.spokenChars = 0
      q.done = true
      q.autoResume = false
      drain()
      return
    }

    q.done = done

    // Reliability mode: streamed text can change many times before the final
    // response settles. Speak the final response once so audio matches transcript.
    if (!done) return

    beginSpeaking()
    q.chunks = chunkText(cleaned)
    q.spokenChars = cleaned.length
    q.done = true
    q.autoResume = true
    drain()
    return
  }, [beginSpeaking, drain])

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
    enqueueSpeech('full', text, true)
  }, [enqueueSpeech])

  const speakStatus = useCallback((text: string) => {
    enqueueSpeech('status', text, true)
  }, [enqueueSpeech])

  const speakStreaming = useCallback((text: string, done: boolean) => {
    enqueueSpeech('stream', text, done)
  }, [enqueueSpeech])

  // ── Reset (shared by cancel + exit) ─────────────────────────────

  const reset = useCallback((keepActive: boolean) => {
    genRef.current++
    cancelledRef.current = true
    autoResumeRef.current = false
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
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
    startConversation, resumeListening, speak, speakStatus, speakStreaming,
    cancelSpeech, exitVoiceMode, setVoice, setRate, setOnSend, updateTtsConfig,
  }
}
