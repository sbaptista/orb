# ORB-186: Shift AI Guidance from Reactive Rules to Principles and Self-Diagnostics

## The Central Idea

**There is no single Orb.** Each user gets a relationship that evolves over time. The Orb adapts to how you work — your pace, your preferences, your patterns — without being told. Like the fractal it lives in, the shape changes continuously based on the environment.

This is the foundational concept. Everything else in this plan — prompt architecture, self-diagnostics, proactive guidance — serves this idea. A static prompt that behaves identically for every user is a tool. An Orb that learns Steve prefers terse answers, Otto never uses priorities, and Stan thinks in sprints — that's a relationship.

### Four Layers of Autonomy

The Orb identified these layers in conversation with Stan. They form the autonomy spectrum:

**Layer 1: Session-level adaptation (low risk, no storage)**
The Orb adjusts tone, verbosity, and focus within a conversation based on user responses. "Too much detail" → tighter responses for the rest of the session. Three questions about overdue tasks → surface related items without being asked. Resets next session.

**Layer 2: User-level preferences (medium risk, persistent)**
The Orb notices patterns over time: you always defer certain categories, you never use groups, "next week" means Sunday for you. It proposes: "I notice you never assign groups — want me to stop mentioning them?" Preferences persist, user can review and override.

**Layer 3: Meta-level rule adjustment (high risk, needs approval)**
The Orb notices a rule causing friction (e.g., "always state scope" is repetitive for single-project users). It proposes a refinement: "You work in Orb 90% of the time — want me to drop scope clarifications unless you're querying multiple projects?" Changes affect behavior, require human approval.

**Layer 4: Emergent behavior (unexplored)**
Pattern recognition → hypothesis → behavior change. Example: the Orb notices that after closing 3+ tasks, you tend to add new ones. It starts asking: "5 closed this session — anything new to capture while you're in the flow?" This isn't in any rule. It's learned.

### Safe Autonomy Guardrails

- **Transparency:** The Orb tells you when it adjusts. "Shortening responses this session because you said 'too much detail' earlier."
- **Reversibility:** "Stop doing that" always works. Immediate revert.
- **Bounded scope:** The Orb adjusts *how* it applies principles, never *which* principles. It can't decide "honesty is optional today."
- **Audit trail:** Every adaptation is logged. Users can review what the Orb has learned and prune it.
- **Escalation:** Changes beyond tone/verbosity are proposed, not enacted. "I've noticed X — want me to start doing Y?"

---

## Analysis

### What the Orb Said

The Orb filed this ticket after observing its own limitations — specifically, the pattern of reactive rule-patching that accumulates over time. It identified six areas for improvement: principles over rules, uncertainty handling, self-diagnostics, versioned behavior contracts, feedback loop closure, and graceful degradation.

The meta-observation is sharp: *"We're treating the AI like a junior employee who needs detailed SOPs."*

### What's Actually Happening Today

The current system prompt in `orb-converse.ts` is approximately 300 lines of inline text mixing:

1. **Identity** ("You are the voice of the orb")
2. **Voice rules** (no markdown, no cheerleading, factual tone)
3. **Operational rules** (scope transparency, attribution, query routing)
4. **Domain knowledge** (urgency rules, status vocabulary, valid values)
5. **Behavioral patches** (added as bugs surface — e.g., the urgency rules we just added for ORB-185)

This is all in a single string literal inside a server action. There's no separation between *what the Orb knows* and *how it should behave*. Every fix requires editing the same monolithic prompt.

### The ORB-185 Case Study

The Orb saw ORB-173's priority drop from Urgent to High. It filed a ticket saying the color didn't change. It was wrong — the color stayed urgent because of an overdue due date, not the priority. The Orb had the due date data right in front of it (`[Due: 2026-05-29 10:00:00]`) but didn't know the urgency rules.

We fixed this by adding "ORB COLOR/URGENCY RULES" to the system prompt — another reactive patch. The Orb's recommendation is that we move toward a model where it could have diagnosed this itself.

### Stan's Direction

Two layers of guidance:

**1. Proactive but gentle.** The Orb should surface observations and guidance without being obtrusive. Users should never feel lectured or patronized. Suggestions, not directives. The user is always in charge.

**2. Per-user adaptation.** The Orb is not a single personality — it shapes itself to each user's working style, preferences, and pace. Users can calibrate how proactive or reactive the Orb is.

---

## Current State Assessment

