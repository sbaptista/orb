'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TtsProvider } from '@/lib/orb-model/tts'
import { synthesizeSpeech } from '@/app/actions/orb-tts'

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

// ── Constants ───────────────────────────────────────────────────────

const LS_VOICE_KEY = 'orb_preferred_voice'
const LS_RATE_KEY = 'orb_voice_rate'
const SILENCE_MS = 2000
const TRANSCRIPT_DEBOUNCE_MS = 150

const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

// ── Types ───────────────────────────────────────────────────────────

export type VoiceState = {
  voiceActive: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  ttsError: string | null
  supportsVoice: boolean
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

// ── Hook ────────────────────────────────────────────────────────────

export function useVoiceMode(ttsConfig?: TtsConfig): VoiceState & VoiceActions {
  const cfgRef = useRef(ttsConfig)
  cfgRef.current = ttsConfig

  // ── State ───────────────────────────────────────────────────────
  const [voiceActive, setVoiceActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, _setIsSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const setSpeaking = useCallback((v: boolean) => { speakingRef.current = v; _setIsSpeaking(v) }, [])
  const [transcript, setTranscript] = useState('')
  const [supportsVoice, setSupportsVoice] = useState(false)
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
  const prefetchRef = useRef<Promise<{ audioBase64: string; contentType: string }> | null>(null)

  const isApi = useCallback(() => {
    const c = cfgRef.current
    return !!(c && c.provider !== 'browser')
  }, [])

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const hasTTS = 'speechSynthesis' in window
    setSupportsVoice(!!SR && (hasTTS || isApi()))

    if (hasTTS) {
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
  }, [isApi])

  // ── Timers ──────────────────────────────────────────────────────
  const clearSilence = useCallback(() => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
  }, [])

  const debouncedTranscript = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setTranscript(text), TRANSCRIPT_DEBOUNCE_MS)
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: Recognition — single instance per session
  // ═══════════════════════════════════════════════════════════════

  const createRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = !isIOS()
    rec.interimResults = true
    rec.lang = 'en-US'

    let accumulated = ''

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
      if (!isIOS()) return

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
        if (autoResumeRef.current && !cancelledRef.current && !speakingRef.current) {
          try { rec.start(); setIsListening(true) } catch {}
        }
      }, 800)
    }

    recRef.current = rec
  }, [clearSilence, debouncedTranscript])

  const startRecognition = useCallback(() => {
    if (!recRef.current) createRecognition()
    if (!recRef.current) return
    try {
      recRef.current.start()
      setIsListening(true)
      transcriptRef.current = ''
      setTranscript('')
      cancelledRef.current = false
      setWasInterrupted(false)
    } catch {}
  }, [createRecognition])

  const stopRecognition = useCallback(() => {
    if (recRef.current) try { recRef.current.stop() } catch {}
    setIsListening(false)
  }, [])

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

  const playChunk = useCallback((text: string, gen: number): Promise<void> => {
    if (cancelledRef.current || gen !== genRef.current) return Promise.resolve()

    const cfg = cfgRef.current
    if (cfg && cfg.provider !== 'browser') {
      // API TTS path
      return (async () => {
        // Use prefetched result if available
        let result: { audioBase64: string; contentType: string }
        if (prefetchRef.current) {
          result = await prefetchRef.current
          prefetchRef.current = null
        } else {
          result = await synthesizeSpeech({
            text,
            provider: cfg.provider,
            model: cfg.model || 'tts-1',
            voiceId: cfg.voiceId || 'nova',
          })
        }

        if (cancelledRef.current || gen !== genRef.current) return

        const ctx = audioCtxRef.current
        if (!ctx) return

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
      })()
    }

    // Browser TTS path
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
      if (cfgRef.current && cfgRef.current.provider !== 'browser' && q.chunks.length > 0 && !prefetchRef.current) {
        const next = q.chunks[0]
        prefetchRef.current = synthesizeSpeech({
          text: next,
          provider: cfgRef.current.provider,
          model: cfgRef.current.model || 'tts-1',
          voiceId: cfgRef.current.voiceId || 'nova',
        }).catch(() => null as any)
      }

      try {
        await playChunk(chunk, gen)
      } catch (err) {
        console.error('[voice] TTS playback failed:', err)
        const msg = err instanceof Error ? err.message : 'Speech synthesis failed'
        setTtsError(msg.replace(/^Error:\s*/i, ''))
        q.chunks = []
        break
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

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  const startConversation = useCallback(() => {
    setVoiceActive(true)
    autoResumeRef.current = true

    if (isApi()) {
      // Unlock AudioContext within user gesture — stays unlocked for the session
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
    } else {
      if ('speechSynthesis' in window) {
        const primer = new SpeechSynthesisUtterance('')
        primer.volume = 0
        speechSynthesis.speak(primer)
      }
    }
  }, [isApi])

  const resumeListening = useCallback(() => {
    autoResumeRef.current = true
    setWasInterrupted(false)
    startRecognition()
  }, [startRecognition])

  const speak = useCallback((text: string) => {
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    beginSpeaking()
    const spoken = cleaned.length > LONG_RESPONSE ? truncateForSpeech(cleaned) : cleaned
    const q = queueRef.current
    q.chunks = chunkText(spoken)
    q.spokenChars = 0
    q.done = true
    q.autoResume = true
    drain()
  }, [beginSpeaking, drain])

  const speakStatus = useCallback((text: string) => {
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    beginSpeaking()
    const spoken = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned
    const q = queueRef.current
    q.chunks = [spoken]
    q.spokenChars = 0
    q.done = true
    q.autoResume = false
    drain()
  }, [beginSpeaking, drain])

  const speakStreaming = useCallback((text: string, done: boolean) => {
    if (cancelledRef.current) return
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    const q = queueRef.current
    q.done = done

    // First call — set up state
    if (q.spokenChars === 0 && !q.playing) {
      beginSpeaking()
      q.autoResume = true
    }

    const already = q.spokenChars

    // Long response truncation
    if (cleaned.length > LONG_RESPONSE && already === 0) {
      const truncated = truncateForSpeech(cleaned)
      q.spokenChars = cleaned.length
      q.chunks.push(...chunkText(truncated))
      if (!q.playing) drain()
      return
    }
    if (already >= LONG_RESPONSE) {
      if (done && !q.playing) drain()
      return
    }

    // Extract new complete sentences
    const unspoken = cleaned.slice(already)
    const sentences = unspoken.match(/[^.!?]+[.!?]+[\s]*/g)

    if (sentences) {
      let consumed = 0
      for (const s of sentences) {
        consumed += s.length
        q.chunks.push(...chunkText(s.trim()))
      }
      q.spokenChars = already + consumed
      if (!q.playing) drain()
    } else if (already === 0 && unspoken.split(/\s+/).length >= 8) {
      // Early clause trigger for faster first speech
      const clause = unspoken.match(/^.+?[,;:—–]\s*/)?.[0]
      if (clause) {
        q.chunks.push(...chunkText(clause.trim()))
        q.spokenChars = already + clause.length
        if (!q.playing) drain()
      }
    }

    if (done) {
      const remaining = cleaned.slice(q.spokenChars).trim()
      if (remaining) {
        q.chunks.push(...chunkText(remaining))
        q.spokenChars = cleaned.length
      }
      if (!q.playing) drain()
    }
  }, [beginSpeaking, drain])

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
  }, [clearSilence, teardownRecognition, stopPlayback, setSpeaking])

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

  const setRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate))
    setVoiceRate(clamped)
    try { localStorage.setItem(LS_RATE_KEY, String(clamped)) } catch {}
  }, [])

  return {
    voiceActive, isListening, isSpeaking, transcript, ttsError,
    supportsVoice, availableVoices, selectedVoiceName, voiceRate,
    wasInterrupted,
    startConversation, resumeListening, speak, speakStatus, speakStreaming,
    cancelSpeech, exitVoiceMode, setVoice, setRate, setOnSend,
  }
}
