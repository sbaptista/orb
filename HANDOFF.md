# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** v0.5.212 (not pushed)

---

### Last Session Completed

**ORB-255 global filtering + ORB-252 repository inspection — 2026-06-12 (Codex)**

### What was done

1. **ORB-255:** Added full-dataset filtering and sorting to paginated Knowledge Repository and Audit Log settings pages. Stan tested and approved it; the todo was closed and a linked Knowledge Repo entry was created.
2. **ORB-252:** Added read-only `query_repository` operations for list, search, and ranged file reads.
3. **Environment behavior:** Localhost Orb reads the live working tree and can query the current production deployment. Production Orb reads a sanitized source bundle regenerated during every Vercel build.
4. **Authorization:** Added a Developer role without admin privileges. Admin, Super Admin, and Developer receive repository access; Owner does not. The tool list, capability reporting, handler, and production endpoint all enforce the same rule.
5. **Security:** Hidden paths, traversal, symlinks, disallowed extensions, files over 250 KB, and oversized responses are blocked. The production trace contains only `.orb-source/repository.json`; environment files, certificates, AGENTS/HANDOFF, Git metadata, and worktrees were verified absent.
6. **Database:** Applied `scripts/migrations/20260612_developer_role.sql`; live role row is ID 4, value 3, name Developer. Pre/post health checks showed no new RLS or query-health regressions.
7. **ORB processing recovery:** Fixed the intermittent iPad state where an Orb card remained on `Processing…` while the toolbar reverted to Send. Stop now follows either submission state or any streaming message, terminal cleanup always settles the card, model turns time out after 60 seconds, production repository requests after 15 seconds, and exhausted tool loops return an explicit message.
8. **General UI ambiguity behavior:** Orb now asks one concise location-based clarification when a visible referent such as "the kebab", "that button", or "this menu" has multiple plausible matches. It does not search the repository to guess which control the user is pointing at.

### Closed Todos This Session

- **ORB-255** — Make filtering global, not page-local

### Uncommitted Changes

- `.gitignore` — ignores generated `.orb-source`
- `app/actions/get-audit-logs.ts` — server-side global audit filtering/sorting
- `app/actions/get-knowledge-entries.ts` — new server-side knowledge filtering/sorting
- `app/actions/orb-converse.ts` — role-aware repository tool exposure and execution
- `app/api/orb-eval/route.ts` — repository capability in eval context
- `app/api/repository/route.ts` — role-checked production repository endpoint
- `components/settings/SettingsAudit.tsx` — global server search/sort wiring
- `components/settings/SettingsCrudList.tsx` — debounced server search/sort pagination support
- `components/settings/SettingsKnowledge.tsx` — global server search/sort wiring
- `components/AmbientDashboard.tsx` — robust Stop and terminal stream cleanup
- `components/OrbConversation.tsx` — Stop visibility derived from submission or streaming-message state
- `components/UnifiedDashboard.tsx` — robust Stop and terminal stream cleanup
- `docs/api-spec.yaml` — canonical `query_repository` tool contract
- `docs/orb-252-repository-access-plan.md` — ORB-252 architecture/security plan
- `docs/orb-255-global-filtering-plan.md` — ORB-255 plan
- `docs/ui-catalog.md` — server-paginated search/sort contract
- `lib/auth.ts` — repository permission in auth context
- `lib/changelog.ts` — v0.5.209 through v0.5.212 releases
- `lib/orb-contract.ts` — regenerated Orb tool contract
- `lib/orb-prompt.ts` — repository routing and permission-aware capability reporting
- `lib/repository-access.ts` — repository role predicate
- `lib/repository-reader.ts` — local/production repository query service
- `lib/version.ts` — v0.5.212
- `package.json` — v0.5.212 and production bundle prebuild
- `scripts/eval-cases.ts` — Tier 1 repository routing case
- `scripts/generate-orb-contract.ts` — complete generated tool labels
- `scripts/generate-repository-bundle.mjs` — sanitized per-deployment source bundler
- `scripts/migrations/20260612_developer_role.sql` — Developer role migration

### Verification

- `npx tsc --noEmit` — passes
- `npm run lint` — passes; UI catalog verification passes; 66 existing warnings remain
- `npm run build` — passes
- Production NFT audit — 146 files, one `.orb-source/repository.json`, no sensitive/project-wide trace expansion
- Repository tests — local read succeeds; `.env.local` and Owner access denied; production bundle search succeeds; production local-source request denied
- Database health audit — no new RLS init-plan findings; cache-hit results remain 99.4–100%
- `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --tier 1` — Tier 1 8/8 passed

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

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar into single unified toolbar. SearchModal component. Modal footer standardization (btn-cancel/btn-primary/btn-danger). Empty states with OrbMini illustration. "Ask Orb" text consistency. Edge button toggle states for mobile.

**CSS Variable Uniformity Sweep (ORB-237) + More Kebab Fix (ORB-236) — 2026-06-10 (Session 75, Claude Code)**
- ORB-236: Fixed kebab button with textareaRef focus + preventDefault pattern. Beautified More menu.
- ORB-237: Replaced ~300 hardcoded text values with CSS variables. Three-tier responsive scaling. 40 files changed.

**Table Improvements completion (ORB-233) — 2026-06-08 (Session 72, Claude Code)**
- Single-column resize fix, table card shrink-wrap, stale localStorage fix, priorities simplification, tickets overflow menu, table headings, standardized action columns, removed Order columns, invitations kebab, Audit Log on SettingsCrudList, iPad touch stability. v0.5.177–v0.5.184.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
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

---

## Next Priorities

1. **Stan tests ORB-252 on localhost:** repository questions as Admin/Super Admin/Developer, Owner denial, and local versus production source selection.
2. **Run Tier 1 eval** once localhost:3001 is available; the new `repository-inspection-tool` case is the production-push gate.
3. **Close ORB-252** after Stan approval, add resolution notes, and create/link the Knowledge Repo entry.
4. **Commit ORB-255 + ORB-252 locally.** Do not push until Stan explicitly approves.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-12 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
