'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { VERSION } from '@/lib/version'

const NAV = [
  { href: '/settings/account',   label: 'Account',    icon: '◉' },
  { href: '/settings/products',  label: 'Projects',   icon: '◈' },
  { href: '/settings/groups',    label: 'Groups',     icon: '▤' },
  { href: '/settings/categories',label: 'Categories', icon: '◇' },
  { href: '/settings/platforms', label: 'Platforms',  icon: '▢' },
  { href: '/settings/data',      label: 'Data',       icon: '⬡' },
]

export default function SettingsSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      width: open ? '220px' : '48px',
      transition: 'width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
      background: 'var(--bg2)',
      minHeight: '100dvh',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
        padding: '14px 12px',
        borderBottom: '1px solid var(--border)',
        minHeight: '52px',
      }}>
        {open && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text3)',
            whiteSpace: 'nowrap',
          }}>
            Settings
          </span>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex', alignItems: 'center', lineHeight: 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {open
              ? <><line x1="3" y1="8" x2="13" y2="8"/><path d="M8 3l-5 5 5 5"/></>
              : <><line x1="3" y1="8" x2="13" y2="8"/><path d="M8 3l5 5-5 5"/></>
            }
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: open ? 'flex-start' : 'center',
                gap: '10px',
                padding: open ? '10px 16px' : '12px 0',
                background: active ? 'var(--pill-active-bg)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--pill-active-color)' : 'transparent'}`,
                color: active ? 'var(--pill-active-color)' : 'var(--text2)',
                fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--font-ui)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: 'background var(--transition), color var(--transition)',
              }}
              aria-current={active ? 'page' : undefined}
            >
              <span style={{ fontSize: '15px', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
              {open && label}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      {open && (
        <span style={{
          padding: 'var(--sp-lg)',
          fontSize: 'var(--fs-version)',
          color: 'var(--muted)',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          TODOS {VERSION}
        </span>
      )}
    </div>
  )
}
