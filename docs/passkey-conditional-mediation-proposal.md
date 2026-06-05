# Proposal: Conditional Mediation for Passkey Login

**Date:** 2026-06-04  
**Status:** Draft — awaiting Stan's review  
**Goal:** Let returning users authenticate with a passkey seamlessly — no button click, no email, just biometric — while keeping email/OTP as the primary path for new users.

---

## The Problem

Today, when a returning user with a registered passkey visits the login page, they must either:
- Click a "Sign in with passkey" button (which we just removed because it confused new users who don't have one), or
- Type their email and go through OTP (defeating the purpose of having a passkey).

Safari and other browsers auto-suggest the passkey via autofill, but without conditional mediation wired up, selecting it just fills the email field — it doesn't authenticate.

## What Conditional Mediation Is

The modern WebAuthn pattern. Instead of a modal dialog, the passkey appears **inline in the browser's autofill UI** when the user focuses the email input. If they select it, the biometric fires and they're authenticated silently. If they don't have a passkey, they just type their email normally. No button, no confusion.

This is how GitHub, Google, Amazon, and most modern apps handle passkey login.

## Technical Approach

Supabase's `signInWithPasskey()` doesn't support conditional mediation — it always triggers the modal. But Supabase's **public two-step API** gives us the pieces:

1. **`supabase.auth.passkey.startAuthentication()`** — POST to Supabase's `/passkeys/authentication/options`, returns a challenge ID + WebAuthn credential request options.
2. **We call `navigator.credentials.get()` ourselves** with `mediation: 'conditional'` + the options from step 1, plus `autocomplete="username webauthn"` on the email input.
3. **When the user selects a passkey from autofill**, the browser returns the credential response.
4. **`supabase.auth.passkey.verifyAuthentication()`** — POST to Supabase's `/passkeys/authentication/verify` with the challenge ID + credential. Returns a session.

No custom server endpoints. No new dependencies. We're just handling the browser ceremony ourselves instead of letting the SDK do it.

## Implementation Plan

### 1. Update `lib/passkey.ts`

Add a new function:

```typescript
export async function startConditionalPasskeyAuth(
  supabase: SupabaseClient,
  abortController: AbortController
): Promise<PasskeyResult<{ session: any }>> {
  // 1. Get challenge from Supabase
  const { data, error } = await supabase.auth.passkey.startAuthentication()
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to start' }

  // 2. Parse options and call navigator.credentials.get with conditional mediation
  const publicKeyOptions = parseRequestOptions(data.options)
  const credential = await navigator.credentials.get({
    publicKey: publicKeyOptions,
    mediation: 'conditional',
    signal: abortController.signal,
  })

  // 3. Serialize the credential response
  const serialized = serializeCredentialResponse(credential)

  // 4. Verify with Supabase
  const verify = await supabase.auth.passkey.verifyAuthentication({
    challengeId: data.challenge_id,
    credential: serialized,
  })

  if (verify.error) return { ok: false, error: verify.error.message }
  return { ok: true, data: { session: verify.data?.session } }
}
```

Helper functions `parseRequestOptions` and `serializeCredentialResponse` replicate what the SDK does internally (base64url decode/encode of challenge and credential fields). These are ~20 lines each.

### 2. Update login page (`app/auth/login/page.tsx`)

- Add `autocomplete="username webauthn"` to the email input.
- On mount, check `PublicKeyCredential.isConditionalMediationAvailable()`.
- If available, call `startConditionalPasskeyAuth()` in the background.
- The browser silently waits for the user to interact with autofill.
- If user selects passkey → biometric → authenticated → redirect to `/dashboard`.
- If user types email instead → abort the conditional mediation, proceed with OTP normally.
- **No passkey button needed.** The autofill UI handles discovery.

### 3. No changes needed to:

- `setup-passkey/page.tsx` — still uses `registerPasskey()` (modal is fine for registration)
- `PasskeyGate.tsx` — still gates users without passkeys
- `verify-otp/page.tsx` — unchanged (just goes to dashboard)
- Any server code or API routes

## Login Page UX After This Change

```
┌─────────────────────────────────┐
│             Orb                 │
│  Enter your email to sign in   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ you@example.com           │  │  ← autocomplete="username webauthn"
│  │  ┌─────────────────────┐  │  │
│  │  │ 🔑 stan@gmail.com   │  │  │  ← OS passkey autofill (if available)
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
│                                 │
│  [ Send verification code ]     │
└─────────────────────────────────┘
```

- **Returning user with passkey:** taps email field → sees passkey in autofill → taps it → biometric → in.
- **New user without passkey:** taps email field → no passkey shown → types email → OTP flow → passkey gate forces registration.
- **User on unsupported browser:** conditional mediation check fails silently → normal email/OTP only.

## Design Principle: Progressive Enhancement

Conditional mediation is a **progressive enhancement**, not a hard dependency. If it's unavailable, unsupported, aborted, or fails at any point, the login page quietly falls back to email/OTP. Passkeys make login faster when available, but never block sign-in.

## Failure Modes and Fallbacks

Every failure path resolves silently — no error toasts, no blocking UI:

| Scenario | Handling |
|----------|----------|
| `PublicKeyCredential` or `isConditionalMediationAvailable()` missing | Do nothing. Page stays in standard OTP mode. |
| `startAuthentication()` fails | Log the error, skip passkey autofill for this session, continue with OTP. |
| User ignores autofill and types email | Abort the pending conditional request, continue with OTP normally. |
| User dismisses biometric prompt / browser returns no credential | Treat as normal cancellation, not an error state. |
| `verifyAuthentication()` fails | Surface a generic non-blocking error only if needed, let user continue with email/OTP. |
| Abort during navigation or unmount | Expected behavior. No error shown. |

## Browser Support and Feature Detection

Conditional mediation support is browser- and platform-dependent. The implementation relies entirely on **runtime feature detection** — no browser sniffing.

**Gating logic (all four must pass before starting conditional mediation):**

1. Check that `window.PublicKeyCredential` exists.
2. Check that `PublicKeyCredential.isConditionalMediationAvailable` exists.
3. Await `PublicKeyCredential.isConditionalMediationAvailable()` — must return `true`.
4. Only then start the background conditional passkey request.

If any check fails, keep the current OTP-first experience unchanged. This keeps the login page safe on older browsers, embedded webviews, and any environment where WebAuthn autofill support is partial or absent.

**Known support:**
- Safari 16+ (macOS Ventura+, iOS 16+)
- Chrome 108+
- Edge 108+
- Firefox: not yet (falls back to email/OTP silently)

## Risks / Caveats

- Conditional mediation is still dependent on browser/platform support and may not appear uniformly across all environments.
- The autofill-based passkey prompt is discoverable for returning users, but invisible to users who don't have a passkey — good for simplicity, but can make debugging harder.
- The login page must handle cancellation and abort paths quietly so users are not shown false-positive errors.
- Because this flow is initiated in the background, careful cleanup is required on unmount and on OTP path selection.

## Estimated Effort

- `lib/passkey.ts` additions: ~60 lines (new function + two helpers)
- `app/auth/login/page.tsx` changes: ~20 lines (autocomplete attr, useEffect for conditional mediation)
- Testing: manual on Safari + Chrome, Mac + iPhone

## Recommendation

Proceed. This preserves the current email/OTP path for everyone, improves the experience for returning passkey users, removes the confusing explicit passkey button, and requires no server-side changes.

## What This Doesn't Change

- Passkey registration flow (still modal-based, still mandatory via PasskeyGate)
- Settings > Passkeys page (still hidden from nav)
- Email/OTP as fallback (always available)
- Supabase as the credential store (no custom tables)
