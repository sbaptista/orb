# HANDOFF.md

> Living session-to-session context for the Orb project.
> Every AI reads at session start. Every AI updates it at session end.
> Committed with each session's code changes.
>
> **History policy (agreed with Codex, 2026-07-12):** this file holds only *current, load-bearing* context. Durable technical lessons live in the **Knowledge Repo**; operating rules in **AGENTS.md**, the **object-capability matrix**, **UI catalog**, **eval cases**, and the **concurrency protocol**; implementation history in **git**. Prune aggressively — do not let dated session narratives accumulate here.

---

## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** local/canonical **0.6.188** — production is current (v0.6.188 deployed and Vercel-promoted 2026-07-12). The earlier v0.6.173 login-loop-bisection rollback has been fully unwound.

---

## Last Session Completed

**ORB-312 — Production Performance Baseline Sweep — 2026-07-12 (Codex, GPT-5) — CLOSED**

Closed after sweeping the instrumented high-use flows across Mac/iPad/iPhone into a ranked, evidence-based target list that separates actionable application latency from OS ceremony, telemetry artifacts, and infra/framework tails. Headline win: AI Metrics `ai_accounting_load` — merging two serialized server actions into `getAiMetricsBundle` removed a full action round-trip (production Mac p50 **4251 → 2631 ms, ~38%**). Closed `closed_at` 2026-07-12T20:50:52Z; KB entry `841e6aef-5255-4d97-adef-8dbe53cc753c`.

---

**ORB-323 — auth hardening + orphan-prevention cleanup (ORB-321 follow-ups) — 2026-07-12 (Claude Code, Opus 4.8) — v0.6.187–v0.6.188 — CLOSED**

Spun off from the ORB-321 login-loop root-cause fix and completed end-to-end (built, shipped, Vercel-promoted, production-verified, closed). All 6 items:
- **#1** Removed the temp `/api/auth-debug` diagnostic endpoint + its `proxy.ts` bypass line.
- **#2** `deleteUser` (`app/actions/delete-user.ts`): `auth.admin.deleteUser` failure is now a **hard error** (was a silent `console.warn` — the swallowed failure that produced ORB-321's orphaned auth users); the "already gone" case is tolerated as success.
- **#3** A valid auth session that can't resolve to a `public.users` row (phantom/orphaned) is now **signed out** via a new **`app/auth/signout/route.ts`** route handler before landing on login, instead of looping `/dashboard ↔ /auth/login`. Key lesson: a **React Server Component can't write cookies** (Supabase `setAll` is try/caught in RSC), so a real sign-out must live in a route handler; the dashboard gate routes `!resolveUser.ok` through it. Do **not** sign out in the proxy on a bare role query — it pre-empts `resolveUser`'s reconciliation/invitation paths.
- **#4** `app/auth/login/page.tsx` never leaks the raw provider error anymore — fixed friendly copy (real error stays in telemetry).
- **#5** Removed the v0.6.184 proxy self-heal band-aid (no longer load-bearing once the root cause was fixed) — shipped separately as v0.6.187.
- **#6** Migration **`scripts/migrations/20260712_orb_adaptations_cascade.sql`**: `orb_adaptations.user_id` FK `NO ACTION → ON DELETE CASCADE` — the **same latent orphan-cause** as the ORB-321 telemetry FKs, found by auditing the *whole* FK class during #2. Applied to the DB (verified). Convention: telemetry FKs → SET NULL (outlive user); personal per-user data → CASCADE.

**Verification:** `tsc` 0, `eslint` 0; representative Tier 1 eval smoke 13/13 (run twice); production-verified after v0.6.188 promotion (passkey sign-in + friendly error, no login loop on Safari/iPad, deleteUser end-to-end orphan check). Closed via Orb API (`closed_at` 2026-07-12T20:26:54Z); KB entry `0b1961cc-d149-4b94-be6b-e6540f7cce60`. **Test-user provisioning was scoped OUT** (separate workstream — see Next Priorities).

---

**ORB-322 — automatic cross-version client-state invalidation (Part B, split from ORB-321) — 2026-07-11/12 (Claude Code, Opus 4.8) — v0.6.186 — CLOSED**

Stale version-coupled client state survived deploys because volatile-state clearing only ran from the **Update button** — any other path to a new bundle (plain reload / back-navigation / browser picking up new assets) left stale Orb transcript/input/action-set/command-history behind, sometimes forcing a manual browser site-data clear.

**Fix (shared module + 3 files):**
- **New `lib/client-state.ts`** — single source of truth: `VERSION_VOLATILE_SESSION_KEYS` (the 3 existing Orb keys **+ added `todos_orb_cmd_hist`**), `LAST_APPLIED_VERSION_KEY`, shared `clearVersionVolatileState()`.
- **`app/layout.tsx`** — a **pre-hydration inline `<script>`** (first child of `<body>`, built from the shared constants) running synchronously during HTML parse, **before React hydrates and before `UnifiedDashboard` reads sessionStorage** (React fires child effects before parent effects, so a provider `useEffect` would lose that race). On boot: if compiled `VERSION !== localStorage[orb_last_applied_version]` → clear volatile keys + set the marker. Fires **once per version transition**, regardless of how the new bundle arrived.
- **`components/SystemStateProvider.tsx`** — removed the duplicated local key list + clear function; `applyUpdate` uses the shared helper/constant.

