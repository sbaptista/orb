'use client'

import { useEffect, useState } from 'react'
import { VERSION } from '@/lib/version'

type Format = 'orb' | 'version'

type Props = {
  className?: string
  as?: 'span' | 'div'
  /** `orb` → "Orb v0.5.1"; `version` → "v0.5.1" (VERSION already includes the v prefix). */
  format?: Format
}

const PLACEHOLDER: Record<Format, string> = {
  orb: 'Orb',
  version: '',
}

function labelFor(format: Format): string {
  return format === 'orb' ? `Orb ${VERSION}` : VERSION
}

/**
 * App version label safe across SSR hydration and deploy skew (stale HTML vs fresh JS).
 * Server and first client paint use a stable placeholder; the real version is set after mount.
 */
export default function OrbVersionLabel({ className, as: Tag = 'span', format = 'orb' }: Props) {
  const [text, setText] = useState(() => PLACEHOLDER[format])

  useEffect(() => {
    setText(labelFor(format))
  }, [format])

  return <Tag className={className}>{text}</Tag>
}
