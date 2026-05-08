'use client'

import Link from 'next/link'
import { useState } from 'react'
import { VERSION } from '@/lib/version'

export type SidebarItem = {
  id: string
  label: string
  icon: string
  active: boolean
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void })

type Props = {
  items: SidebarItem[]
  defaultOpen?: boolean
}

export default function CollapsibleSidebar({ items, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: open ? 'flex-start' : 'center',
    gap: '10px',
    padding: open ? '10px 16px' : '12px 0',
    width: '100%',
    background: active ? 'var(--pill-active-bg)' : 'transparent',
    borderLeft: `2px solid ${active ? 'var(--pill-active-color)' : 'transparent'}`,
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    color: active ? 'var(--pill-active-color)' : 'var(--text2)',
    fontSize: 'var(--fs-sm)',
    fontFamily: 'var(--font-ui)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background var(--transition), color var(--transition)',
  })

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
    }}>

      {/* Header: toggle + version */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '8px var(--sp-sm)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex', alignItems: 'center', lineHeight: 1, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {open ? (
              <><line x1="3" y1="2" x2="3" y2="14"/><polyline points="9,5 6,8 9,11"/><line x1="6" y1="8" x2="13" y2="8"/></>
            ) : (
              <><line x1="3" y1="2" x2="3" y2="14"/><polyline points="7,5 10,8 7,11"/><line x1="3" y1="8" x2="10" y2="8"/></>
            )}
          </svg>
        </button>
        {open && (
          <span style={{ fontSize: 'var(--fs-version)', color: 'var(--muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            TODOS {VERSION}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {items.map(item => {
          const style = navItemStyle(item.active)
          const inner = (
            <>
              <span style={{ fontSize: '15px', flexShrink: 0, opacity: 0.7 }}>{item.icon}</span>
              {open && item.label}
            </>
          )
          if (item.href) {
            return (
              <Link key={item.id} href={item.href} style={style} aria-current={item.active ? 'page' : undefined}>
                {inner}
              </Link>
            )
          }
          return (
            <button key={item.id} onClick={item.onClick} style={style} aria-current={item.active ? 'page' : undefined}>
              {inner}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
