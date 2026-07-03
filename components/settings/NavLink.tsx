'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges'
import { flushPerformanceEvents, markPerformanceNavigation, startInteraction } from '@/lib/performance/telemetry'
import type { ComponentProps } from 'react'

type NavLinkProps = Omit<ComponentProps<typeof Link>, 'onNavigate'>

export default function NavLink(props: NavLinkProps) {
  const router = useRouter()
  const { confirmNavigation } = useUnsavedChanges()

  return (
    <Link
      {...props}
      onNavigate={(e) => {
        e.preventDefault()
        const href = String(props.href)
        const perf = startInteraction({
          focus: 'settings',
          flow: 'settings-navigation',
          interaction: 'settings_nav_click',
          surface: 'settings-sidebar',
          immediateFlush: true,
          metadata: { href },
        })
        confirmNavigation(() => {
          perf.end(true)
          flushPerformanceEvents()
          markPerformanceNavigation(href)
          router.push(href)
        })
      }}
    />
  )
}
