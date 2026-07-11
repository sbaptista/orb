# ORB-312 — Production Performance Optimization

**Status:** open. Companion to `docs/orb-309-initialization-performance-plan.md` (instrumentation) and the Flow/Performance Matrix (`docs/object-capability-matrix.md`, Part 2).

ORB-312 began as a "Production Performance Baseline Sweep." The baseline + the login investigation are done; this doc tracks the **optimization passes** that follow, each measure-first (per [[project_systematic_quality_audits]]: one target, baseline, one focused change, before/after, record).

---

## Ranked targets (2026-07 production baseline)

1. **AI Metrics `ai_accounting_load`** — p50 ~3–4s, p95 4.3–6s cross-platform. → **Pass 1 done (v0.6.176), see below.**
2. **`dashboard-init` p95 tail** — p50 ~0.4s but p95 4.5–5.0s on Mac/iPad (n=240/133). High volume; the tail is the issue. Now measurable end-to-end via the `route_to_ready` span (v0.6.175). → **Pass 3 attempted (v0.6.179) and reverted after a production login outage — still UNADDRESSED. See Pass 3 below.**
3. **Settings large-table loads** (`orb_model_requests`, `performance_events`, `audit_log`) — p95 3–4s; already partly addressed by ORB-311 cursor pagination. Watch, don't prioritize.

**Discarded as non-actionable:** passkey `navigator.credentials.get` ceremony (OS/environment, not app code); `conditional_passkey` dwell (telemetry artifact, span removed v0.6.174); `auth` failure rate (was benign aborts, fixed v0.6.175).

---

## Results log

### Pass 1 — AI Metrics accounting-load merge (v0.6.176, 2026-07-08)

**Finding.** `ai_accounting_load` (~3–4s) was **~100% server+network** — client render ~1ms (the `server_actions_completed` stage ≈ total). The `get_ai_cost_summary_rollups` RPC is only **183ms** on a 3,627-row / 4.3MB table, so the DB was never the problem. Root cause: the span fired **two** server actions (`getAiCostSummary` + `getOrbAiSettings`), and **Next.js serializes server actions from one client**, so each paid a full `getAuthContext()` → `supabase.auth.getUser()` **network round-trip** — the auth cost was paid **twice, back-to-back**. p50 4s ≈ 2 × (~1.8s auth + queries).

**Fix.** New `getAiMetricsBundle(options)` = one `requireAdmin()` + a real server-side `Promise.all` of both fetches. Extracted `fetchOrbAiSettings(ctx)` into `lib/orb-model/ai-settings-core.ts` (no auth gate) for reuse; public `getAiCostSummary` / `getOrbAiSettings` wrappers unchanged (other callers unaffected). Commit `e6ca709`.

**Measured (production, before ≤v0.6.175 vs after v0.6.176):**

| Platform | Before | After | Read |
|---|---|---|---|
| **Mac** | p50 4251 / p95 5652 (n=13) | p50 **2631** / p95 **3907** (n=5) | **~38% faster — confirmed** (same-timeframe, apples-to-apples) |
| **iPhone** | p50 3346 / p95 6050 (n=6) | p50 3038 / p95 7172 (n=7) | **Inconclusive** — tiny n, "before" baseline 5 days stale (different network), mobile RTT-dominated; p95 uptick is one slow Safari sample, not a trend |

**Conclusion.** Confirmed on Mac: the merge removed one **server-action round-trip** and that was worth ~38%. ⚠️ **My original attribution — "the residual ~2.6s is a single `getUser` round-trip, auth ≈1.8s" — was wrong, and Pass 2 (below) disproved it with direct instrumentation.** `getAuthContext` is only ~106ms; the residual is server-action round-trip + Vercel cold-start overhead, not auth. Real lesson: **a server-action round-trip costs ~1–2s of framework/network/cold-start overhead regardless of the ~hundreds of ms of code inside it** — so the lever is *fewer round-trips per page*, which is (unwittingly) exactly what this merge did.

