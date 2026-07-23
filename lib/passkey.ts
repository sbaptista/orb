import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──

export interface PasskeyResult<T = void> {
  ok: boolean
  error?: string
  failureCode?: PasskeyFailureCode
  stage?: PasskeyRegistrationStage
  data?: T
}

export interface PasskeyEntry {
  id: string
  friendly_name: string | null
  created_at: string
}

export type PasskeyAuthStage =
  | 'challenge_started'
  | 'credential_options_parsed'
  | 'credential_received'
  | 'credential_serialized'
  | 'authentication_verified'

export type PasskeyRegistrationStage =
  | 'challenge_requested'
  | 'challenge_received'
  | 'credential_prompt_opened'
  | 'credential_created'
  | 'credential_verified'

export type PasskeyFailureCode =
  | 'cancelled'
  | 'network_error'
  | 'session_expired'
  | 'unsupported'
  | 'already_registered'
  | 'security_error'
  | 'unknown_error'

// ── Support Detection ──

/** The only domain where the WebAuthn RP ID is configured. */
const PASSKEY_RP_HOSTNAME = 'orb-eight-lake.vercel.app'
const PASSKEY_SETUP_DEFERRED_PREFIX = 'orb_passkey_setup_deferred_'

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

/** User-scoped recovery preference: allow Orb without forcing enrollment again. */
export function deferPasskeySetup(userId: string) {
  try { localStorage.setItem(`${PASSKEY_SETUP_DEFERRED_PREFIX}${userId}`, 'true') } catch {}
}

export function isPasskeySetupDeferred(userId: string) {
  try { return localStorage.getItem(`${PASSKEY_SETUP_DEFERRED_PREFIX}${userId}`) === 'true' } catch { return false }
}

export function clearPasskeySetupDeferred(userId: string) {
  try { localStorage.removeItem(`${PASSKEY_SETUP_DEFERRED_PREFIX}${userId}`) } catch {}
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

/** Parse registration options for navigator.credentials.create(). */
function parseCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  if (typeof PublicKeyCredential !== 'undefined' &&
      'parseCreationOptionsFromJSON' in PublicKeyCredential &&
      typeof (PublicKeyCredential as any).parseCreationOptionsFromJSON === 'function') {
    return (PublicKeyCredential as any).parseCreationOptionsFromJSON(options)
  }

  const parsed: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlDecode(options.challenge).buffer,
    user: {
      ...options.user,
      id: base64urlDecode(options.user.id).buffer,
    },
  }

  if (options.excludeCredentials?.length > 0) {
    parsed.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
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

/** Serialize a registration credential for Supabase's verification endpoint. */
function serializeRegistrationResponse(credential: Credential): any {
  if ('toJSON' in credential && typeof (credential as any).toJSON === 'function') {
    return (credential as any).toJSON()
  }

  const cred = credential as PublicKeyCredential
  const response = cred.response as AuthenticatorAttestationResponse

  return {
    id: cred.id,
    rawId: cred.id,
    response: {
      attestationObject: base64urlEncode(new Uint8Array(response.attestationObject)),
      clientDataJSON: base64urlEncode(new Uint8Array(response.clientDataJSON)),
    },
    type: 'public-key',
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: (cred as any).authenticatorAttachment ?? undefined,
  }
}

function passkeyErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message || error.name
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; name?: unknown; code?: unknown }
    return [value.name, value.code, value.message].filter(part => typeof part === 'string').join(': ')
  }
  return String(error || 'Passkey registration failed')
}

function classifyRegistrationFailure(error: unknown): PasskeyFailureCode {
  const message = passkeyErrorMessage(error).toLowerCase()
  if (/abort|cancel|not.?allowed|timed? ?out/.test(message)) return 'cancelled'
  if (/network|fetch|offline|connection/.test(message)) return 'network_error'
  if (/session.*(missing|expired)|jwt.*expired|refresh token|not authenticated/.test(message)) return 'session_expired'
  if (/not.?supported|unsupported|webauthn.*disabled/.test(message)) return 'unsupported'
  if (/invalidstate|already.*(registered|exists)|exclude.*credential/.test(message)) return 'already_registered'
  if (/security|relying party|rp.?id|domain|origin/.test(message)) return 'security_error'
  return 'unknown_error'
}