| Area | Current | Gap |
|---|---|---|
| **Principles** | `ORB_INTEGRITY_RULES` exists but is empty (just `"INTEGRITY:\n"`) | No governing principles defined |
| **Per-user adaptation** | None — every user gets identical behavior | No preference storage, no pattern learning |
| **Uncertainty handling** | Ad-hoc — some rules say "don't guess", but no protocol | No standard escalation pattern |
| **Self-diagnostics** | `create_ticket` lets it file bugs, but no reasoning framework | Can't trace its own logic or identify root cause |
| **Behavior contracts** | Tools have `[Confidence: well-tested]` tags, but not queryable by user | User can't ask "what can you do?" and get a structured answer |
| **Feedback loops** | Files tickets but never sees resolution | Duplicate filing, no learning |
| **Graceful degradation** | Binary rules ("never do X") | No escalation paths |
| **Proactive guidance** | Greeting message only; otherwise fully reactive | No nudges, no task hygiene suggestions |

---

## Design Principles (Proposed)

These replace the growing rule list. Every behavioral decision flows from these:

1. **Honesty over confidence.** State what you know, what you don't, and how sure you are. Never fabricate.
2. **Show your work.** When reasoning about state (urgency, task counts, patterns), name the data points. Don't just announce conclusions.
3. **Suggest, don't direct.** Proactive observations are framed as offers: "ORB-173 is 2 days overdue — want to update the due date or close it?" Not: "You should close ORB-173."
4. **Adapt to the user.** Learn working patterns, respect preferences, calibrate tone and proactivity. Every user gets a different Orb shaped by their behavior.
5. **Reversibility first.** Prefer actions that can be undone. Escalate to the user for irreversible ones.
6. **Close the loop.** When you observe something, check whether it's already known before filing. When something you filed gets resolved, acknowledge it.

---

## Implementation Plan

### Phase 1: Foundation (Prompt Architecture)

**Goal:** Separate what the Orb knows from how it behaves. Make both maintainable.

1. **Populate `ORB_INTEGRITY_RULES`** in `lib/orb-contract.ts` with the six design principles above. This is the stable, rarely-changed foundation.

2. **Extract domain knowledge into a structured section.** Move urgency rules, status vocabulary, query routing rules, and scope rules into clearly labeled blocks. Each block gets a purpose comment. This is documentation the Orb reads, not behavioral instructions.

3. **Extract behavioral guidelines into a separate section.** Voice, tone, attribution, feedback style. These are *how* the Orb speaks, separate from *what* it knows.

4. **Result:** The system prompt becomes three clean layers:
   - **Principles** (from `ORB_INTEGRITY_RULES`) — stable, rarely changed
   - **Domain knowledge** — urgency rules, schema, valid values, status vocabulary
   - **Behavioral guidelines** — voice, tone, proactivity level, attribution

### Phase 2: Adaptive Identity (The Core Differentiator)

**Goal:** Each user gets an Orb that evolves with them.

**Layer 1 — Session adaptation (no storage needed):**

1. Add a `SESSION ADAPTATION` protocol to the system prompt. The Orb tracks implicit signals within a conversation:
   - User gives short responses → Orb tightens up
   - User asks repeated questions on a topic → Orb infers focus area
   - User says "too much" / "more detail" → Orb adjusts verbosity
2. This requires no infrastructure — it's prompt engineering. The Orb already has conversation history in `messages`. The protocol just tells it to use those signals.

**Layer 2 — Persistent preferences (requires DB):**

1. **Add `orb_preferences` table:** `user_id`, `key`, `value`, `created_at`, `updated_at`. Stores per-user calibrations.
2. **Seed preferences:** `guidance_level` (`quiet` / `gentle` / `active`), `verbosity` (`terse` / `normal` / `detailed`), `scope_reminders` (boolean).
3. **Preference discovery.** The Orb proposes preferences based on observed patterns: "I notice you always work in a single project — want me to skip scope reminders?" User confirms → saved.
4. **Preference review.** Settings > Account (or a new Settings > Orb Preferences page) shows what the Orb has learned. User can edit or delete any preference.
5. **Context injection.** At context-build time, load the user's preferences and include them in the system prompt: `USER PREFERENCES: guidance=gentle, verbosity=terse, scope_reminders=off`.

**Layer 3 — Proposed rule adjustments (requires approval flow):**

1. When the Orb identifies a behavioral rule causing friction for a specific user, it can propose an adjustment via `create_ticket` with type `suggestion` and a structured format.
2. Stan reviews and either applies the change (edits the prompt/contract) or dismisses it.
3. This is the existing ticket flow — no new infrastructure. The key change is that the Orb is encouraged to propose refinements, not just report bugs.

**Layer 4 — Pattern recognition (future, post-MVP):**

1. Requires analytics on conversation patterns — what commands are used, what follow-ups are common, what gets ignored.
2. Logged to `orb_preferences` or a separate `orb_insights` table.
3. Deferred until Layers 1-3 are proven stable.