---

### Pass 2 — auth-path local verify + the correction (v0.6.177)

**What I did.** Replaced `supabase.auth.getUser()` (network) with `supabase.auth.getClaims()` (local ES256 verify) in the shared `getAuthContext`, expecting to remove a ~1.8s auth floor. Then instrumented `getAuthContext` server-side (temporary diagnostic, since removed) to actually measure the phases.

**What the instrumentation showed** (dev, n=62; phase marks *inside* the function, so route-compilation noise is excluded):

| Phase | p50 | p95 |
|---|---|---|
| `createClient` | 2ms | — |
| `getClaims` (local verify) | **2ms** | 7ms |
| role query (`users`) | 100ms | 351ms |
| **`getAuthContext` total** | **~106ms** | 358ms |

**The correction.** Auth was **never** the bottleneck. `getAuthContext` is ~106ms, not ~1.8s. `getClaims` works perfectly (~2ms local verify, no network), so the change is **correct and kept** — but it bought **no perf win**, because there was no auth cost to remove. Production before/after confirmed independently: v0.6.176 (getUser) p50 2750 vs v0.6.177 (getClaims) p50 2535 — flat.

**Where the ~2.5s actually is.** `getAuthContext` (106ms) + RPC (183ms) + settings queries ≈ **~400ms of real server work**. The other **~2.1s is server-action overhead** — the client→Vercel→back round-trip, Next.js server-action framework cost, and **Vercel cold starts** (matches "Performance felt sluggish at times"). Outside our code.

**Lesson (twice-learned).** Measure before optimizing. I inferred a ~1.8s `getUser` floor twice and was wrong both times; one diagnostic pass settled it. The 100ms role query is now the biggest thing *inside* `getAuthContext` — foldable into a JWT custom claim later, but a rounding error vs. the round-trip.

**Real lever going forward:** reduce **server-action round-trips per admin page** (app-side, same move as Pass 1) and/or address **Vercel cold starts** (infra). Round-trips first — cleaner, no infra commitment.

---

### Pass 3 — dashboard client-auth removal → production login outage → REVERTED (v0.6.179–v0.6.182, 2026-07-09)

**What I did (v0.6.179).** Target #2 (dashboard-init). `client_init` in `UnifiedDashboard` re-ran `supabase.auth.getUser()` + a `users` profile query on mount, even though the server component (`app/dashboard/page.tsx`) already ran `getUser()` → `resolveUser()` and passed the resolved `user` + `initialProducts` down as props. 97 production `client_init` samples confirmed those two redundant round-trips were ≈ the entire span (Mac p50 362 / p95 1166, iPhone 375 / 1584, iPad 505 / 7835 ms; `had_projects_query = 0`). Changed `client_init` to read the profile from the `user` prop; widened `resolveUser`'s select. A dead-state cleanup followed (v0.6.180).

**What broke.** After v0.6.180 deployed, **production login looped** — sign-in bounced back to the login screen, hung on "authenticating," or cycled. Reverted Pass 3 (v0.6.181) → fixed **Chrome only**. Reverted **Pass 2's getClaims** (v0.6.182) → fixed **Safari/Firefox**.

**Actual root cause (took three misdiagnoses to pin down).** Orb already HAS session-refresh middleware: **`proxy.ts`** at the repo root (Next 16 renamed `middleware` → `proxy`), which calls `getUser()` on every request (refresh + cookie propagation) and does auth redirects. The outage was **Pass 2**, not Pass 3: `getAuthContext` used `getClaims()` (local verify, which **rejects** an expired token) while the proxy used `getUser()` (which **refreshes** it). A server-action `getClaims` failure → `handleSessionExpired` → `/auth/login` → the proxy's `getUser` succeeds there → redirects back to `/dashboard` → **infinite loop**. Safari (ITP) / Firefox (ETP) let access tokens go stale and exposed it; Chrome auto-refreshed and hid it. Full write-up: KB `17accfad-9606-445d-855e-145bb9a2c370`, memory `project_auth_getclaims_vs_proxy`.

