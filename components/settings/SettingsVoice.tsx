'use client'

import { useState, useEffect, useRef } from 'react'

type VoiceInfo = {
  name: string
  lang: string
  localService: boolean
}

const LS_VOICE_KEY = 'orb_preferred_voice'
const LS_RATE_KEY = 'orb_voice_rate'
const SAMPLE_TEXT = 'Hello. I\'m your Orb — ready when you are.'

export default function SettingsVoice() {
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [selected, setSelected] = useState('')
  const [rate, setRate] = useState(1.0)
  const [supported, setSupported] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [saved, setSaved] = useState(false)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSupported(false)
      return
    }

    const load = () => {
      const all = speechSynthesis.getVoices()
      setVoices(all.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })))
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

  const grouped = voices.reduce<Record<string, VoiceInfo[]>>((acc, v) => {
    const lang = v.lang.split('-')[0].toUpperCase()
    ;(acc[lang] ??= []).push(v)
    return acc
  }, {})

  const sortedLangs = Object.keys(grouped).sort((a, b) => {
    if (a === 'EN') return -1
    if (b === 'EN') return 1
    return a.localeCompare(b)
  })

  function preview(voiceName: string) {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()

    const allVoices = speechSynthesis.getVoices()
    const voice = allVoices.find(v => v.name === voiceName)
    if (!voice) return

    const utterance = new SpeechSynthesisUtterance(SAMPLE_TEXT)
    utterance.voice = voice
    utterance.rate = rate
    utterance.onend = () => setPlaying(false)
    utterance.onerror = () => setPlaying(false)

    synthRef.current = utterance
    setPlaying(true)
    speechSynthesis.speak(utterance)
  }

  function stopPreview() {
    speechSynthesis.cancel()
    setPlaying(false)
  }

  function save() {
    try {
      localStorage.setItem(LS_VOICE_KEY, selected)
      localStorage.setItem(LS_RATE_KEY, String(rate))
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!supported) {
    return (
      <div className="settings-page">
        <h2 className="s-title mb-2xl">Voice</h2>
        <div className="s-card" style={{ padding: 'var(--sp-xl)' }}>
          <p className="text-sm text-muted">Voice features are not supported in this browser.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <h2 className="s-title mb-2xl">Voice</h2>

      <div className="s-card" style={{ padding: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-medium)' }}>
          Orb Voice
        </h3>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--sp-lg)', lineHeight: 'var(--lh-normal)' }}>
          Choose the voice the Orb uses when speaking. Tap the Orb on the dashboard to start a voice conversation. Voice availability varies by browser and device.
        </p>

        {/* Rate slider */}
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-xs)' }}>
            Speed: {rate.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            style={{ width: '100%', maxWidth: '300px', accentColor: 'var(--pill-active-bg)' }}
          />
        </div>

        {/* Voice list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {sortedLangs.map(lang => (
            <div key={lang}>
              <h4 style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase', marginBottom: 'var(--sp-xs)' }}>
                {lang}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {grouped[lang].map(v => {
                  const isSelected = v.name === selected
                  return (
                    <div
                      key={v.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
                        padding: 'var(--sp-xs) var(--sp-sm)',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'var(--pill-active-bg)' : 'transparent',
                        color: isSelected ? 'var(--pill-active-color)' : 'var(--text)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => setSelected(v.name)}
                    >
                      <span style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>
                        {v.name}
                        <span style={{ fontSize: 'var(--fs-xs)', color: isSelected ? 'inherit' : 'var(--muted)', marginLeft: 'var(--sp-xs)', opacity: 0.7 }}>
                          {v.lang}
                          {v.localService ? ' · local' : ' · cloud'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); playing ? stopPreview() : preview(v.name) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: isSelected ? 'var(--pill-active-color)' : 'var(--muted)',
                          fontSize: 'var(--fs-sm)', padding: '2px 6px',
                        }}
                      >
                        {playing && synthRef.current?.voice?.name === v.name ? '■' : '▶'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {voices.length === 0 && (
          <p className="text-sm text-muted" style={{ marginTop: 'var(--sp-md)' }}>
            No voices available. Your browser may not support speech synthesis.
          </p>
        )}

        <div style={{ marginTop: 'var(--sp-xl)', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <button
            className="btn-primary"
            onClick={save}
            disabled={!selected}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
          {selected && (
            <button
              type="button"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 'var(--fs-sm)',
                textDecoration: 'underline',
              }}
              onClick={() => { setSelected(''); try { localStorage.removeItem(LS_VOICE_KEY) } catch {} }}
            >
              Reset to default
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
