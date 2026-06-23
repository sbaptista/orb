'use client'

import type { ReactNode } from 'react'

type Props = {
  /** Page info text shown in the top row (e.g. "p.1 · 1–50 of 3,379"). */
  info: ReactNode
  /** Pagination controls rendered in the bottom row. Omit to show info-only. */
  children?: ReactNode
  /** Visual variant. Default: 'enclosed'. */
  variant?: 'enclosed' | 'minimal'
  /** When true, show only the info row (no bottom nav row). */
  infoOnly?: boolean
}

export default function PaginationController({ info, children, variant = 'enclosed', infoOnly }: Props) {
  const cls = variant === 'minimal' ? 'pag-ctrl pag-ctrl--minimal' : 'pag-ctrl'

  return (
    <div className={cls}>
      <div className="pag-ctrl-top">{info}</div>
      {!infoOnly && children && <div className="pag-ctrl-bottom">{children}</div>}
    </div>
  )
}