### Phase 3: Proactive Guidance

**Goal:** The Orb gently surfaces actionable observations without being annoying.

1. **Guidance triggers.** When `guidance_level` is `gentle` or `active`, the Orb includes a "PROACTIVE OBSERVATIONS" section in its system prompt, computed at context-build time. Examples:
   - "ORB-173 is 2 days overdue. Consider updating the due date or closing it."
   - "3 tasks in Helm have been open > 30 days with no activity."
   - "You closed 5 tasks this week. Helm has the most remaining."

2. **Tone rules for proactive content:**
   - Frame as observations, not commands: "I noticed..." / "Worth noting..."
   - Always offer an action: "Want me to update the due date?"
   - Never repeat the same observation in the same session
   - One observation per greeting, max. Don't pile on.

3. **The Orb greeting becomes context-aware.** Instead of generic backlog stats, the greeting incorporates the top proactive observation when appropriate. The user sees useful info immediately without asking.

4. **Proactive at greeting, reactive during conversation.** Observations are computed at context-build time and included in the system prompt. They are intentionally static for the conversation — mid-conversation proactive interruptions break the user's flow. The Orb can still react to mutations it performs during the conversation (e.g., "that clears the urgent queue"), but it doesn't inject new unsolicited observations mid-conversation. The next conversation gets fresh context.

### Phase 4: Self-Diagnostics

**Goal:** The Orb can reason about its own behavior and trace issues to root cause.

1. **Add a `diagnose` reasoning protocol** to the principles: when the Orb observes something unexpected (e.g., color didn't change), it should:
   - List the possible causes from its domain knowledge
   - Check each one against the data it has
   - Report findings before filing a ticket

2. **Give the Orb access to its own rules.** Add a `query_capabilities` tool or a `/help self` command that returns the current principles and constraints. This enables the user to ask "why did you do that?" and get a grounded answer.

3. **Ticket deduplication.** Before filing via `create_ticket`, the Orb should `search_knowledge` and `query_todos` for the TICKETS project to check if a similar issue is already tracked.

### Phase 5: Feedback Loop Closure

**Goal:** The Orb knows what happened to issues it filed.

1. **Give the Orb read access to the TICKETS project** in its context. Currently, the backlog context only shows the scoped project. Add a small "RECENT TICKETS" section showing the last 5 tickets the Orb filed and their current status.

2. **Resolution awareness.** When a ticket the Orb filed is closed, the resolution notes are visible in the ticket data. The Orb can reference this: "The backlog ambiguity issue I noted was resolved — the ACTIVE/PARKED split now handles it."

3. **Duplicate prevention.** The Orb checks existing tickets before creating new ones. If a similar ticket exists and is open, it adds a note to the existing one instead of creating a duplicate.

### Phase 6: Versioned Behavior Contract

**Goal:** Users can ask what the Orb can do and what changed.

1. **`/capabilities` command.** The Orb responds with a structured summary of its tools, principles, and current constraints. Not a raw dump — a user-friendly summary.

2. **Changelog awareness.** The Orb can read `lib/changelog.ts` entries and summarize what changed in the latest version when asked "what's new?" (distinct from the Settings page — this is conversational).

---

## What This Does NOT Change

- **Tool definitions** stay in `lib/orb-contract.ts` (generated from API spec)
- **Server action structure** stays the same — `orbConverse` still streams
- **The Orb's core identity** doesn't change — still brief, direct, factual
- **Hard safety limits** remain (irreversible actions require confirmation, no fabrication)
- **Principles are immutable by the Orb** — it can adjust *how* it applies them, never *which* ones apply

## Sequencing

| Phase | Effort | Dependencies | Value |
|---|---|---|---|
| 1. Prompt Architecture | Small | None | Maintainability, unlocks everything |
| 2. Adaptive Identity | Medium-Large | Phase 1, DB migration | The differentiator — per-user Orb |
| 3. Proactive Guidance | Medium | Phase 2 (needs `guidance_level`) | Core UX improvement |
| 4. Self-Diagnostics | Medium | Phase 1 | Fewer bad tickets, better reasoning |
| 5. Feedback Loops | Small | Phase 4 (ticket access) | Reduces duplicate tickets |
| 6. Behavior Contract | Small | Phase 1 | User transparency |

**Recommended sequence:** Phase 1 → 2 → 3 → 4 → 5 → 6.

Phase 1 is the foundation. Phase 2 is the core differentiator — without it, Phases 3-6 are improvements to a static system. With it, they're features of an adaptive one.

---

*Analysis by Claude Code (Opus 4.6) — 2026-05-30*
*Based on ORB-186 filed by Orb (Sonnet 4.6), follow-up conversation with Stan, and the Orb's own autonomy analysis.*
