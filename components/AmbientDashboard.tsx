'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AddProductModal from './AddProductModal'
import { OrbDevPanel, type MoodOverride } from './OrbDevPanel'
import { orbConverse } from '@/app/actions/orb-converse'

type Product = { id: string; name: string; code: string | null; icon: string | null }
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

const PLACEHOLDER: Record<Urgency, string> = {
  calm:   'What needs doing?',
  active: 'What\'s next?',
  urgent: 'What\'s most pressing?',
}

export default function AmbientDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)

  const [products, setProducts]           = useState<Product[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [todos, setTodos]                 = useState<Todo[]>([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [inputFocused, setInputFocused]   = useState(false)
  const [pulse, setPulse]                 = useState(false)
  const [moodOverride, setMoodOverride]   = useState<MoodOverride>(null)
  const [dryRun, setDryRun]               = useState(false)
  const [speech, setSpeech]               = useState<{ text: string; autoFade?: number } | null>(null)
  const [speechVisible, setSpeechVisible] = useState(false)
  const [speechText, setSpeechText]       = useState('')

  // Speech: fade in on new value, fade out when cleared. Keep last text during fade-out.
  useEffect(() => {
    if (speech) {
      setSpeechText(speech.text)
      setSpeechVisible(true)
      if (speech.autoFade) {
        const t = setTimeout(() => setSpeech(null), speech.autoFade)
        return () => clearTimeout(t)
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
      const { data } = await supabase.from('products').select('id, name, code, icon').order('sort_order')
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

  // Fetch todos when product changes
  useEffect(() => {
    if (!selectedId) return
    async function fetchTodos() {
      const { data } = await supabase
        .from('todos')
        .select('id, title, status, priority_value')
        .eq('product_id', selectedId)
        .is('deleted_at', null)
      setTodos((data ?? []) as Todo[])
    }
    fetchTodos()
    localStorage.setItem(LAST_PRODUCT_KEY, selectedId)
  }, [selectedId, supabase])

  const openTodos = todos.filter(t => t.status !== 'done')
  const urgency   = moodOverride ?? computeUrgency(todos)
  const style     = ORB_STYLE[urgency]

  // Top 3 by priority (nulls last) — case 4: no special-case for empty P1
  const topItems = useMemo(() => {
    return [...openTodos]
      .sort((a, b) => (a.priority_value ?? Infinity) - (b.priority_value ?? Infinity))
      .slice(0, 3)
  }, [openTodos])
  const speed     = ORB_SPEED[urgency]
  const selected  = products.find(p => p.id === selectedId)

  async function refetchTodos() {
    if (!selectedId) return
    const { data } = await supabase
      .from('todos')
      .select('id, title, status, priority_value')
      .eq('product_id', selectedId)
      .is('deleted_at', null)
    setTodos((data ?? []) as Todo[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !selectedId || submitting) return
    setSubmitting(true)
    setInput('')

    const res = await orbConverse({ input: text, productId: selectedId, dryRun })
    setSpeech({ text: res.speech, autoFade: res.refresh ? 4000 : undefined })

    if (res.refresh) {
      await refetchTodos()
      setPulse(true)
      setTimeout(() => setPulse(false), 420)
    }

    setSubmitting(false)
    inputRef.current?.focus()
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
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text2)' }}>No products yet.</p>
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
    <div style={{
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
    }}>

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
        onKeyDown={e => e.key === 'Enter' && selectedId && router.push(`/dashboard/${selectedId}`)}
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

      {/* Speech zone — orb's voice */}
      <div
        aria-live="polite"
        style={{
          width: '460px',
          maxWidth: '90vw',
          minHeight: '52px',
          marginTop: '-28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--fs-base)',
          fontWeight: 400,
          lineHeight: 1.45,
          color: 'var(--text2)',
          opacity: speechVisible ? 1 : 0,
          transform: speechVisible ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 280ms ease-out, transform 280ms ease-out',
          pointerEvents: speechVisible ? 'auto' : 'none',
          whiteSpace: 'pre-line',
          padding: '0 16px',
        }}
      >
        {speechText}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ width: '420px', maxWidth: '90vw', position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={PLACEHOLDER[urgency]}
          disabled={submitting}
          style={{
            width: '100%',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-input)',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)',
            padding: '15px 50px 15px 20px',
            color: 'var(--text)',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--border-focus)'
            setInputFocused(true)
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--border)'
            setInputFocused(false)
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || submitting}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: input.trim() ? 'pointer' : 'default',
            color: input.trim() ? 'var(--pill-active-color)' : 'var(--muted)',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
          aria-label="Add todo"
        >
          ↵
        </button>
      </form>

      {/* Focus-reveal: top priority items */}
      <div
        aria-hidden={!inputFocused}
        style={{
          width: '420px',
          maxWidth: '90vw',
          marginTop: '-24px',
          opacity: inputFocused && topItems.length > 0 ? 1 : 0,
          transform: inputFocused && topItems.length > 0 ? 'translateY(0)' : 'translateY(-6px)',
          maxHeight: inputFocused && topItems.length > 0 ? '200px' : '0',
          overflow: 'hidden',
          transition: 'opacity 0.28s ease-out, transform 0.28s ease-out, max-height 0.32s ease-out',
          pointerEvents: inputFocused ? 'auto' : 'none',
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '4px 8px',
        }}>
          {topItems.map(t => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text3)',
                lineHeight: 1.4,
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: t.priority_value === 1
                  ? 'var(--status-open)'
                  : t.priority_value === 2
                    ? 'var(--pill-active-color)'
                    : 'var(--muted)',
                flexShrink: 0,
              }} />
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Product pills */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '420px' }}>
        {products.map(p => (
          <button
            key={p.id}
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
          + product
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
          TODOS v0.2.24
        </span>
      </div>

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
          onCreated={product => {
            setProducts(prev => [...prev, product])
            setSelectedId(product.id)
            setShowAddProduct(false)
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
