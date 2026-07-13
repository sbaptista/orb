# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** local/canonical **0.6.188** — production is current (v0.6.188 deployed and Vercel-promoted 2026-07-12). The earlier v0.6.173 rollback from the login-loop bisection has been fully unwound.

---

### Last Session Completed

**ORB-323 — auth hardening + orphan-prevention cleanup (ORB-321 follow-ups) — 2026-07-12 (Claude Code, Opus 4.8) — v0.6.187–v0.6.188 — CLOSED**

Spun off from the ORB-321 login-loop root-cause fix and completed end-to-end (built, shipped, Vercel-promoted, production-verified, closed). All 6 items:
- **#1** Removed the temp `/api/auth-debug` diagnostic endpoint + its `proxy.ts` bypass line.
- **#2** `deleteUser` (`app/actions/delete-user.ts`): `auth.admin.deleteUser` failure is now a **hard error** (was a silent `console.warn` — the swallowed failure that produced ORB-321's orphaned auth users); the "already gone" case is tolerated as success.
- **#3** A valid auth session that can't resolve to a `public.users` row (phantom/orphaned) is now **signed out** via a new **`app/auth/signout/route.ts`** route handler before landing on login, instead of looping `/dashboard ↔ /auth/login`. Key lesson: a **React Server Component can't write cookies** (Supabase `setAll` is try/caught in RSC), so a real sign-out must live in a route handler; the dashboard gate routes `!resolveUser.ok` through it. Do **not** sign out in the proxy on a bare role query — it pre-empts `resolveUser`'s reconciliation/invitation paths.
- **#4** `app/auth/login/page.tsx` never leaks the raw provider error anymore — fixed friendly copy (real error stays in telemetry).
- **#5** Removed the v0.6.184 proxy self-heal band-aid (no longer load-bearing once the root cause was fixed) — shipped separately as v0.6.187.
- **#6** Migration **`scripts/migrations/20260712_orb_adaptations_cascade.sql`**: `orb_adaptations.user_id` FK `NO ACTION → ON DELETE CASCADE` — the **same latent orphan-cause** as the ORB-321 telemetry FKs, found by auditing the *whole* FK class during #2. Applied to the DB (verified). Convention: telemetry FKs → SET NULL (outlive user); personal per-user data → CASCADE.

**Verification:** `tsc` 0, `eslint` 0; representative Tier 1 eval smoke 13/13 (run twice); production-verified after v0.6.188 promotion (passkey sign-in + friendly error, no login loop on Safari/iPad, deleteUser end-to-end orphan check). **Closed** via Orb API (`closed_at` 2026-07-12T20:26:54Z); Knowledge Repo entry `0b1961cc-d149-4b94-be6b-e6540f7cce60`. **Test-user provisioning was scoped OUT** (separate workstream — the one genuinely-open auth item).

---

**ORB-322 — automatic cross-version client-state invalidation (Part B, split from ORB-321) — 2026-07-11 (Claude Code, Opus 4.8) — v0.6.186**

The genuinely-open remainder after ORB-321 (login loop) was closed. Problem: stale version-coupled client state survived deploys because volatile-state clearing only ran from the **Update button** — any other path to a new bundle (plain reload / back-navigation / browser picking up new assets) left stale Orb transcript/input/action-set/command-history state behind, sometimes forcing a manual browser site-data clear.

**Fix (shared module + 3 files):**
- **New `lib/client-state.ts`** — single source of truth: `VERSION_VOLATILE_SESSION_KEYS` (the 3 existing Orb keys **+ added `todos_orb_cmd_hist`**), `LAST_APPLIED_VERSION_KEY`, and shared `clearVersionVolatileState()`.
- **`app/layout.tsx`** — a **pre-hydration inline `<script>`** (first child of `<body>`, built from the shared constants) that runs synchronously during HTML parse — **before React hydrates and before `UnifiedDashboard` reads sessionStorage** (React fires child effects before parent effects, so a provider `useEffect` would lose that race). On boot: if compiled `VERSION !== localStorage[orb_last_applied_version]` → clear the volatile keys + set the marker. Fires **once per version transition**, regardless of how the new bundle arrived.
- **`components/SystemStateProvider.tsx`** — removed the duplicated local key list + clear function; `applyUpdate` now calls the shared helper/constant. Update-button behavior unchanged.

**Preserved across versions (deliberately NOT cleared):** voice prefs (`orb_preferred_voice`/`orb_voice_rate`), dismissed broadcasts, welcome state, saved login email (`last_otp_*`), dev flags, session identity, and the marker itself. (Conservative scope, approved by Stan — the value is the automatic trigger, not a heavier wipe.)

**Decisions recorded:** HTTP cache headers **audited → no change needed** (client polls `/api/version` with `cache: 'no-store'`, `sw.js` has no fetch handler so caches nothing, JS/CSS are content-hashed immutable, authed App Router docs are dynamic — storage was the sole stale-state driver). **No perf instrumentation** (synchronous, non-network, sub-ms boot guard). No DB / UI-catalog / eval impact (client-side, no new UI, not an Orb-conversation change).

**Verification:** `tsc` exit 0, `eslint` 0 on changed files. **Stan tested on the dev server:** version transition clears the Orb transcript/volatile state; prefs/dismissals survive; fires once per transition (second same-version reload clears nothing). **Representative Tier 1 eval smoke set — 13/13 passed** (one case per tool + routing family: create/query/conversational/update/delete/confirm-flow/knowledge/projects/tickets/repository/strategic-routing/memory/voice; ~554k tokens, ~$0.4268, 2m 29s, completed 2026-07-12T19:35:18Z). Not the full Tier 1 by design — ORB-322 is not an Orb-conversation change; the smoke set confirms prompt-assembly/routing didn't regress.

**ORB-322 status: CLOSED 2026-07-12** — v0.6.186 deployed and Vercel-promoted to production; closed via Orb API with attributed resolution notes (server `closed_at` 2026-07-12T19:41:51Z). Knowledge Repo closure entry `8770a2e3-dc23-410a-990d-6e83ea5c7a85` (durable lessons: boot-time version-compare trigger, must-run-before-hydration inline script, single-source-of-truth key list, scope discipline; supersedes the manual-only aspect of KB `6d3e884c`). Behavioral note: a user mid-conversation who reloads *into a new deploy* loses that in-progress conversation (same as the Update-button behavior, intended).

---

**ROOT-CAUSED & FIXED: the WebKit login loop was orphaned auth users + a phantom passkey — NOT cookies — 2026-07-11 (Claude Code, Opus 4.8)**

**READ THIS FIRST — the v0.6.181–v0.6.185 login work below was chasing the WRONG theory (cookie corruption / self-heal / auth-debug). The real cause was found by Stan testing passkeys + DB evidence, then fixed at the data/schema level (no app-version dependency).**

**Real root cause (DB-proven):** `deleteUser` (`app/actions/delete-user.ts`) deletes the `public.users` row, then calls `auth.admin.deleteUser()` — but that's **best-effort (warn, not throw)**. It failed because `orb_metrics` / `orb_model_requests` had `user_id` **NOT NULL + NO ACTION FK** to `auth.users`, so the auth delete hit a FK violation and was swallowed → **orphaned `auth.users` rows survived, with their passkeys.** Selecting the orphan's passkey (`stan.baptista+u1`) authenticated a phantom auth user with no `public.users` row → `resolveUser` can't resolve → **two symptoms from one root:** (a) Supabase `passkey.verifyAuthentication` (`lib/passkey.ts:237`) mints a session → proxy `/dashboard↔/auth/login` **loop**; or (b) verify hangs then errors → raw Supabase msg leaked verbatim at `app/auth/login/page.tsx:126` ("blank page then red error"). WebKit exposed it via the passkey picker; version-independent (why bisection to v0.6.173 "worked" — Stan used his *valid* passkey there).

**Fixes applied to PRODUCTION DB (done, verified):**
1. **Migration** `scripts/migrations/20260711_telemetry_user_id_set_null.sql` (Stan ran it): `orb_metrics.user_id` + `orb_model_requests.user_id` → **nullable + FK `ON DELETE SET NULL`** (matches `performance_events`). Satisfies Stan's requirement that **usage/cost telemetry must OUTLIVE the user** (and become anonymizable later). Also removes the deletion blocker.
2. **Data cleanup** (Stan ran the DELETE): removed the **4 orphaned auth users** (`stan.baptista-t2`, `katherinenagel23@gmail.comworks`, `stevedmiller.sm`, `stan.baptista+u1`). `+u1`'s passkey cascaded away; its **43 `orb_model_requests` + 1 `orb_metrics` preserved with `user_id=NULL`**. Verified: orphans=0, u1 passkeys=0, telemetry kept.

**Confirmation test — DONE:** verified in production (no loop; the removed credential is gone). The remaining hardening from this root-cause fix became **ORB-323** (all 6 items closed 2026-07-12 — see top entry).

**REMAINING (next session — all real, none on fire):**
- ~~**Auth hardening + cleanup → ORB-323**~~ **DONE + CLOSED 2026-07-12 (Claude Code, Opus 4.8).** All 6 items shipped (v0.6.187 item 5 + v0.6.188 items 1-4,6), deployed, Vercel-promoted, production-verified: removed `/api/auth-debug` + proxy bypass; `deleteUser` auth-delete is now a hard error; phantom/unresolvable sessions sign out via new `/auth/signout` route (no loop); `login/page.tsx` never leaks raw provider errors; removed the v0.6.184 self-heal band-aid; **migration `20260712_orb_adaptations_cascade.sql`** (orb_adaptations FK NO ACTION → CASCADE — same latent orphan-cause as the ORB-321 telemetry FKs) applied. Eval smoke 13/13. KB entry `0b1961cc`.
- **Test-user provisioning** (scoped OUT of ORB-323 — the one genuinely-open auth item): real test non-admins + admins with a **login-bypass for one admin + one user**, to collect non-admin telemetry. `dev-login.ts` is existing related infra.
- ~~**Promote production back to latest**~~ **DONE** — v0.6.186 deployed and Vercel-promoted.
- ~~**Correct ORB-321 / split Part B**~~ **DONE 2026-07-11/12 (Claude Code, Opus 4.8).** ORB-321 closed (Part A resolved via the orphaned-auth-user / telemetry-FK fix; wrong cookie-corruption theory documented); Part B split to **ORB-322 → now also CLOSED** (auto client-state invalidation, shipped v0.6.186 — see the top entry). KB entries `c9292534` (ORB-321) + `8770a2e3` (ORB-322).

---

**WebKit login-loop self-heal (proxy auth-cookie reset) — 2026-07-11 (Claude Code, Opus 4.8) — v0.6.184**

**Problem:** production login loops/cycles on **Safari + all iPad browsers (WebKit)**, never reaching the app; only clearing site data fixes it, and this recurs. Decisive clue from Stan: clicking **Update** (which reloads + clears some sessionStorage + pokes the SW but **never clears cookies**) does **not** fix the loop — so the culprit is the **corrupt Supabase auth cookie**, not stale JS/storage/bundle. Confirmed the service worker (`public/sw.js`) has **no fetch handler** (push-only, caches nothing), so "clear cache" really means "clear the cookie."

**Mechanism:** `proxy.ts` calls `getUser()` on every request; on WebKit the chunked `sb-*-auth-token` cookie can end up present-but-invalid, so `getUser` returns inconsistently → proxy flip-flops `/dashboard` (no user → `/auth/login`) ↔ `/auth/login` (user → `/dashboard`) forever.

**Fix (this release, `proxy.ts`):** in the `!user && !authFailed && /dashboard` redirect branch, if any `-auth-token` cookie exists, **expire the auth cookies** on the redirect response → next request is clean → lands on login once (self-heal = the automatic equivalent of the manual site-data clear). Additive; `authFailed` (getUser threw = transient) is excluded so a network blip won't log anyone out; logged-in users (valid getUser) never hit this branch. **No refresh-mechanism change.** Verified: `tsc`/`eslint` clean.

**MUST verify on Chrome + Safari before trusting it** (Safari is the one that reproduces). **This is a mitigation, not a root-cause fix** — the corruption source (chunk-orphaning vs refresh-rotation race) still needs the cookie-chunk evidence (Storage → Cookies when it next loops). Tracked in **ORB-321** (priority 1).

**UPDATE — v0.6.184 did NOT fix iPad (WebKit) — v0.6.185 adds a diagnostic.** Confirmed v0.6.184 live (`/api/version` = v0.6.184) yet iPad Chrome still loops → `getUser` is returning something other than plain `null` on the corrupt cookie (phantom user / error), so the `!user` self-heal branch never fires. Added a **temporary read-only diagnostic** `app/api/auth-debug/route.ts` (v0.6.185; proxy bypasses it via the `isStatic` list) returning `{ hasUser, userIdPrefix, getUserError, authCookies:[{name,size}], totalCookieCount }` — no secrets. Open `https://orb-eight-lake.vercel.app/api/auth-debug` on the looping iPad to read what `getUser` resolves to + the `sb-*-auth-token` chunk state, without devtools. **This endpoint + the self-heal's `!user`-only assumption must both be revisited once the JSON is captured; remove the debug route after.**

