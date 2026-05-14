'use client'

import NavLink from '@/components/settings/NavLink'
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

  return (
    <div className="cs-sidebar" style={{ width: open ? '220px' : '48px' }} {...(!open ? { 'data-collapsed': '' } : {})}>
      <div className="cs-header">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="cs-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {open ? (
              <><line x1="3" y1="2" x2="3" y2="14"/><polyline points="9,5 6,8 9,11"/><line x1="6" y1="8" x2="13" y2="8"/></>
            ) : (
              <><line x1="3" y1="2" x2="3" y2="14"/><polyline points="7,5 10,8 7,11"/><line x1="3" y1="8" x2="10" y2="8"/></>
            )}
          </svg>
        </button>
        {open && <span className="cs-version">Orb {VERSION}</span>}
      </div>

      <nav className="cs-nav">
        {items.map(item => {
          const inner = (
            <>
              <span className="cs-icon">{item.icon}</span>
              {open && item.label}
            </>
          )
          if (item.href) {
            return (
              <NavLink key={item.id} href={item.href} className="cs-item" aria-current={item.active ? 'page' : undefined}>
                {inner}
              </NavLink>
            )
          }
          return (
            <button key={item.id} onClick={item.onClick} className="cs-item" aria-current={item.active ? 'page' : undefined}>
              {inner}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
