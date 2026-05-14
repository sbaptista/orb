'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges'
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
        confirmNavigation(() => router.push(String(props.href)))
      }}
    />
  )
}