**Separate, still-open (issue B):** no automatic cross-version client-state invalidation — `clearVersionVolatileSessionState` is manual-only (Update button) + sessionStorage-only; doesn't touch cookies/localStorage/HTTP cache. Part of the same tracked audit.

---

**ORB-312 — SettingsUserDetail two-action → one-bundle merge (Pass-1-style, safe) — 2026-07-10 (Claude Code, Opus 4.8) — v0.6.183**

The safe, non-auth-path optimization flagged after the outage. `components/settings/SettingsUserDetail.tsx` fired a client `Promise.all([getUserDetail, getUserProjects])` — Next.js serializes server actions, so each paid its own `requireAdmin()` (getUser round-trip) AND separately re-queried the target user's `role_id` for the super-admin gate. Merged into **`getUserDetailBundle(targetUserId)`** in `app/actions/get-user-detail.ts`: one auth gate, one target-user query (covers both profile fields + role gate), then the projects/todos fetches (todos depends on projects → stays sequential). Removes one full server-action round-trip + one redundant role query per user-detail open. Deleted the now-unused `getUserDetail`/`getUserProjects` (only SettingsUserDetail used them; the `getUserProjects` in `SettingsProjects` is a different one from `manage-project.ts`). Added a `settings`-focus `startInteraction` span (`settings-user-detail / load`) so there's a real before/after number under Settings → Performance.

**No auth-path change** (`requireAdmin`/`getAuthContext` untouched — still getUser). Verified: `tsc` clean, `eslint` 0 errors. Not an Orb-conversation change → no eval.

**Reachability fix (same v0.6.183, `components/settings/SettingsUsers.tsx`):** the `/settings/users/[userId]` "{Name}'s Projects" page was **orphaned** — its only in-app link (`SettingsProjectTodos` owner link) is effectively unreachable post settings-reorg, so the page (and thus the optimized load) couldn't be reached. Per Stan: made each **user name a `<Link>`** to that page (documented `--link` nav color, same as the `SettingsProjectTodos` owner link — no new CSS class), and **removed the row's `onClick`/pointer** so the row is no longer clickable — only the existing **Edit** `action-link` opens the modal. UI model: `SettingsCrudList` row + `action-cell`/`action-link` (unchanged) + a nav `Link` on the name cell.

**Awaiting Stan's dev-server test:** Settings → Users → click a name → the "{Name}'s Projects" page renders (projects + per-project todo counts); the row no longer opens edit; Edit link still opens the modal; super-admin access-denied gate still holds. Also uncommitted separately: the ORB-312 doc Pass-3/outage record (docs-only).

---

**ORB-320 filed + closed (not needed): the session-refresh middleware already exists — 2026-07-09 (Claude Code, Opus 4.8) — no code change (prod stable at v0.6.182)**

Filed ORB-320 to "add missing Supabase updateSession middleware" — then discovered the premise was **false**. A 145-line **`proxy.ts`** has existed at the repo root since ~2026-06-30 (Next 16 renamed `middleware` → `proxy`); it already calls `supabase.auth.getUser()` on every request (refresh + cookie propagation), plus maintenance-mode gating and auth redirects. `lib/supabase/server.ts`'s "middleware handles session refresh" comment was literally true.

**Corrected root cause of the outage (final):** the loop was `getClaims()` in server actions (ORB-312 Pass 2) **disagreeing** with the proxy's `getUser()` over an expired token — getClaims rejects it, getUser refreshes it. Server-action getClaims failure → `handleSessionExpired` → `/auth/login` → proxy's getUser succeeds → `/dashboard` → loop. Safari(ITP)/Firefox(ETP) exposed it; Chrome hid it. **Already fully fixed by v0.6.182 (getUser everywhere)** — the correct permanent state. Nothing to build for ORB-320.

- **ORB-320 closed** via Orb API with resolution notes (server-verified `closed_at` 2026-07-10T02:49:10Z). Knowledge Repo entry `17accfad-9606-445d-855e-145bb9a2c370` (5 durable lessons incl. "read files before concluding something is missing"). Abandoned branch `orb-320-session-proxy` (nothing committed); memory corrected (`project_auth_getclaims_vs_proxy`, replacing the earlier wrong "no middleware" note).
- **ORB-312 status:** auth optimizations (Pass 2 getClaims, Pass 3 client-getUser removal) fully reverted and abandoned as unsafe. **Pass 1 (AI Metrics single-bundle merge) remains live** — the one ORB-312 win standing. If ever revisited, getClaims must be made to agree with the proxy AND tested on all 3 browsers.
- **My error accounting:** misdiagnosed the outage 3× (Pass 3 alone → Chrome-only revert → "no middleware"), each from theorizing before reading code. Corrective rule saved to memory.

**Uncommitted:** this HANDOFF.md edit only (docs; no version bump needed — ORB-320 close + KB entry are DB-only). Prod is stable and needs no further push.

---

**HOTFIX 2: revert ORB-312 Pass 2 (getClaims) — Safari/Firefox login loop — 2026-07-09 (Claude Code, Opus 4.8) — v0.6.182**

The v0.6.181 Pass-3 revert fixed **Chrome** but not Safari/Firefox. Stan's cross-browser test was the decisive clue: **Chrome (Mac/iPhone) works; Safari (Mac/iPad) cycles and never reaches the dashboard; Firefox hangs on "authenticating."** Browser-specific auth failure = session-cookie/token persistence, and it traces to Pass 2, not Pass 3.

**Root cause (corrected & complete):** `getAuthContext` (`lib/auth.ts`) used `supabase.auth.getClaims()` (Pass 2, v0.6.177) — local JWT verify that **rejects an expired access token instead of refreshing it**. `getUser()` refreshes via the refresh token; `getClaims()` does not. My Pass-2 code comment claiming it "cannot break auth" was wrong — the getUser fallback is only for key-type/WebCrypto issues, **not** expiry. Safari (ITP) and Firefox (ETP) throttle/block the client's background token auto-refresh, so their access tokens lapse → server-side `getClaims()` rejects → `handleSessionExpired` → login loop. Chrome auto-refreshes fine, so it never hit the expired-token path. Server code is browser-agnostic, but its *input* (fresh vs expired cookie) is browser-dependent. Compounded by the **missing session-refresh middleware** (the standing root cause).

**Fix:** `git checkout c78b965~1 -- lib/auth.ts` — restored `getAuthContext` to the pre-Pass-2 `getUser()` version (refreshes on validate). `getClaims` was only in this one file. Version → 0.6.182; user-facing changelog entry. Verified: `tsc` clean, `eslint` 0 errors.

**State: ORB-312 auth optimizations are now FULLY reverted** (Pass 2 + Pass 3 both undone); auth path is back to pre-ORB-312 (v0.6.176-era) known-good. **Do not re-attempt either optimization until Supabase `updateSession` middleware exists AND the fix is tested on Chrome + Safari + Firefox.** ORB-312 stays open.

---

**HOTFIX: revert ORB-312 Pass 3 — production login/session regression — 2026-07-09 (Claude Code, Opus 4.8) — v0.6.181**

**Outage:** After v0.6.180 deployed, production login broke — sign-in bounced back to login, hung on auth, or cycled in a loop. Reported by Stan.

**Root cause (grounded):** The app has **no Supabase SSR session-refresh `middleware.ts`** — token refresh has been riding on incidental `supabase.auth.getUser()` calls. Pass 2 (v0.6.177) moved server actions to `getClaims()` (local verify, **no refresh**). Pass 3 (v0.6.180) then removed the client-side `getUser()` in `UnifiedDashboard` `client_init` as "redundant" — but it was the **last reliable client-side token-refresh trigger**. With nothing refreshing the access token, it lapsed mid-session → client queries + server actions returned auth errors → `handleSessionExpired` signed the user out → login loop. Ruled out `resolveUser` (its modified select runs fine against prod — columns exist, row returns), so it was not a redirect-loop from a failing query.

**Fix:** `git checkout 305d48f -- components/UnifiedDashboard.tsx lib/resolve-user.ts` — restored both files to their known-good pre–Pass-3 (v0.6.178) state (client `getUser()` + profile query back; `resolveUser` select reverted). Version bumped **forward** to 0.6.181; changelog entry added (user-facing). This also unwinds the v0.6.180 dead-state cleanup (re-land later). Verified: `tsc` clean, `eslint` 0 errors.

**Durable follow-up (before re-attempting Pass 3):** add proper Supabase SSR `updateSession` **middleware** so token refresh doesn't depend on incidental `getUser()` calls. Only after that can Pass 3 (drop redundant client auth) + the dead-state cleanup be re-landed safely. **ORB-312 stays open**; file/track the middleware task.

---

**Dead-state cleanup in UnifiedDashboard (Pass 3 follow-up) — 2026-07-09 (Claude Code, Opus 4.8) — v0.6.180**

Traced the dashboard's profile-derived state after Stan questioned what the Pass 3 fields actually feed. Found several were dead (set, never read): `userName`/`userFullName` state, the `releaseStage` state, and the derived `displayUserName` const — all eslint-flagged. The live greeting already uses `user?.first_name` (the prop) directly; the only *real* consumers of the moved fields are `urgencyThreshold` (urgency/due-soon coloring) and `daysActive` (sent to the Orb as conversation context). Removed the dead state + setters in `components/UnifiedDashboard.tsx`, and reverted the now-orphaned `release_stage` addition from `lib/resolve-user.ts` (type + 3 selects) since nothing consumes it. No behavior change. Verified: `tsc` clean, `eslint` 0 errors (the 3 dead-symbol warnings are gone). Not an Orb-conversation change → no eval.

---

**ORB-312 Pass 3 — dashboard-init redundant client auth/profile removal — 2026-07-09 (Claude Code, Opus 4.8) — v0.6.179**

Measure-first Pass 3. Pulled 97 production `dashboard-init / client_init` samples: the client was re-running `supabase.auth.getUser()` + a `users` profile query on mount even though the server component (`app/dashboard/page.tsx`) already ran `getUser()` → `resolveUser()` and passed the resolved `user` + `initialProducts` down as props (telemetry confirmed `had_projects_query = 0`). Those two redundant round-trips were essentially the **entire** `client_init` duration: Mac p50 362 / p95 1166, iPhone p50 375 / p95 1584, iPad p50 505 / p95 7835 (ms).

**Change (2 files):**
- `lib/resolve-user.ts` — added `urgency_threshold_hours, release_stage, created_at` to the existing `users` select (admin client) + the `ResolvedUser` type. Purely additive; other callers (`auth/callback`, `prototype`, `complete-onboarding`, `dev-login`) only read existing fields / `.ok` / `.isNew`.
- `components/UnifiedDashboard.tsx` — `client_init` now reads all profile fields from the `user` prop instead of calling `getUser()` + the profile query. Kept its sessionStorage/session-change + `selectedId` logic (needs only `user.id`). Removed the now-meaningless `auth_user_loaded`/`profile_loaded` marks. In the normal path (`initialProducts` present) the effect now has **no awaits** → `client_init` should drop to ~0.

**Instrumentation decision:** none added — the existing `client_init` span **is** the before/after instrument. **Measure after deploy:** `dashboard-init / client_init` p50/p95 on v0.6.179 vs the v≤0.6.178 baseline above.

**Out of scope (candidate Pass 4):** the server component's own `getUser()` (SSR round-trip) and `SettingsUserDetail`'s `Promise.all` of two server actions (Next.js serializes them → 2 round-trips, same anti-pattern as Pass 1). **ORB-312 remains open.**

Verified: `tsc` clean, `eslint` 0 errors. Not an Orb-conversation change → no eval needed.

---

**Version reconciliation for `ccb65cf` + ORB-312 pass-2 doc record — 2026-07-09 (Claude Code, Opus 4.8) — v0.6.178**

Bookkeeping catch-up, coordinated live with Codex. Codex's `ccb65cf` (sanitizer / ORB-315 hardening) shipped a code + behavior change on the **same** version string (0.6.177) as the earlier pass-2 commit, with no patch bump or changelog entry — so production served new code under a version "What's New" couldn't distinguish. Per Codex's instruction, reconciled **forward** (no amend of `ccb65cf`): bumped to **0.6.178** (`package.json` + `lib/version.ts`), added the `lib/changelog.ts` entry describing the sanitizer/eval-assertion/ORB-317 closure, and bumped this file's App State version.

Also committed the previously-orphaned ORB-312 **Pass 2 correction record** (`docs/orb-312-performance-optimization.md`) — documents already-shipped v0.6.177: auth was never the bottleneck (`getAuthContext` ~106ms), the residual ~2.1s is server-action round-trip + Vercel cold-start overhead, so the real lever is **fewer server-action round-trips per admin page**. No code change. **ORB-312 remains open** (Pass 3 = round-trip reduction, not yet started).

---

**ORB-317 Strategic Orb v1 closeout + ORB-315 structural project-code speech hardening — 2026-07-09 (Codex, GPT-5) — v0.6.177 (committed `ccb65cf`, pushed)**

