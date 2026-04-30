'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/data', label: 'Data' },
]

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile: horizontal tab bar */}
      <nav style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        flexShrink: 0,
      }}
        className="sm-hide-flex"
      >
        <Link
          href="/dashboard"
          style={{
            padding: '12px 16px',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            borderBottom: '2px solid transparent',
          }}
        >
          ← Back
        </Link>
        {NAV.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: '12px 16px',
                fontSize: 'var(--fs-sm)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                borderBottom: `2px solid ${active ? 'var(--pill-active-color)' : 'transparent'}`,
                color: active ? 'var(--pill-active-color)' : 'var(--text3)',
                fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-normal)',
              }}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Desktop: vertical sidebar */}
      <aside
        style={{
          width: '220px',
          flexShrink: 0,
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          minHeight: '100dvh',
          padding: 'var(--sp-2xl) 0',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="sm-show-flex"
      >
        <div style={{ padding: '0 var(--sp-lg)', marginBottom: 'var(--sp-2xl)' }}>
          <Link
            href="/dashboard"
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            ← Dashboard
          </Link>
          <h2 style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-bold)',
            color: 'var(--text)',
            margin: 'var(--sp-md) 0 0',
          }}>
            Settings
          </h2>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 var(--sp-sm)' }}>
          {NAV.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: 'var(--sp-sm) var(--sp-md)',
                  borderRadius: 'var(--r)',
                  fontSize: 'var(--fs-sm)',
                  textDecoration: 'none',
                  fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-normal)',
                  color: active ? 'var(--pill-active-color)' : 'var(--text2)',
                  background: active ? 'var(--pill-active-bg)' : 'transparent',
                  border: `1px solid ${active ? 'var(--pill-active-border)' : 'transparent'}`,
                  transition: 'all var(--transition)',
                }}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <style>{`
        .sm-hide-flex { display: flex; }
        .sm-show-flex { display: none; }
        @media (min-width: 640px) {
          .sm-hide-flex { display: none; }
          .sm-show-flex { display: flex; }
        }
      `}</style>
    </>
  )
}
