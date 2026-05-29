'use client'

import { usePathname } from 'next/navigation'
import CollapsibleSidebar, { type SidebarItem } from '@/components/CollapsibleSidebar'
import { isPasskeyAvailable } from '@/lib/passkey'

const NAV: SidebarItem[] = [
  { id: 'priorities', href: '/settings/priorities', label: 'Priorities', icon: '▴', active: false },
  { id: 'statuses',   href: '/settings/statuses',   label: 'Statuses',   icon: '◪', active: false },
  { id: 'platforms',  href: '/settings/platforms',  label: 'Platforms',  icon: '💻', active: false },
  { id: 'urgency',    href: '/settings/urgency',    label: 'Urgency Threshold', icon: '⚡', active: false },
  { id: 'notifications', href: '/settings/notifications', label: 'Notifications', icon: '🔔', active: false },
  { id: 'passkeys', href: '/settings/passkeys', label: 'Passkeys', icon: '🔑', active: false },
  { id: 'projects',   href: '/settings/projects',   label: 'Projects',   icon: '◈', active: false },
  { id: 'users',      href: '/settings/users',      label: 'Users',      icon: '◎', active: false },
  { id: 'invitations', href: '/settings/invitations', label: 'Invitations', icon: '✉', active: false },
  { id: 'tickets',    href: '/settings/tickets',    label: 'Tickets',    icon: '⊙', active: false },
  { id: 'maintenance', href: '/settings/maintenance', label: 'Maintenance Mode', icon: '🛠', active: false },
  { id: 'data',       href: '/settings/data',       label: 'Data',       icon: '⬡', active: false },
  { id: 'whats-new',  href: '/settings/whats-new',  label: "What's New", icon: '✨', active: false },
]

export default function SettingsSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const passkeyDomainOk = isPasskeyAvailable()
  const items = NAV
    .filter(item => {
      if (item.id === 'passkeys') return isAdmin && passkeyDomainOk
      if (['users', 'invitations', 'tickets', 'maintenance'].includes(item.id)) return !!isAdmin
      return true
    })
    .map(item => ({ ...item, active: pathname === item.href || pathname.startsWith(item.href + '/') }))
  return <CollapsibleSidebar items={items} />
}