Closed the Strategic Orb v1 interaction-quality umbrella after completing and verifying the main foundation pieces:
- **ORB-308** closed earlier in the session after consolidating production/eval context and backlog building through shared `lib/orb-model/context.ts`; Knowledge Repo entry added: `ORB-308: Shared Orb context prevents eval/production drift`.
- **ORB-314** closed as stale-open after verifying the dead generated `ORB_INTEGRITY_RULES` path was already removed and `docs/api-spec.yaml` is REST/API integration guidance, not live conversational prompt law.
- **ORB-315** closed after live eval exposed that prompt-only name-first speech was insufficient: the model still echoed raw project tags like `[code: STOKELYFRO]`.
- **ORB-317** closed after the acceptance eval set passed and the umbrella had enough explicit evidence to close as a v1 foundation, not remain open for every future behavior issue.

**Code shipped in `ccb65cf`:**
- Added `lib/orb-model/speech-sanitizer.ts`, a shared user-facing speech sanitizer that strips raw project-code tags like `[code: STOKELYFRO]` while preserving task codes such as `ORB-315`.
- Applied the sanitizer in both production Orb conversation responses (`app/actions/orb-converse.ts`) and the eval endpoint (`app/api/orb-eval/route.ts`) so eval and live behavior share the same boundary.
- Fixed the ORB-315 eval assertion in `scripts/eval-cases.ts`: the runner checks `speechNotContains` case-insensitively, so banning `THUNDERBOL` falsely failed on the display name `Thunderbolt`. The eval now bans `[code: THUNDERBOL]` instead.

**Verification:**
- Stan ran `project-list-hides-internal-code-tags`: **Tier 2 passed 2/3** after the sanitizer + eval assertion fix.
- Stan ran the ORB-317 acceptance string:
  `project-count-distinguishes-visible-from-active-task-projects,voice-current-project-status-update-uses-brief-summary,voice-status-question-stays-operational,ticket-status-shorthand-followup-checks-live-tickets,query-tickets-admin-lookup`
  Result: **5/5 passed** (Tier 1 3/3, Tier 2 2/2), completed 2026-07-09T22:48:58Z.
- `npx tsc --noEmit` passed.
- `npm run build` passed on Next.js 16.2.1.

**Knowledge Repo:**
- Added `ORB-317: Strategic Orb v1 foundation closes on acceptance evidence` (`25fff0e4-ab2c-494b-9c30-66ae04d0718e`).
- Durable lesson: close umbrellas when the v1 foundation has explicit acceptance evidence; future regressions should become narrower tasks/evals. For Orb interaction quality, prefer structural guards and focused evals over prompt-only hopes.

**Current working tree note:**
- After the push, remaining uncommitted files are Claude-owned local work only: `.claude/settings.local.json` and `docs/orb-312-performance-optimization.md`.
- Do not commit those under the ORB-317/315 closeout unless Stan/Claude explicitly says to.

---

**ORB-312 AI Metrics accounting-load optimization — 2026-07-08 (Claude Code, Opus 4.8) — v0.6.176 (committed `e6ca709`, pushed)**

First ORB-312 optimization pass (measure-first). AI Metrics `ai_accounting_load` was ~3–4s p50; the telemetry stage-split showed it's ~100% server+network (client render ~1ms), and the RPC is only **183ms** on a 3.6k-row table. Root cause: the span fired **two** server actions (`getAiCostSummary` + `getOrbAiSettings`), and **Next.js serializes server actions**, so each paid a full `getAuthContext()` / `supabase.auth.getUser()` network round-trip — the auth cost was paid twice.

**Fix:** new `getAiMetricsBundle(options)` = one `requireAdmin()` + server-side `Promise.all` of both fetches. Extracted `fetchOrbAiSettings(ctx)` into new `lib/orb-model/ai-settings-core.ts` (no auth gate) for reuse; public `getAiCostSummary`/`getOrbAiSettings` wrappers unchanged so other callers (SettingsAI) are unaffected. SettingsMetrics now makes one call. Verified: tsc clean, eslint clean.

**Expected** ~halving (~4s → ~2s). **Measure after deploy:** compare `settings-ai-metrics / ai_accounting_load` p50/p95 on v0.6.176 vs the v≤0.6.175 baseline.

**Residual lever (next, if wanted):** even merged, you pay one `supabase.auth.getUser()` network validation (~1.8s) per admin action; making that cheap (local JWT verify via `getClaims`, or auth-schema health) is a broader shared-auth-path pass — scope separately. **ORB-312 remains open.**

---

**ORB-312 auth telemetry hygiene + correlated login→dashboard span — 2026-07-08 (Claude Code, Opus 4.8) — v0.6.175 (committed `502882e`, pushed)**

Acted on two of the ORB-312 follow-ups surfaced by the login investigation below (both instrumentation, no user-facing behavior change):
- **Auth telemetry hygiene** (`app/actions/performance-events.ts`): an `isBenignPerfEvent` classifier excludes the removed conditional-mediation span + user-cancelled/no-credential/abort/expired passkey outcomes from **both** latency percentiles and the failure rate, reported separately as `benign`. Removes the fake ~30% auth failure rate; genuine failures still count. Settings → Performance shows an "Expected / Benign" stat card.
- **Correlated `route_to_ready` span**: login + verify-otp `markPerformanceNavigation('/dashboard')` at auth-success; `UnifiedDashboard` reads it (single-shot `consumePerformanceNavigationStart`) and emits a `dashboard-init / route_to_ready` span backdated across the redirect via `startInteraction({ startTimeMs })` — the true "signed in → dashboard usable" wait. Also captures sidebar → dashboard.
- Docs: `object-capability-matrix.md` Part 2 (auth + dashboard rows), `ui-catalog.md` (benign card). Verified: `tsc` clean, `eslint` 0 errors, `verify-ui-catalog` passed. No eval (not a conversation change).

**ORB-312 stays open** for the actual optimization passes it surfaced (AI Metrics p95 ~4.5–5.3s cross-platform; dashboard-init p95 ~4.5–5.0s Mac/iPad) — instrumentation is now in place to measure them.

---

**Login page redesign + ORB-312 login-performance investigation — 2026-07-08 (Claude Code, Opus 4.8) — v0.6.174 (committed `3ab6bc6`, pushed)**

Started as an ORB-312 (Production Performance Baseline Sweep) look at "login sometimes takes several minutes." It resolved into a **telemetry + UX finding, not a latency bug**, and then a full login redesign that Stan approved via an iterative prototype.

**The investigation (read-only telemetry):**
- The multi-minute (and one 6.7-hour) auth durations were all WebAuthn **conditional-mediation (passkey autofill) *dwell* time logged as latency** — a background `navigator.credentials.get()` that stays open until the user picks a passkey or leaves. Not sign-in latency.
- Conditional mediation completed **0 of 35** sign-ins in production while firing a background credential request on every login mount. Real passkey sign-in (explicit button) is ~6s, dominated by the OS credential ceremony (environment, not app code). The "31.6% auth failure rate" is almost entirely benign conditional-mediation aborts.
- Also surfaced: `dashboard-init` p95 **4.5–5.0s on Mac/iPad** (n=240/133) is a real, app-side post-login tail; the login→dashboard handoff is **not** captured as one correlated span (login spans end at `router.push`; `dashboard-init` starts fresh, unlinked).

**The redesign (built + shipped):**
- Removed conditional mediation entirely. Passkey sign-in is an explicit button only (key glyph added); email button → **"Request verification code"**; email `autoComplete="email"`.
- Login **and** verify-otp now sit on the calm `MuralCanvas`; frosted translucent `.auth-card` (`rgba(255,255,255,0.96)` + `blur(10px)`, matching `dash-strip-inner`); calm ambient Orb perched **inside** the card's top-right corner (40px, 5.5s breathing).
- The existing `passkeyAvailable` gate already gives new users / passkey-less browsers the email-only path — no new branch. **Note:** passkey is host-gated to production, so **localhost only ever shows the email-only layout** — the passkey button + two-button layout can only be tested on production.
- New `docs/ui-catalog.md` **Login/Auth (`auth-*`)** section. Verified: `tsc` clean, `eslint` clean, `verify-ui-catalog` passed. Not an Orb-conversation change → **no eval needed** (Tier 1 unaffected).

**Tracking:**
- Filed **and closed ORB-319** (login redesign) with attributed resolution notes (server-verified `closed_at`) + Knowledge Repo entry `4adccf73`.

