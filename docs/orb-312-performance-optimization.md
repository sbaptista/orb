# ORB-312 — Production Performance Optimization

**Status:** open. Companion to `docs/orb-309-initialization-performance-plan.md` (instrumentation) and the Flow/Performance Matrix (`docs/object-capability-matrix.md`, Part 2).

ORB-312 began as a "Production Performance Baseline Sweep." The baseline + the login investigation are done; this doc tracks the **optimization passes** that follow, each measure-first (per [[project_systematic_quality_audits]]: one target, baseline, one focused change, before/after, record).

---

## Ranked targets (2026-07 production baseline)

1. **AI Metrics `ai_accounting_load`** — p50 ~3–4s, p95 4.3–6s cross-platform. → **Pass 1 done (v0.6.176), see below.**
2. **`dashboard-init` p95 tail** — p50 ~0.4s but p95 4.5–5.0s on Mac/iPad (n=240/133). High volume; the tail is the issue. Now measurable end-to-end via the `route_to_ready` span (v0.6.175).
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

**Conclusion.** Confirmed on Mac, matching the mechanism exactly (before = 2×auth + queries; after = 1×auth + queries; auth ≈1.8s, queries+net ≈0.6s → ~4.2s→~2.4s). Mobile within noise — not disproven. **The residual ~2.6s is a single `getUser` round-trip**, now the dominant remaining cost and worst on mobile (round-trip-bound). Not worth chasing a cleaner mobile number for this pass — diminishing returns.

---

## Next pass — spec: `getUser` → local JWT verification

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
