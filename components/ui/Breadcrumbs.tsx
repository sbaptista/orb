'use client'

import NavLink from '@/components/settings/NavLink'
import { usePathname } from 'next/navigation'
import { useBreadcrumbOverrides } from '@/lib/hooks/useBreadcrumbOverrides'

interface BreadcrumbsProps {
  /** First crumb. Defaults to Settings (Dashboard link is now in AppNav). */
  root?: { label: string; path: string }
}

// Pages whose URL doesn't reflect their navigational parent.
// key = final path segment, value = { label, path } of the intermediate crumb to insert.
const PARENT_CRUMBS: Record<string, { label: string; path: string }> = {
  knowledge: { label: 'Data', path: '/settings/data' },
}

export default function Breadcrumbs({ root = { label: 'Settings', path: '/settings' } }: BreadcrumbsProps) {
  const pathname = usePathname()
  const { overrides } = useBreadcrumbOverrides()
  const segments = pathname.split('/').filter(Boolean)

  // Skip segments already covered by root (e.g. root="/settings" skips the "settings" segment)
  const rootSegments = root.path.split('/').filter(Boolean)
  const breadcrumbs = [root]
  let currentPath = root.path

  for (let i = rootSegments.length; i < segments.length; i++) {
    // Insert a parent crumb if this segment has a navigational parent not in the URL
    const parent = PARENT_CRUMBS[segments[i]]
    if (parent && !breadcrumbs.some(b => b.path === parent.path)) {
      breadcrumbs.push(parent)
    }
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