**Still open — ORB-312 follow-ups (next priorities):**
- Correlated **login→dashboard** span (the perceived post-login wait isn't measured end-to-end).
- **Auth telemetry-hygiene:** exclude conditional-mediation dwell + benign passkey aborts from auth latency and failure-rate reporting (otherwise auth always looks slow/broken).
- Add the mural to any remaining auth surfaces if new ones appear. ORB-312 itself remains **open**.

---

**ORB-303 — query_tickets read tool + full closeout, eval de-flake — 2026-07-06 (Claude Code, Opus 4.8) — v0.6.161–v0.6.173**

Anchored on ORB-303 (add a read tool to the create-only tickets surface), which then snowballed through ~11 live-testing-driven fixes. All of it was uncommitted when this session opened (tree was at v0.6.172, HANDOFF was stale at v0.6.160). This session verified the eval gate, de-flaked one fixture, and did the closeout.

**Built (the anchor, v0.6.161):**
- `query_tickets` — admin-only Orb read tool over the tickets table (code/status/type/scope/search/max_results; two-tier detail: compact for lists, full row for a single-code lookup). Reuses `getTickets()` in `app/actions/ticket-actions.ts` and the `auth.isAdmin` gate; gated by filtering `availableOrbTools`, exactly like `query_repository`, plus a conditional prompt line so non-admins know it's gated, not missing.
- Added `tickets` to `lib/db-schema.ts` `ALLOWED_TABLES` so non-admins can ask about their **own** filed tickets via the RLS-scoped `query_db` fallback (`tickets_reporter_select` scopes it automatically) — complementary to the admin tool, not a duplicate.

**The live-testing cascade (v0.6.162–172):**
- Eval auth simulation now derives `isAdmin`/`canInspectRepository` from the resolved user's real role, not hardcoded `true` (v0.6.162).
- Phantom-code guard hardened: now checks the `returned` list every query tool emits + static backlog/recent-tickets context, and `query_db` attaches a formatted `TICKETS-N` code to ticket rows so citing one isn't a false phantom (v0.6.163, v0.6.169).
- No update/delete ticket tool exists for anyone — moved that fact from the admin-only tool description into the universal routing prompt + a server-side guard rejecting `TICKETS-N` on `delete_todo`/`update_todo`/`move_todo` (v0.6.163, v0.6.172).
- "How many bugs" now checks **both** surfaces: `query_todos` gained a `category` filter (+ category UI added to todo create+edit modals — **ORB-318, closed**, new `components/ui/ComboSelect.tsx`) AND the tickets queue, always live-queried, never read off the truncated RECENT TICKETS snippet (v0.6.165–168).
- Voice: speaks the full narrative lead-in up to the first list (v0.6.166); intermittent voice-repeat bug root-caused — spoken text was derived twice per turn — and fixed (v0.6.164, v0.6.170, v0.6.171).
- Non-admin ticket-unavailable framing corrected: "you're not an admin", never "I am non-admin" (v0.6.169).

**This session's own work (v0.6.173):**
- De-flaked Tier 1 case `approval-follow-through`: it referenced ORB-100 in fixture history but used the **live** backlog, where ORB-100 is a real-but-different, non-visible task — so the model could reasonably re-query to verify (identifier provenance), making a "deterministic" case a coin-flip. Added a frozen `backlogOverride` containing ORB-100 as "Set up CI pipeline"/open, so approval → `update_todo` is now deterministic. (Full run caught it at 43/44; isolated re-run confirmed 1/1; de-flake makes it durable.)
- Closed ORB-303 via the Orb API with attributed resolution notes (server-verified `closed_at`).
- Knowledge Repo entry `9ca8ceac-1a40-417e-9c36-b48a90eb4b3d` ("ORB-303 closed: query_tickets read tool + tickets capability gap lessons", 5 durable lessons). Related entries (`27c4315b` create_ticket false positives, `f7a5bbb9` false move-capability) reviewed — still true, not superseded.

**Eval:** 4 new Tier 1 cases (`query-tickets-admin-lookup`, `general-bugs-question-checks-tickets-too`, `bugs-question-filters-todos-by-category`, `ticket-code-rejected-as-todo-mutation`). **Tier 1 44/44** confirmed by Stan (terminal): full run 43/44 + `approval-follow-through` 1/1 isolated, then de-flaked. Latest full run: ~1,680,279 tokens, ~$1.1203, 8m 2s, completed 2026-07-07T06:54:57Z.

**Not yet done:** commit (awaiting Stan's approval), then push is a separate explicit approval.

---

**ORB-316 foundational prompt definitions — 2026-07-06 (Codex, GPT-5) — v0.6.160**

Started ORB-316 after the Strategic Orb v1 Next-Step slice and the full Tier 1 eval reached **40/40 passed**.

**What changed:**
- Added `ORB_FOUNDATIONAL_DEFINITIONS` in `lib/orb-prompt.ts` as the canonical live source for recurring prompt concepts that had been spread across scope, routing, strategic reads, project-health reads, and mutation protocol.
- Wired the new definitions into both production Orb conversation prompt assembly and the eval endpoint stable prompt.
- Canonicalized the key definitions: visible vs owned project, visible/non-dormant project vs project with active tasks, project code vs project name, explicit BACKLOG facts vs tool-required facts, exact vs vague references, and evidence vs judgment.
- Updated the operating-rules audit to record that ORB-316 definitions live in the prompt library; the audit remains a map, not binding law.
- Bumped release docs to `v0.6.160`.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed, with sandbox-only `/tmp/xcrun_db` warnings from git.
- Stan ran full Tier 1 after ORB-316: **40/40 passed**, ~1,485,985 tokens, estimated cost ~$1.0225, elapsed 9m 24s, completed 2026-07-07T00:00:06.414Z.
- Stan resolved the Gemini quota/rate-limit issue and closed ORB-316 with the verified resolution notes.

**Strategic Orb v1 Next-Step Read contract — 2026-07-06 (Codex, GPT-5) — v0.6.159**

Enabled the second Strategic Orb v1 interaction under **ORB-317 — Strategic Orb v1 interaction-quality program**: focused next-step reads for prompts like "what should I work on next?", "where should I focus?", and "help me prioritize?"

**What changed:**
- Clarified that **ORB-317 — Strategic Orb v1 interaction-quality program** is the umbrella behind this work, not just the Next-Step Read slice. It coordinates context/eval architecture, operating-rule cleanup, capability gaps, project-health reads, next-step recommendations, and future interaction improvements.
- Added `ORB_NEXT_STEP_READ` to the live Orb prompt contract and eval prompt mirror.
- Added `lib/orb-model/next-step.ts`, a per-request Next-Step Packet builder and renderer using existing project, task, priority, due-date, stale-work, recent-audit, and Project Health Packet data only.
- Next-Step Packet v0 limits recommendation candidates to current-user-owned active tasks, tracks omitted other-user active work, and surfaces advisory signals such as `in_progress`, `urgent`, `due`, `stale_active`, and `recent_activity`.
- Wired the rendered Next-Step Packet into both production Orb conversation context and the eval endpoint, skipping it for frozen backlog override cases so deterministic fixture tests remain fixture-only.
- Tightened next-step answer shape: one primary recommendation, at most one alternate, evidence named explicitly, inferred sequencing labeled as judgment, and no ranked backlog dump unless the user asks for one.
- Added blocker/dependency guardrails: "blocked", "must happen first", "gating", and prerequisite claims require explicit evidence from task text, audit, knowledge, memory, adaptation, or the user's current message.
- Tightened live-test follow-up guardrails after Stan tested ORB-317-centered prompts: avoid even hypothetical blocker phrasing unless the user/evidence raises a blocker, and never label a visible project as "yours" unless ownership evidence explicitly supports it.
- Strengthened the existing strategic guidance eval case to guard against false completion-claim regressions plus invented blocker/gating language.
- Tightened existing routing/tool contracts after Stan's Tier 1 run exposed three regressions: switch-project narration now avoids "Switching to..." before client confirmation, vague knowledge-entry updates search Knowledge Repo instead of asking for a task code/title, and exact `entry titled "..."` corrections call `update_knowledge` directly.
- Tightened a second Tier 1 regression pass: bulk project deletes should use visible BACKLOG task codes without a pre-query, missing owner/dormant project facts must call `query_projects`, exact quoted knowledge-entry corrections call `update_knowledge` directly, and vague "that entry" corrections search first.
- Improved the eval CLI progress status line so terminal resizing truncates the active case label instead of leaving wrapped progress-bar fragments on screen.
- Updated `docs/strategic-orb-v1-plan.md` with the v0.6.159 implementation note.
- Bumped release docs to `v0.6.159`.

**Knowledge Repo check:**
- Live service-role query could not be completed from the current sandbox (`curl` exited code 6 / DNS unavailable). Used the committed handoff's relevant known lesson instead: ORB-212 requires strategic recommendations to stay scoped to current-user-owned projects, and Project Health follow-up notes require explicit evidence before blocker/dependency claims.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed, with sandbox-only `/tmp/xcrun_db` warnings from git.
- Stan ran focused regression retries after prompt/tool-contract fixes:
  - `switch-project-partial-name-resolves,knowledge-entry-not-todo-cold-start,update-knowledge-correction-tool`: **3/3 passed**, completed 2026-07-06T22:48:08.763Z.
  - `bulk-delete-project-todos-calls-tools,query-projects-tool,query-projects-dormant,update-knowledge-correction-tool,update-knowledge-vague-reference-searches-first`: **5/5 passed**, completed 2026-07-06T23:34:49.354Z.
- Stan ran full Tier 1: **40/40 passed**, ~1,473,219 tokens, estimated cost ~$1.0049, elapsed 6m 45s, completed 2026-07-06T23:42:20.824Z.

**Strategic Orb v1 Project-Health Summary contract — 2026-07-05 (Codex, GPT-5) — v0.6.158**

Enabled the first Strategic Orb v1 interaction: broad project-health summaries such as "tell me about my projects" and "anything stand out?"

**What changed:**
- Added `ORB_PROJECT_HEALTH_SUMMARY` to the live Orb prompt contract and eval prompt mirror.
- Added `lib/orb-model/project-health.ts`, a per-request Project Health Packet builder and renderer using existing project, task, priority, and audit data only.
- Defined semantic boundaries for project-health reads: distinguish visible projects, projects with active tasks, dormant projects, ownership, facts, supported interpretations, and judgment-labeled next moves.
- Project Health Packet v0 includes per-project active/parked/closed/urgent/in-progress/stale-active counts plus 14-day recent activity counts, momentum, last activity, and neutral signals. It deliberately does not add a project-role schema field.
- Narrowed both the `query_projects` routing rule and the generated `query_projects` tool description so broad project-health summaries answer from BACKLOG when the needed project names, owners, descriptions, counts, and dormant state are already present, rather than reflexively calling a tool for a "full picture."
- Preserved natural language leeway: Orb should not sound canned, but must maintain accuracy, scope, and evidence.
- Kept scratchpad-style project roles as flexible user/project semantics rather than a brittle eval target; users can state a project's purpose directly, and future metadata/memory/adaptation paths can support this at scale.
- Added project-role correction handling: if the user corrects Orb's interpretation of a project's purpose, Orb should treat it as high-confidence for the current conversation and offer to remember durable project semantics as an approved adaptation instead of silently persisting it.
- Cleaned up `switch_project` streaming so client actions do not stack generic "Navigating..." thoughts, premature "Switching to..." speech, and final confirmation into duplicated text/voice output.
- Refined Project Health Summary wording so packet signals are watch cues, not verdicts. Orb should avoid blocker/foundational/gating claims unless explicit evidence supports them and keep other-user projects separate from the current user's workload.
- Tuned Project Health Summary tone so quiet active work is phrased as "quiet with active items" / "worth confirming whether intentionally parked" rather than "stalled" without stronger evidence, and project-health reads avoid cute/dramatic personification.
- Updated `docs/strategic-orb-v1-plan.md` to record Project-Health Summary as the first enabled Strategic Orb v1 behavior.
- Bumped release docs to `v0.6.158`.

**Knowledge Repo check:**
- Queried project-health / strategic lessons. Relevant results: ORB-212 requires strategic guidance to stay scoped to current-user-owned projects, and ORB-293/voice epistemics reinforces that blockers/dependencies require explicit evidence rather than plausible inference.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- `npm run build` passed.
- Stan ran the attempted focused eval multiple times; failures showed the eval was over-constraining a flexible user/project semantics case and exposed a real tool-description conflict that was fixed instead.

**Eval prompt caching + production tool-array cache stability — 2026-07-05 (Claude Code, committed by Codex) — v0.6.157**

Claude Code implemented eval prompt caching and then hit a usage limit. Stan ran Tier 1 after the change and confirmed the cache path is working: Tier 1 **40/40 passed**, estimated cost dropped to **~$0.9277**, and Anthropic usage reported **480,410 cache-read tokens** plus **13,726 cache-write tokens**.

**What changed:**
- Split the eval endpoint prompt into a stable cacheable block and per-case dynamic block, mirroring production's prompt boundary.
- Added Anthropic `cache_control: { type: 'ephemeral' }` for the eval stable block so repeated Tier 1 cases can reuse the stable prompt prefix within the cache window.
- Kept strategic evaluation prompts in single-string form because those runs use frozen packets or mode-specific prompts and are usually routed to Gemini.
- Stopped filtering `confirm_mutation` out of the production tool list when no mutation is pending, because changing tool definitions can void the prompt-cache prefix during propose/confirm flows. The server still rejects invalid confirms.
- Bumped release docs to `v0.6.157`.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Stan ran Tier 1: **40/40 passed**. Reported usage: ~1,311,709 total tokens, estimated cost ~$0.9277, elapsed 7m 39s, completed 2026-07-06T03:56:40.105Z.

**Note:**
- Claude Code's `ACTIVE_WORK/claude-code.md` claim remains in the working tree because Codex does not edit another agent's ledger file under the concurrency protocol.

**Strategic context packet starter slice — 2026-07-05 (Codex, GPT-5) — v0.6.156**

Continued the Strategic Orb v1 work by starting the ORB-308 context/eval architecture workstream without touching the production operational/CRUD prompt path.

**What changed:**
- Added `lib/orb-model/strategic-context.ts` with `STRATEGIC_ORB_CONTEXT_PACKET_VERSION`, a versioned `StrategicOrbContextPacket`, `buildStrategicContextPacket`, and `renderStrategicEvaluationPrompt`.
- Updated the eval endpoint so frozen strategic `contextPacketId` cases render through the shared strategic context renderer instead of an inline prompt block.
- Updated eval request-ledger recording to use the shared strategic context packet version instead of a hard-coded legacy packet version string.
- Updated the strategic eval runner so blinded review packet rows preserve `contextPacketVersion` and `contextPacketId`.
- Updated `docs/strategic-orb-v1-plan.md` with a v0.6.156 implementation note.
- Bumped release docs to `v0.6.156`.

**Verification:**
- `npm run build` passed.
- `git diff --check` passed.
- `npx tsc --noEmit` passed.

### Prior Session: Strategic Orb v1 planning + ORB-308 folded into context/eval architecture — 2026-07-04 (Codex, GPT-5) — v0.6.155

**Strategic Orb v1 planning + ORB-308 folded into context/eval architecture — 2026-07-04 (Codex, GPT-5) — v0.6.155**

Stan decided ORB-308 can wait if it is intentionally subsumed into Strategic Orb v1. This session created the planning artifact that makes that real instead of leaving ORB-308 as a loose cleanup task.

**What changed:**
- Added `docs/strategic-orb-v1-plan.md`, defining the first Strategic Orb product role, strategic answer rubric, non-goals, proactivity boundaries, cost/routing posture, and phased implementation path.
- Folded ORB-308 into the Strategic Orb v1 **Context and Eval Architecture** workstream: shared strategic context packet builder, packet versioning, eval/production parity, and debug packet output.
- Updated `docs/orb-operating-rules-audit.md` with a planning note pointing to the Strategic Orb v1 plan.
- Bumped release docs to `v0.6.155`.

**Knowledge Repo check:**
- Queried Strategic Orb / ORB-308 / context-builder lessons. Relevant result: ORB-212, which established strategic guidance must stay scoped to current-user-owned projects.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- `npm run build` passed.

### Prior Session: Project count precision follow-up — 2026-07-04 (Codex, GPT-5) — v0.6.154

**Project count precision follow-up — 2026-07-04 (Codex, GPT-5) — v0.6.154**

Stan live-tested the ORB-315 project-name fix and confirmed raw project codes were no longer leaking, but Orb still said "five active projects" while listing four projects with active tasks. Source inspection showed the likely ambiguity: the BACKLOG context includes all visible/non-dormant projects, even those with `active_count=0`, plus a separate DORMANT section. Orb was likely mixing "active project" as non-dormant with "project that has active tasks."

**What changed:**
- Added a project-count precision rule to the shared SCOPE prompt: distinguish visible/non-dormant projects, projects with active tasks (`active_count > 0`), and dormant projects.
- Added Tier 2 eval coverage for a fixture with five visible projects, four with active tasks, and one dormant project, guarding against the exact "five active projects" phrasing.
- Bumped release docs to `v0.6.154`.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- `npm run build` passed.
- Stan ran targeted Tier 2 eval `project-count-distinguishes-visible-from-active-task-projects`: **1/1 passed**. Reported usage: ~99,968 tokens, estimated cost ~$0.1018, elapsed 27s, completed 2026-07-05T04:59:46.780Z.

### Prior Session: ORB-314 / ORB-315 operating-rules cleanup + shared SCOPE builder — 2026-07-04 (Codex, GPT-5) — v0.6.153

**ORB-314 / ORB-315 operating-rules cleanup + shared SCOPE builder — 2026-07-04 (Codex, GPT-5) — v0.6.153**

Stan approved applying the Orb Craft and Art Doctrine to Orb AI itself, starting with the concrete rule-system cleanup already called out by prior work.

**What changed:**
- Added `docs/orb-operating-rules-audit.md`, mapping Orb AI behavior rules across prompt modules, server guards, evals, tool contracts, model routing, preferences, memory/adaptations, and Knowledge Repo surfaces.
- Removed the dead generated `ORB_INTEGRITY_RULES` export path from `scripts/generate-orb-contract.ts` and `lib/orb-contract.ts`.
- Reframed `docs/api-spec.yaml` so its `x-orb-agent-contract` block is REST/API integration guidance only, explicitly not live conversational prompt law.
- Extracted the duplicated dynamic SCOPE prompt block from production and eval into shared `buildOrbScopePrompt` in `lib/orb-prompt.ts`.
- Tightened project-speech behavior: project codes and raw `[code: ...]` tags are internal routing hints only; task codes remain acceptable when identifying tasks.
- Added Tier 2 eval coverage (`project-list-hides-internal-code-tags`) to catch project-list answers that leak internal project code tags.
- Marked the historical ORB-186 plan as superseded where it still recommended `ORB_INTEGRITY_RULES`.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- `npm run build` passed.
- Stan ran `npm run eval:t1`: Tier 1 **40/40 passed**. Reported usage: ~1,312,151 tokens, estimated cost ~$1.3575, elapsed 6m 42s, completed 2026-07-05T04:47:29.459Z.

**Tracking:**
- ORB-314 and ORB-315 implementation work is complete in the working tree.
- Larger ORB-308 eval/production context-builder consolidation remains separate and should not be considered done by this slice.

### Prior Session: ORB-309 closed after production performance instrumentation and baseline pass — 2026-07-04 (Codex, GPT-5) — v0.6.151

**ORB-309: closed after production performance instrumentation and baseline pass — 2026-07-04 (Codex, GPT-5) — v0.6.151**

Stan closed ORB-309 after the final production samples confirmed the important outcome: Orb now has data-driven tools for performance work, and the current broad initialization concern has enough evidence to stop being treated as an open-ended optimization project.

**What changed:**
- ORB-309 was closed through the Orb API with attributed resolution notes.
- Added Knowledge Repo closure entry `686b9146-93df-431e-9421-20a4f469667b` documenting the durable performance lessons.
- Updated the Flow / Performance Matrix to mark login/auth and Settings CRUD instrumentation as covered, with current baseline interpretation and future watch points.
- Bumped release docs to `v0.6.151`.

**What we learned:**
- Passkey login latency is mostly inside the browser/OS credential ceremony (`navigator.credentials.get`), not Orb app initialization.
- OTP verification is fast in production samples; OTP request is slower because it includes allowed-login check plus Supabase email send, but the collected samples were acceptable.
- Early iPad Safari outliers were contaminated by stale cache/state; Stan cleared cache and later behavior looked normal.
- Large-table coverage exists for AI Request Log, Audit Log, and Knowledge Repo. AI Request Log already received the scalable fetch pattern; Audit Log and Knowledge Repo are measured and currently acceptable, with future work driven by telemetry if they grow into a problem.
- Background `conditional_passkey` aborted/expired rows can show very large durations because they wait in the background until navigation or OTP aborts them; analysis should treat those separately from user-facing failure latency.

**Tracking:**
- ORB-309 is **closed** as of 2026-07-04 23:12 UTC.
- Knowledge Repo closure entry: `ORB-309 closed: performance instrumentation and baseline lessons` (`686b9146-93df-431e-9421-20a4f469667b`).
- Future performance passes should be narrow: choose one target from Settings > Performance, collect platform/browser baseline samples, make one focused change, compare before/after, and record the result.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Stan tested production login/passkey and OTP paths before closing ORB-309.

### Prior Session: ORB-302 knowledge_repo update + read tools, two real bugs found and fixed under live testing — 2026-07-04 (Claude Code, Fable 5) — v0.6.140(cont.)–v0.6.149

Continuation of the same session as the entry below (concurrency protocol + ORB-301) — Stan asked to check ORB-302 next, then said "go ahead" and "I changed the description because I couldn't remember if it was done for another task. But please build this then I'll test." What followed was three build-test-fix cycles, each driven by Stan's own live testing, not by anything the eval suite caught (the eval harness structurally cannot execute handlers — same finding as ORB-301 — so every real bug here was live-only).

**Built: knowledge_repo CRUD minus delete (v0.6.144, Stan: "delete is reserved for admins... Orb can file a ticket if staleness is detected").**
- `update_knowledge`: held mutation (propose/confirm), same spine as `update_project`. Resolves by title via `resolveKnowledgeReference` in `lib/orb-mutations.ts`. Every successful update is signed and time-stamped **server-side, deterministically** — `[Updated: YYYY-MM-DD HH:MM UTC — Orb (Haiku 4.5)]` — never composed by the model, per Stan's explicit requirement, and a prior stamp is stripped before re-stamping so repeated updates don't stack.
- No delete tool. Spec/prompt explicitly route staleness the model can't fix via update to `create_ticket` instead.

**Bug 1 — wrong-target mutation, live and executed (v0.6.147).** Asked to update the entry titled "Disk IO budget: auth.flow_state accumulation...", the model paraphrased the reference down to something like "ORB-159" — and `resolveKnowledgeReference`'s one-directional substring check (`title.includes(ref)`) matched a **different, unrelated entry** ("Implementing Client-Side OTP Cooldown (ORB-159)") that just happened to contain that fragment. Stan confirmed live: audit_log showed the wrong row stamped, the right row untouched. Recovered the original content from `audit_log.before` and restored the wrongly-mutated row; logged the restoration as its own audit event. Fixed the resolver itself: now requires the reference to cover ~80% of its own significant words (punctuation-stripped, filler words excluded) within a candidate title before accepting a match — a short/generic fragment can no longer hijack a longer, unrelated title. Ambiguous/no-match now surfaces instead of guessing. Verified directly against the real function and live database (not a reimplementation).
- Also fixed along the way: `update_knowledge` was forcing an unwanted `search_knowledge` round-trip even when the exact title was already quoted (tool description said "search first, always" instead of matching `update_project`'s "call directly, server resolves" pattern); and a cold-start "update the X entry" phrase was routing to `query_todos` instead of `search_knowledge` (added a VOCABULARY DISAMBIGUATION rule: "entry" means knowledge_repo, not a todo).
- Also fixed a real relevance-ranking defect in `search_knowledge`'s topic search (found while chasing the routing bug, unrelated to it): with 234 entries, a short query like "disk IO budget" matched ~40% of the corpus with no ranking, so the actual best match could be crowded out of the 10-result cap by newer, loosely-matching entries. Added `scoreTextMatch` in `lib/fuzzy-search.ts` (title matches weighted far above content matches, generic meta-words like "entry"/"issue" excluded from scoring).

**Stan reframed scope mid-session: "I see this as a knowledge repo CRUD task... a read tool can be used in many contexts... I'm also concerned about 'exact-title' lookup, it needs leeway."** Built `search_knowledge`'s `title` param (v0.6.148) — a genuine precise single-entry read, not just a side-effect of update. Reuses the exact same `resolveKnowledgeReference` (leeway-resolved, exact-match-first) so the wrong-target fix automatically covers both read and write. Ambiguous references list candidates and ask; not-found says so plainly.

**Bug 2 — pre-existing RLS visibility bug, exposed by the new read tool (v0.6.149).** Live-testing the new read path, the model correctly *resolved* the target entry (via the admin/service-role client) but its content came back **empty**. Root cause: the entry has `product_id IS NULL` — the documented, valid convention for a cross-project knowledge entry — but `knowledge_repo`'s SELECT RLS policy does an `EXISTS` join against `projects.id = knowledge_repo.product_id`, which can **never** match a null product_id. **8 of 234 entries were invisible to every RLS-scoped read** (the Orb's own topic search included) for as long as they've existed — always visible in Settings → Knowledge only because that page reads via the service-role client. This explained the entire confusing prior transcript in one shot: topic search never had the real entry in its candidate pool at all. Fixed with `scripts/migrations/20260704_knowledge_repo_null_product_rls.sql` (SELECT policy now also allows `product_id IS NULL`, `(SELECT auth.uid())` initplan convention followed) — verified directly against the database under a simulated authenticated session, all 8 rows now visible, the other 226 unaffected. Also fixed the read handler itself to fetch the resolved entry via the admin client rather than the RLS-scoped conversation context list, so a correctly-resolved entry can't come back empty even in an edge case the RLS fix doesn't anticipate.

**Full live re-verification by Stan, two separate conversations, no new bugs:** ambiguous disambiguation across 3 real disk-IO entries (correctly including the previously-invisible one), `query_audit_trail` correctly identifying what was actually updated and when, the exact stamp format read back and confirmed (`[Updated: 2026-07-04 18:38 UTC — Orb (Haiku 4.5)]`), not-found handling for a nonexistent topic, and topic-mode search still functioning distinctly from precise-read.

**Verified:** Tier 1 **40/40** (Stan, terminal, two full runs across the session — 36/36 before this todo, 40/40 after). `npx tsc --noEmit` clean at every stage. Eslint 0 errors throughout (pre-existing warnings only).

**Closed** with full attributed resolution notes (server-verified `closed_at`) + Knowledge Repo entry `8b70e226-90d7-405f-9ec3-0e90d44397dc` (five lessons: coverage-scored resolution over naive substring; share one resolver across read/write; RLS can silently break a documented NULL-able convention with no error; don't re-fetch an admin-resolved entity through an RLS-scoped list; a new read tool is a diagnostic instrument, not just a feature). Capability matrix knowledge_repo row updated to full CRUD (delete deliberately excluded).

### Key Lesson

**A "performance" symptom can be a measurement artifact.** The intermittent "several-minute login" was conditional-mediation *dwell* logged as latency, not slow code — and the fix was to **remove an invisible feature nobody used** (0/35), not to optimize anything. Measure the right span before optimizing; a flow that "looks slow" in telemetry may just be mis-instrumented.

**Verify durable state against ground truth — it drifts.** This session opened with `HANDOFF.md` describing the ORB-303 work as uncommitted when it had already been committed (`024c79c`). A cold start that trusted it would have started from a false picture. Always `git status` / re-read rather than trust the record.

### AI Tool Used Last Session

2026-07-08 — Claude Code (Opus 4.8)

### Uncommitted Changes

None — all this session's work is committed and pushed: AI Metrics optimization v0.6.176 (`e6ca709`), ORB-312 telemetry v0.6.175 (`502882e`), login redesign v0.6.174 (`3ab6bc6`). The prior ORB-303 session (v0.6.161–v0.6.173) is committed (`024c79c`).

- `.claude/settings.local.json` — remains intentionally uncommitted (harness permission allowlist; the `git push` gate stays in `ask`), as always.

---

### Prior Session: Multi-Agent Concurrency Protocol + ORB-301 query_projects — 2026-07-03 (Claude Code, Fable 5) — v0.6.140–v0.6.143 + process commits

> **First concurrent two-agent day.** Codex's v0.6.138–139 session (entry below) ran and pushed *during* this Claude Code session — the interleaving worked: the Release Bookkeeping re-read rule caught Codex's bumps mid-flight and versioned on top of the true canonical 0.6.139 with no collision.

**Part 1 — Multi-Agent Concurrency Protocol (adopted, pushed: `2720203`, `30eea64`).** Stan wants Claude Code and Codex working in the main directory at the same time. Rules were negotiated to consensus in a shared proposal doc — Claude Code drafted and owned the protocol text, Codex responded in an append-only discussion log over two rounds, all seven questions resolved, Stan adopted.
- **`docs/multi-agent-concurrency-protocol.md`** is the operative rule set and **single source of truth** — the `AGENTS.md` section and `ACTIVE_WORK/README.md` are deliberately thin pointers with zero restated rules (Stan's explicit call, to prevent drift). Protocol changes happen there ONLY.
- **`ACTIVE_WORK/`** claim ledger: read every file before mutating work, write only your own (`claude-code.md` / `codex.md`). Claims are real-time working-tree signals, not audit records — the completing commit leaves your file back at `*(none)*`. 2-hour staleness with `Long-running: yes` override; exclusive **Release Bookkeeping** claim over `HANDOFF.md`/`package.json`/`lib/version.ts`/`lib/changelog.ts`; `main` default with task branches required for high-risk work; DB schema claims exclusive, DB data claims declared-only.
- **Ceiling: 2 writable agents** (read-only research agents exempt) — both agents agreed; dev server, release bookkeeping, migrations, and Stan's verification bandwidth are serialized lanes a third writable agent would only queue behind.
- **Comprehension check Q9 added to AGENTS.md:** every session must answer concurrency questions from the protocol doc (not memory) and report live claims in the other agent's ledger.
- Proposal doc frozen as history with a full decision record.

**Part 2 — ORB-301: `query_projects` built, eval-hardened, closed, deployed (v0.6.140–v0.6.143, commit `445119a`).** Session opened with an ORB-302 status check per Stan — **not done** (no update/delete knowledge tools exist; it stays open).
- **The tool:** name-first project read tool mirroring `query_todos`. Defined in `docs/api-spec.yaml` — **`lib/orb-contract.ts` is GENERATED from the spec by `scripts/generate-orb-contract.ts`; never hand-edit it.** Handler in `orb-converse.ts` runs in-memory over already-loaded context (zero extra DB reads); visibility inherited (non-admin sees own projects; dormant list admin-only). Filters: `name` (partial/fuzzy), `include_dormant`, `max_results`. Returns name/code/description/owner/active+total counts/dormant flag; dormant rows include owner as of v0.6.143 (live testing found neither backlog nor tool carried dormant ownership).
- **Routing (where the real bugs were):** first eval run failed because the routing rule had been added to `ORB_INTEGRITY_RULES` — which is **generated but imported by nothing, dead since inception** (filed **ORB-314**; its rules 1–7, including "backlog is orientation only," have never reached a prompt and contradict live behavior). The live rule set is `ORB_QUERY_ROUTING` in `lib/orb-prompt.ts` (shared by production and the eval harness), which mandates **BACKLOG DIRECT ACCESS**: answer from context when it fully answers, tools only otherwise. Fix aligned with that design; eval cases rebuilt on frozen `backlogOverride` fixtures that *lack* the answer, so the tool call is deterministically required.
- **Fabrication caught and fixed (v0.6.142):** with no `[Owner: ...]` tags in the fixture, the model *invented* "owned by you (Stanley Baptista)" — third member of the fabrication family (phantom task codes, fabricated UUIDs, now assumed ownership). Added a **PROJECT FACT PROVENANCE** rule to the shared routing prompt: owner/description/dormant facts come only from explicit backlog tags or `query_projects` results; never assume the current user owns a project.
- **Verified:** Tier 1 **36/36** (Stan, terminal). Ten live probes on Mac + iPhone dev all behaved per design — backlog-direct answers where context suffices is *correct*, and "Who owns CAN26?" forced the tool path end-to-end (important because **the eval harness asserts tool calls but never executes handlers** — a new handler's first real execution is live). Production v0.6.143 spot-checked: CAN26 owner question → `[Checking projects...]` → correct owner.
- **Closed** with attributed resolution notes (server-verified `closed_at`) + Knowledge Repo entry `0a841090-dfff-4966-ba77-d4ec7a32f4ab`. Capability matrix projects row updated (read gap closed).
- **Filed this session:** **ORB-314** (dead `ORB_INTEGRITY_RULES` — reconcile or delete), **ORB-315** (Orb speaks project codes like `[code: STOKELYFRO]` to the user despite the v0.6.117 name-first policy — needs prompt fix + Tier 2 case).

(All files from this session were committed in `445119a`. Codex's v0.6.139 entry below lists files that were uncommitted at its writing — all since committed in `3d3f86e`/`651114d`.)

### Key Lesson

1. **Prompt rules only work where the prompt is assembled.** Rule text in a dead constant is invisible — trace the import chain before trusting a rule is live (`ORB_INTEGRITY_RULES` has been dead since inception).
2. **The eval harness asserts tool calls but never executes handlers.** Every new tool needs one live test that forces the tool path (ask for a fact the context lacks), or the handler ships unexecuted.
3. **When the model fills a data gap, suspect the gap, not just the model.** The ownership fabrication and the CAN26 dead-end were both missing-data problems wearing behavior-problem costumes.

---

### Prior Session: AI Metrics Cost Accounting Labels + ORB-310 First Redesign Slice — 2026-07-03 (Codex, GPT-5) — v0.6.139

**AI Metrics Cost Accounting Labels + ORB-310 First Redesign Slice — 2026-07-03 (Codex, GPT-5) — v0.6.139**

Stan asked why OpenAI/ElevenLabs TTS usage was not visible in AI Metrics. Direct DB inspection showed TTS usage is present in `orb_model_requests` with `source = voice_tts`; the UI was unclear because the newer request-ledger cost accounting area was titled generically while the visible table below is the older `orb_metrics` daily metrics surface.

**What changed:**
- Renamed the top AI Metrics cost section to **App AI Cost Accounting** and clarified that it is the newer request ledger for model calls and API TTS usage, including OpenAI and ElevenLabs.
- Mapped `voice_tts` to the visible source label **Voice TTS**.
- Created **ORB-310 — AI Metrics Redesign** to redesign Settings -> AI Metrics piece by piece, remove or demote legacy `orb_metrics` data, make the request ledger primary, and address AI Metrics performance while redesigning.
- Started ORB-310 at the top of the page: tightened the App AI Cost Accounting caption, populated Model from request-ledger models plus configured rate cards, moved the eval/day-to-day note under the filter controls, replaced duplicate summary card/list renderings with one ledger-style summary card, added an **Accounting Details** card, aligned the shorter top cards to the same width, moved the Rate Cards header/caption outside the card list, shortened the rate-card caption, and restored a visually distinct **New Rate Card** form above the existing rate-card list.
- Removed the legacy `orb_metrics` daily summary from the visible AI Metrics page.
- Replaced the visible logging table with **AI Request Log**, a paginated/searchable/sortable request-level `orb_model_requests` ledger with provider, model, source, role, status, latency, token/character counts, cost estimate, and failure columns.
- Kept the shared `SettingsCrudList` pagination and column navigation controllers for the request log.
- Fixed `SettingsCrudList` so tables using external search modals still render the column navigation controller when the table overflows; AI Request Log uses that path.
- Added a show/hide toggle for **AI Request Log** and defaulted it collapsed on narrow/coarse-pointer screens to reduce iPhone scrolling when the log renders as cards.
- Fixed the narrow-width **Show Log** jump by keeping `SettingsCrudList` page headers and header extras mounted during initial table loading instead of replacing the whole page shell with skeleton rows.
- Restyled **Provider Bill Reconciliation** with the same section-header/card pattern, visible input outlines, editable recorded bill rows, and audited delete support.
- Started ORB-311 by checking AI Metrics performance telemetry before optimizing: production samples still show `ai_accounting_load` as the larger page-load signal, while `request_log_load` is the growing-table risk.
- Converted **AI Request Log** from exact-count offset paging to cursor pagination on indexed `created_at`, returning `nextCursor` to `SettingsCrudList` and dropping table counts from the hot request-log fetch.
- Limited request-log server sorting to created-time order for this first optimization pass so the query can stay on the append-heavy log-table access pattern instead of encouraging arbitrary large-table sorts.
- Continued ORB-311 after Stan tested the cursor path: new `request_log_load` samples showed the cursor path reduced the ugly tail on iPhone Chrome, while `ai_accounting_load` remained the larger initialization bottleneck.
- Added `get_ai_cost_summary_rollups`, a service-role-only database rollup RPC for App AI Cost Accounting totals, provider/model breakdowns, role breakdowns, source breakdowns, actual row range, and model options.
- Updated `getAiCostSummary` to consume compact rollup rows instead of fetching and reducing thousands of raw `orb_model_requests` rows in the server action.
- Fixed AI Metrics `page_full_load` telemetry so it measures the component load lifecycle directly instead of relying on a stale Settings navigation timestamp that produced misleading `0ms` samples.
- Tightened performance telemetry platform detection so iPhone/iPad analysis prefers browser device signals before falling back to viewport width and coarse-pointer heuristics.
- Updated the UI catalog to document cursor pagination as the preferred pattern for log-style or append-heavy settings tables such as AI Request Log, Audit Log, and future Knowledge Repo-style tables.
- Updated the UI catalog and object capability performance matrix to document the reusable large-table fetch pattern: database-side rollups for summary cards/breakdowns and cursor pagination for detail rows.
- Updated the UI catalog with the AI Metrics accounting, rate-card, and request-log patterns used by the redesign.
- Updated AGENTS so required Supabase, psql, Orb API, and Knowledge Repo reads go directly to approved/escalated network access when the current AI tool is known to be sandboxed, instead of first recreating the expected DNS failure.

**What we learned:**
- Rate cards contain ElevenLabs Turbo v2.5 at `50` input-per-million and OpenAI TTS rows at `15`/`30` input-per-million.
- TTS usage exists in `orb_model_requests`: OpenAI `tts-1` and ElevenLabs `eleven_turbo_v2_5` rows are present under `source = voice_tts`.
- Provider bill reconciliation should record actual plan/bill amounts for the period; rate cards remain the per-unit estimate.

**Tracking:**
- ORB-309 remains **open**. The AI Metrics performance optimization work has not been done yet.
- ORB-310 is **closed** as of 2026-07-04 01:07 UTC. Knowledge Repo entry: `ORB-310 AI Metrics redesign completed` (`9b765610-a483-4d7c-aee6-2a5b07b76a66`).
- ORB-311 is **open**. Request Log has received the first scalable-fetch change, but before/after production samples still need to confirm improvement and decide whether App AI Cost Accounting summary queries are the next optimization target.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

**Uncommitted at time of writing** (all since committed in `3d3f86e`/`651114d`): `AGENTS.md`, `app/actions/get-ai-request-log.ts`, `app/actions/get-ai-cost-summary.ts`, `app/actions/orb-ai-settings.ts`, `app/globals.css`, `components/settings/SettingsCrudList.tsx`, `components/settings/SettingsCostReconciliation.tsx`, `components/settings/SettingsMetrics.tsx`, `docs/object-capability-matrix.md`, `docs/ui-catalog.md`, `HANDOFF.md`, `lib/changelog.ts`, `lib/performance/telemetry.ts`, `lib/version.ts`, `package.json`, `scripts/migrations/20260703_ai_cost_summary_rollups.sql`

---

### Prior Session: ORB-309 Performance Analysis UI + Production Telemetry Checkpoint — 2026-07-02 (Codex, GPT-5) — v0.6.138

Stan resumed ORB-309 after the instrumentation foundation shipped and asked to work through the remaining tasks without closing ORB-309. This checkpoint adds the first analysis layer to Settings -> Performance and records the first production telemetry lesson: production collection needs both deployed code/server env enablement and per-browser local measurement.

**What changed:**
- Added a **Performance Analysis** section above Latency Summary in Settings -> Performance.
- Changed summary calculations so P50/P75/P95 are based on successful completed events only; failed, stale, aborted, and interrupted events stay visible as reliability signals instead of contaminating latency percentiles.
- Added analysis cards for data coverage, completed events, failed/interrupted events, and top bottleneck.
- Added **Needs Attention** rows for high P95, high Max, and high failure-rate groups.
- Added platform-difference and environment/platform/browser coverage summaries.
- Added a **Production Collection Checklist** under Measurement Controls and to the ORB-309 plan: deploy latest app version, set `ORB_PERF_TELEMETRY_ENABLED=true` in Vercel Production, redeploy if needed, turn on Local Browser Measurement per browser/device, select focus areas, and confirm `environment = production` rows.
- Updated the UI catalog and changelog for the new Performance Settings analysis/checklist classes.

**What we learned:**
- Production telemetry ingestion is working once server-side ingestion is enabled and the testing browser has Local Browser Measurement turned on.
- A code deploy alone does not enable production telemetry. Vercel Production must have `ORB_PERF_TELEMETRY_ENABLED=true`.
- First production sample observed: **36 production events on v0.6.137** from Mac/Chrome between `2026-07-03 06:55:11` and `06:58:19 UTC`.
- Early production signals: `auth / login / passkey_click` had one slow sample around 8.5s; AI Metrics showed first samples around 4.3s `page_full_load` and 3.4s `ai_accounting_load`; Settings Performance filter loads had 11 samples with p50 about 1.2s, p95 about 3.1s, and max about 4.2s; dashboard init looked much faster in production than dev so far.
- Production is still on v0.6.137 until this commit is pushed/deployed; v0.6.138 analysis UI/checklist has been verified in dev only.

**Tracking:**
- Added Knowledge Repo entry `ORB-309 production telemetry and analysis UI checkpoint` (`c34e99e4-470f-42f6-9b2d-657b34160d48`).
- ORB-309 remains **open**. Do not close it until production samples exist across Mac/iPad/iPhone, a measured bottleneck is improved, and before/after data confirms the result.

**Verification:**
- Stan manually verified the dev UI: Performance Analysis appears above Latency Summary, coverage/counts look plausible, Needs Attention shows expected rows, and narrow-width cards stack without disappearing controls/text.
- `npx tsc --noEmit` passed.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed.

---

### Prior Session: ORB-309 Performance Instrumentation Foundation — 2026-07-02 (Codex, GPT-5) — v0.6.120-v0.6.137

Stan stopped new feature work to address the basic performance problem systemically: login was one visible symptom, but the task became instrumentation for every user-clickable flow, with dev and production measurements, focus-area controls, platform/browser context, and a Settings surface for analysis.

**What changed:**
- Created **ORB-309 — Improve Initialization Speed** and kept it open. This commit ships the measurement foundation, not the final optimization work.
- Added `performance_events` storage, ingestion, querying, deletion, and summary actions with RLS, indexes, platform/browser/viewport metadata, focus areas, sampling, batching, correlation IDs, and immediate flush for measured interactions.
- Added **Settings -> Performance** with measurement controls, focus-area toggles, sample rate, probe/flush actions, event CRUD/search/filter/table/cards, event detail modal, latency summary, P50/P75/P95/Max, platform/browser grouping, and narrow-width card layouts.
- Instrumented auth/login, OTP verification, Settings navigation, AI Metrics, Orb Metrics reconciliation, generic `SettingsCrudList` lifecycle/actions, dashboard initialization, project switching, todo CRUD, bulk delete, dashboard list controls, Orb submit, and voice start.
- Updated the ORB-309 plan, Object Capability Matrix, UI catalog, and AGENTS process rules so new functionality must explicitly decide whether performance instrumentation is required.
- Improved Performance Settings UX based on Stan's testing: styled measurement controls and filters, fixed detail modal overlap, used the existing Settings column controller, added table/card titles, preserved summary cards on narrow widths, made latency-summary rows readable, and added browser collection/filtering.

**First dev findings:**
- AI Metrics is the current standout slow surface. Local dev data showed `settings-ai-metrics / ai_accounting_load` and `metrics_table_load` with multi-second medians and very high P95/Max outliers.
- Some Performance Settings views can become analysis targets themselves as the events table grows.
- Failed/stale/interrupted events are now captured, but successful latency analysis should separate them from completed events.
- Production data is still required before choosing remedies because dev and production timings may differ materially.

**Tracking:**
- Added Knowledge Repo entry `ORB-309 performance instrumentation foundation and first dev findings` (`b197fe48-46fd-4428-b283-a02e612bc0ce`).
- ORB-309 remains **open**. Do not close it until production data has been collected and the remaining analysis/optimization work below is complete.

**Verification:**
- `npx tsc --noEmit` passed during the session.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed during the session.
- `npm run build` passed at v0.6.137.
- Browser/device testing happened iteratively on dev with Stan. Production collection is the reason for this commit/push.

### Prior Session: Voice Speak-Once, Confirm-Loop Fixes, Identifier Provenance, Project-Code UI Audit — 2026-07-01 (Claude Code, Fable 5) — v0.6.113-v0.6.119

Four connected pieces of work, each surfaced by Stan testing the prior session's voice operator runtime live and reporting exactly what broke, then asked to be fixed as a general class rather than a one-off patch.

**1. Voice speak-once (v0.6.113).** The streaming speech queue (per-response spoken-character tracking + "shrink recovery") was the source of voice repeating itself: when the server replaced streamed narration with deterministic text (a confirm message, a phantom-code correction), the queue detected the shrink and re-spoke the replacement from scratch, overlapping with narration still playing on slower mobile TTS. Replaced with speak-once-per-turn: voice waits for the response to finish streaming, derives `spokenText` once, speaks it, done. Removed `speakStatus`/stream modes, `spokenChars`, `completeSpeechPrefix`, `utteranceId`, and the unread `prevStreamingRef` (~80 lines net). Trade-off: first audio now waits for stream end; the existing "Gathering data..." visual state covers the wait.
- Files: `lib/hooks/useVoiceMode.ts`, `components/UnifiedDashboard.tsx`, `docs/orb-voice-operator-runtime-plan.md`, `docs/ui-catalog.md`.

**2. Confirm-loop fixes (v0.6.114).** Stan hit two live bugs testing voice: (a) "Confirm confirm" (a stacked voice-transcript affirmation) didn't match the exact-phrase affirmation regex, so it fell through to the model as a new request and asked to confirm a second time; (b) granting permission up front in the same message ("you have my permission to create them") wasn't recognized, so Orb asked to confirm anyway. Fixed both: `isBareAffirmation`/`isBareDecline` now accept any input made of stacked affirmation/decline phrases; a new `grantsUpfrontPermission` check executes held todo operations directly when permission was granted in the requesting message, with Orb acknowledging the pre-given go-ahead in its response. Stop remains the escape hatch.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored), `scripts/eval-cases.ts`.

**3. Identifier provenance (v0.6.115).** After the transcript was cleared by an update/Reconnect, Stan asked Orb (in a fresh voice session) to delete "the two test todos you created" — Orb had no record, so it fabricated codes by incrementing from the last known todo number (guessed TODO-4/-5 instead of the real TODO-2/-3). Root cause: nothing enforced that a task code Orb uses actually came from something it had seen — this was the third fabricated-identifier bug in the codebase (after phantom codes in speech, fabricated UUIDs), so it was fixed as a general provenance principle at three layers instead of a fourth one-off patch: (1) a new `IDENTIFIER PROVENANCE` resolution law in the shared prompt — codes must come from context, never from memory of a cleared session or pattern-completion; (2) a deterministic `[SYSTEM]` note injected whenever a conversation starts with empty history, telling the model its session record is empty; (3) a structural server-side gate that tracks every code the model has actually been shown (prompt, tool results, conversation) and rejects any mutation targeting an unseen code, redirecting the model to `query_todos` first.
- Files: `lib/orb-prompt.ts`, `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored), `scripts/eval-cases.ts`.

**4. Itemized bulk confirmations (v0.6.116).** Deleting the (now correctly found) todos worked, but the confirm message said "see the transcript for the exact items" without ever listing them. Confirm messages now itemize the exact targets (code + title) under the summary line, capped at 10 with an "…and N more (total)" tail for large sets — so a 1,000-todo bulk delete still gets a real confirmation gate without a wall of text.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored).

**5. Project-code UI audit and cleanup (v0.6.117).** Separate design conversation: Stan asked whether the project `code` column serves any purpose beyond composing todo codes (e.g. `ORB-73`) given tables already have `id`. Conclusion: code stays, but narrowed to exactly that one internal purpose — never a second user-facing label. Full audit presented and approved before any change:
- **Deleted (orphaned, unreachable from any in-app link since the Unified Dashboard shipped):** `app/dashboard/classic/page.tsx`, `app/dashboard/[productId]/page.tsx`, `components/DashboardProducts.tsx`, `components/TodoView.tsx`. Shared types (`Todo`/`Product`/`Priority`/`StatusDef`) extracted to new `lib/todo-types.ts` first so `TodoForm.tsx`/`QueryResultsModal.tsx`/`TodoPanel.tsx` (still live) kept working. Any future split-view rebuild starts from `UnifiedDashboard`, not from the deleted files.
- **Stripped project code from every remaining user-facing surface:** switch-project list, ticket/knowledge project pickers, Settings → Projects table, printed reports, the Orb project-switch voice/transcript message.
- **Removed the editable Code field entirely** from all three project create/edit forms (`AddProductModal.tsx`, `SettingsProjects.tsx`, `SettingsUserDetail.tsx`). No server change needed — `createProject`/`updateProject` already auto-generate a unique code from the name (`generateUniqueCode` in `app/actions/manage-project.ts`) when none is supplied.
- **Added fuzzy project-name resolution** (`resolveProjectByReference` in `UnifiedDashboard.tsx`: exact name → exact code → fuzzy/partial name via the existing `fuzzyMatch` util) so "Switch to Mr. Stokely" and "Switch to Mr. Stokely from Boston" both resolve — replacing four duplicated exact-match-only call sites (`/switch`, `/drop`, `/edit`, the Orb `switch_project` client action).
- Files: `components/UnifiedDashboard.tsx`, `components/AddProductModal.tsx`, `components/settings/SettingsProjects.tsx`, `components/settings/SettingsUserDetail.tsx`, `components/settings/SettingsTickets.tsx`, `components/settings/SettingsKnowledge.tsx`, `app/dashboard/print/page.tsx`, `app/settings/projects/page.tsx`, `lib/todo-types.ts` (new), `docs/ui-catalog.md`.

**6. Shared false-completion guard and name-first switch_project (v0.6.118).** Live voice testing caught Orb saying it had switched projects without calling the backing `client_action`, leaving the active project unchanged. Root cause: the false-completion-claim guard existed in the eval harness but had drifted from production. The guard now lives in one shared module (`lib/orb-model/false-claim-guard.ts`) and is tool-agnostic: unbacked completion claims for navigation/actions are blocked the same way unbacked mutation claims are. The server-side switch-project resolver now shares the fuzzy project resolver from `lib/projects.ts`, and `client_action.switch_project.target` is name-first, not code-first, matching `update_project`/`delete_project`.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts`, `components/UnifiedDashboard.tsx`, `docs/api-spec.yaml`, `docs/orb-voice-operator-runtime-plan.md`, `lib/orb-contract.ts`, `lib/orb-model/false-claim-guard.ts` (new), `lib/orb-prompt.ts`, `lib/projects.ts`, `scripts/eval-cases.ts`.

**7. Eval harness parity for voice rules and adaptation capability (v0.6.119).** Follow-up audit found the eval harness was missing real production voice speech-policy rules and the self-proposed behavioral adaptation capability. Those are now shared with production instead of duplicated by hand, so no re-greeting, brevity rules, filler avoidance, and adaptation proposal behavior are visible to the automated suite.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts`, `docs/orb-voice-operator-runtime-plan.md`, `lib/orb-prompt.ts`, `scripts/eval-cases.ts`.

**Eval suite:** 6 new/strengthened Tier 1 cases this session (`confirm-mutation-doubled-affirmation`, `upfront-permission-still-emits-creates`, `no-session-record-looks-up-before-delete`, itemization assertion added to `delete-first-action-set-resolves-by-ledger`, `switch-project-partial-name-resolves`). Full suite: **Tier 1 34/34 passed**, confirmed by Stan from the terminal.

**Process note (own mistake, corrected):** mid-session, running `rm -rf .next` three times during `tsc --noEmit` verification (to clear stale generated route-type errors after deleting the classic routes) hung Stan's live dev server and, downstream, the eval suite's first HTTP request. Diagnosed once Stan reported the hang; fixed by Stan restarting the dev server (its own script already does `rm -rf .next && next dev ...`). Saved as `feedback_next_cache_live_server` — never delete `.next` directly again; only tell Stan to, paired with a restart.

**Verification:**
- `npx tsc --noEmit` passed (clean, 0 errors) at every stage.
- Focused ESLint on touched files: 0 errors throughout; only pre-existing warnings.
- Full-repo `eslint .`: 8 errors, all pre-existing in `app/prototype/voice/page.tsx` and `components/settings/SettingsCrudList.tsx` — neither touched this session.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` clean except one pre-existing Markdown line-break convention (double trailing space, used 21× elsewhere in `docs/ui-catalog.md`) that was matched, not introduced.
- **`npm run eval:t1` — Tier 1 34/34 passed** (run by Stan from the terminal). One case (`bulk-delete-project-todos-calls-tools`) failed on the full run — diagnosed as a one-off model past-tense phrasing slip against the eval harness's single-shot completion-claim guard (not a code regression; production has a multi-turn retry the eval harness lacks) — confirmed by isolated re-run passing 1/1.
- No device/browser testing performed this session (server-side/prompt work + non-interactive UI removal); Stan should spot-check voice on iPhone/iPad for the speak-once behavior and confirm the project-code-free UI reads correctly on all three platforms.

**Loose end resolved in v0.6.118:** `client_action`'s `switch_project.target` is now documented and prompted as a project name, not a project code, consistent with `update_project`/`delete_project`.

---

### Prior Session: Voice Operator Runtime + ORB-299 Closure — 2026-06-30 (Codex, GPT-5) — v0.6.106–v0.6.112

Stan's directive evolved from fixing iPhone/iPad voice bugs into a product-level voice pivot: Orb voice should be an **operator for the dashboard**, not a screen reader for a complex task interface. Voice carries intent, compact confirmations, concise outcomes, and short summaries; the transcript/UI carries exact target sets, long analysis, and inspection detail.

**What changed:**
- Removed automatic initial backlog summaries. Text and voice now start with a greeting and wait for the user to ask for project state.
- Prevented voice mode from reading old transcript cards before the intro. Existing Orb messages are marked as display-only history before voice mode activates.
- Added `spokenText` alongside transcript `text` so voice can speak shorter operator-style responses while the screen keeps fuller answers.
- Updated the speech queue to track spoken character progress per Orb response, queue only new completed segments, avoid final-response replay, recover from shortened derived spoken text, and hand the mic back after the final spoken turn.
- Removed the dashboard-level "Ready" recovery timer from the voice path; mic handoff is owned by the voice runtime/queue.
- Hardened iPhone/iPad recognition handling with duplicate-start guards and rapid empty start/end loop protection.
- Kept API TTS failures visible instead of silently falling back to a browser voice.
- Added concise bulk confirmation speech that points to the transcript for exact todos/items.
- Repositioned the voice Orb as a featured top-right presence, reduced it slightly, added visual `Gathering data...`, and added an indeterminate progress bar.
- Created `docs/orb-voice-operator-runtime-plan.md` and updated `docs/ui-catalog.md` for the new voice placement/state pattern.
- Added eval case `greeting-no-automatic-summary`.
- Fixed the eval endpoint so frozen backlog fixture cases can use fixture-only project codes without depending on the live database containing that project.

**Tracking:**
- Closed **ORB-299 — Voice and todo action transaction reliability release** with server-verified `closed_at`.
- Added linked knowledge entry `Voice operator runtime and ORB-299 closure` (`0586b02c-5268-4d4a-afee-0485e468aca3`).
- Related prior knowledge `Voice and todo action transaction reliability release state` (`467d7b95-e319-4419-9c5e-6e2666c8c4aa`) remains true as the pre-operator action transaction/speech channel state; the new entry extends it rather than superseding it.

**Verification:**
- `npx tsc --noEmit` passed.
- Focused ESLint passed with existing warnings only.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed.
- `npm run build` passed.
- Manual iPad/iPhone localhost testing improved markedly after the operator pivot. Production real-device testing remains the next meaningful check because voice behavior can differ after deploy.

### Prior Session: Object Capability Matrix — Systematic CRUD/Surface Audit — 2026-06-30 (Claude Code, Sonnet 5)

**Object Capability Matrix — Systematic CRUD/Surface Audit — 2026-06-30 (Claude Code, Sonnet 5)**

Stan's directive: stop discovering capability gaps (e.g. Tickets having create-only Orb access) piecemeal — build a systematic, living audit across every domain object and every surface, plus a separate cross-cutting performance/flow matrix, since speed problems (e.g. login latency) need the same systematic treatment, not one-off fixes.

**What changed:**
- Created `docs/object-capability-matrix.md` — two-part matrix:
  - **Part 1:** all 11 domain objects (`todos`, `projects`, `knowledge_repo`, `tickets`, `audit_log`, `categories`, `groups`, `statuses`, `priorities`, `invitations`, `users`) audited across DB table, Orb tool CRUD, `query_db` fallback, REST API, Settings UI CRUD (verified against actual `onEdit`/`onDelete`/`onCreate` handlers in each Settings component, not assumed), Print, Help, and Test coverage.
  - **Part 2:** Flow/Performance matrix for cross-cutting critical paths (login/auth, dashboard load, project switch, settings loads, voice start, todo CRUD round-trip) — none currently instrumented.
- Added **"Object Capability Matrix — Maintenance Rule"** section to AGENTS.md (modeled on the existing UI Catalog / Eval Suite rules): any new table/tool/endpoint/page/flow must update the matrix in the same change; blank cells must be confirmed with Stan, not assumed.
- Filed four ORB todos for confirmed gaps:
  - **ORB-301** — Add a read tool for projects (`query_projects`)
  - **ORB-302** — Add update/delete tools for `knowledge_repo` entries
  - **ORB-303** — Add read/update/delete tools for tickets (sharpest gap — create-only today)
  - **ORB-304** — Systematic time-to-interactive instrumentation across critical flows (login flagged as the first known case; reframed from an initial one-off "fix login speed" todo after Stan caught the piecemeal framing mid-session)
- **Confirmed with Stan:** `statuses`/`priorities` are deliberately fixed/unmanaged (no Orb tool, no Settings page) — not a gap. Matrix records this as confirmed, not open.
- **Key findings surfaced:**
  - REST API (`docs/api-spec.yaml`) covers only `/api/tasks` — no project/knowledge/ticket/audit endpoints exist for external agents at all.
  - The only test coverage anywhere in the repo is the Orb eval suite (Tier 1/2), scoped to conversational tool-calling only — Settings UI, REST, and every non-conversational surface has zero automated test coverage.
  - Knowledge Repo's Settings UI (full CRUD) exceeds its Orb tool surface (create+read only) — an inverse gap worth noting alongside ORB-302.

No version bump — documentation/process work only, no user-facing app change this session.

**Tracking:** No knowledge_repo entry written yet for this session (the matrix doc itself is the artifact). Consider adding a short knowledge entry on close if this work is later closed against a todo.

### Key Lesson (this session)

When a reported problem (a missing tool, a slow flow) looks like a one-off, treat it as a signal to audit the whole category, not a ticket to patch the single instance. Caught live this session: an initial "fix login speed" todo was rewritten into ORB-304 (systematic instrumentation) after Stan pointed out it repeated the exact piecemeal pattern the matrix work exists to prevent. Saved to memory as `project_systematic_quality_audits` and `project_app_generator_vision` (Orb as a deliberate learning ground toward a future app-generator tool — context for why this kind of systemic work matters beyond Orb itself).

---

### Prior Session: Release Coherency + Manual Update Recovery — 2026-06-30 (Codex, GPT-5) — v0.6.104

Stan's directive: fix the broader release/update problem that affects both development and production. Users should never have to clear browser data, switch tabs, or guess whether the app silently changed under them after a deploy or local dev-server restart.

**Core contract:** Orb may detect that a newer server version or restarted local dev process exists, but it must not present itself as running that new state until the user explicitly applies the update/reconnect.

**What changed:**
- **Next 16 build warning cleanup:** follow-up v0.6.105 migrated `middleware.ts` to `proxy.ts`/`proxy()` and aligned `outputFileTracingRoot` with `turbopack.root` using `process.cwd()`, removing the production build warnings Stan saw after v0.6.104.
- **Central release coordinator:** `SystemStateProvider` owns server/client version state, polls `/api/version` while visible, and exposes one `applyUpdate` path for visible and conversational update actions.
- **Pinned running client version:** the mounted app shell pins `clientVersion` once. Version labels, Settings update checks, and What's New use that pinned value so Fast Refresh/HMR cannot make the app look upgraded before approval.
- **Production update detection:** production can only show the update banner for a real server/client version mismatch. `/api/version` returns `serverBootId: null` outside development.
- **Development restart detection:** local Next/Turbopack restarts are detected with a development-only `serverBootId`. The banner says `Dev only: reconnect to the restarted local server` and the button says `Reconnect`, avoiding production-style update language.
- **Manual-only apply:** automatic reload was removed after mobile testing showed it undermines trust. The app detects automatically, but reloads only when the user taps Update/Reconnect or explicitly applies an update.
- **Scoped state clearing:** `applyUpdate` clears only version-sensitive session state (`todos_orb_input`, `todos_orb_conversation`, `todos_orb_action_sets`) and preserves auth, durable settings, voice preferences, and layout preferences.
- **Push-only service worker lifecycle:** `public/sw.js` now uses `skipWaiting`/`clients.claim` while still avoiding any fetch handler or app asset cache.
- **What's New coherency:** Settings filters the changelog to the pinned running version, labels it `Installed`, and does not present newer release entries as installed before approval.
- **Dev-channel hardening:** the admin developer-channel poll pauses during update/restart recovery and on stale server-action response errors so it does not fire server actions into a rebooting dev server.

**Tracking todo and knowledge:**
- Closed **ORB-300 — Release coherency and automatic update recovery** with server-verified `closed_at`.
- Added linked knowledge entry `Release coherency and manual update recovery contract` (`6d3e884c-0b15-4934-86cf-aa88e5910ce4`).
- Checked related knowledge. `Helm version update system — update banner, changelog, What's New sheet, and SW dev guard` is adjacent prior art, not superseded.

### Changes in this commit (v0.6.99–v0.6.105)

Key files:
- `components/SystemStateProvider.tsx` — release coordinator, pinned client version, update reason, manual apply path, scoped session clearing.
- `app/api/version/route.ts` — no-store version endpoint now includes development-only `serverBootId`.
- `components/UpdateBanner.tsx` — reason-specific copy for real version updates vs dev-only reconnects.
- `components/ui/OrbVersionLabel.tsx` — displays pinned running client version.
- `components/settings/SettingsWhatsNew.tsx` — filters changelog to the installed/running version and uses the shared manual update path.
- `components/UnifiedDashboard.tsx` — conversational check/apply update actions use the release coordinator; dev-channel polling backs off during restart recovery.
- `public/sw.js` — push-only service worker lifecycle update.
- `middleware.ts` → `proxy.ts`, `next.config.ts` — Next 16 proxy convention and aligned build roots.
- `lib/changelog.ts`, `lib/version.ts`, `package.json` — release entries and version bump through v0.6.105.

### Verification Status

- `npx tsc --noEmit` passed.
- Focused ESLint on touched files passed with only existing `UnifiedDashboard` warnings.
- `git diff --check` passed.
- `npm run build` passed after v0.6.105 cleanup; the prior `outputFileTracingRoot`/`turbopack.root` and `middleware` deprecation warnings no longer appeared.
- Manual local testing on iPad/iPhone confirmed: update/reconnect waits for user action, version stamp stays pinned before approval, and dev-only reconnect copy is clear.
- Production verification is next after push. Production should exercise only the version-mismatch path, never the dev-only server-restart path.

### Known Issues / Watch

1. **Production verification pending:** after deploy, test old open tabs on Mac/iPad/iPhone. Expected: banner appears for server/client version mismatch, version stamp remains old until Update is tapped, then reload shows v0.6.105.
2. **Voice production still needs retest:** earlier iPhone voice symptoms may have been affected by stale release state. Retest voice after production release coherency is live.
3. **Full project lint still has unrelated historical errors:** focused lint on touched files is clean, but full `npm run lint` still fails in unrelated prototype/settings files.

### Key Lessons

1. **Detecting an update is not applying an update.** The UI must distinguish “new state exists” from “this app is running new state.”
2. **Running version is a client-shell fact.** Pin it at mount; do not let server version or HMR module replacement rewrite the user's visible installed version before consent.
3. **Development recovery needs development language.** A local dev-server restart is not a production release. Label it as dev-only reconnect so the mechanism builds trust instead of confusion.
4. **Manual consent beats clever auto-reload.** Especially on mobile, silent recovery can feel like the app changed behind the user's back.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

### Prior Session Context

**Voice + Todo Action Transaction Release — 2026-06-29 (Codex, GPT-5) — v0.6.97**

v0.6.77–v0.6.97: unified voice speech channel, no silent TTS fallback, deterministic todo action transactions shared by text/voice, session action-set ledger, grouped summaries, concise voice project state, commitment integrity, and eval coverage. Created ORB-299 to continue failure/warning-path work.

**CRUD Reliability — Name-First Context + structural gate — 2026-06-27 (Claude Code, Opus 4.6)**

v0.6.73–v0.6.75: removed regex approval gate, name-first AI context, capability detection, voice structural fixes, first structural mutation gate (now superseded by the propose/confirm/execute flow above).

**Voice mode production fixes — 2026-06-26**

v0.6.67–v0.6.71: silent TTS fix, build gate for TTS keys, iPhone AudioContext volume, selected voice DB load, delete-project loop, duplicate voice race, fader slider.

---

## Key Decisions

- **Name-first context.** The AI's backlog, scope text, observations, and all project references use project NAME as the primary identifier. Code is shown as metadata `[code: XXX]` for tool calls only. Users never interact with codes.
- **Project code is internal-only, purely for composing todo codes (v0.6.117).** Code has exactly one job: prefixing todo codes like `ORB-73`. It is never a second user-facing label (removed from every list/table/picker/print surface that showed it) and never user-editable (removed from every create/edit form; `createProject`/`updateProject` auto-generate it from the name). Project references — typed, spoken, or model-driven — resolve by exact name → exact code → fuzzy/partial name (`resolveProjectByReference` in `UnifiedDashboard.tsx`), so a short or partial name always works.
- **Structural mutation gate replaces prompt-only gating.** CRUD tools are held server-side until user confirms. The AI calls the tool immediately, the server holds, the user confirms, the server executes.
- **Prompt aligns with gate.** The mutation prompt says "always call the tool immediately — the server handles confirmation." No conflict between prompt-layer and gate-layer expectations.
- **Project name is the user's identifier.** Tool params for `delete_project` and `update_project` accept `name`, not `project_code`. Handlers look up by name. Code is immutable, auto-generated, internal. (Known inconsistency: `client_action`'s `switch_project.target` is still documented as "Project code" — not yet reconciled to the name-first convention; see loose end in the v0.6.117 session notes above.)
- **Identifier provenance is a general rule, not a per-tool patch (v0.6.115).** Task/project codes may only be used if they came from something actually seen this conversation — backlog, tool result, or the user's words. Never constructed by pattern, never remembered across a cleared session. Enforced at three layers: a prompt law, a record-state-transparency note on empty history, and a structural server-side gate that rejects mutations targeting unseen codes.
- **Voice speaks once per turn, after the response completes (v0.6.113).** Voice does not chase the stream — the screen shows streaming progress, voice waits for the final response and speaks a single derived summary. This is what fixed voice repeating/overlapping itself.
- **Linear processes get structural enforcement.** If steps must happen in a fixed order, code enforces the order. Non-linear processes (queries, reads) stay prompt-guided.
- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel`. Primary = `btn-primary`. Delete = `btn-danger` with `marginRight: auto`.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Voice personality: one personality at three volumes** (reserved/natural/open).
- **Voice preferences in localStorage, not DB.** Browser voices differ per device.
- **Voice testing: Chrome/Safari/Edge only.** Comet is unreliable for voice.

---

## Next Priorities

1. **ORB-303 / tickets is the sharpest capability-matrix gap.** It is probably the next practical implementation slice unless Stan chooses another ORB-317 interaction-quality behavior.
2. **Continue ORB-317 slices with the verified v0.6.160 prompt base.** The umbrella now covers project-health reads, next-step reads, operating-rule cleanup, capability gaps, and future interaction-quality work.
3. **Consider a strategic-provider fallback improvement.** The Gemini quota incident showed the current strategic failure message is accurate but not very diagnostic to the user; a future slice could expose the classified reason or fall back to Claude for strategic reads when Gemini is unavailable.
4. **Keep eval cost discipline.** Use Stan live transcripts for flexible strategic tone first; add or adjust evals only when a behavior needs to become a durable regression guard.

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-07-12 — Claude Code (Opus 4.8)`

---

*Updated by AI at end of each session. Committed with session code changes.*
