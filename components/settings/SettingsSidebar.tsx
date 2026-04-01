'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/settings/products', label: 'Products' },
  { href: '/settings/groups', label: 'Groups' },
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/platforms', label: 'Platforms' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/data', label: 'Data' },
]

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile: horizontal tab bar */}
      <nav className="sm:hidden bg-white border-b border-zinc-200 flex overflow-x-auto shrink-0">
        {NAV.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-zinc-900 text-zinc-900 font-medium'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Desktop: vertical sidebar */}
      <aside className="hidden sm:flex flex-col w-60 shrink-0 bg-white border-r border-zinc-200 min-h-screen py-6">
        <div className="px-4 mb-6">
          <Link
            href="/dashboard"
            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            ← Dashboard
          </Link>
          <h2 className="text-sm font-semibold text-zinc-900 mt-3">Settings</h2>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