**Outcome — the "reduce auth round-trips" lever is CLOSED.**
- **Pass 2 (getClaims): abandoned as unsafe.** It cannot replace `getUser` in server actions — it must agree with the proxy's refresh or the app loops. The ~100ms win is not worth the fragility.
- **Pass 3 (dashboard client-auth removal): reverted.** The redundant client `getUser` + profile query is back. **Target #2 remains unaddressed.** Any re-attempt is high-blast-radius (shared auth path) and must be measure-first AND verified on **Chrome + Safari + Firefox** before deploy — not a quick win.
- **Pass 1 (AI Metrics merge) is untouched and remains the one standing ORB-312 win.**
- **Standing lesson:** the residual per-page ~2s is Vercel/Next framework + cold-start overhead — not app-fixable. Prefer safe, non-auth server-action merges next (e.g. `SettingsUserDetail`'s two-action `Promise.all`, same pattern as Pass 1, no auth-path change).

---

## Superseded — original spec: `getUser` → local JWT verification
> Implemented in Pass 2 (v0.6.177). The perf **premise** below (that `getUser` was a ~1.8s floor) was **wrong** — see Pass 2. Retained for the security / precondition analysis, which still holds.

**Problem.** Every admin server action calls `getAuthContext()` (`lib/auth.ts`), which does `supabase.auth.getUser()` — a **network round-trip to the Supabase Auth server** to validate the JWT — plus a role lookup. On the AI Metrics page (and most admin surfaces) this ~1.8s auth call is now the floor, and it's paid once per server action. Next.js serialization means a page firing several admin actions pays it several times. Mobile latency makes each round-trip worse.

**Proposed approach.** Replace the network `getUser()` in `getAuthContext` with **`supabase.auth.getClaims()`**, which verifies the JWT **locally** (signature + expiry) against the project's published JWKS — no network round-trip. Keep the role lookup (fast, indexed PK query) or fold the role into JWT claims later.

**Preconditions / unknowns to verify FIRST (measure-first):**
1. **Signing keys.** `getClaims()` only avoids the network call if the project uses **asymmetric JWT signing keys** (ECC/RSA) with a JWKS endpoint. If the project is still on the legacy shared **HS256** secret, `getClaims()` may fall back to a network call or require migrating signing keys (Supabase dashboard → Auth → JWT Signing Keys) first. **Check the project's current signing key type before anything else.**
2. **Isolate the cost.** Add a stage mark inside `getAuthContext` around the `getUser()` call and collect production samples to confirm it is in fact ~1.8s (vs. the role query / client creation). Don't optimize on assumption.

**Security trade-off (must decide explicitly):**
- `getUser()` does a **live server check** — catches a user deleted/banned/token-revoked since issue.
- `getClaims()` trusts a cryptographically valid, unexpired JWT — a revoked admin could act until token expiry (`jwt_expiry`, default 1h).
- For this app (single admin, small alpha) this is very likely acceptable, especially for **reads**. Option: use `getClaims` for read/query actions and keep `getUser` for sensitive mutations. Decide before implementing.

**Blast radius.** `getAuthContext` is the shared gate behind `requireAdmin` and every authed server action — this is a **high-blast-radius change to the whole auth path**, not an AI-Metrics-local tweak. Requires a task branch (per concurrency §4) and careful before/after verification across auth, dashboard, and settings flows.

**Expected win.** If `getUser` is ~1.8s and `getClaims` is local (~ms), admin server actions drop by ~that much each — the biggest single lever left, and it compounds on any page firing multiple admin actions and on mobile.

**Not started.** Needs Stan's go + the signing-key check. When approved: branch, instrument the auth call, confirm the cost, choose the security posture, implement behind the shared `getAuthContext`, and measure.
