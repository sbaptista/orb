# WIP: ORB-153 Passkey Authentication

## Status: All 5 phases implemented, compiles clean

## What was built

### Phase 1c: Client config
- `lib/supabase/client.ts` — added `auth.experimental.passkey: true`

### Phase 2: Utility module
- `lib/passkey.ts` (NEW) — isPasskeySupported, authenticateWithPasskey, registerPasskey, listPasskeys, renamePasskey, removePasskey

### Phase 3: Login page
- `app/auth/login/page.tsx` — passkey-first button + "or" divider + OTP below

### Phase 4: Settings
- `components/settings/SettingsPasskeys.tsx` (NEW) — passkey list/register/rename/delete
- `app/settings/passkeys/page.tsx` (NEW) — thin route wrapper
- `components/settings/SettingsSidebar.tsx` — added passkeys nav entry
- `components/settings/SettingsAccount.tsx` — added "Manage Passkeys" link card

### Phase 5: Enrollment interstitial
- `app/auth/setup-passkey/page.tsx` (NEW) — post-OTP passkey enrollment prompt
- `app/auth/verify-otp/page.tsx` — conditional redirect to setup-passkey

## Also fixed this session
- ORB-175: Mobile list view actions on same line as title (Safari iOS flex-on-td workaround)
- `app/loading.tsx`: fixed duplicate minHeight TS error

## Prerequisites completed
- SDK upgraded to supabase-js ^2.106.2, ssr ^0.10.3 (previous session)
- Stan enabled passkeys in Supabase dashboard

## Next: Test on localhost
- Login page: passkey button should appear
- Register a passkey from Settings > Passkeys
- Sign out, sign back in with passkey
- OTP login → enrollment interstitial prompt
