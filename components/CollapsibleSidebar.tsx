'use client'

import NavLink from '@/components/settings/NavLink'
import { useState } from 'react'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import HScrollNav from '@/components/ui/HScrollNav'

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
    <div className="cs-sidebar" {...(!open ? { 'data-collapsed': '' } : {})}>
      <div className="cs-header">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="cs-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {/* Vertical divider bar — always present */}
            <line x1="4" y1="2" x2="4" y2="14"/>
            {/* Three horizontal lines on the right side */}
            <line x1="7" y1="4.5" x2="13" y2="4.5"/>
            <line x1="7" y1="8"   x2="13" y2="8"/>
            <line x1="7" y1="11.5" x2="13" y2="11.5"/>
          </svg>
        </button>
        {open && <OrbVersionLabel className="cs-version" />}
      </div>

      <HScrollNav>
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
          <OrbVersionLabel className="cs-nav-version" format="version" />
        </nav>
      </HScrollNav>
    </div>
  )
}
