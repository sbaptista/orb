# ORB-375 — Security Hardening Phase 1

**Source:** Reduced immediate-containment scope extracted from deferred ORB-374
**Todo:** ORB-375 (`0ae79de4-0824-476b-a96b-f115b2f10405`)
**Status:** Implementation in progress; credential rotation requires Stan's provider-console actions
**Owner:** Codex
**Date:** 2026-08-04 HST

## Scope

This phase implements only the controls Stan selected for immediate use:

1. A protected, human-run Orb development launcher.
2. Containment of the 13 secret-bearing credentials exposed through the former shared environment file: rotate the 12 retained credentials and retire the unused ElevenLabs dependency instead of issuing another key.
3. Owner-only filesystem storage outside the repository and removal of the repository `.env.local` path.

The complete native-sandbox, container, VM, removable-media, production-broker, per-tool hardening, supply-chain, retention, and recurring-audit proposals remain preserved in ORB-374 and are deferred.

## Implemented design

### Human-run launcher

`orb-dev` is a fixed-purpose launcher. It:

- verifies that the secret root and Orb secret directory are owner-only (`0700`) and that the encrypted environment is owner-only (`0600`);
- refuses to run while any repository `.env.local` file or symlink exists;
- detects the current default network interface and IPv4 address rather than assuming `en0` or a home-network subnet;
- uses the Mac's stable Bonjour name (`stanleys-macbook-pro.local`) as the preferred iPhone/iPad URL and the current IPv4 address as a fallback;
- creates or refreshes a trusted local certificate for `localhost`, loopback, the Bonjour hostname, and the current IPv4 address;
- passes only those exact hostnames to Next.js `allowedDevOrigins`, replacing permanent subnet wildcards;
- decrypts the environment only after a human enters its passphrase and exports it directly to the dev-server process; and
- starts Orb on `0.0.0.0:3001` without printing secret values.

The tracked source is `scripts/security/orb-dev`; the installed command is `~/.local/bin/orb-dev`. The executable contains no credentials.

### Encrypted storage

The target layout is:

```text
/Users/stanleybaptista/Project-secrets/          0700
└── orb-secrets/                                 0700
    ├── orb.env.enc                              0600
    └── tls/                                     0700
        ├── orb-dev.pem                          0600
        ├── orb-dev-key.pem                      0600
        └── hosts.txt                            0600
```

`scripts/security/orb-secrets-seal` is deliberately human-run. It validates the expected credential names without printing values, encrypts the current external plaintext file using AES-256-CBC with PBKDF2, and verifies the encrypted copy before replacing any prior encrypted copy. Plaintext removal requires the explicit `--remove-plaintext` option.

After sealing, `orb-secrets-set VARIABLE_NAME` performs one human-approved rotation without recreating the full plaintext file. It prompts without echo for the encryption passphrase and replacement value, decrypts and re-encrypts through a pipeline, verifies the replacement bundle, and atomically installs it at mode `0600`. `orb-secrets-set --remove ELEVENLABS_API_KEY` removes the retired credential through the same verified atomic path. Neither the passphrase nor replacement is accepted as a command-line argument.

Encryption is necessary because `0600/0700` protects against other macOS accounts but not an AI tool running as Stan's own account. An AI may be able to read the encrypted file, but it cannot recover the values without the human-held passphrase. This is a storage boundary, not a complete process-isolation boundary.

### Credential rotation

The following retained secret-bearing credentials must be replaced in their authoritative provider consoles and updated in each required development or production consumer:

- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_ADMIN_API_KEY`
- `ORB_API_SECRET`
- `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_BILLING_CREDENTIALS_JSON_BASE64`
- `MISTRAL_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_ADMIN_API_KEY`

`ELEVENLABS_API_KEY` is deliberately retired rather than rotated. OpenAI Realtime is the production voice path; ORB-375 removes the legacy ElevenLabs TTS adapter, Voice Settings option, quota poller, new rate-card option, and build/runtime credential requirements while preserving historical provider, request-ledger, and financial records.

Rotation is not automated because each provider has different issuance, overlap, revocation, and deployment semantics. For each credential, Stan updates every required local and hosted consumer, verifies normal operation, revokes the old value, and verifies the old value fails. After all replacements are sealed and tested, the external plaintext `.env.local` is removed.

### Verified Orb consumer inventory

This source-level inventory identifies where each environment name is consumed. Vercel must receive replacements for production runtime variables; the encrypted development bundle receives replacements needed by localhost. Provider-console and Helm/shared-infrastructure consumers still require separate verification before revocation.

| Credential | Verified Orb consumer class | Development | Production/Vercel |
|---|---|---:|---:|
| `SUPABASE_SECRET_KEY` | Admin/service Supabase clients, email support, eval and maintenance scripts | Yes | Yes |
| `DATABASE_URL` | Direct database/test scripts; no application runtime reference found | Yes | No source evidence |
| `ANTHROPIC_API_KEY` | Serial Orb, eval endpoint, mutation authorization, developer channel | Yes | Yes |
| `ANTHROPIC_ADMIN_API_KEY` | Provider usage/cost monitoring | Yes | Yes |
| `ORB_API_SECRET` | Task/repository/state/dev-channel APIs, proxy and capability checks, eval scripts | Yes | Yes |
| `RESEND_API_KEY` | Email and reminder delivery | Yes | Yes |
| `VAPID_PRIVATE_KEY` | Web Push signing | Yes | Yes |
| `GEMINI_API_KEY` | Gemini strategic model route | Yes | Yes |
| `GOOGLE_BILLING_CREDENTIALS_JSON_BASE64` | Google provider usage/cost monitoring | Yes | Yes |
| `MISTRAL_API_KEY` | Mistral model adapter | Yes | Yes while adapter remains deployable |
| `OPENAI_API_KEY` | Realtime voice sessions, speech-to-text, legacy TTS; use an Orb project service-account key, not a user-owned key | Yes | Yes |
| `OPENAI_ADMIN_API_KEY` | Provider usage/cost monitoring | Yes | Yes |

“No source evidence” means the repository search found no production application reference; it does not prove that Vercel, Supabase, GitHub, Helm, or an external worker lacks a separately configured consumer. Those external planes must be inspected before the old credential is revoked.

Cross-project verification found one confirmed shared value: Orb's `ORB_API_SECRET` equals Helm's differently named `TODOS_API_SECRET` (verified by comparing hashes, without printing either value). That rotation must update the Orb server and every Helm caller as one coordinated operation. Helm also uses variables named `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY`, but their stored values differ from Orb's; rotating Orb's copies does not rotate Helm's independent credentials.

### Safe rotation sequence

1. Create a replacement while the current credential remains valid whenever the provider permits overlapping keys.
2. Put the replacement into the external Orb rotation file and the matching Vercel Production/Preview environments. Mark Vercel values sensitive where supported.
3. For `ORB_API_SECRET`, update Helm's `TODOS_API_SECRET` in the same change window.
4. Redeploy every affected Vercel project; Vercel environment changes do not alter already-built deployments.
5. Verify the affected local and production workflow with the replacement.
6. Revoke/delete the former provider credential, then verify a harmless request using the former value is rejected.
7. Check logs for authentication failures that would reveal a missed consumer or silent fallback.

Do not retain an exposed credential merely to perform the negative test. If the old value is no longer held after the encrypted bundle and hosted consumers are replaced, the provider's irreversible deleted/revoked state plus successful new-key operation is the accepted evidence; keeping an extra recoverable copy would weaken containment to prove a condition the provider already enforces.

Special cases:

- Prefer a new Supabase `sb_secret_...` key over rotating the legacy JWT/service-role secret; Supabase supports overlapping secret keys so consumers can move without invalidating user sessions.
- Resetting the Supabase database password changes `DATABASE_URL` without an overlap window. Do it after identifying every direct Postgres client and be prepared to update each connection immediately.
- `VAPID_PRIVATE_KEY` belongs to a public/private pair. A real rotation also changes `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and can require browsers to create new push subscriptions; do not rotate only the private half.
- `RESEND_API_KEY` should be a sending-only, domain-restricted key because Orb sends mail but does not administer the Resend account.
- OpenAI's runtime credential should be owned by a nonhuman service account scoped to the Orb project rather than by “You,” Stan's personal identity. Prefer separate `orb-development` and `orb-production` service accounts/keys so localhost and Vercel do not share one blast radius. A service-account key defaults to read/write access across the project's API resources; restrict it in the project's API Keys settings to Orb's required endpoints. The organization admin key is a separate elevated owner credential used for consumption reporting and cannot be replaced by a project-scoped service account. Create, scope, and revoke the runtime and admin credentials independently. Anthropic's admin credential is likewise separate from its ordinary API key.

