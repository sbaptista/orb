'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AddProductModal from './AddProductModal'
import OrbHelp from './OrbHelp'
import { OrbDevPanel, type MoodOverride } from './OrbDevPanel'
import { orbConverse } from '@/app/actions/orb-converse'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { VERSION } from '@/lib/version'

type Product = { id: string; name: string; code: string | null; description: string | null }
type Todo    = { id: string; title: string; status: string; priority_value: number | null }
type Urgency = 'calm' | 'active' | 'urgent'

const LAST_PRODUCT_KEY = 'todos_last_product_id'

function computeUrgency(todos: Todo[]): Urgency {
  const open = todos.filter(t => t.status !== 'done')
  if (open.some(t => t.priority_value === 1)) return 'urgent'
  if (open.length > 5) return 'active'
  return 'calm'
}

const ORB_SPEED: Record<Urgency, string> = {
  calm:   '5.5s',
  active: '3.5s',
  urgent: '3.5s',
}

// Glow size (extra inset beyond sphere) and blur — grows with urgency
const ORB_GLOW: Record<Urgency, { inset: string; blur: string }> = {
  calm:   { inset: '-16px', blur: '20px' },
  active: { inset: '-28px', blur: '28px' },
  urgent: { inset: '-44px', blur: '38px' },
}

const ORB_STYLE: Record<Urgency, {
  orbMid: string; orbLo: string; glow: string; countColor: string; labelColor: string
}> = {
  calm: {
    orbMid: '#d4e4d4', orbLo: '#b8d0b8',
    glow: 'rgba(80,130,80,0.22)',
    countColor: '#2d5a2d', labelColor: '#7a9e7a',
  },
  active: {
    orbMid: '#e4daf4', orbLo: '#d0c4ee',
    glow: 'rgba(130,90,200,0.28)',
    countColor: '#5a3090', labelColor: '#9a7ac8',
  },
  urgent: {
    orbMid: '#f8ead8', orbLo: '#f0d4b0',
    glow: 'rgba(230,130,55,0.48)',
    countColor: '#a05010', labelColor: '#c88040',
  },
}

const ORB_ANIMATION: Record<Urgency, string> = {
  calm:   'todos-orb-calm',
  active: 'todos-orb-active',
  urgent: 'todos-orb-urgent',
}

// Solar flares — many wispy eruptions, slow cycles, mostly dormant
const SOLAR_FLARES = [
  { angle: 14,  width: 24, height: 32, dur: 14, delay: 0    },
  { angle: 41,  width: 18, height: 24, dur: 16, delay: 5.2  },
  { angle: 68,  width: 28, height: 36, dur: 13, delay: 9.6  },
  { angle: 96,  width: 20, height: 28, dur: 17, delay: 2.4  },
  { angle: 124, width: 26, height: 34, dur: 15, delay: 11.3 },
  { angle: 152, width: 22, height: 30, dur: 14, delay: 7.0  },
  { angle: 178, width: 30, height: 38, dur: 16, delay: 4.0  },
  { angle: 206, width: 18, height: 26, dur: 18, delay: 12.4 },
  { angle: 232, width: 24, height: 32, dur: 13, delay: 6.2  },
  { angle: 258, width: 20, height: 28, dur: 15, delay: 10.0 },
  { angle: 284, width: 28, height: 36, dur: 14, delay: 1.7  },
  { angle: 312, width: 22, height: 30, dur: 17, delay: 8.5  },
  { angle: 340, width: 26, height: 34, dur: 15, delay: 13.2 },
]

const INPUT_PLACEHOLDER = "Do work, 'Explain' or '?'"
const SS_INPUT  = 'todos_orb_input'
const SS_SPEECH = 'todos_orb_speech'

