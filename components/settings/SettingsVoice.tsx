'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OPENAI_VOICES, ELEVENLABS_VOICES, type TtsVoiceOption } from '@/lib/orb-model/tts'
import { synthesizeSpeech } from '@/app/actions/orb-tts'
import { saveTtsConfig } from '@/app/actions/orb-ai-settings'
import { useToast } from '@/components/ui/Toast'

type BrowserVoiceInfo = {
  name: string
  lang: string
  localService: boolean
}

const LS_VOICE_KEY = 'orb_preferred_voice'
const LS_RATE_KEY = 'orb_voice_rate'
const SAMPLE_TEXT = 'Hello. I\'m your Orb — ready when you are.'

type ModalTarget = 'browser' | 'openai' | 'elevenlabs' | null

export default function SettingsVoice() {
  const toast = useToast()
  const [browserVoices, setBrowserVoices] = useState<BrowserVoiceInfo[]>([])
  const [selected, setSelected] = useState('')
  const [rate, setRate] = useState(1.0)
  const [supported, setSupported] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalTarget>(null)
  const [pendingVoice, setPendingVoice] = useState<string | null>(null)
  const [showAllLangs, setShowAllLangs] = useState(false)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const apiAudioRef = useRef<HTMLAudioElement | null>(null)
  const dialogRef = useCallback((el: HTMLDivElement | null) => { el?.focus() }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSupported(false)
      return
    }
    const load = () => {
      const all = speechSynthesis.getVoices()
      setBrowserVoices(all.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })))
    }
    load()
    speechSynthesis.onvoiceschanged = load

    try {
      const savedVoice = localStorage.getItem(LS_VOICE_KEY)
      if (savedVoice) setSelected(savedVoice)
      const savedRate = localStorage.getItem(LS_RATE_KEY)
      if (savedRate) setRate(parseFloat(savedRate) || 1.0)
    } catch {}
  }, [])

  const grouped = browserVoices.reduce<Record<string, BrowserVoiceInfo[]>>((acc, v) => {
    const lang = v.lang.split('-')[0].toUpperCase()
    ;(acc[lang] ??= []).push(v)
    return acc
  }, {})

  const sortedLangs = Object.keys(grouped).sort((a, b) => {
    if (a === 'EN') return -1
    if (b === 'EN') return 1
    return a.localeCompare(b)
  })

  const englishLangs = sortedLangs.filter(l => l === 'EN')
  const otherLangs = sortedLangs.filter(l => l !== 'EN')

  function previewBrowser(voiceName: string) {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const allVoices = speechSynthesis.getVoices()
    const voice = allVoices.find(v => v.name === voiceName)
    if (!voice) return
    const utterance = new SpeechSynthesisUtterance(SAMPLE_TEXT)
    utterance.voice = voice
    utterance.rate = rate
    utterance.onend = () => setPlaying(null)
    utterance.onerror = () => setPlaying(null)
    synthRef.current = utterance
    setPlaying(voiceName)
    speechSynthesis.speak(utterance)
  }

  async function previewApi(voiceId: string, provider: 'openai' | 'elevenlabs') {
    if (apiAudioRef.current) {
      apiAudioRef.current.pause()
      apiAudioRef.current = null
    }
    setPlaying(voiceId)
    try {
      const result = await synthesizeSpeech({
        text: SAMPLE_TEXT,
        provider,
        model: provider === 'openai' ? 'tts-1' : 'eleven_turbo_v2_5',
        voiceId,
      })
      const audio = new Audio(`data:${result.contentType};base64,${result.audioBase64}`)
      apiAudioRef.current = audio
      audio.playbackRate = rate
      audio.onended = () => { setPlaying(null); apiAudioRef.current = null }
      audio.onerror = (e) => { console.error('[tts] audio playback error:', e); setPlaying(null); apiAudioRef.current = null }
      await audio.play()
    } catch (err) {
      console.error('[tts] preview failed:', err)
      setPlaying(null)
    }
  }

  function stopPreview() {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    if (apiAudioRef.current) { apiAudioRef.current.pause(); apiAudioRef.current = null }
    setPlaying(null)
  }

  function persistRate(newRate: number) {
    try { localStorage.setItem(LS_RATE_KEY, String(newRate)) } catch {}
  }

  async function resetToDefault() {
    try { localStorage.removeItem(LS_VOICE_KEY); localStorage.removeItem(LS_RATE_KEY) } catch {}
    setSelected('')
    setRate(1.0)
    try {
      await saveTtsConfig({ provider: 'browser', model: null, voiceId: null })
      toast.success('Voice reset to default.')
    } catch {
      toast.error('Failed to reset voice setting.')
    }
  }

  function closeModal() {
    setModal(null)
    setPendingVoice(null)
    stopPreview()
    setShowAllLangs(false)
  }

  function handleModalKeyDown(provider: 'browser' | 'openai' | 'elevenlabs') {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && pendingVoice) {
        e.preventDefault()
        commitVoice(provider)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
      }
    }
  }

  async function commitVoice(provider: 'browser' | 'openai' | 'elevenlabs') {
    if (!pendingVoice) return false
    const name = pendingVoice
    const model = provider === 'openai' ? 'tts-1'
      : provider === 'elevenlabs' ? 'eleven_turbo_v2_5'
        : null
    const label = provider === 'browser' ? name
      : provider === 'openai' ? OPENAI_VOICES.find(v => v.id === name)?.name ?? name
        : ELEVENLABS_VOICES.find(v => v.id === name)?.name ?? name

    try {
      await saveTtsConfig({ provider, model, voiceId: provider === 'browser' ? null : name })
      setSelected(name)
      try { localStorage.setItem(LS_VOICE_KEY, name) } catch {}
      toast.success(`Voice set to ${label}.`)
    } catch (err) {
      console.error('[voice] failed to save TTS config:', err)
      toast.error('Failed to save voice setting.')
      return false
    }

    setModal(null)
    stopPreview()
    setShowAllLangs(false)
    setPendingVoice(null)
    return true
  }

  function pendingLabel(): string {
    if (!pendingVoice) return ''
    if (modal === 'openai') return OPENAI_VOICES.find(v => v.id === pendingVoice)?.name ?? pendingVoice
    if (modal === 'elevenlabs') return ELEVENLABS_VOICES.find(v => v.id === pendingVoice)?.name ?? pendingVoice
    return pendingVoice
  }

  function selectedLabel(): string {
    if (!selected) return 'None'
    const ov = OPENAI_VOICES.find(v => v.id === selected)
    if (ov) return `OpenAI · ${ov.name}`
    const ev = ELEVENLABS_VOICES.find(v => v.id === selected)
    if (ev) return `ElevenLabs · ${ev.name}`
    return selected
  }

  function renderApiVoiceList(voices: TtsVoiceOption[], provider: 'openai' | 'elevenlabs') {
    return (
      <div className="modal-body" style={{ maxHeight: '60dvh', overflowY: 'auto', padding: 'var(--sp-md) var(--sp-lg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {voices.map(v => {
            const isPending = v.id === pendingVoice
            const isPlaying = playing === v.id
            return (
              <div
                key={v.id}
                className="selectable-row"
                aria-selected={isPending}
                onClick={() => setPendingVoice(v.id)}
              >
                <span className="selectable-row-label">{v.name}</span>
                <button
                  type="button"
                  className="selectable-row-action"
                  onClick={e => { e.stopPropagation(); isPlaying ? stopPreview() : previewApi(v.id, provider) }}
                  aria-label={isPlaying ? 'Stop preview' : `Preview ${v.name}`}
                >
                  {isPlaying ? '■' : '▶'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderBrowserVoiceList() {
    const visibleLangs = showAllLangs ? sortedLangs : englishLangs

    return (
      <div className="modal-body" style={{ maxHeight: '60dvh', overflowY: 'auto', padding: 'var(--sp-md) var(--sp-lg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {visibleLangs.map(lang => (
            <div key={lang}>
              <h4 style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase', marginBottom: 'var(--sp-xs)', margin: '0 0 var(--sp-xs)' }}>
                {lang}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {grouped[lang].map(v => {
                  const isPending = v.name === pendingVoice
                  const isPlaying = playing === v.name
                  return (
                    <div
                      key={v.name}
                      className="selectable-row"
                      aria-selected={isPending}
                      onClick={() => setPendingVoice(v.name)}
                    >
                      <span className="selectable-row-label">
                        {v.name}
                        <span className="selectable-row-meta">
                          {v.lang}{v.localService ? ' · local' : ' · cloud'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="selectable-row-action"
                        onClick={e => { e.stopPropagation(); isPlaying ? stopPreview() : previewBrowser(v.name) }}
                        aria-label={isPlaying ? 'Stop preview' : `Preview ${v.name}`}
                      >
                        {isPlaying ? '■' : '▶'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {otherLangs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllLangs(!showAllLangs)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 'var(--fs-xs)',
                textAlign: 'left', padding: 'var(--sp-xs) var(--sp-md)',
                fontWeight: 'var(--fw-medium)',
              }}
            >
              {showAllLangs ? '▾ Hide other languages' : `▸ ${otherLangs.length} more language${otherLangs.length === 1 ? '' : 's'}…`}
            </button>
          )}

          {browserVoices.length === 0 && (
            <p className="text-sm text-muted">No voices available in this browser.</p>
          )}
        </div>
      </div>
    )
  }

  if (!supported) {
    return (
      <div className="settings-page s-page">
        <h2 className="s-title mb-2xl">Voice</h2>
        <div className="s-card" style={{ padding: 'var(--sp-xl)', maxWidth: '400px' }}>
          <p className="text-sm text-muted">Voice features are not supported in this browser.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page s-page">
      <h2 className="s-title mb-2xl">Voice</h2>

      <div className="s-card" style={{ padding: 'var(--sp-xl)', maxWidth: '400px' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-medium)' }}>
          Orb Voice
        </h3>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--sp-lg)', lineHeight: 'var(--lh-normal)' }}>
          Choose the voice the Orb uses when speaking. Tap the Orb to start a voice conversation.
        </p>

        {selected && (
          <p className="text-sm" style={{ margin: '0 0 var(--sp-lg)', color: 'var(--text)' }}>
            Current: <strong>{selectedLabel()}</strong>
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-xl)' }}>
          <button type="button" className="btn-outline" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => { setPendingVoice(null); setModal('browser') }}>
            Browser voices (free)
          </button>
          <button type="button" className="btn-outline" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => { setPendingVoice(null); setModal('openai') }}>
            OpenAI TTS
          </button>
          <button type="button" className="btn-outline" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => { setPendingVoice(null); setModal('elevenlabs') }}>
            ElevenLabs
          </button>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-xs)' }}>
            Speed: {rate.toFixed(1)}x
          </label>
          <input
            type="range"
            className="s-range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={rate}
            onChange={e => { const r = parseFloat(e.target.value); setRate(r); persistRate(r) }}
          />
        </div>

        {selected && (
          <div style={{ marginTop: 'var(--sp-xl)' }}>
            <button
              type="button"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 'var(--fs-sm)',
                textDecoration: 'underline',
              }}
              onClick={resetToDefault}
            >
              Reset to default
            </button>
          </div>
        )}
      </div>

      {modal === 'browser' && (
        <>
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal-center modal-sm" role="dialog" aria-modal="true" aria-labelledby="voice-browser-title" ref={dialogRef} tabIndex={-1} onKeyDown={handleModalKeyDown('browser')}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 id="voice-browser-title" style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>Browser Voices</h3>
              <button type="button" className="close-btn" onClick={closeModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-sm text-muted" style={{ margin: 0, padding: '0 var(--sp-lg) var(--sp-sm)', lineHeight: 'var(--lh-normal)' }}>Tap ▶ to sample a voice. Tap the name to select it.</p>
            {renderBrowserVoiceList()}
            <div className="modal-footer">
              {pendingVoice && <span className="text-sm" style={{ marginRight: 'auto', color: 'var(--text)' }}>{pendingLabel()} selected</span>}
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => commitVoice('browser')} disabled={!pendingVoice}>Save</button>
            </div>
          </div>
        </>
      )}

      {modal === 'openai' && (
        <>
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal-center modal-sm" role="dialog" aria-modal="true" aria-labelledby="voice-openai-title" ref={dialogRef} tabIndex={-1} onKeyDown={handleModalKeyDown('openai')}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 id="voice-openai-title" style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>OpenAI TTS</h3>
              <button type="button" className="close-btn" onClick={closeModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-sm text-muted" style={{ margin: 0, padding: '0 var(--sp-lg) var(--sp-sm)', lineHeight: 'var(--lh-normal)' }}>Tap ▶ to sample a voice. Tap the name to select it.</p>
            {renderApiVoiceList(OPENAI_VOICES, 'openai')}
            <div className="modal-footer">
              {pendingVoice && <span className="text-sm" style={{ marginRight: 'auto', color: 'var(--text)' }}>{pendingLabel()} selected</span>}
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => commitVoice('openai')} disabled={!pendingVoice}>Save</button>
            </div>
          </div>
        </>
      )}

      {modal === 'elevenlabs' && (
        <>
          <div className="modal-backdrop" onClick={closeModal} />
          <div className="modal-center modal-sm" role="dialog" aria-modal="true" aria-labelledby="voice-elevenlabs-title" ref={dialogRef} tabIndex={-1} onKeyDown={handleModalKeyDown('elevenlabs')}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 id="voice-elevenlabs-title" style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>ElevenLabs</h3>
              <button type="button" className="close-btn" onClick={closeModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-sm text-muted" style={{ margin: 0, padding: '0 var(--sp-lg) var(--sp-sm)', lineHeight: 'var(--lh-normal)' }}>Tap ▶ to sample a voice. Tap the name to select it.</p>
            {renderApiVoiceList(ELEVENLABS_VOICES, 'elevenlabs')}
            <div className="modal-footer">
              {pendingVoice && <span className="text-sm" style={{ marginRight: 'auto', color: 'var(--text)' }}>{pendingLabel()} selected</span>}
              <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => commitVoice('elevenlabs')} disabled={!pendingVoice}>Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
