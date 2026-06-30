'use client'

import { useEffect, useState } from 'react'
import { useSystemState } from '@/components/SystemStateProvider'

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

function labelFor(format: Format, version: string): string {
  return format === 'orb' ? `Orb ${version}` : version
}

/**
 * App version label safe across SSR hydration and deploy skew (stale HTML vs fresh JS).
 * Server and first client paint use a stable placeholder; the real version is set after mount.
 */
export default function OrbVersionLabel({ className, as: Tag = 'span', format = 'orb' }: Props) {
  const { clientVersion } = useSystemState()
  const [text, setText] = useState(() => PLACEHOLDER[format])

  useEffect(() => {
    setText(labelFor(format, clientVersion))
  }, [clientVersion, format])

  return <Tag className={className}>{text}</Tag>
}
