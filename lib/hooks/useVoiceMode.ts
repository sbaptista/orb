'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TtsProvider } from '@/lib/orb-model/tts'
import { synthesizeSpeech } from '@/app/actions/orb-tts'

export type TtsConfig = {
  provider: TtsProvider
  model: string | null
  voiceId: string | null
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

function splitIntoSentences(text: string): string[] {
  const chunks = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!chunks) return [text]
  const result: string[] = []
  let current = ''
  for (const chunk of chunks) {
    if ((current + chunk).length > 200 && current) {
      result.push(current.trim())
      current = chunk
    } else {
      current += chunk
    }
  }
  if (current.trim()) result.push(current.trim())
  return result
}

const LONG_RESPONSE_CHARS = 500
const MAX_TTS_CHUNK_CHARS = 240

function splitLongSpeechChunk(text: string): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []
  if (cleaned.length <= MAX_TTS_CHUNK_CHARS) return [cleaned]

  const chunks: string[] = []
  const pieces = cleaned.split(/(?<=[,;:—–])\s+|\n+/)
  let current = ''

  for (const piece of pieces) {
    const part = piece.trim()
    if (!part) continue

    if (part.length > MAX_TTS_CHUNK_CHARS) {
      if (current) {
        chunks.push(current)
        current = ''
      }

      let wordChunk = ''
      for (const word of part.split(/\s+/)) {
        const next = wordChunk ? `${wordChunk} ${word}` : word
        if (next.length > MAX_TTS_CHUNK_CHARS && wordChunk) {
          chunks.push(wordChunk)
          wordChunk = word
        } else {
          wordChunk = next
        }
      }
      if (wordChunk) chunks.push(wordChunk)
      continue
    }

    const next = current ? `${current} ${part}` : part
    if (next.length > MAX_TTS_CHUNK_CHARS && current) {
      chunks.push(current)
      current = part
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function splitIntoSpeechChunks(text: string): string[] {
  return splitIntoSentences(text).flatMap(splitLongSpeechChunk)
}

function truncateForSpeech(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return text
  let result = ''
  for (const s of sentences) {
    if ((result + s).length > LONG_RESPONSE_CHARS) break
    result += s
  }
  return (result.trim() || sentences[0].trim()) + ' Check the transcript for the full details.'
}

const LS_VOICE_KEY = 'orb_preferred_voice'
const LS_RATE_KEY = 'orb_voice_rate'
const SILENCE_TIMEOUT_MS = 2000
const TRANSCRIPT_DEBOUNCE_MS = 150

const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

export type VoiceState = {
  voiceActive: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string
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

export function useVoiceMode(ttsConfig?: TtsConfig): VoiceState & VoiceActions {
  const ttsConfigRef = useRef(ttsConfig)
  ttsConfigRef.current = ttsConfig

  const [voiceActive, setVoiceActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState('')
  const [voiceRate, setVoiceRate] = useState(1.0)
  const [wasInterrupted, setWasInterrupted] = useState(false)

  const recognitionRef = useRef<any>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeAudiosRef = useRef<Set<HTMLAudioElement>>(new Set())
  const transcriptRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSendRef = useRef<((text: string) => void) | null>(null)
  const autoResumeRef = useRef(false)
  const cancelledRef = useRef(false)
  const speechGenerationRef = useRef(0)

  const stopAudioElement = useCallback((audio: HTMLAudioElement) => {
    try { audio.pause() } catch {}
    audio.onended = null
    audio.onerror = null
    try {
      audio.removeAttribute('src')
      audio.load()
    } catch {}
  }, [])

  const stopAllPlayback = useCallback(() => {
    activeAudiosRef.current.forEach(stopAudioElement)
    activeAudiosRef.current.clear()
    if (audioRef.current) {
      stopAudioElement(audioRef.current)
      audioRef.current = null
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    utteranceRef.current = null
  }, [stopAudioElement])

  const isApiTts = useCallback(() => {
    const cfg = ttsConfigRef.current
    return !!(cfg && cfg.provider !== 'browser')
  }, [])

  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
    setSupportsVoice(!!SpeechRecognitionAPI && (hasTTS || isApiTts()))

    if (hasTTS) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices()
        if (voices.length > 0) setAvailableVoices(voices)
      }
      loadVoices()
      speechSynthesis.onvoiceschanged = loadVoices
    }

    try {
      const saved = localStorage.getItem(LS_VOICE_KEY)
      if (saved) setSelectedVoiceName(saved)
      const savedRate = localStorage.getItem(LS_RATE_KEY)
      if (savedRate) setVoiceRate(parseFloat(savedRate) || 1.0)
    } catch {}
  }, [isApiTts])

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const debouncedSetTranscript = useCallback((text: string) => {
    if (transcriptDebounceRef.current) clearTimeout(transcriptDebounceRef.current)
    transcriptDebounceRef.current = setTimeout(() => setTranscript(text), TRANSCRIPT_DEBOUNCE_MS)
  }, [])

  // ── Recognition (shared by both TTS paths) ──────────────────────────

  const beginRecognition = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = !isIOS()
      recognition.interimResults = true
      recognition.lang = 'en-US'

      let accumulated = ''
      let interim = ''

      recognition.onresult = (event: any) => {
        interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            accumulated += event.results[i][0].transcript
            transcriptRef.current = accumulated
            debouncedSetTranscript(accumulated)

            clearSilenceTimer()
            silenceTimerRef.current = setTimeout(() => {
              const text = transcriptRef.current.trim()
              if (text && onSendRef.current) {
                onSendRef.current(text)
                transcriptRef.current = ''
                accumulated = ''
                setTranscript('')
              }
              if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch {}
                recognitionRef.current = null
              }
            }, SILENCE_TIMEOUT_MS)
          } else {
            interim += event.results[i][0].transcript
          }
        }
        if (interim) {
          debouncedSetTranscript(accumulated + interim)
        }
      }

      recognition.onerror = (e: any) => {
        if (e.error !== 'aborted' && e.error !== 'no-speech') {
          console.error('[voice] recognition error:', e.error)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        if (isIOS() && autoResumeRef.current && !silenceTimerRef.current) {
          const text = transcriptRef.current.trim()
          if (text) {
            if (onSendRef.current) {
              onSendRef.current(text)
              transcriptRef.current = ''
              accumulated = ''
              setTranscript('')
            }
          } else {
            setTimeout(() => {
              if (autoResumeRef.current && !cancelledRef.current) {
                beginRecognition()
              }
            }, 100)
          }
        }
      }

      recognitionRef.current = recognition
      transcriptRef.current = ''
      setTranscript('')
      cancelledRef.current = false
      recognition.start()
      setIsListening(true)
      setWasInterrupted(false)
    } catch (err) {
      console.error('[voice] start failed:', err)
      setIsListening(false)
    }
  }, [clearSilenceTimer, debouncedSetTranscript])

  // ── API TTS (OpenAI, ElevenLabs, any non-browser provider) ──────────

  const apiSpeakChunk = useCallback(async (text: string, onDone: () => void) => {
    const cfg = ttsConfigRef.current
    if (!cfg || cfg.provider === 'browser') { onDone(); return }
    const generation = speechGenerationRef.current

    try {
      const result = await synthesizeSpeech({
        text,
        provider: cfg.provider,
        model: cfg.model || 'tts-1',
        voiceId: cfg.voiceId || 'nova',
      })

      if (cancelledRef.current || generation !== speechGenerationRef.current) return

      const audio = new Audio(`data:${result.contentType};base64,${result.audioBase64}`)
      audioRef.current = audio
      activeAudiosRef.current.add(audio)
      audio.playbackRate = voiceRate
      const finish = () => {
        audioRef.current = null
        activeAudiosRef.current.delete(audio)
        if (!cancelledRef.current && generation === speechGenerationRef.current) onDone()
      }
      audio.onended = finish
      audio.onerror = finish
      await audio.play()
    } catch (err) {
      console.error('[voice] API TTS failed:', err)
      if (!cancelledRef.current && generation === speechGenerationRef.current) onDone()
    }
  }, [voiceRate])

  const apiStreamQueueRef = useRef<string[]>([])
  const apiStreamPlayingRef = useRef(false)
  const apiStreamDoneRef = useRef(false)
  const apiStreamSpokenRef = useRef(0)

  const apiDrainQueue = useCallback(() => {
    if (cancelledRef.current || apiStreamQueueRef.current.length === 0) {
      apiStreamPlayingRef.current = false
      if (apiStreamDoneRef.current) {
        apiStreamSpokenRef.current = 0
        apiStreamDoneRef.current = false
        setIsSpeaking(false)
        if (!cancelledRef.current && autoResumeRef.current) {
          beginRecognition()
        }
      }
      return
    }

    apiStreamPlayingRef.current = true
    const chunk = apiStreamQueueRef.current.shift()!
    apiSpeakChunk(chunk, () => apiDrainQueue())
  }, [apiSpeakChunk, beginRecognition])

  // ── Browser TTS (speechSynthesis) ───────────────────────────────────

  const browserSpeak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return

    const needsCancel = speechSynthesis.speaking || speechSynthesis.pending
    if (needsCancel) speechSynthesis.cancel()

    const sentences = splitIntoSentences(text)
    let currentIndex = 0

    const selectedVoice = selectedVoiceName && availableVoices.length > 0
      ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
      : null

    function speakNext() {
      if (cancelledRef.current || currentIndex >= sentences.length) {
        setIsSpeaking(false)
        if (!cancelledRef.current && autoResumeRef.current) {
          beginRecognition()
        }
        return
      }

      const utterance = new SpeechSynthesisUtterance(sentences[currentIndex])
      utterance.rate = voiceRate
      if (selectedVoice) utterance.voice = selectedVoice
      utterance.onend = () => { currentIndex++; speakNext() }
      utterance.onerror = () => setIsSpeaking(false)
      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    }

    if (needsCancel) {
      setTimeout(speakNext, 80)
    } else {
      speakNext()
    }
  }, [selectedVoiceName, availableVoices, voiceRate, beginRecognition])

  const browserSpeakStatus = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return

    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()

    const selectedVoice = selectedVoiceName && availableVoices.length > 0
      ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
      : null

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = voiceRate
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
  }, [selectedVoiceName, availableVoices, voiceRate])

  const browserStreamSpokenRef = useRef(0)
  const browserStreamSpeakingRef = useRef(false)
  const browserStreamQueueRef = useRef<string[]>([])
  const browserStreamDoneRef = useRef(false)

  const browserSpeakStreaming = useCallback((text: string, done: boolean) => {
    if (!('speechSynthesis' in window)) return
    if (cancelledRef.current) return

    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    browserStreamDoneRef.current = done

    if (browserStreamSpokenRef.current === 0 && !browserStreamSpeakingRef.current) {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
      clearSilenceTimer()
      cancelledRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
      setIsSpeaking(true)
      setIsListening(false)
    }

    const alreadySpoken = browserStreamSpokenRef.current

    if (cleaned.length > LONG_RESPONSE_CHARS && alreadySpoken === 0) {
      const truncated = truncateForSpeech(cleaned)
      browserStreamSpokenRef.current = cleaned.length
      browserStreamQueueRef.current = splitIntoSentences(truncated)
      if (!browserStreamSpeakingRef.current) browserDrainQueue()
      return
    }
    if (alreadySpoken >= LONG_RESPONSE_CHARS) {
      if (done) browserFinishStreaming()
      return
    }

    const unspoken = cleaned.slice(alreadySpoken)
    const sentenceMatches = unspoken.match(/[^.!?]+[.!?]+[\s]*/g)

    if (sentenceMatches) {
      let consumed = 0
      for (const s of sentenceMatches) {
        consumed += s.length
        browserStreamQueueRef.current.push(s.trim())
      }
      browserStreamSpokenRef.current = alreadySpoken + consumed
      if (!browserStreamSpeakingRef.current) browserDrainQueue()
    }

    if (done) {
      const finalUnspoken = cleaned.slice(browserStreamSpokenRef.current).trim()
      if (finalUnspoken) {
        browserStreamQueueRef.current.push(finalUnspoken)
        browserStreamSpokenRef.current = cleaned.length
      }
      if (!browserStreamSpeakingRef.current && browserStreamQueueRef.current.length > 0) {
        browserDrainQueue()
      } else if (!browserStreamSpeakingRef.current) {
        browserFinishStreaming()
      }
    }

    function browserDrainQueue() {
      if (cancelledRef.current || browserStreamQueueRef.current.length === 0) {
        browserStreamSpeakingRef.current = false
        if (browserStreamDoneRef.current) browserFinishStreaming()
        return
      }

      browserStreamSpeakingRef.current = true
      const chunk = browserStreamQueueRef.current.shift()!
      const selectedVoice = selectedVoiceName && availableVoices.length > 0
        ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
        : null

      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.rate = voiceRate
      if (selectedVoice) utterance.voice = selectedVoice
      utterance.onend = () => browserDrainQueue()
      utterance.onerror = () => { browserStreamSpeakingRef.current = false; browserFinishStreaming() }
      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    }

    function browserFinishStreaming() {
      browserStreamSpokenRef.current = 0
      browserStreamSpeakingRef.current = false
      browserStreamQueueRef.current = []
      browserStreamDoneRef.current = false
      setIsSpeaking(false)
      if (!cancelledRef.current && autoResumeRef.current) {
        beginRecognition()
      }
    }
  }, [selectedVoiceName, availableVoices, voiceRate, clearSilenceTimer, beginRecognition])

  // ── Public API (delegates to the active TTS path) ───────────────────

  const startConversation = useCallback(() => {
    setVoiceActive(true)
    autoResumeRef.current = true

    if (!isApiTts()) {
      // Browser TTS only: prime speechSynthesis within user gesture
      if ('speechSynthesis' in window) {
        const primer = new SpeechSynthesisUtterance('')
        primer.volume = 0
        speechSynthesis.speak(primer)
      }
    }

    beginRecognition()
  }, [beginRecognition, isApiTts])

  const resumeListening = useCallback(() => {
    autoResumeRef.current = true
    setWasInterrupted(false)
    beginRecognition()
  }, [beginRecognition])

  const speak = useCallback((text: string) => {
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    clearSilenceTimer()
    cancelledRef.current = false
    stopAllPlayback()
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsSpeaking(true)
    setIsListening(false)

    const spokenText = cleaned.length > LONG_RESPONSE_CHARS ? truncateForSpeech(cleaned) : cleaned

    if (isApiTts()) {
      apiSpeakChunk(spokenText, () => {
        setIsSpeaking(false)
        if (!cancelledRef.current && autoResumeRef.current) beginRecognition()
      })
    } else {
      browserSpeak(spokenText)
    }
  }, [clearSilenceTimer, stopAllPlayback, isApiTts, apiSpeakChunk, browserSpeak, beginRecognition])

  const speakStatus = useCallback((text: string) => {
    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    clearSilenceTimer()
    cancelledRef.current = false
    stopAllPlayback()
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsSpeaking(true)
    setIsListening(false)

    const spokenText = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned

    if (isApiTts()) {
      apiSpeakChunk(spokenText, () => {
        setIsSpeaking(false)
      })
    } else {
      browserSpeakStatus(spokenText)
    }
  }, [clearSilenceTimer, stopAllPlayback, isApiTts, apiSpeakChunk, browserSpeakStatus])

  const speakStreaming = useCallback((text: string, done: boolean) => {
    if (cancelledRef.current) return

    if (isApiTts()) {
      const cleaned = stripMarkdown(text)
      if (!cleaned) return

      apiStreamDoneRef.current = done

      if (apiStreamSpokenRef.current === 0 && !apiStreamPlayingRef.current) {
        clearSilenceTimer()
        cancelledRef.current = false
        stopAllPlayback()
        if (recognitionRef.current) {
          try { recognitionRef.current.stop() } catch {}
          recognitionRef.current = null
        }
        setIsSpeaking(true)
        setIsListening(false)
      }

      const alreadySpoken = apiStreamSpokenRef.current

      if (cleaned.length > LONG_RESPONSE_CHARS && alreadySpoken === 0) {
        const truncated = truncateForSpeech(cleaned)
        apiStreamSpokenRef.current = cleaned.length
        apiStreamQueueRef.current = splitIntoSpeechChunks(truncated)
        if (!apiStreamPlayingRef.current) apiDrainQueue()
        return
      }
      if (alreadySpoken >= LONG_RESPONSE_CHARS) {
        if (done) {
          apiStreamSpokenRef.current = 0
          apiStreamDoneRef.current = false
          if (!apiStreamPlayingRef.current) {
            setIsSpeaking(false)
            if (!cancelledRef.current && autoResumeRef.current) beginRecognition()
          }
        }
        return
      }

      const unspoken = cleaned.slice(alreadySpoken)
      const sentenceMatches = unspoken.match(/[^.!?]+[.!?]+[\s]*/g)

      if (sentenceMatches) {
        let consumed = 0
        for (const s of sentenceMatches) {
          consumed += s.length
          apiStreamQueueRef.current.push(...splitIntoSpeechChunks(s.trim()))
        }
        apiStreamSpokenRef.current = alreadySpoken + consumed
        if (!apiStreamPlayingRef.current) apiDrainQueue()
      } else if (alreadySpoken === 0 && unspoken.split(/\s+/).length >= 8) {
        const clauseMatch = unspoken.match(/^.+?[,;:—–]\s*/)?.[0]
        if (clauseMatch) {
          apiStreamQueueRef.current.push(...splitIntoSpeechChunks(clauseMatch.trim()))
          apiStreamSpokenRef.current = alreadySpoken + clauseMatch.length
          if (!apiStreamPlayingRef.current) apiDrainQueue()
        }
      }

      if (done) {
        const finalUnspoken = cleaned.slice(apiStreamSpokenRef.current).trim()
        if (finalUnspoken) {
          apiStreamQueueRef.current.push(...splitIntoSpeechChunks(finalUnspoken))
          apiStreamSpokenRef.current = cleaned.length
        }
        if (!apiStreamPlayingRef.current && apiStreamQueueRef.current.length > 0) {
          apiDrainQueue()
        } else if (!apiStreamPlayingRef.current) {
          apiStreamSpokenRef.current = 0
          apiStreamDoneRef.current = false
          setIsSpeaking(false)
          if (!cancelledRef.current && autoResumeRef.current) beginRecognition()
        }
      }
    } else {
      browserSpeakStreaming(text, done)
    }
  }, [isApiTts, clearSilenceTimer, stopAllPlayback, apiDrainQueue, browserSpeakStreaming, beginRecognition])

  const cancelSpeech = useCallback(() => {
    clearSilenceTimer()
    speechGenerationRef.current += 1
    autoResumeRef.current = false
    cancelledRef.current = true
    if (transcriptDebounceRef.current) {
      clearTimeout(transcriptDebounceRef.current)
      transcriptDebounceRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    stopAllPlayback()
    setIsListening(false)
    setIsSpeaking(false)
    setWasInterrupted(true)
    transcriptRef.current = ''
    setTranscript('')
    utteranceRef.current = null
    apiStreamSpokenRef.current = 0
    apiStreamPlayingRef.current = false
    apiStreamQueueRef.current = []
    apiStreamDoneRef.current = false
    browserStreamSpokenRef.current = 0
    browserStreamSpeakingRef.current = false
    browserStreamQueueRef.current = []
    browserStreamDoneRef.current = false
  }, [clearSilenceTimer, stopAllPlayback])

  const exitVoiceMode = useCallback(() => {
    clearSilenceTimer()
    speechGenerationRef.current += 1
    autoResumeRef.current = false
    cancelledRef.current = true
    if (transcriptDebounceRef.current) clearTimeout(transcriptDebounceRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    stopAllPlayback()
    setVoiceActive(false)
    setIsListening(false)
    setIsSpeaking(false)
    setWasInterrupted(false)
    transcriptRef.current = ''
    setTranscript('')
    utteranceRef.current = null
    apiStreamSpokenRef.current = 0
    apiStreamPlayingRef.current = false
    apiStreamQueueRef.current = []
    apiStreamDoneRef.current = false
    browserStreamSpokenRef.current = 0
    browserStreamSpeakingRef.current = false
    browserStreamQueueRef.current = []
    browserStreamDoneRef.current = false
  }, [clearSilenceTimer, stopAllPlayback])

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
    voiceActive, isListening, isSpeaking, transcript,
    supportsVoice, availableVoices, selectedVoiceName, voiceRate,
    wasInterrupted,
    startConversation, resumeListening, speak, speakStatus, speakStreaming,
    cancelSpeech, exitVoiceMode, setVoice, setRate, setOnSend,
  }
}
