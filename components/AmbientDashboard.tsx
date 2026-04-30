'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AddProductModal from './AddProductModal'

type Product = { id: string; name: string; code: string | null; icon: string | null }
type Todo    = { id: string; status: string; priority_value: number | null }
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
  urgent: '2.2s',
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
    glow: 'rgba(130,90,200,0.20)',
    countColor: '#5a3090', labelColor: '#9a7ac8',
  },
  urgent: {
    orbMid: '#f8ead8', orbLo: '#f0d4b0',
    glow: 'rgba(200,120,40,0.22)',
    countColor: '#a05010', labelColor: '#c88040',
  },
}

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
        .select('id, status, priority_value')
        .eq('product_id', selectedId)
        .is('deleted_at', null)
      setTodos((data ?? []) as Todo[])
    }
    fetchTodos()
    localStorage.setItem(LAST_PRODUCT_KEY, selectedId)
  }, [selectedId, supabase])

  const openTodos = todos.filter(t => t.status !== 'done')
  const urgency   = computeUrgency(todos)
  const style     = ORB_STYLE[urgency]
  const speed     = ORB_SPEED[urgency]
  const selected  = products.find(p => p.id === selectedId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = input.trim()
    if (!title || !selectedId || submitting) return
    setSubmitting(true)
    await supabase.from('todos').insert({
      product_id: selectedId,
      title,
      status: 'open',
      sort_order: 0,
      urls: [],
    })
    setInput('')
    setSubmitting(false)
    router.push(`/dashboard/${selectedId}`)
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
        }}
        aria-label={`${openTodos.length} open todos — tap to view list`}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && selectedId && router.push(`/dashboard/${selectedId}`)}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute',
          inset: '-20px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${style.glow}, transparent 70%)`,
          filter: 'blur(22px)',
          animation: `todos-breathe ${speed} ease-in-out infinite`,
          transition: 'background 0.8s',
        }} />

        {/* Sphere */}
        <div style={{
          width: '164px',
          height: '164px',
          borderRadius: '50%',
          background: `radial-gradient(circle at 36% 30%, #ffffff, ${style.orbMid} 45%, ${style.orbLo} 82%)`,
          boxShadow: `0 8px 32px ${style.glow}, 0 2px 8px rgba(0,0,0,0.06), inset 0 -4px 12px rgba(0,0,0,0.04), inset 0 2px 8px rgba(255,255,255,0.9)`,
          animation: `todos-breathe ${speed} ease-in-out infinite`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '2px',
          transition: 'background 0.8s, box-shadow 0.8s',
        }}>
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

      {/* Product name */}
      <span style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 500,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginTop: '-28px',
      }}>
        {selected?.name ?? ''}
      </span>

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
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--border)'
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
          TODOS v0.2.19
        </span>
      </div>

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
        @keyframes todos-breathe {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.035); }
        }
      `}</style>
    </div>
  )
}
