# Object Capability Matrix

This is the standing audit of every domain object's mutation and access surface — built so capability gaps (a missing tool, a missing test, a missing UI affordance) are discovered systematically, not one object at a time when something breaks. See AGENTS.md → "Object Capability Matrix — Maintenance Rule" for when this file must be updated.

**Origin:** Built 2026-06-30 after discovering Tickets had create-only Orb access (no read/update/delete tool) — a gap that had gone unnoticed because CRUD coverage was being verified piecemeal, object by object, instead of audited as a whole.

**Two axes, not one:**
- **Objects** — the 11 domain entities below. Each has a stable identity across surfaces (DB table → Orb tool → REST → Settings UI → Help → Print → Tests).
- **Flows** — composite interactions that cut across objects (login, dashboard load, voice start). These don't map to a single object, so they get their own matrix with a different column set (see Part 2).

---

## Part 1 — Object Capability Matrix

Legend: ✅ covered · 🟡 covered but unverified/low-confidence · ⚠️ fallback only, not first-class · ❌ gap · — not applicable · `?` unconfirmed with Stan

| Object | DB Table | Orb Tool (C/R/U/D) | `query_db` fallback | REST API (C/R/U/D) | Settings UI (C/R/U/D) | Print | Help | Test Coverage |
|---|---|---|---|---|---|---|---|---|
| **todos** | ✅ `todos` | ✅✅✅✅ `create_todo`/`query_todos`/`update_todo`/`delete_todo` + `move_todo`, all well-tested | ✅ | ✅✅✅✅ `/api/tasks` (soft delete) | Primary CRUD lives in the main dashboard (`TodoView`), not Settings — `SettingsProjectTodos` is a project-scoped view, not the canonical editor | ✅ "Print Backlog" (global nav) | ✅ `ask` topic covers C/R/U/D examples | ✅ Tier 1 + Tier 2 eval cases (tool correctness + speech behavior) |
| **projects** | ✅ `projects` | ✅create / ✅read (`query_projects`, name-first, v0.6.140 — ORB-301) / 🟡update / 🟡delete (held via propose/confirm) | ✅ | ❌ none | ✅✅✅✅ `SettingsProjects` — confirmed `onEdit`+`onDelete`, create via command-bar button | — | 🟡 generic only (`[project]` placeholder examples in `ask` topic, no dedicated topic) | 🟡 Tier 1: `query-projects-tool`, `query-projects-dormant`, `delete-project-calls-tool`; update path still unasserted |
| **knowledge_repo** | ✅ `knowledge_repo` | ✅create(`add_knowledge`) / ✅read(`search_knowledge`) / ❌**no update** / ❌**no delete** | ✅ | ❌ none | ✅✅✅✅ `SettingsKnowledge` — confirmed `onEdit`+`onDelete` (Settings UI exceeds Orb tool coverage) | — | ❌ none | ❌ none found |
| **tickets** | ✅ `tickets` | ✅create(`create_ticket`) only / ❌**no read** / ❌**no update** / ❌**no delete** | ❌ not in `ALLOWED_TABLES` | ❌ none | ✅✅✅✅ `SettingsTickets` (admin-managed) — confirmed `onEdit`+`onDelete` | — | ❌ none | ❌ none found |
| **audit_log** | ✅ `audit_log` | ✅read(`query_audit_trail`) only — correct, append-only by design | ✅ | ❌ none | ✅ read-only by design (`SettingsAudit`, "Open" to view, no mutation actions) | — | ❌ none | ❌ none found |
| **categories** | ✅ `categories` | ❌ no Orb tool at all | ✅ | ❌ none | ✅✅✅✅ `SettingsCategories` — `onEdit`+`onDelete`+`canDelete` (guards in-use categories) | — | ❌ none | ❌ none found |
| **groups** | ✅ `groups` | ❌ no Orb tool at all | ✅ | ❌ none | ✅✅✅✅ `SettingsGroups` — `handleAdd`+`editingId`+`confirmDeleteId` confirmed | — | ❌ none | ❌ none found |
| **statuses** | ✅ `statuses` | ❌ no Orb tool | ✅ (read fallback only) | ❌ none | ❌ **no Settings page at all** | — | ❌ none | ❌ none found |
| **priorities** | ✅ `priorities` | ❌ no Orb tool | ✅ (read fallback only) | ❌ none | ❌ **no Settings page at all** | — | ❌ none | ❌ none found |
| **invitations** | ✅ `invitations` | ❌ deliberately excluded (sensitive, per `DB_SCHEMA` comment) | ❌ excluded | ❌ none | ✅ `SettingsInvitations` — `onDelete`+`onResend`+`onCopyDecline` (revoke/resend model, not plain update) | — | ❌ none | ❌ none found |
| **users** | ✅ `users` | ❌ deliberately excluded (sensitive) | ❌ excluded | ❌ none | ✅ `SettingsUsers`/`SettingsUserDetail` — `onEdit`+`onDelete`+`canDelete`; create is via signup/invitation, not direct | — | ❌ none | ❌ none found |
| **performance_events** | ✅ `performance_events` | ❌ no Orb tool; telemetry system-owned | ❌ not in `ALLOWED_TABLES` | 🟡 create-only `/api/performance-events` ingestion endpoint, not external-agent CRUD | ✅✅✅✅ `SettingsPerformance` — full admin CRUD/search/filter/sort/detail for telemetry rows | — | ❌ none | ❌ none found |