export default function AmbientDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [products, setProducts]           = useState<Product[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [todos, setTodos]                 = useState<Todo[]>([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showEditProduct, setShowEditProduct] = useState(false)
  const [pulse, setPulse]                 = useState(false)
  const [moodOverride, setMoodOverride]   = useState<MoodOverride>(null)
  const [dryRun, setDryRun]               = useState(false)
  const [speech, setSpeech]               = useState<{ text: string; autoFade?: number } | null>(null)
  const [speechVisible, setSpeechVisible] = useState(false)
  const [speechText, setSpeechText]       = useState('')
  const [showHelp, setShowHelp]           = useState(false)
  const autoFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore input and speech from sessionStorage on mount
  useEffect(() => {
    const savedInput  = sessionStorage.getItem(SS_INPUT)
    const savedSpeech = sessionStorage.getItem(SS_SPEECH)
    if (savedInput)  setInput(savedInput)
    if (savedSpeech) setSpeech({ text: savedSpeech })
  }, [])

  // Persist speechText to sessionStorage whenever it changes
  useEffect(() => {
    if (speechText) sessionStorage.setItem(SS_SPEECH, speechText)
    else            sessionStorage.removeItem(SS_SPEECH)
  }, [speechText])

  // Speech: fade in on new value, fade out when cleared. Keep last text during fade-out.
  useEffect(() => {
    if (speech) {
      setSpeechText(speech.text)
      setSpeechVisible(true)
      if (speech.autoFade) {
        autoFadeRef.current = setTimeout(() => setSpeech(null), speech.autoFade)
        return () => {
          if (autoFadeRef.current) clearTimeout(autoFadeRef.current)
          autoFadeRef.current = null
        }
      }
    } else {
      setSpeechVisible(false)
      // clear text after fade-out completes
      const t = setTimeout(() => setSpeechText(''), 500)
      return () => clearTimeout(t)
    }
  }, [speech])

  // Load products, restore last selected
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('projects').select('id, name, code, description').order('sort_order')
      const list = (data ?? []) as Product[]
      setProducts(list)
      if (list.length > 0) {
        const last = localStorage.getItem(LAST_PRODUCT_KEY)
        const found = list.find(p => p.id === last)
        setSelectedId(found ? found.id : list[0].id)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const fetchTodos = useCallback(async () => {
    if (!selectedId) return
    const { data } = await supabase
      .from('todos')
      .select('id, title, status, priority_value')
      .eq('product_id', selectedId)
      .is('deleted_at', null)
    setTodos((data ?? []) as Todo[])
  }, [selectedId, supabase])

  useVisibilityRefetch(fetchTodos)

  // Fetch todos when product changes; subscribe to realtime updates
  useEffect(() => {
    if (!selectedId) return

    fetchTodos()
    localStorage.setItem(LAST_PRODUCT_KEY, selectedId)

    const channel = supabase
      .channel(`todos:${selectedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `product_id=eq.${selectedId}` },
        () => fetchTodos(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedId, supabase, fetchTodos])

  const openTodos = todos.filter(t => t.status !== 'done')
  const urgency   = moodOverride ?? computeUrgency(todos)
  const style     = ORB_STYLE[urgency]
  const speed     = ORB_SPEED[urgency]
  const selected  = products.find(p => p.id === selectedId)

  // Global keyboard shortcuts
  useEffect(() => {
    const HINT_KEY = 'todos_keyboard_hint_shown'
    let hintShown = !!localStorage.getItem(HINT_KEY)

    function onKey(e: KeyboardEvent) {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)

      if (e.key === '?' && !inInput) {
        e.preventDefault()
        setShowHelp(s => !s)
        return
      }
      if (e.key === 'Escape') {
        setShowHelp(false)
        return
      }
      if (e.key === 'Tab' && !hintShown) {
        hintShown = true
        localStorage.setItem(HINT_KEY, '1')
        setSpeech({ text: 'Keyboard mode — Tab to navigate, arrows to switch products, ? for help.' })
        return
      }
      if (!inInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        setSelectedId(current => {
          if (!current || products.length <= 1) return current
          const idx = products.findIndex(p => p.id === current)
          if (idx === -1) return current
          const next = e.key === 'ArrowLeft'
            ? (idx - 1 + products.length) % products.length
            : (idx + 1) % products.length
          return products[next].id
        })
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [products])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || !selectedId || submitting) return
    if (text === '?') {
      setShowHelp(true)
      return
    }
    if (text.toLowerCase() === 'explain') {
      setSpeech({ text: 'Create, query, update, delete, or archive todos.\nTap the orb to list. Type \'?\' for more.' })
      return
    }
    if (autoFadeRef.current) {
      clearTimeout(autoFadeRef.current)
      autoFadeRef.current = null
    }
    setSubmitting(true)
    setSpeech({ text: 'Processing…' })

    const res = await orbConverse({ input: text, productId: selectedId, dryRun })
    setSpeech({ text: res.speech })

    if (res.refresh) {
      setPulse(true)
      setTimeout(() => setPulse(false), 420)
    }

    setSubmitting(false)
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Loading…</p>
    </div>
  )

  if (products.length === 0) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text2)' }}>No projects yet.</p>
      <Link href="/dashboard/classic" style={{
        fontSize: 'var(--fs-sm)',
        color: 'var(--pill-active-color)',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      }}>
        Go to classic view to create one
      </Link>
    </div>
  )

  return (
    <div
      id="main-content"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '44px',
        paddingTop: 'var(--sat)',
        paddingBottom: 'calc(var(--sp-3xl) + var(--sab))',
        fontFamily: 'var(--font-ui)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >

      {/* Orb */}
      <div
        onClick={() => selectedId && router.push(`/dashboard/${selectedId}`)}
        style={{
          position: 'relative',
          width: '240px',
          height: '240px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transform: pulse ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        aria-label={`${openTodos.length} open todos — tap to view list`}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && selectedId && router.push(`/dashboard/${selectedId}`)}
      >
        {/* Glow */}
        <div data-todos-glow style={{
          position: 'absolute',
          inset: ORB_GLOW[urgency].inset,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${style.glow}, transparent 70%)`,
          filter: `blur(${ORB_GLOW[urgency].blur})`,
          animation: `todos-glow-${urgency} ${speed} ease-in-out infinite`,
          transition: 'inset 0.8s, filter 0.8s, background 0.8s',
        }} />

        {/* Solar flares (urgent only) — render behind sphere so they emerge from the edge */}
        {urgency === 'urgent' && SOLAR_FLARES.map((f, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 0,
              height: 0,
              transform: `rotate(${f.angle}deg)`,
              pointerEvents: 'none',
            }}
          >
            <div
              data-todos-flare
              style={{
                position: 'absolute',
                bottom: '82px',
                left: `${-f.width / 2}px`,
                width: `${f.width}px`,
                height: `${f.height}px`,
                background: `radial-gradient(ellipse 70% 100% at 50% 100%,
                  rgba(255, 235, 180, 0.95) 0%,
                  rgba(255, 185, 90, 0.6) 30%,
                  rgba(255, 140, 60, 0.28) 60%,
                  transparent 95%)`,
                borderRadius: '50% 50% 50% 50%',
                transformOrigin: 'bottom center',
                animation: `todos-flare-rise ${f.dur}s ease-in-out infinite`,
                animationDelay: `${f.delay}s`,
                filter: 'blur(6px)',
                mixBlendMode: 'screen',
              }}
            />
          </div>
        ))}

        {/* Sphere */}
        <div data-todos-orb style={{
          position: 'relative',
          width: '164px',
          height: '164px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 36% 30%, #ffffff, ${style.orbMid} 45%, ${style.orbLo} 82%)`,
          boxShadow: `0 8px 32px ${style.glow}, 0 2px 8px rgba(0,0,0,0.06), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 2px 8px rgba(255,255,255,0.9)`,
          animation: `${ORB_ANIMATION[urgency]} ${speed} ease-in-out infinite`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2px',
          transition: 'background 0.8s, box-shadow 0.8s',
        }}>
          {/* Product name — curved along the inside top of the sphere */}
          <svg
            width="164"
            height="164"
            viewBox="0 0 164 164"
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            aria-hidden
          >
            <defs>
              <path
                id="todos-orb-name-arc"
                d="M 24 82 A 58 58 0 0 1 140 82"
                fill="none"
              />
              <path
                id="todos-orb-state-arc"
                d="M 24 82 A 58 58 0 0 0 140 82"
                fill="none"
              />
            </defs>
            <text
              fontFamily="var(--font-ui)"
              fontSize="11"
              fontWeight={600}
              letterSpacing="3"
              fill={style.labelColor}
              style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
            >
              <textPath href="#todos-orb-name-arc" startOffset="50%" textAnchor="middle">
                {(() => {
                  const raw = (selected?.code ?? selected?.name ?? '').toUpperCase()
                  return raw.length > 10 ? `${raw.slice(0, 9)}…` : raw
                })()}
              </textPath>
            </text>
            <text
              fontFamily="var(--font-ui)"
              fontSize="11"
              fontWeight={600}
              letterSpacing="3"
              fill={style.labelColor}
              style={{ textTransform: 'uppercase', transition: 'fill 0.8s' }}
            >
              <textPath href="#todos-orb-state-arc" startOffset="50%" textAnchor="middle">
                {urgency.toUpperCase()}
              </textPath>
            </text>
          </svg>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-orb)',
            fontWeight: 300,
            color: style.countColor,
            letterSpacing: '-1px',
            lineHeight: 1,
            transition: 'color 0.8s',
          }}>
            {openTodos.length}
          </span>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 400,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: style.labelColor,
            transition: 'color 0.8s',
          }}>
            open
          </span>
        </div>
      </div>

      {/* Speech panel — appears only when there's something to say */}
      {speechText && (
        <div
          aria-live="polite"
          style={{
            width: '420px',
            maxWidth: '90vw',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--sp-md) var(--sp-xl)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-base)',
            fontWeight: 400,
            lineHeight: 1.5,
            color: 'var(--text2)',
            whiteSpace: 'pre-wrap',
            overflowY: 'auto',
            height: '96px',
            opacity: speechVisible ? 1 : 0,
            transform: speechVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 280ms ease-out, transform 280ms ease-out',
          }}
        >
          {speechText}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ width: '420px', maxWidth: '90vw', position: 'relative' }}>
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={e => { setInput(e.target.value); sessionStorage.setItem(SS_INPUT, e.target.value) }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={INPUT_PLACEHOLDER}
          disabled={submitting}
          style={{
            width: '100%',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-input)',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '12px 50px 12px 20px',
            color: 'var(--text)',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)',
            WebkitAppearance: 'none',
            appearance: 'none',
            resize: 'none',
            lineHeight: 1.5,
            overflowY: 'auto',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--border-focus)'
            setInput('')
            setSpeech(null)
            sessionStorage.removeItem(SS_INPUT)
            sessionStorage.removeItem(SS_SPEECH)
          }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || submitting}
          style={{
            position: 'absolute',
            right: '12px',
            bottom: '12px',
            background: 'none',
            border: 'none',
            cursor: input.trim() ? 'pointer' : 'default',
            color: input.trim() ? 'var(--pill-active-color)' : 'var(--muted)',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
          aria-label="Submit"
        >
          ↵
        </button>
      </form>

      {/* Product pills */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '420px' }}>
        {products.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setSelectedId(p.id)}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                letterSpacing: '0.07em',
                padding: '7px 16px',
                borderRadius: '20px',
                border: `1px solid ${p.id === selectedId ? 'var(--pill-active-border)' : 'var(--border)'}`,
                color: p.id === selectedId ? 'var(--pill-active-color)' : 'var(--muted)',
                background: p.id === selectedId ? 'var(--pill-active-bg)' : 'transparent',
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
            >
              {p.code ?? p.name}
            </button>
            {p.id === selectedId && (
              <button
                onClick={() => setShowEditProduct(true)}
                aria-label={`Edit ${p.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all var(--transition)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowAddProduct(true)}
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 500,
            letterSpacing: '0.07em',
            padding: '7px 16px',
            borderRadius: '20px',
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
            background: 'none',
            cursor: 'pointer',
            transition: 'all var(--transition)',
          }}
        >
          + project
        </button>
      </div>

      {/* Top right — sign out */}
      <button
        onClick={async () => {
          await supabase.auth.signOut()
          router.push('/auth/login')
        }}
        style={{
          position: 'fixed',
          top: 'calc(var(--sp-lg) + var(--sat))',
          right: 'var(--sp-lg)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          letterSpacing: '0.04em',
        }}
      >
        sign out
      </button>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'calc(12px + var(--sab)) 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 'var(--fs-xs)',
          color: 'var(--muted)',
          letterSpacing: '0.05em',
        }}>
          TODOS {VERSION}
        </span>
      </div>

      {showHelp && <OrbHelp onClose={() => setShowHelp(false)} />}

      <OrbDevPanel
        override={moodOverride}
        onChange={setMoodOverride}
        onSpeak={setSpeech}
        dryRun={dryRun}
        onDryRunChange={setDryRun}
      />

      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onCreated={project => {
            setProducts(prev => [...prev, project])
            setSelectedId(project.id)
            setShowAddProduct(false)
          }}
        />
      )}

      {showEditProduct && selected && (
        <AddProductModal
          project={selected}
          onClose={() => setShowEditProduct(false)}
          onUpdated={updated => {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
            setShowEditProduct(false)
          }}
          onDeleted={id => {
            setProducts(prev => prev.filter(p => p.id !== id))
            setSelectedId(prev => prev === id ? (products.find(p => p.id !== id)?.id ?? null) : prev)
            setShowEditProduct(false)
          }}
        />
      )}

      <style>{`
        /* Calm: gentle breath, perfect circle, soft glow */
        @keyframes todos-orb-calm {
          0%, 100% { transform: scale(1);     border-radius: 50%; }
          50%      { transform: scale(1.025); border-radius: 50%; }
        }
        @keyframes todos-glow-calm {
          0%, 100% { transform: scale(1);    opacity: 0.85; }
          50%      { transform: scale(1.05); opacity: 1; }
        }

        /* Active: faster breath, edges begin to soften, glow blooms */
        @keyframes todos-orb-active {
          0%, 100% { transform: scale(1);     border-radius: 50% 50% 50% 50%; }
          33%      { transform: scale(1.04);  border-radius: 48% 52% 51% 49%; }
          66%      { transform: scale(1.025); border-radius: 51% 49% 48% 52%; }
        }
        @keyframes todos-glow-active {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%      { transform: scale(1.12); opacity: 1; }
        }

        /* Urgent: warm energetic pulse — no warping, flares carry the urgency signal */
        @keyframes todos-orb-urgent {
          0%, 100% { transform: scale(1);     border-radius: 50%; }
          50%      { transform: scale(1.045); border-radius: 50%; }
        }
        @keyframes todos-glow-urgent {
          0%, 100% { transform: scale(1);    opacity: 0.75; }
          50%      { transform: scale(1.18); opacity: 1; }
        }

        /* Solar flares: long dormant, slow swell, billow, dissipate as wisps */
        @keyframes todos-flare-rise {
          0%, 55%  { transform: scaleY(0)    scaleX(0.5) skewX(0deg);   opacity: 0;    }
          68%      { transform: scaleY(0.5)  scaleX(1)   skewX(-2deg);  opacity: 0.85; }
          78%      { transform: scaleY(1)    scaleX(1.1) skewX(2deg);   opacity: 1;    }
          88%      { transform: scaleY(1.15) scaleX(0.7) skewX(-3deg);  opacity: 0.55; }
          96%      { transform: scaleY(1.3)  scaleX(0.3) skewX(3deg);   opacity: 0.15; }
          100%     { transform: scaleY(1.4)  scaleX(0.1) skewX(0deg);   opacity: 0;    }
        }

        /* Accessibility: honor reduced-motion — keep mood signal via glow size & color, drop kinesis */
        @media (prefers-reduced-motion: reduce) {
          [data-todos-orb], [data-todos-glow], [data-todos-flare] {
            animation: none !important;
          }
          [data-todos-flare] { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
