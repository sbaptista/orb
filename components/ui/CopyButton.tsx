'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'

export type ClipboardField = {
  label: string
  value: string | number | boolean | null | undefined
}

export function formatClipboardRecord(recordType: string, fields: ClipboardField[]): string {
  const lines = [recordType.toUpperCase()]

  for (const field of fields) {
    const value = field.value === null || field.value === undefined || field.value === ''
      ? '(empty)'
      : String(field.value)
    lines.push('', `${field.label}:`, value)
  }

  return lines.join('\n')
}

export default function CopyButton({
  value,
  fieldLabel,
  label = 'Copy',
  compact = true,
}: {
  value: string | (() => string | Promise<string>)
  fieldLabel: string
  label?: string
  compact?: boolean
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [copying, setCopying] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  async function copy() {
    if (copying) return
    setCopying(true)
    try {
      const resolvedValue = typeof value === 'function' ? await value() : value
      try {
        await navigator.clipboard.writeText(resolvedValue)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = resolvedValue
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.pointerEvents = 'none'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('Clipboard fallback failed')
      }
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(`Could not copy ${fieldLabel.toLowerCase()}.`)
    } finally {
      setCopying(false)
    }
  }

  return (
    <button
      type="button"
      className={`btn-outline${compact ? ' btn-sm' : ''}`}
      onClick={copy}
      disabled={copying}
      aria-label={`${label} ${fieldLabel}`}
      style={{ minHeight: compact ? undefined : '44px', flexShrink: 0 }}
    >
      {copying ? 'Copying…' : copied ? 'Copied' : label}
    </button>
  )
}