### Rotation progress

| Credential | Encrypted localhost | Production/Vercel | Former credential revoked | Verification |
|---|---|---|---|---|
| `SUPABASE_SECRET_KEY` | Replaced | Replaced and redeployed | Revoked | Localhost and production passed before and after revocation |
| `ANTHROPIC_API_KEY` | Replaced | Replaced and redeployed | Revoked | Serial Orb passed after revocation |
| `ANTHROPIC_ADMIN_API_KEY` | Replaced | Replaced and redeployed | Revoked | Anthropic AI Metrics consumption passed after revocation |
| `OPENAI_API_KEY` | Separate development/production project service-account keys | Replaced and redeployed | Revoked | Realtime voice passed after revocation |
| `OPENAI_ADMIN_API_KEY` | Replaced | Replaced and redeployed | Revoked | OpenAI AI Metrics consumption passed after revocation |
| `GEMINI_API_KEY` | Replaced | Replaced and redeployed | Revoked | Strategic Gemini request passed locally and in production after revocation |
| `GOOGLE_BILLING_CREDENTIALS_JSON_BASE64` | Replaced | Replaced and redeployed | Former service-account key deleted | Google/Gemini AI Metrics consumption passed locally and in production after deletion |
| `RESEND_API_KEY` | Replaced | Replaced and redeployed | Revoked | Development and production email passed after revocation |
| `MISTRAL_API_KEY` | Replaced | Replaced in Vercel and redeployed; no active Orb runtime consumer | Revoked | Harmless model request passed after revocation |
| `ELEVENLABS_API_KEY` | Retirement helper ready; encrypted removal pending | Runtime dependency removed in code; Vercel removal pending deployment | Provider keys pending deletion after deployment | Static checks must show no live API path; Settings, AI Metrics, and OpenAI Realtime acceptance remain |
| `DATABASE_URL` | Pending | Pending | Pending | Pending |
| `ORB_API_SECRET` | Pending | Pending with coordinated Helm `TODOS_API_SECRET` update | Pending | Pending |
| `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Pending as a pair | Pending as a pair | Pending | Pending browser resubscription and push checks on all platforms |

## Known boundary and deferred work

The launcher prevents secrets from residing in an AI-readable plaintext file and avoids command-line arguments, shell history, and repository paths. Once started, the required secrets exist in the Next.js process environment. Whether another same-user, unsandboxed tool can inspect that environment is not established: Codex's harmless canary test was inconclusive because its managed sandbox denied `ps` itself. A separate macOS account, VM/container, broker, or tested tool-specific process policy would be required to claim a stronger runtime boundary; those controls remain deferred under ORB-374.

## Verification and performance decision

Deterministic verification:

- shell syntax and helper checks pass via `npm run test:security-launcher`;
- TypeScript and the production build validate the Next.js configuration;
- `orb-dev --check` validates owner/mode, repository-path removal, encrypted-store presence, and current network discovery without decrypting secrets;
- Stan starts the server with `orb-dev` and verifies the printed localhost, Bonjour, and IPv4 URLs on Mac, iPhone, and iPad;
- after rotation, normal development and production workflows pass and every old credential is rejected.

No application performance instrumentation is added. The launcher work affects a human-run development bootstrap command, while ElevenLabs retirement removes a Settings option, a server action branch, and a scheduled external request without adding a new interaction or latency-bearing path. Existing Settings and voice instrumentation remain sufficient.

## Operational references

- [Supabase: migrate to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Supabase: understanding and rotating secret keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Vercel: rotating environment-variable secrets](https://vercel.com/docs/environment-variables/rotating-secrets)
- [Google Cloud: rotate API keys](https://docs.cloud.google.com/docs/authentication/api-keys)
- [Resend: create scoped API keys](https://resend.com/docs/api-reference/api-keys/create-api-key)
- [OpenAI: manage organization admin API keys](https://platform.openai.com/docs/api-reference/admin-api-keys)