**Preserved across versions (deliberately NOT cleared):** voice prefs, dismissed broadcasts, welcome state, saved login email, dev flags, session identity, the marker itself. (Conservative scope — the value is the automatic trigger, not a heavier wipe.) HTTP cache headers audited → no change needed. Closed 2026-07-12T19:41:51Z; KB entry `8770a2e3-dc23-410a-990d-6e83ea5c7a85`.

**Current product behavior (intended):** loading a newly-deployed version clears any in-progress Orb conversation — a stale transcript from the old bundle can't be safely reused, same as the Update-button path.

---

**ORB-321 — WebKit login loop root-caused & closed — 2026-07-11 (Claude Code, Opus 4.8)**

The recurring Safari/iPad login loop was **not** cookie corruption (the discarded v0.6.181–185 theory). Real, DB-proven cause: `deleteUser` swallowed an `auth.admin.deleteUser` FK failure (telemetry `user_id` was NOT NULL + NO ACTION), leaving orphaned `auth.users` rows with live passkeys; selecting an orphan's passkey minted a phantom session with no `public.users` row → proxy `/dashboard ↔ /auth/login` loop. Fixed at the data/schema level: migration `20260711_telemetry_user_id_set_null.sql` (telemetry FKs → nullable + ON DELETE SET NULL) + deletion of the 4 orphaned auth users. Production-verified, closed; KB `c9292534`. The hardening half became **ORB-323**; the client-state half became **ORB-322** (both above).

---

## Current Uncommitted Changes

- `HANDOFF.md` — this Claude-owned restructure/prune, not yet committed.
- `.claude/settings.local.json` — intentional local tool-settings change (never committed with feature work).
- Otherwise the tree is clean. All ORB-321/322/323 code, migrations, and closures are committed and pushed (through `bbef735`).

---

## Active Risks / Unresolved Work

- **None pressing.** The ORB-321 login-loop class is fully closed (ORB-321/322/323 + the two FK migrations); the orphan-cause FK class was audited whole, not patched per-instance.
- **Standing, low priority (verified 2026-07-12):** full-project `npm run lint` reports **6 errors + 63 warnings**, all in pre-existing files unrelated to recent work (e.g. `react-hooks/set-state-in-effect` in voice hooks, unused-var warnings in scripts). Focused lint on touched files is clean and is the working gate.

---

## Next Priorities

1. **Test-user provisioning → ORB-324 (open).** The one open item from the auth arc (scoped out of ORB-323, now filed). Real test non-admins + admins with a login-bypass for one admin + one user, to collect non-admin telemetry. `dev-login.ts` is existing related infra.
2. **ORB-292** — design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, consent-based Orb tuning proposals.

_(Reprioritize with Stan. Removed stale candidates: ORB-303/ORB-317/ORB-287/ORB-254 are all closed — file a fresh focused ticket if any has genuinely unfinished scope rather than reviving a closed one.)_

---

## Key Current Decisions

Load-bearing invariants for anyone touching Orb behavior. Full operating rules live in **AGENTS.md**; UI patterns in **docs/ui-catalog.md**; conversation behavior in **eval cases** + `lib/orb-contract.ts`.

- **Name-first identifiers.** Project **NAME** is the identifier everywhere users/model interact. Project **code** is internal-only, auto-generated, immutable, and exists solely to prefix todo codes (`ORB-73`) — never a second user-facing label, never user-editable. References resolve name → exact code → fuzzy/partial name (`resolveProjectByReference`). `switch_project`, `update_project`, `delete_project` all take **name**, server resolves. (The old `switch_project`-uses-code inconsistency is **reconciled** as of 2026-07-12.)
- **Structural mutation gate** (not prompt-only). CRUD tools are held server-side: the model calls the tool immediately, the server holds, the user confirms, the server executes. The mutation prompt aligns ("always call the tool immediately — the server handles confirmation").
- **Identifier provenance.** Task/project codes may only be used if they were actually seen this conversation (backlog, tool result, or the user's words) — never constructed by pattern or remembered across a cleared session. Enforced at the prompt layer + a server-side gate that rejects mutations targeting unseen codes.
- **Voice.** Speaks once per turn, after the response completes (never chases the stream). One personality at three volumes (reserved/natural/open). Preferences live in localStorage (browser voices differ per device). Test on Chrome/Safari/Edge only — Comet is unreliable for voice.
- **Git push is never automatic** — explicit in-chat approval every time (also structurally enforced via settings.local.json).
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-07-12 — Claude Code (Opus 4.8)`

---

*Updated by AI at end of each session. Committed with session code changes.*
