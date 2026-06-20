'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

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
const SILENCE_TIMEOUT_MS = 1200
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
  speakBrief: (text: string) => void
  speakStreaming: (text: string, done: boolean) => void
  cancelSpeech: () => void
  exitVoiceMode: () => void
  setVoice: (name: string) => void
  setRate: (rate: number) => void
  setOnSend: (cb: (text: string) => void) => void
}

export function useVoiceMode(): VoiceState & VoiceActions {
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
  const transcriptRef = useRef('')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSendRef = useRef<((text: string) => void) | null>(null)
  const autoResumeRef = useRef(false)
  const cancelledRef = useRef(false)

  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
    setSupportsVoice(!!SpeechRecognitionAPI && hasTTS)

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
  }, [])

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
        // iOS non-continuous mode: auto-restart if we have no pending submission
        if (isIOS() && autoResumeRef.current && !silenceTimerRef.current) {
          const text = transcriptRef.current.trim()
          if (text) {
            // Had speech — submit it
            if (onSendRef.current) {
              onSendRef.current(text)
              transcriptRef.current = ''
              accumulated = ''
              setTranscript('')
            }
          } else {
            // No speech yet — restart recognition
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

  const startConversation = useCallback(() => {
    setVoiceActive(true)
    autoResumeRef.current = true
    // Prime speechSynthesis with a silent utterance so iOS Safari
    // allows non-gesture-initiated speak() calls later
    if ('speechSynthesis' in window) {
      const primer = new SpeechSynthesisUtterance('')
      primer.volume = 0
      speechSynthesis.speak(primer)
    }
    beginRecognition()
  }, [beginRecognition])

  const resumeListening = useCallback(() => {
    autoResumeRef.current = true
    setWasInterrupted(false)
    beginRecognition()
  }, [beginRecognition])

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) { console.log('[voice] speak: no speechSynthesis'); return }

    clearSilenceTimer()
    cancelledRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    const needsCancel = speechSynthesis.speaking || speechSynthesis.pending
    if (needsCancel) {
      speechSynthesis.cancel()
    }

    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    const spokenText = cleaned.length > LONG_RESPONSE_CHARS ? truncateForSpeech(cleaned) : cleaned
    const sentences = splitIntoSentences(spokenText)
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

      utterance.onend = () => {
        currentIndex++
        speakNext()
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
      }

      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    }

    setIsSpeaking(true)
    setIsListening(false)
    // Chrome drops utterances queued immediately after cancel().
    // A short delay lets the engine reset.
    if (needsCancel) {
      setTimeout(speakNext, 80)
    } else {
      speakNext()
    }
  }, [selectedVoiceName, availableVoices, voiceRate, clearSilenceTimer, beginRecognition])

  // Streaming TTS: called repeatedly as text arrives during LLM streaming.
  // Speaks complete sentences as soon as they're available, while the LLM
  // continues generating. When `done` is true, speaks any remaining text.
  const streamSpokenRef = useRef(0)
  const streamSpeakingRef = useRef(false)
  const streamQueueRef = useRef<string[]>([])
  const streamDoneRef = useRef(false)

  const speakStreaming = useCallback((text: string, done: boolean) => {
    if (!('speechSynthesis' in window)) return
    if (cancelledRef.current) return

    const cleaned = stripMarkdown(text)
    if (!cleaned) return

    streamDoneRef.current = done

    // On first call, cancel any brief acknowledgment and set up state
    if (streamSpokenRef.current === 0 && !streamSpeakingRef.current) {
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel()
      }
      clearSilenceTimer()
      cancelledRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
      setIsSpeaking(true)
      setIsListening(false)
    }

    const alreadySpoken = streamSpokenRef.current

    // Apply long-response truncation
    if (cleaned.length > LONG_RESPONSE_CHARS && alreadySpoken === 0) {
      // We'll speak the truncated version and ignore further streaming text
      const truncated = truncateForSpeech(cleaned)
      streamSpokenRef.current = cleaned.length
      streamQueueRef.current = splitIntoSentences(truncated)
      if (!streamSpeakingRef.current) speakFromQueue()
      return
    }
    if (alreadySpoken >= LONG_RESPONSE_CHARS) {
      if (done) finishStreaming()
      return
    }

    const unspoken = cleaned.slice(alreadySpoken)
    const sentenceMatches = unspoken.match(/[^.!?]+[.!?]+[\s]*/g)

    if (sentenceMatches) {
      let consumed = 0
      for (const s of sentenceMatches) {
        consumed += s.length
        streamQueueRef.current.push(s.trim())
      }
      streamSpokenRef.current = alreadySpoken + consumed
      if (!streamSpeakingRef.current) speakFromQueue()
    }

    if (done) {
      // Speak any remaining text that didn't end with punctuation
      const finalUnspoken = cleaned.slice(streamSpokenRef.current).trim()
      if (finalUnspoken) {
        streamQueueRef.current.push(finalUnspoken)
        streamSpokenRef.current = cleaned.length
      }
      if (!streamSpeakingRef.current && streamQueueRef.current.length > 0) {
        speakFromQueue()
      } else if (!streamSpeakingRef.current) {
        finishStreaming()
      }
    }

    function speakFromQueue() {
      if (cancelledRef.current || streamQueueRef.current.length === 0) {
        streamSpeakingRef.current = false
        if (streamDoneRef.current) finishStreaming()
        return
      }

      streamSpeakingRef.current = true
      const chunk = streamQueueRef.current.shift()!
      const selectedVoice = selectedVoiceName && availableVoices.length > 0
        ? availableVoices.find(v => v.name === selectedVoiceName) ?? null
        : null

      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.rate = voiceRate
      if (selectedVoice) utterance.voice = selectedVoice

      utterance.onend = () => {
        speakFromQueue()
      }
      utterance.onerror = () => {
        streamSpeakingRef.current = false
        finishStreaming()
      }

      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    }

    function finishStreaming() {
      streamSpokenRef.current = 0
      streamSpeakingRef.current = false
      streamQueueRef.current = []
      streamDoneRef.current = false
      setIsSpeaking(false)
      if (!cancelledRef.current && autoResumeRef.current) {
        beginRecognition()
      }
    }
  }, [selectedVoiceName, availableVoices, voiceRate, clearSilenceTimer, beginRecognition])

  const speakBrief = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = voiceRate
    if (selectedVoiceName && availableVoices.length > 0) {
      const match = availableVoices.find(v => v.name === selectedVoiceName)
      if (match) utterance.voice = match
    }
    speechSynthesis.speak(utterance)
  }, [selectedVoiceName, availableVoices, voiceRate])

  const cancelSpeech = useCallback(() => {
    autoResumeRef.current = false
    cancelledRef.current = true
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setWasInterrupted(true)
    utteranceRef.current = null
    streamSpokenRef.current = 0
    streamSpeakingRef.current = false
    streamQueueRef.current = []
    streamDoneRef.current = false
  }, [])

  const exitVoiceMode = useCallback(() => {
    clearSilenceTimer()
    autoResumeRef.current = false
    cancelledRef.current = true
    if (transcriptDebounceRef.current) clearTimeout(transcriptDebounceRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    speechSynthesis.cancel()
    setVoiceActive(false)
    setIsListening(false)
    setIsSpeaking(false)
    setWasInterrupted(false)
    transcriptRef.current = ''
    setTranscript('')
    utteranceRef.current = null
    streamSpokenRef.current = 0
    streamSpeakingRef.current = false
    streamQueueRef.current = []
    streamDoneRef.current = false
  }, [clearSilenceTimer])

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
    startConversation, resumeListening, speak, speakBrief, speakStreaming,
    cancelSpeech, exitVoiceMode, setVoice, setRate, setOnSend,
  }
}
