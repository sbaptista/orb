'use client'

import { usePathname } from 'next/navigation'
import CollapsibleSidebar, { type SidebarItem } from '@/components/CollapsibleSidebar'

const NAV: SidebarItem[] = [
  { id: 'priorities', href: '/settings/priorities', label: 'Priorities', icon: '▴', active: false },
  { id: 'statuses',   href: '/settings/statuses',   label: 'Statuses',   icon: '◪', active: false },
  { id: 'platforms',  href: '/settings/platforms',  label: 'Platforms',  icon: '▢', active: false },
  { id: 'users',      href: '/settings/users',      label: 'Users',     icon: '◎', active: false },
  { id: 'friction',   href: '/settings/friction',   label: 'Orb Issues', icon: '⚠', active: false },
  { id: 'data',       href: '/settings/data',       label: 'Data',      icon: '⬡', active: false },
]

export default function SettingsSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = NAV
    .filter(item => (item.id !== 'users' && item.id !== 'friction') || isAdmin)
    .map(item => ({ ...item, active: pathname === item.href || pathname.startsWith(item.href + '/') }))
  return <CollapsibleSidebar items={items} />
}
