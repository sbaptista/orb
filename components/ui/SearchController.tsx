'use client'

import type { ReactNode } from 'react'

type Props = {
  /** Info text shown in the top row. Omit or pass null to hide the top row entirely. */
  info?: ReactNode
  /** Optional trailing element in the top row (e.g. a Reset button). */
  infoTrailing?: ReactNode
  /** Controls rendered in the bottom row. */
  children: ReactNode
  /** Visual variant. 'enclosed' = shaded top + border. 'minimal' = divider line only. Default: 'enclosed'. */
  variant?: 'enclosed' | 'minimal'
}

export default function SearchController({ info, infoTrailing, children, variant = 'enclosed' }: Props) {
  const hasInfo = info != null
  const cls = variant === 'minimal' ? 'search-ctrl search-ctrl--minimal' : 'search-ctrl'

  return (
    <div className={cls}>
      {hasInfo && (
        <div className="search-ctrl-top">
          <span className="search-ctrl-info">{info}</span>
          {infoTrailing && <span className="search-ctrl-trailing">{infoTrailing}</span>}
        </div>
      )}
      <div className={`search-ctrl-bottom${hasInfo ? '' : ' search-ctrl-bottom--solo'}`}>
        {children}
      </div>
    </div>
  )
}
