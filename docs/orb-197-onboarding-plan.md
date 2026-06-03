# ORB-197 — Onboarding for Testers

> **Status:** Examination + plan (no implementation yet — pending Stan's go-ahead on the proposed improvements)
> **Relates to:** ORB-173 (Pre-Alpha Checklist) gates 4 (First impression is competent) and 5 (Operator can manage it)
> **Author:** 2026-06-03 — Perplexity Computer (Claude Sonnet 4.6)
> **Revision:** 2026-06-03 — revised after review by Claude Code; I-3 downgraded, I-5 bumped, I-6 added (seeding-failure UX), ORB-204 reclassified as a closure blocker.

---

## 1. Examination — what onboarding does today

A new tester goes through a coherent, multi-stage flow that is already working. Tracing it end-to-end from the code:

### 1.1 Invitation → account creation
- Admin invites from **Settings → Users**; an invite email goes out via Resend (`lib/email.ts`, template documented in `docs/pre-alpha-invite-email.md`).
- The tester clicks the link → server-side OTP verification (`app/auth/callback/route.ts`) → lands on **`/auth/create-account`**.
- The create-account page collects **first name + last name** and calls **`completeOnboarding()`** (`app/actions/complete-onboarding.ts`), then routes to `/dashboard`.

### 1.2 `completeOnboarding()` — what happens on first login
1. Re-authenticates and runs `resolveUser()` (handles the unstable-auth-UUID / orphaned-row case — see knowledge entry "Onboarding Re-Architecture").
2. Upserts the `users` row with `onboarded_at`.
3. Fires a **welcome email** (`sendWelcomeEmail`, fire-and-forget — never blocks).
4. Accepts the invitation.
5. **Seeds three demo projects with tasks** via `seedOnboardingProjects()` (`lib/onboarding-seeding.ts`). Failures auto-file a ticket.

### 1.3 The seeded environment (the "exercises")
`seedOnboardingProjects()` is idempotent (checks existing project codes + todo titles before inserting) and creates **three projects**, each chosen to demonstrate a different facet of Orb:

| Project | Code | View | Purpose |
|---|---|---|---|
| Welcome & Guide | `WELCOME` | checklist | The guided exercise list — start here |
| Home Maintenance | `HOME` | list | Demonstrates a **calm** ambient state |
| Urban Compost Initiative | `ECO` | kanban | Demonstrates **urgent** states, bottlenecks, and drag-and-drop |

The **WELCOME** project is the structured walkthrough — six exercise todos, each with a descriptive `description`:
1. Observe the Orb's ambient mood state (pulse & color)
2. Ask the Orb: "What should I do next?"
3. Test Kanban drag-and-drop (on the ECO project)
4. Mark a task done and watch the Orb's mood shift
5. Send a feedback message / report a bug (conversational)
6. Read the Pre-Alpha Testing guide in the Help tab

**HOME** seeds 3 low/medium-priority tasks (calm). **ECO** seeds 6 tasks spanning urgent/overdue → low, including an overdue P1 and an in-progress item due today — deliberately engineered so the Orb renders an **urgent** state and the Kanban board has something meaningful to drag.

### 1.4 First conversational interaction
- On the dashboard, `AmbientDashboard.tsx` detects a new user (`!onboarded_at` and no `todos_welcome_shown_<userId>` local-storage key) and **pre-fills the input** with: *"Hi {firstName}! I'm Orb. Thanks for joining the pre-alpha. Press Return or tap send → to get started."*
- The first submit is intercepted by `handleWelcomeSubmit()` — a **hardcoded reply (no Claude call, free)** that gives quick-start commands, the **privacy disclosure** (tasks/conversations visible to Stan; don't store anything confidential; access not guaranteed), and how to report bugs conversationally. It then marks `onboarded_at` and sets the per-user welcome key so it never repeats.

### 1.5 The Help tab (`components/OrbHelp.tsx`)
Five topics: *What can I do?*, *Keyboard shortcuts*, *The Orb* (states/counting/signals), **Pre-Alpha Testing** (goals, things to try, how to report bugs, privacy & observability), and *About*.

### 1.6 Feedback + observability (gate 5 mechanisms already in place)
- **Bug/suggestion reporting:** fully conversational — the tester says "Report a bug: …" or "Suggestion: …" and Orb's `create_ticket` tool silently files it into the `tickets` table. Admins get push + email notification. Status changes propagate back to the reporter (ORB-148).
- **Usage observability:** task names and conversation logs are visible to Stan (disclosed twice — Help tab + first-interaction reply). Structured audit logging exists (`logAuditEvent`).

**Bottom line on the examination:** the flow is solid — invitation, identity reconciliation, a thoughtfully designed three-project demo that exercises calm/urgent ambient states and all three view modes, a free scripted first interaction with privacy disclosure, conversational feedback, and a Help guide. It is **not** "not bad" by accident; it is purpose-built around the two value propositions Orb is testing (ambient workload reflection + strategic AI assistance).

---

## 2. Proposed plan (answering ORB-197's three explicit asks)

### Ask 1 — "What would we like testers to look at?"
Already encoded in the WELCOME exercises and the Help → Pre-Alpha Testing tab. The two validation targets are correct and should stay the north star:
- **Ambient workload reflection** — does the glowing Orb keep them aware without micromanaging lists?
- **Strategic AI assistance** — is talking to the Orb for planning better than checkboxes?

Recommendation: keep the three-project structure; treat the WELCOME checklist as the canonical "what to look at" surface and keep the Help tab in sync with it.

### Ask 2 — "How can they communicate bugs, issues, and feature requests?"
Already solved and arguably best-in-class for a pre-alpha: **conversational ticketing** (no forms). Plan: make this even harder to miss (see improvements I-2, I-3) and close the loop so testers can *see* status (ORB-204, currently open).

### Ask 3 — "How can we observe how they use the product (without being creepy)?"
Current approach = transparent disclosure + audit log + conversation visibility. This is the right ethical posture. Plan: keep disclosure prominent and add **lightweight, opt-in-by-disclosure milestone signals** (see I-4) rather than any hidden analytics. No third-party trackers, no silent telemetry — consistent with the privacy model being designed in ORB-192.

### Sequencing
1. Fix the documentation drift (I-1) — cheap, prevents tester confusion. **Doable now.**
2. Tighten the first-run prompts (I-2, I-3) — small, high-leverage UX. **Needs Stan's go-ahead.**
3. Milestone signals + feedback-loop visibility (I-4) — overlaps with ORB-204; coordinate. **Larger; defer/coordinate.**

---

## 3. Spotted improvements (opportunities, not blockers)

**I-1 — Documentation drift: "Orb Feedback project" is stale (recommend fixing).**
`docs/pre-alpha-invite-email.md` and `docs/pre-alpha-feedback-email.md` still tell testers to *"Add task to Orb Feedback: …"*. That ORBFDBK/shared-project mechanism was **removed and replaced by the tickets system** (ORB-114, ORB-148). If the live invite email still says this, new testers get instructions that don't match the app. **Action:** verify the live Resend template wording and update both docs to the conversational "just tell Orb 'report a bug' / 'suggestion'" phrasing. Low risk, high clarity gain.

**I-2 — WELCOME exercise #5 references a slightly different phrasing than the app teaches.**
The seed todo says say *"Report a bug: …"* / *"Suggestion: …"*, while the first-interaction reply also offers natural phrasings like *"something's broken"* / *"I have a suggestion."* Both work; consider unifying the examples across seed todos, Help tab, and the scripted reply so testers see one consistent vocabulary.

**I-3 — Fix the literal `**markdown**` asterisks in the Help tab (minor).**
The Pre-Alpha Testing privacy paragraph in `OrbHelp.tsx` (~line 243) contains literal `**…**` that renders as visible asterisks rather than bold in that JSX context. **Action:** correct the asterisks directly in `OrbHelp.tsx` — a one-line fix. (Earlier draft proposed extracting a shared privacy-string constant; that's over-engineering for two strings that rarely change. Skip the abstraction.)

**I-4 — Close the observability/feedback loop visibly (ORB-204 — closure BLOCKER, not just coordination).**
Today observation is one-directional: Stan sees usage, but testers can't see whether their report was acted on. This is **the single biggest risk to tester retention in a pre-alpha** — when feedback disappears into a void, testers stop giving it (and often stop testing). ORB-204 ("let users see ticket status and get notified when their suggestions ship") is therefore not a nice coordination item but a **blocker for ORB-197 closure**: ORB-197 should not close until testers have visible feedback-loop closure. This also completes ORB-173 gate 5.

**I-5 — "Reset onboarding" affordance for re-testing (recommended — bumped up).**
Seeding is idempotent (good), but there's no easy way to re-run the welcome flow for QA. A dev-panel "replay onboarding" button (clears `todos_welcome_shown_<id>` + `onboarded_at`) lets you iterate on the onboarding flow without manual DB surgery. **Why this matters now:** the next priority is external tester validation — you'll want to iterate on the welcome flow itself before/while testers use it. Without a reset, every change to onboarding requires hand-editing the DB to re-test. Recommend building this alongside any onboarding-flow changes.

**I-6 — Seeding-failure UX gap (new — flagged by review).**
If `seedOnboardingProjects()` fails, it auto-files a ticket (good for the operator) but the *tester* lands on an **empty dashboard with no context** — no projects, no exercises, no explanation. For a brand-new tester this reads as "the app is broken." **Action:** add a minimal fallback — e.g. detect zero projects immediately post-onboarding and show a static "Your workspace is still setting up — give it a moment, or say 'set up my workspace' to retry" message, ideally wired to re-invoke seeding. Low effort, prevents a terrible first impression.

---

## 4. Recommendation on closing ORB-197 and ORB-173

- **ORB-197:** The *examination* (ask 1) and *reporting mechanism* (ask 2) are done; the *observation approach* (ask 3) is sound and disclosed. Remaining work before close: (a) the doc-drift fix (I-1), and (b) **ORB-204 — visible feedback-loop closure, treated as a blocker** (see I-4). I-6 (seeding-failure fallback) should also land before external testers arrive. Once I-1 + ORB-204 land, ORB-197 can close with this document as its resolution artifact.
- **ORB-173:** Gates 1–3 done; gate 4 satisfied by this onboarding flow; gate 5 is one step (ORB-204) from complete. Keep open until ORB-204 resolves, then close.

---

## References
- `lib/onboarding-seeding.ts` — three-project demo seeding
- `app/actions/complete-onboarding.ts` — first-login orchestration
- `components/AmbientDashboard.tsx` — new-user detection + scripted first reply
- `components/OrbHelp.tsx` — Help guide incl. Pre-Alpha Testing tab
- `app/actions/ticket-actions.ts`, `tickets` table — conversational feedback (ORB-148)
- Knowledge Repo: "Pre-Alpha Onboarding Lifecycle & OTP Token Hashing", "Onboarding Re-Architecture: resolveUser()", "ORB-195: Nuts and Bolts value demonstration", "Access Hardening, Email Syncing, and Admin Ticket Notifications"
- Related todos: ORB-204 (feedback-loop visibility, open), ORB-192 (privacy model, open), ORB-114 / ORB-148 (ticketing replaced ORBFDBK)
- Docs to update: `docs/pre-alpha-invite-email.md`, `docs/pre-alpha-feedback-email.md` (I-1)
