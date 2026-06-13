'use client'

import { usePathname } from 'next/navigation'
import CollapsibleSidebar, { type SidebarItem } from '@/components/CollapsibleSidebar'

const NAV: SidebarItem[] = [
  { id: 'urgency',    href: '/settings/urgency',    label: 'Urgency Threshold', icon: '⚡', active: false },
  { id: 'notifications', href: '/settings/notifications', label: 'Notifications', icon: '🔔', active: false },
  { id: 'projects',   href: '/settings/projects',   label: 'Projects',   icon: '◈', active: false },
  { id: 'users',      href: '/settings/users',      label: 'Users',      icon: '◎', active: false },
  { id: 'invitations', href: '/settings/invitations', label: 'Invitations', icon: '✉', active: false },
  { id: 'tickets',    href: '/settings/tickets',    label: 'Tickets',    icon: '⊙', active: false },
  { id: 'maintenance', href: '/settings/maintenance', label: 'Maintenance Mode', icon: '🛠', active: false },
  { id: 'knowledge', href: '/settings/knowledge', label: 'Knowledge', icon: '📚', active: false },
  { id: 'audit',     href: '/settings/audit',     label: 'Audit Log', icon: '📋', active: false },
  { id: 'backup',     href: '/settings/backup',     label: 'Backup',     icon: '⬡', active: false },
  { id: 'archive',    href: '/settings/archive',    label: 'Archive',    icon: '⧖', active: false },
  { id: 'whats-new',  href: '/settings/whats-new',  label: "What's New", icon: '✨', active: false },
]

export default function SettingsSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = NAV
    .filter(item => {
      if (['users', 'invitations', 'tickets', 'maintenance', 'knowledge', 'audit'].includes(item.id)) return !!isAdmin
      return true
    })
    .map(item => ({ ...item, active: pathname === item.href || pathname.startsWith(item.href + '/') }))
  return <CollapsibleSidebar items={items} />
}

