'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable, listPasskeys } from '@/lib/passkey'

/**
 * Wraps authenticated pages. If the device supports passkeys and the user
 * has none registered, redirects to /auth/setup-passkey before showing
 * the page content. Users without WebAuthn support pass through immediately.
 */
export default function PasskeyGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function check() {
      // Device doesn't support passkeys — let them through
      if (!isPasskeyAvailable()) {
        setChecked(true)
        return
      }

      try {
        const result = await listPasskeys(supabase)
        if (result.ok && result.data && result.data.length === 0) {
          // No passkeys registered — redirect to mandatory setup
          router.replace('/auth/setup-passkey')
          return
        }
      } catch {
        // If the check fails, don't block the user
      }

      setChecked(true)
    }
    check()
  }, [supabase, router])

  if (!checked) {
    return null
  }

  return <>{children}</>
}
