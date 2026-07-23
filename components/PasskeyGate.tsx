'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable, isPasskeySetupDeferred, listPasskeys } from '@/lib/passkey'

/**
 * Wraps authenticated pages. If the device supports passkeys, the user has
 * none registered, and they have not chosen to register later, redirects to
 * /auth/setup-passkey. Users without WebAuthn support pass through immediately.
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
        // This is only a user-scoped UX preference, not an authorization decision.
        // The dashboard's server component has already authenticated the request.
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user.id && isPasskeySetupDeferred(session.user.id)) {
          setChecked(true)
          return
        }

        const result = await listPasskeys(supabase)
        if (result.ok && result.data && result.data.length === 0) {
          // No passkeys registered and no recovery deferral — offer setup.
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
