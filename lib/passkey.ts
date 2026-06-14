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

/** The only domain where the WebAuthn RP ID is configured. */
const PASSKEY_RP_HOSTNAME = 'orb-eight-lake.vercel.app'

/**
 * Check if the current browser supports WebAuthn / passkeys.
 * Must be called client-side only.
 */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.PublicKeyCredential
}

/**
 * Check if passkeys can actually work on this domain.
 * WebAuthn RP ID is only configured for production — localhost and staging
 * will always fail with "invalid domain". Returns false there so the UI
 * can hide passkey options entirely.
 */
export function isPasskeyAvailable(): boolean {
  if (!isPasskeySupported()) return false
  if (typeof window === 'undefined') return false
  return window.location.hostname === PASSKEY_RP_HOSTNAME
}

// ── Conditional Mediation Support ──

/**
 * Check if the browser supports conditional mediation (passkey autofill).
 * Four-step gate per the proposal:
 * 1. window.PublicKeyCredential exists
 * 2. isConditionalMediationAvailable exists
 * 3. isConditionalMediationAvailable() returns true
 * 4. Domain is production
 */
export async function isConditionalMediationSupported(): Promise<boolean> {
  if (!isPasskeyAvailable()) return false
  try {
    if (typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') return false
    return await PublicKeyCredential.isConditionalMediationAvailable()
  } catch {
    return false
  }
}

// ── Base64URL helpers ──

/** Decode a base64url string to Uint8Array. */
function base64urlDecode(str: string): Uint8Array {
  // Pad to multiple of 4
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Encode a Uint8Array to base64url string (no padding). */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Parse the server's credential request options into the format
 * navigator.credentials.get() expects (ArrayBuffer challenges/IDs).
 */
function parseRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  // Use browser's built-in parser if available
  if (typeof PublicKeyCredential !== 'undefined' &&
      'parseRequestOptionsFromJSON' in PublicKeyCredential &&
      typeof (PublicKeyCredential as any).parseRequestOptionsFromJSON === 'function') {
    return (PublicKeyCredential as any).parseRequestOptionsFromJSON(options)
  }

  const parsed: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64urlDecode(options.challenge).buffer,
  }

  if (options.allowCredentials?.length > 0) {
    parsed.allowCredentials = options.allowCredentials.map((cred: any) => ({
      ...cred,
      id: base64urlDecode(cred.id).buffer,
      type: cred.type || 'public-key',
      transports: cred.transports,
    }))
  }

  return parsed
}

/**
 * Serialize a PublicKeyCredential response for Supabase's verify endpoint.
 */
function serializeCredentialResponse(credential: Credential): any {
  // Use built-in toJSON if available
  if ('toJSON' in credential && typeof (credential as any).toJSON === 'function') {
    return (credential as any).toJSON()
  }

  const cred = credential as PublicKeyCredential
  const response = cred.response as AuthenticatorAssertionResponse

  return {
    id: cred.id,
    rawId: cred.id,
    response: {
      authenticatorData: base64urlEncode(new Uint8Array(response.authenticatorData)),
      clientDataJSON: base64urlEncode(new Uint8Array(response.clientDataJSON)),
      signature: base64urlEncode(new Uint8Array(response.signature)),
      userHandle: response.userHandle
        ? base64urlEncode(new Uint8Array(response.userHandle))
        : undefined,
    },
    type: 'public-key',
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: (cred as any).authenticatorAttachment ?? undefined,
  }
}

// ── Authentication ──

/**
 * Sign in with a passkey via conditional mediation (autofill).
 * Runs in the background — the browser silently waits for the user to
 * select a passkey from autofill. Returns session on success.
 *
 * Requires autocomplete="username webauthn" on the email input.
 */
export async function authenticateWithConditionalMediation(
  supabase: SupabaseClient,
  abortController: AbortController
): Promise<PasskeyResult<{ session: any }>> {
  try {
    // Step 1: Get challenge from Supabase
    const { data, error } = await (supabase.auth as any).passkey.startAuthentication()
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to start authentication' }
    }

    // Step 2: Call navigator.credentials.get with conditional mediation
    const publicKeyOptions = parseRequestOptions(data.options)
    const credential = await navigator.credentials.get({
      publicKey: publicKeyOptions,
      mediation: 'conditional' as CredentialMediationRequirement,
      signal: abortController.signal,
    })

    if (!credential) {
      return { ok: false, error: 'no_credentials' }
    }

    // Step 3: Serialize and verify with Supabase
    const serialized = serializeCredentialResponse(credential)
    const verify = await (supabase.auth as any).passkey.verifyAuthentication({
      challengeId: data.challenge_id,
      credential: serialized,
    })

    if (verify.error) {
      return { ok: false, error: verify.error.message }
    }

    return { ok: true, data: { session: verify.data?.session } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Abort is expected — user typed email or navigated away
    if (msg.includes('AbortError') || msg.includes('abort')) {
      return { ok: false, error: 'aborted' }
    }
    return { ok: false, error: msg }
  }
}

/**
 * Sign in with a passkey (modal flow). Handles the full WebAuthn ceremony
 * via Supabase SDK. Returns session data on success.
 */
export async function authenticateWithPasskey(
  supabase: SupabaseClient
): Promise<PasskeyResult<{ session: any }>> {
  try {
    const { data, error } = await (supabase.auth as any).signInWithPasskey()

    if (error) {
      if (error.message?.includes('AbortError') || error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        return { ok: false, error: 'cancelled' }
      }
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
      const m = error.message || ''
      if (m.includes('AbortError') || m.includes('cancelled') || m.includes('canceled') || m.includes('not allowed')) {
        return { ok: false, error: 'cancelled' }
      }
      return { ok: false, error: m }
    }

    return { ok: true, data: data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not allowed')) {
      return { ok: false, error: 'cancelled' }
    }
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
