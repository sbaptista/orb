'use client'

import NavLink from '@/components/settings/NavLink'
import { usePathname } from 'next/navigation'
import { useBreadcrumbOverrides } from '@/lib/hooks/useBreadcrumbOverrides'

interface BreadcrumbsProps {
  /** First crumb. Defaults to Dashboard. */
  root?: { label: string; path: string }
}

export default function Breadcrumbs({ root = { label: 'Dashboard', path: '/dashboard' } }: BreadcrumbsProps) {
  const pathname = usePathname()
  const { overrides } = useBreadcrumbOverrides()
  const segments = pathname.split('/').filter(Boolean)

  const breadcrumbs = [root]
  let currentPath = ''

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`
    const seg = segments[i]
    let label = seg.charAt(0).toUpperCase() + seg.slice(1)

    const isUuid = seg.length > 20 || /^[0-9a-f]{8}-/.test(seg)
    if (isUuid) {
      if (segments[i - 1] === 'users') label = 'Projects'
      else if (segments[i - 1] === 'projects') label = 'Todos'
      else label = 'Detail'
    }

    const path = overrides[currentPath] ?? currentPath
    breadcrumbs.push({ label, path })
  }

  return (
    <div className="sl-breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1
        return (
          <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLast ? (
              <span style={{ color: 'var(--text)' }}>{crumb.label}</span>
            ) : (
              <>
                <NavLink href={crumb.path} className="sl-back" style={{ color: 'var(--text2)' }}>
                  {crumb.label}
                </NavLink>
                <span>/</span>
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}
