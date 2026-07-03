'use client'

import NavLink from '@/components/settings/NavLink'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import HScrollNav from '@/components/ui/HScrollNav'
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges'
import { flushPerformanceEvents, markPerformanceNavigation, startInteraction } from '@/lib/performance/telemetry'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const { confirmNavigation } = useUnsavedChanges()
  const activeItem = items.find(item => item.active) ?? items[0]
  const mobilePickerRef = useRef<HTMLDivElement>(null)

  function handleMobileSelect(value: string) {
    const item = items.find(next => next.id === value)
    setMobileMenuOpen(false)
    if (!item || item.active) return
    if ('href' in item && item.href) {
      const perf = startInteraction({
        focus: 'settings',
        flow: 'settings-navigation',
        interaction: 'settings_mobile_nav_select',
        surface: 'settings-sidebar-mobile',
        immediateFlush: true,
        metadata: { href: item.href },
      })
      confirmNavigation(() => {
        perf.end(true)
        flushPerformanceEvents()
        markPerformanceNavigation(item.href)
        router.push(item.href)
      })
      return
    }
    if (typeof item.onClick === 'function') item.onClick()
  }

  useEffect(() => {
    if (!mobileMenuOpen) return

    function handleOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (mobilePickerRef.current?.contains(target)) return
      setMobileMenuOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [mobileMenuOpen])

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

      <div className="cs-mobile-picker" ref={mobilePickerRef}>
        <button
          type="button"
          className="cs-mobile-trigger"
          aria-haspopup="menu"
          aria-expanded={mobileMenuOpen}
          aria-label={`Settings section: ${activeItem?.label ?? 'Settings'}`}
          onClick={() => setMobileMenuOpen(value => !value)}
        >
          <span className="cs-mobile-trigger-icon" aria-hidden="true">{activeItem?.icon ?? '⚙'}</span>
          <span className="cs-mobile-trigger-arrow" aria-hidden="true">⌄</span>
        </button>
        <OrbVersionLabel className="cs-mobile-version" format="version" />
        {mobileMenuOpen && (
          <div className="cs-mobile-menu" role="menu" aria-label="Settings sections">
            <div className="cs-mobile-menu-header">
              <span>Settings sections</span>
              <button
                type="button"
                className="cs-mobile-menu-close"
                aria-label="Close settings menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                ×
              </button>
            </div>
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className="cs-mobile-menu-item"
                role="menuitem"
                aria-current={item.active ? 'page' : undefined}
                onClick={() => handleMobileSelect(item.id)}
              >
                <span className="cs-mobile-menu-icon" aria-hidden="true">{item.icon}</span>
                <span className="cs-mobile-menu-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}
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
