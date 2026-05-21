'use client'

import { usePathname } from 'next/navigation'
import CollapsibleSidebar, { type SidebarItem } from '@/components/CollapsibleSidebar'

const NAV: SidebarItem[] = [
  { id: 'priorities', href: '/settings/priorities', label: 'Priorities', icon: '▴', active: false },
  { id: 'statuses',   href: '/settings/statuses',   label: 'Statuses',   icon: '◪', active: false },
  { id: 'urgency',    href: '/settings/urgency',    label: 'Urgency Threshold', icon: '⚡', active: false },
  { id: 'notifications', href: '/settings/notifications', label: 'Notifications', icon: '🔔', active: false },
  { id: 'projects',   href: '/settings/projects',   label: 'Projects',   icon: '◈', active: false },
  { id: 'users',      href: '/settings/users',      label: 'Users',      icon: '◎', active: false },
  { id: 'invitations', href: '/settings/invitations', label: 'Invitations', icon: '✉', active: false },
  { id: 'tickets',    href: '/settings/tickets',    label: 'Tickets',    icon: '⚠', active: false },
  { id: 'data',       href: '/settings/data',       label: 'Data',       icon: '⬡', active: false },
  { id: 'whats-new',  href: '/settings/whats-new',  label: "What's New", icon: '✨', active: false },
]

export default function SettingsSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = NAV
    .filter(item => !(['users', 'tickets', 'invitations'].includes(item.id)) || isAdmin)
    .map(item => ({ ...item, active: pathname === item.href || pathname.startsWith(item.href + '/') }))
  return <CollapsibleSidebar items={items} />
}
