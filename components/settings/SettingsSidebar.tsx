'use client'

import { usePathname } from 'next/navigation'
import CollapsibleSidebar, { type SidebarItem } from '@/components/CollapsibleSidebar'

const NAV: SidebarItem[] = [
  { id: 'account',    href: '/settings/account',    label: 'Account',    icon: '◉', active: false },
  { id: 'products',   href: '/settings/products',   label: 'Projects',   icon: '◈', active: false },
  { id: 'priorities', href: '/settings/priorities', label: 'Priorities', icon: '▴', active: false },
  { id: 'statuses',   href: '/settings/statuses',   label: 'Statuses',   icon: '◪', active: false },
  { id: 'platforms',  href: '/settings/platforms',  label: 'Platforms',  icon: '▢', active: false },
  { id: 'data',       href: '/settings/data',       label: 'Data',       icon: '⬡', active: false },
]

export default function SettingsSidebar() {
  const pathname = usePathname()
  const items = NAV.map(item => ({ ...item, active: pathname === item.href }))
  return <CollapsibleSidebar items={items} />
}
