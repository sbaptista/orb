'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// Minimal voice prototype: STT → Anthropic → TTS, nothing else.
// No React hooks, no shared state, no voice bar, no Orb. Just raw Web Speech API.

export default function VoicePrototypePage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [log, setLog] = useState<string[]>([])
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 })
    setLog(prev => [...prev, `${ts} — ${msg}`])
  }, [])

  // ── Step 1: Start listening ──
  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      addLog('ERROR: SpeechRecognition not supported')
      return
    }

    // Prime TTS with a user-gesture utterance
    if ('speechSynthesis' in window) {
      const primer = new SpeechSynthesisUtterance('.')
      primer.volume = 0.01
      speechSynthesis.speak(primer)
      addLog('TTS primed with user gesture')
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let accumulated = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          accumulated += event.results[i][0].transcript
          setTranscript(accumulated)
          addLog(`Final: "${event.results[i][0].transcript.trim()}"`)

          // Reset silence timer on each final result
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            addLog(`Silence timeout — submitting: "${accumulated.trim()}"`)
            recognition.stop()
            recognitionRef.current = null
            submitToOrb(accumulated.trim())
            accumulated = ''
          }, 1500)
        } else {
          interim += event.results[i][0].transcript
        }
      }
      if (interim) setTranscript(accumulated + interim)
    }

    recognition.onerror = (e: any) => {
      addLog(`Recognition error: ${e.error}`)
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setStatus('idle')
      }
    }

    recognition.onend = () => {
      addLog('Recognition ended')
    }

    recognitionRef.current = recognition
    recognition.start()
    setStatus('listening')
    setTranscript('')
    setResponse('')
    addLog('Listening started')
  }, [addLog])

  // ── Step 2: Send to Orb API ──
  const submitToOrb = useCallback(async (text: string) => {
    if (!text) { setStatus('idle'); return }
    setStatus('thinking')
    addLog(`Sending to API: "${text}"`)

    try {
      const res = await fetch('/api/orb-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          history: [],
        }),
      })
      const data = await res.json()
      const speech = data.speech || data.text || 'No response'
      setResponse(speech)
      addLog(`API response (${speech.length} chars): "${speech.slice(0, 80)}..."`)
      speakResponse(speech)
    } catch (err: any) {
      addLog(`API error: ${err.message}`)
      setStatus('idle')
    }
  }, [addLog])

  // ── Step 3: Speak the response ──
  const speakResponse = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      addLog('ERROR: speechSynthesis not supported')
      setStatus('idle')
      return
    }

    // Clean markdown
    const cleaned = text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/`([^`]+)`/g, '$1')
      .trim()

    if (!cleaned) {
      addLog('Cleaned text is empty, skipping TTS')
      setStatus('idle')
      return
    }

    addLog(`TTS: speaking "${cleaned.slice(0, 60)}..."`)
    addLog(`TTS state before: speaking=${speechSynthesis.speaking}, pending=${speechSynthesis.pending}, paused=${speechSynthesis.paused}`)

    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.rate = 1.0

    utterance.onstart = () => {
      addLog('TTS: utterance started playing')
    }
    utterance.onend = () => {
      addLog('TTS: utterance finished')
      setStatus('idle')
    }
    utterance.onerror = (e) => {
      addLog(`TTS ERROR: ${e.error}`)
      setStatus('idle')
    }

    setStatus('speaking')
    speechSynthesis.speak(utterance)
    addLog(`TTS: utterance queued. speaking=${speechSynthesis.speaking}, pending=${speechSynthesis.pending}`)
  }, [addLog])

  // ── Stop everything ──
  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    speechSynthesis.cancel()
    setStatus('idle')
    addLog('Stopped everything')
  }, [addLog])

  // Preload voices on mount
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  useEffect(() => {
    const load = () => {
      const v = speechSynthesis.getVoices()
      if (v.length > 0) {
        setVoicesLoaded(true)
        addLog(`Voices loaded on mount: ${v.length}`)
      }
    }
    load()
    speechSynthesis.onvoiceschanged = () => {
      load()
      addLog('voiceschanged event fired')
    }
  }, [addLog])

  // ── Manual TTS test (no API, just speak fixed text) ──
  const testTTS = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      addLog('ERROR: speechSynthesis not supported')
      return
    }

    const voices = speechSynthesis.getVoices()
    addLog(`Voices available: ${voices.length}`)
    if (voices.length > 0) {
      addLog(`First 5: ${voices.slice(0, 5).map(v => `${v.name} (${v.lang})`).join(', ')}`)
      addLog(`Default: ${voices.find(v => v.default)?.name || 'none'}`)
    }
    addLog(`speechSynthesis state: speaking=${speechSynthesis.speaking}, pending=${speechSynthesis.pending}, paused=${speechSynthesis.paused}`)

    speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance('Hello, this is the Orb speaking. Can you hear me?')
    utterance.rate = 1.0
    if (voices.length > 0) {
      const defaultVoice = voices.find(v => v.default) || voices[0]
      utterance.voice = defaultVoice
      addLog(`Using voice: ${defaultVoice.name}`)
    }
    utterance.onstart = () => addLog('Test TTS: started')
    utterance.onend = () => { addLog('Test TTS: ended'); setStatus('idle') }
    utterance.onerror = (e) => addLog(`Test TTS ERROR: ${e.error}`)
    setStatus('speaking')
    speechSynthesis.speak(utterance)
    addLog(`After speak(): speaking=${speechSynthesis.speaking}, pending=${speechSynthesis.pending}`)
  }, [addLog])

  const statusColors: Record<string, string> = {
    idle: '#888',
    listening: '#00b894',
    thinking: '#fdcb6e',
    speaking: '#6c5ce7',
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: '-apple-system, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Voice Prototype</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Minimal STT → API → TTS. No hooks, no voice bar, no Orb.</p>

      {/* Status */}
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#1a1a2e',
        color: statusColors[status],
        fontSize: 18,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
        textAlign: 'center',
      }}>
        {status}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={startListening}
          disabled={status !== 'idle'}
          style={{
            flex: 1, padding: '12px', fontSize: 16, borderRadius: 8,
            border: 'none', background: status === 'idle' ? '#00b894' : '#444',
            color: '#fff', cursor: status === 'idle' ? 'pointer' : 'not-allowed',
          }}
        >
          Start Voice
        </button>
        <button
          onClick={testTTS}
          disabled={status !== 'idle'}
          style={{
            flex: 1, padding: '12px', fontSize: 16, borderRadius: 8,
            border: 'none', background: status === 'idle' ? '#6c5ce7' : '#444',
            color: '#fff', cursor: status === 'idle' ? 'pointer' : 'not-allowed',
          }}
        >
          Test TTS Only
        </button>
        <button
          onClick={stop}
          style={{
            flex: 1, padding: '12px', fontSize: 16, borderRadius: 8,
            border: 'none', background: '#d63031', color: '#fff', cursor: 'pointer',
          }}
        >
          Stop
        </button>
      </div>

      {/* Transcript */}
      {transcript && (
        <div style={{ padding: 12, borderRadius: 8, background: '#0a2e1a', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#00b894', marginBottom: 4, textTransform: 'uppercase' }}>You said</div>
          <div style={{ fontSize: 16, color: '#e0e0e0' }}>{transcript}</div>
        </div>
      )}

      {/* Response */}
      {response && (
        <div style={{ padding: 12, borderRadius: 8, background: '#1a1a3e', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6c5ce7', marginBottom: 4, textTransform: 'uppercase' }}>Orb said</div>
          <div style={{ fontSize: 16, color: '#e0e0e0' }}>{response}</div>
        </div>
      )}

      {/* Log */}
      <div style={{
        padding: 12, borderRadius: 8, background: '#111',
        maxHeight: 300, overflow: 'auto', fontSize: 12, fontFamily: 'monospace',
      }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>Debug log</div>
        {log.map((entry, i) => (
          <div key={i} style={{ color: entry.includes('ERROR') ? '#e74c3c' : '#aaa', lineHeight: 1.6 }}>{entry}</div>
        ))}
        {log.length === 0 && <div style={{ color: '#444' }}>Click "Start Voice" or "Test TTS Only" to begin</div>}
      </div>
    </div>
  )
}