function registrationFailure(
  error: unknown,
  stage: PasskeyRegistrationStage
): PasskeyResult<PasskeyEntry> {
  const failureCode = classifyRegistrationFailure(error)
  return {
    ok: false,
    error: failureCode === 'cancelled' ? 'cancelled' : passkeyErrorMessage(error),
    failureCode,
    stage,
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
  supabase: SupabaseClient,
  onStage?: (stage: PasskeyAuthStage) => void
): Promise<PasskeyResult<{ session: any }>> {
  try {
    const { data, error } = await (supabase.auth as any).passkey.startAuthentication()
    onStage?.('challenge_started')
    if (error || !data) {
      const message = error?.message ?? 'Failed to start authentication'
      if (message.includes('AbortError') || message.includes('cancelled') || message.includes('canceled')) {
        return { ok: false, error: 'cancelled' }
      }
      if (message.includes('no credentials') || message.includes('NotAllowedError')) {
        return { ok: false, error: 'no_credentials' }
      }
      return { ok: false, error: message }
    }

    const publicKeyOptions = parseRequestOptions(data.options)
    onStage?.('credential_options_parsed')
    const credential = await navigator.credentials.get({ publicKey: publicKeyOptions })
    onStage?.('credential_received')
    if (!credential) {
      return { ok: false, error: 'no_credentials' }
    }

    const serialized = serializeCredentialResponse(credential)
    onStage?.('credential_serialized')
    const verify = await (supabase.auth as any).passkey.verifyAuthentication({
      challengeId: data.challenge_id,
      credential: serialized,
    })
    onStage?.('authentication_verified')

    if (verify.error) {
      const message = verify.error.message ?? 'Passkey verification failed'
      if (message.includes('AbortError') || message.includes('cancelled') || message.includes('canceled')) {
        return { ok: false, error: 'cancelled' }
      }
      if (message.includes('no credentials') || message.includes('NotAllowedError')) {
        return { ok: false, error: 'no_credentials' }
      }
      return { ok: false, error: message }
    }

    return { ok: true, data: { session: verify.data?.session } }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('AbortError') || msg.includes('cancelled') || msg.includes('canceled')) {
      return { ok: false, error: 'cancelled' }
    }
    if (msg.includes('no credentials') || msg.includes('NotAllowedError')) {
      return { ok: false, error: 'no_credentials' }
    }
    return { ok: false, error: msg }
  }
}

// ── Registration ──

/**
 * Register a new passkey for the current authenticated user.
 * Requires an active session.
 */
export async function registerPasskey(
  supabase: SupabaseClient,
  onStage?: (stage: PasskeyRegistrationStage) => void
): Promise<PasskeyResult<PasskeyEntry>> {
  let stage: PasskeyRegistrationStage = 'challenge_requested'
  try {
    onStage?.(stage)
    const start = await (supabase.auth as any).passkey.startRegistration()
    if (start.error || !start.data) {
      return registrationFailure(start.error ?? new Error('Passkey registration challenge was unavailable'), stage)
    }

    stage = 'challenge_received'
    onStage?.(stage)
    const publicKey = parseCreationOptions(start.data.options)

    stage = 'credential_prompt_opened'
    onStage?.(stage)
    const credential = await navigator.credentials.create({ publicKey })
    if (!credential) {
      return registrationFailure(new Error('No credential was created'), stage)
    }

    stage = 'credential_created'
    onStage?.(stage)
    const serialized = serializeRegistrationResponse(credential)
    const verify = await (supabase.auth as any).passkey.verifyRegistration({
      challengeId: start.data.challenge_id,
      credential: serialized,
    })
    if (verify.error) return registrationFailure(verify.error, stage)

    stage = 'credential_verified'
    onStage?.(stage)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user.id) clearPasskeySetupDeferred(session.user.id)
    } catch {
      // Enrollment succeeded; local preference cleanup must never turn that into a failure.
    }
    return { ok: true, data: verify.data as PasskeyEntry, stage }
  } catch (err: unknown) {
    return registrationFailure(err, stage)
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
