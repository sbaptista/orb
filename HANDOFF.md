# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.6

---

### Last Session Completed

**ORB-266: Ghost in the Machine — 2026-06-18 (Codex, GPT-5)**

Closed ORB-266 after completing the cross-session memory/voice work, self-adaptation proposal flow, insight rendering, and a critical mutation-integrity fix.

**What was done:**

1. **Cross-session memory and voice personality were retained from the prior slice work** — `orb_memory`, `save_memory`, `recall_memories`, `openness`, and `memory_level` remain wired into Orb conversation and Settings > Orb Memory.

2. **Self-adaptation proposals** — added active adaptation loading into Orb context, `propose_adaptation` tool exposure/handler, `orb_adaptations` migration, signed approval/rejection email links, and audit logging.

3. **Insight rendering** — Orb responses can carry structured `observation`, `coaching`, or `strategic` insights. The conversation UI now renders them as a full-width header strip (`Observation`, `Coaching read`, `Strategic read`) at the top of the Orb card.

4. **Server-enforced mutation approval** — prompt-only approval was not enough. `orbConverse` now gates mutating tools when `mutation_approval=ask`, asks for confirmation first, and only executes after an affirmative response to a pending proposal or when `mutation_approval=allow`.

5. **False-success guard** — Orb can no longer claim a mutation succeeded or cite a new task code when no mutation tool ran. No-tool mutation completion claims are blocked unless a mutation actually succeeded in the current request.

6. **Eval protection** — evals now support `mutationApproval: 'ask'`; added Tier 1 cases for false-success history and approved mutation follow-through. Full Tier 1: **12/12 green**.

7. **Closeout** — closed ORB-266 with attributed resolution notes, added linked Knowledge Repo entry `cfd351a6`, created follow-up ORB-287 for dashboard background polling overhead, and bumped to v0.6.6.

### Uncommitted Changes

- `.claude/settings.local.json` — local settings change from this session
- `app/actions/orb-converse.ts` — adaptation context/tool handler, insight extraction/streaming, server-side mutation approval gate, no-tool false-success guard
- `app/api/orb-eval/route.ts` — matching prompt wiring plus eval approval-mode simulation and false-success guard behavior
- `app/api/orb-adaptation/route.ts` — NEW signed approve/reject endpoint for adaptation emails
- `app/globals.css` — `oc-insight` header-strip styles
- `components/OrbConversation.tsx` — insight type and OrbCard header-strip rendering
- `components/UnifiedDashboard.tsx` — preserves streamed insight metadata on Orb messages
- `docs/ui-catalog.md` — documented Orb Insight Marker pattern
- `lib/email.ts` — signed adaptation email helpers
- `lib/orb-contract.ts` — `propose_adaptation` tool label
- `lib/orb-prompt.ts` — strategic/coaching/adaptation prompts, expanded observations, approval integrity rules
- `scripts/eval-cases.ts` — added approval/false-success Tier 1 cases
- `scripts/orb-eval.ts` — passes eval-only `mutationApproval` override
- `scripts/migrations/20260617_orb_adaptations.sql` — NEW adaptation persistence table
- `lib/changelog.ts` — v0.6.6 release entry
- `lib/version.ts` — v0.6.6
- `package.json` — v0.6.6

---

### Key Lesson

**Prompt-only mutation safety is insufficient** — When a conversational agent can mutate production data, the server must enforce both permission and truthfulness. ORB-266 showed that Orb could call a mutating tool without asking even when `mutation_approval=ask`, and could also claim a new ORB code when no tool ran. The durable fix is server-side gating plus no-tool false-success blocking. Knowledge repo entry `cfd351a6` documents the lesson.

---

### Not started

- **ORB-287:** Investigate dashboard background polling overhead (`fetchPendingDevMessages()`, `/api/health`, `/api/version`).
- **ORB-265:** Full Audit of Orb Instructions.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**Current pattern** (UnifiedDashboard.tsx):
```
{showOrb && <OrbConversation ... />}
{showList && <div className="ud-list-content">...</div>}
```

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Earlier Sessions

**ORB-254: Audit the Audit Log — 2026-06-16 (Claude Code, Opus 4.6)**
- Modal search, toolbar redesign, scroll nav fix, mobile version label. Bumped to v0.6.0.

**ORB-254: Audit Log stages 1–3 + Stage 4 partial — 2026-06-15 (Codex, GPT-5)**
- System info collection, audit log completeness, Orb auto-tickets, table UX with sticky columns. v0.5.232.

**ORB-260, ORB-261, ORB-262 — Auth & Settings overhaul — 2026-06-13 (Claude Code, Opus 4.6)**
- Restored explicit passkey button on login. Stale passkey flows. Split compound Data page. Removed breadcrumbs. Passkey migration to Account page. Email change flow. v0.5.224.

**ORB-255 global filtering + ORB-252 repository inspection — 2026-06-12 (Codex)**
- Full-dataset filtering/sorting on Knowledge Repository and Audit Log. Repository access for Admin/Super Admin/Developer roles.

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar. SearchModal. Modal footer standardization. Empty states.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Search modals use `<form onSubmit>`** — Enter key submits, cancel/clear buttons are `type="button"`, submit button is `type="submit"`. Reusable pattern for future modals.
- **Filter presentation:** Kebab menus, not native selects or pills. Consistent with commands rule: styled dropdown triggered by a button. Accessibility contract: menu/menuitemradio pattern with keyboard support.
- **Accessibility hardening boundary:** No redesign unless a real contrast/motion failure is found. Prefer visible titles and labels as accessible names; attach destructive confirmation text to the final destructive action.
- **Resize divider behavior:** Do not snap the divider back to preset ratios after drag. Persist the exact user-selected position; use a 40px coarse-pointer gutter on iPad/touch.
- **Project switcher language:** The dashboard project selector is "Change Project", not "Search"; `SearchModal` remains reusable with a default title of "Search".
- **Empty states:** OrbMini SVG illustration + message. 5 variants. "Ask Orb" not "Ask the Orb".
- **Loading states:** Skeleton shimmer rows, never bare "Loading…" text.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Disabled opacity normalized to 0.7** across the entire app.
- **Three-tier font scaling:** Desktop → Tablet (touch) → Phone.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Email change: instant via admin API.** No confirmation email, no sign-out. Session refreshes in place, PasskeyGate handles re-registration.
- **Column resize removed.** Sticky columns + horizontal scroll replaces resize. `stickyColumns` is a per-table config on SettingsCrudList.
- **externalSearchTerm pattern:** Parent manages search UI (modals, buttons), CrudList handles data loading. Clean separation for complex search UIs.
- **Voice personality: one personality at three volumes** (reserved/natural/open), not three different characters. Adjustable via `openness` preference.
- **Two-track memory model:** autonomous (Orb saves silently after 2+ observations) and offered (user confirms before saving). All memories visible in Settings > Orb Memory.
- **CrudList toolbar maxWidth:** When table uses pixel column widths, toolbar maxWidth is constrained to tableMinWidth so controls align with the table edge.

---

## Next Priorities

1. **ORB-287** — investigate dashboard background polling overhead observed during ORB-266 testing.
2. **ORB-265** — full audit of Orb instructions, especially now that server-side mutation integrity has been strengthened.
3. **ORB-254 remaining** — blank User columns when filtering by date.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-18 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
