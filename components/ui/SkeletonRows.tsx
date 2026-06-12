'use client'

type Props = {
  rows?: number
}

export default function SkeletonRows({ rows = 5 }: Props) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-bone skeleton-bone--sm" />
          <div className="skeleton-bone skeleton-bone--lg" style={{ width: `${70 - i * 8}%` }} />
        </div>
      ))}
    </div>
  )
}