### Deliberate exclusions (not gaps)
`users` and `invitations` are intentionally kept out of Orb tools and `query_db` — `lib/db-schema.ts`'s own `DB_SCHEMA` comment marks them `EXCLUDED (sensitive)`. Confirmed by design, not by omission.

### Confirmed deliberate (not a gap)
`statuses` and `priorities` have **zero** surface anywhere (no Orb tool, no Settings page) outside the read-only `query_db` fallback. **Confirmed by Stan 2026-06-30: deliberately meant to stay fixed/unmanaged.** Not a gap — do not propose tools or a Settings page for these without a new explicit request.

### Tracked gaps (filed as ORB todos, 2026-06-30)
- ~~**ORB-301** — Add a read tool for projects (`query_projects`)~~ **Closed v0.6.143 (2026-07-03)** — Tier 1 36/36 green, live-verified on Mac + iPhone
- **ORB-302** — Add update/delete tools for `knowledge_repo` entries
- **ORB-303** — Add read/update/delete tools for tickets (sharpest gap — create-only today)

### Cross-cutting finding: test coverage
The **only** test mechanism in this repo is the Orb eval suite (`scripts/eval-cases.ts`), and it exclusively covers **Orb-conversation tool-calling and speech behavior** (Tier 1 / Tier 2). There is **no traditional unit, integration, or E2E test suite** anywhere in the codebase — Settings UI CRUD, REST API, print, and every non-conversational surface in the table above ships with zero automated test coverage. This is a standing gap across nearly every row, not a per-object issue.

---

## Part 2 — Flow / Performance Matrix

Speed is a flow property, not an object property — login isn't one of the 11 domain objects, but it's exactly the kind of critical path this matrix exists to stop losing track of. Per [[project_systematic_quality_audits]]: when one flow is found slow, audit the class, don't patch the instance.

| Flow | Instrumented? | Measured baseline | Budget/target | Known issues |
|---|---|---|---|---|
| **Login/auth → app visible** | 🟡 initial `auth` focus instrumentation added for login mount, passkey, OTP request, OTP verify | Baseline pending | TBD | Stan-reported: "sometimes much longer than it should be" — see **ORB-304/ORB-309** |
| **Initial dashboard load** (products + todos fetch) | 🟡 initial `dashboard-init` instrumentation added for client profile/projects/priorities/statuses/todo loads | Baseline pending | TBD | — |
| **Project switch** | 🟡 dashboard click instrumentation added for project selection through resulting list-settled timing | Baseline pending | TBD | — |
| **Settings page loads and CRUD** | 🟡 central Settings CRUD instrumentation added for initial/search/filter/sort/pagination loads plus modal/add/save/delete/move/bulk actions; Settings navigation and AI Metrics full page load instrumented | Early dev samples visible for Performance Settings and AI Metrics; production baseline pending. ORB-311 dev testing showed AI Request Log exact-count paging improved after cursor pagination, then App AI Cost Accounting became the larger signal. | TBD after p50/p75/p95 by platform | AI Metrics is the current focused optimization target. Reusable fetch patterns from ORB-311: cursor pagination for growing detail logs, database-side rollups for large-table summary cards/breakdowns, and honest component-lifecycle full-page timing when nav timestamps are noisy. |
| **Voice-mode start** (greeting latency) | ❌ | Unmeasured | TBD | Per HANDOFF.md "Next Priorities" — latency breakdown by stage already flagged as needed |
| **Todo CRUD round-trip** (confirm → execute → UI update) | 🟡 dashboard click instrumentation added for create, panel save/delete, toggle done, status move, bulk close/delete, sort/filter/view/list controls, and project create/update/delete | Baseline pending | TBD | — |

**Tracked:** **ORB-304** — Systematic time-to-interactive instrumentation across critical flows. **ORB-309** — Improve Initialization Speed, the concrete follow-up to measure all user-clickable initialization/interaction paths in both dev and production. Login is the first known case, not the whole scope.

---

## Maintenance

See AGENTS.md → "Object Capability Matrix — Maintenance Rule" and "Performance Instrumentation — Build Rule." Short version: touching any object's mutation surface (new table, new Orb tool, new REST endpoint, new Settings page, new eval case) or any critical flow updates this file in the same change, and new user-facing functionality must explicitly decide whether performance instrumentation is required.
