import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──

export interface PasskeyResult<T = void> {
  ok: boolean
  error?: string
  data?: T
}

export interface PasskeyEntry {
  id: string
  friendly_name: string | null
  created_at: string
}

// ── Support Detection ──

/**
 * Check if the current browser supports WebAuthn / passkeys.
 * Must be called client-side only.
 */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.PublicKeyCredential
}

// ── Authentication ──

/**
 * Sign in with a passkey. Handles the full WebAuthn ceremony via Supabase SDK.
 * Returns session data on success.
 */
export async function authenticateWithPasskey(
  supabase: SupabaseClient
): Promise<PasskeyResult<{ session: any }>> {
  try {
    const { data, error } = await (supabase.auth as any).signInWithPasskey()

    if (error) {
      // User cancelled the WebAuthn prompt
      if (error.message?.includes('AbortError') || error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        return { ok: false, error: 'cancelled' }
      }
      // No credentials found for this device
      if (error.message?.includes('no credentials') || error.message?.includes('NotAllowedError')) {
        return { ok: false, error: 'no_credentials' }
      }
      return { ok: false, error: error.message }
    }

    return { ok: true, data: { session: data?.session } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── Registration ──

/**
 * Register a new passkey for the current authenticated user.
 * Requires an active session.
 */
export async function registerPasskey(
  supabase: SupabaseClient
): Promise<PasskeyResult<PasskeyEntry>> {
  try {
    const { data, error } = await (supabase.auth as any).registerPasskey()

    if (error) {
      if (error.message?.includes('AbortError') || error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        return { ok: false, error: 'cancelled' }
      }
      return { ok: false, error: error.message }
    }

    return { ok: true, data: data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── List ──

/**
 * List all passkeys for the current user. Requires an active session.
 */
export async function listPasskeys(
  supabase: SupabaseClient
): Promise<PasskeyResult<PasskeyEntry[]>> {
  try {
    const { data, error } = await (supabase.auth as any).passkey.list()

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: data?.passkeys ?? data ?? [] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── Rename ──

/**
 * Rename a passkey by its ID. Requires an active session.
 */
export async function renamePasskey(
  supabase: SupabaseClient,
  passkeyId: string,
  friendlyName: string
): Promise<PasskeyResult> {
  try {
    const { error } = await (supabase.auth as any).passkey.update({
      passkeyId,
      friendlyName,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── Delete ──

/**
 * Delete a passkey by its ID. Requires an active session.
 */
export async function removePasskey(
  supabase: SupabaseClient,
  passkeyId: string
): Promise<PasskeyResult> {
  try {
    const { error } = await (supabase.auth as any).passkey.delete({
      passkeyId,
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
