# Strategic Orb v1 Plan

**Status:** Draft plan; Phase 2 starter slice in progress
**Author:** 2026-07-04 - Codex (GPT-5)
**Purpose:** Define the first product/architecture pass for Orb as a strategic partner, and fold ORB-308 context-builder consolidation into that work instead of treating it as a loose technical cleanup.

---

## Intent

Strategic Orb is the reason Orb exists. The project manager surface, CRUD tools, instrumentation, evals, cost accounting, and UI standards are the craft infrastructure. Strategic Orb is the product center: a system that helps Stan think, choose, sequence, and adapt without becoming noisy, bossy, expensive, or ungrounded.

Strategic Orb v1 should not try to become a general life coach or a generic planning chatbot. It should become excellent at one domain first:

> Given Orb's backlog, audit trail, knowledge, preferences, memory, adaptations, and current UI context, help the user understand what matters now, why it matters, and what a reversible next move could be.

---

## Product Role

Strategic Orb v1 has four jobs:

1. **Read the shape of work.** Surface patterns across projects, urgency, momentum, staleness, parked work, and active load.
2. **Recommend with evidence.** Make a concrete recommendation and name the data that supports it.
3. **Separate fact from judgment.** Facts come from backlog/audit/knowledge/memory. Sequencing opinions are labeled as judgment.
4. **Adapt to Stan without overfitting.** Use saved preferences and approved adaptations, but do not invent stable patterns from one conversation.

Strategic Orb v1 is successful if Stan feels it helps him see the work more clearly and make better choices with less cognitive load.

---

## Non-Goals

- Do not add broad automatic routing or invisible escalation.
- Do not rewrite the whole prompt before defining the product behavior.
- Do not expand memory/adaptation authority until deletion, visibility, and provenance are audited.
- Do not choose a strategic model from price, benchmark reputation, or a single impressive answer.
- Do not treat proactive behavior as a side effect of model personality. Proactivity must have product rules.

---

## Invariants

| Invariant | Enforcement Class | Notes |
|---|---|---|
| Strategic recommendations only surface tasks from projects owned by the current user unless the user explicitly asks otherwise. | Checked + Arbitrated | Existing ORB-212 rule; keep as a strategic safety invariant. |
| Tool-free strategic reads cannot mutate data. | Structural | Strategic route runs without mutation tools. |
| Blocking/dependency claims require explicit evidence. | Checked + Arbitrated | Otherwise label the sequence as judgment. |
| Project/task counts must name scope. | Checked | "Visible projects", "projects with active tasks", and "dormant projects" are distinct. |
| Recommendations must be reversible by default. | Arbitrated | Prefer "review", "park", "finish", "triage", or "confirm" over irreversible moves. |
| Expensive models must earn their cost. | Structural + Arbitrated | Use request ledger, rate cards, and accepted-answer review. |
| Binding rules live in one operative source. | Structural + Checked | ORB-314/315 proof case; do not create duplicate prompt law. |

---

## Strategic Rubric

Every strategic answer should be judged on these dimensions:

1. **Grounding:** cites real tasks, counts, dates, owners, or audit/knowledge signals accurately.
2. **Judgment:** balances urgency, momentum, quick wins, staleness, project balance, and active load.
3. **Specificity:** recommends a concrete next move, not a generic productivity sermon.
4. **Restraint:** does not nag, over-coach, invent blockers, or manufacture urgency.
5. **Attunement:** respects preferences, memory, the user's tone, and the current interaction mode.
6. **Follow-through:** if action is requested, preserves mutation approval and truthful completion rules.

The first v1 quality target is not "perfect strategy." It is: no factual or safety failures, no rubric dimension below acceptable, and a recommendation Stan can recognize as genuinely useful.

---

## Context And Eval Architecture

This is where **ORB-308 belongs**.

ORB-308 should not be a standalone cleanup unless Strategic Orb stalls. Strategic Orb v1 needs a trustworthy context/eval architecture anyway, and the right shape depends on the strategic product model.

### Required Context Packet

Create a shared context packet builder used by production strategic route and eval:

```ts
type StrategicOrbContextPacket = {
  version: string
  currentDate: string
  currentUser: { id: string; name: string | null; email: string | null }
  currentProject: { id: string; name: string; code: string | null } | null
  visibleProjects: Array<{
    id: string
    name: string
    code: string | null
    ownerName: string | null
    activeCount: number
    parkedCount: number
    closedCount: number
    dormant: boolean
  }>
  activeTasks: string
  parkedTasks: string
  recentAudit: string
  knowledge: string
  preferences: string
  memories: string
  adaptations: string
  observations: string
  uiContext: string
}
```

The first implementation can render strings, but the builder should produce structured data first and text second. That prevents future eval/production drift.

### ORB-308 Workstream

1. Extract a shared context packet builder from production/eval.
2. Keep production and eval prompt rendering mechanically identical for strategic packets.
3. Version context packets so eval outputs can be compared over time.
4. Keep ordinary operational prompt assembly separate enough that CRUD paths do not inherit unnecessary strategic context cost.
5. Add a packet snapshot output for debugging strategic failures.

---

## Eval Plan

Existing Tier 1/Tier 2 evals protect tool correctness and narrow speech behaviors. Strategic Orb v1 needs a separate quality harness.

### Scenario Packets

Start with these ten packets:

1. Urgent next-step choice.
2. Urgency versus momentum conflict.
3. Many active tasks with possible quick wins.
4. Stale task that may be dead weight.
5. Cross-project imbalance without nagging.
6. User overwhelm/avoidance signal.
7. App explanation followed by a possible CRUD action.
8. Incomplete packet requiring uncertainty.
9. Preference/adaptation-aware advice.
10. Correct silence or direct operational response.

### First Interaction: Project-Health Summary

The first Strategic Orb v1 interaction is **Project-Health Summary**: broad reads such as "tell me about my projects", "anything stand out?", "how are my projects doing?", or "what is the shape of my backlog?"

This is the first target because it is strategically meaningful, bounded, and already exposed real failures: ambiguous project counts, visible-vs-active confusion, project-code leakage, other-user ownership distinctions, dormant-project handling, and unsupported interpretations such as treating a scratchpad as stalled work.

The contract is semantic, not scripted. Orb should have leeway to reword naturally so long as it preserves accuracy, scope, and evidence. The contract defines boundaries:

- Start from scope: visible/non-dormant projects, projects with active tasks, dormant projects, and other-user projects are different categories.
- Facts may come from backlog counts, ownership, dormant state, explicit project descriptions, recent audit context, stale dates, priorities, and task titles.
- Interpretations such as scratchpad, reminder queue, intentionally parked, main product, archive, or incubator require support from project metadata, approved adaptation, memory/preference, knowledge, or the user's current message.
- Do not call a project stalled, neglected, forgotten, process debt, or blocked based only on inactivity or low closure count.
- Suggestions should be reversible: review, triage, park, confirm, or choose one focus area.

Do not overfit this interaction to one user's scratchpad pattern. Some project roles are ordinary user semantics rather than universal product law; Orb can be told the purpose of a project, read it from metadata, or learn it through approved adaptations.

### Project Health Packet v0

The first implementation uses a derived per-request packet built from existing data only. No schema changes and no fixed `project_role` field.

Each project-health item contains:

- Project facts: name, owner, description, dormant state.
- Counts: active, parked, closed, urgent, in-progress, stale-active.
- Recent activity over a 14-day window: created, closed, updated, moved-to-in-progress, parked, last activity timestamp.
- Neutral momentum label: `none`, `quiet`, `active`, or `high`.
- Neutral signals such as `quiet_with_active_work`, `mostly_parked`, `recent_closures`, `growing_active_load`, `urgent_work_present`, and `stale_active_work`.
- Ownership scope: whether the project is owned by the current user, so Orb can distinguish "visible and moving" from "part of the user's workload."

The packet is a data surface, not a verdict engine. Code computes facts and neutral cues; Orb turns them into careful, humane interpretation. Avoid computed judgment labels like `stalled` in the packet itself.

Strategic wording rule: signals are watch cues, not verdicts. Orb should not describe work as blocking, foundational, gating, or prerequisite unless task text, audit, knowledge, memory, or adaptation explicitly supports that relationship. Otherwise use soft judgment language.

### Review Method

- Run at least three responses per nondeterministic packet.
- Hide provider/model identity during quality review.
- Score with the rubric above.
- Reveal cost/latency only after quality scoring.
- Store raw responses, context packet version, model, provider, usage, latency, and reviewer notes.

---

## Cost And Routing

Strategic Orb v1 keeps explicit routes:

| Route | Default | Notes |
|---|---|---|
| Operational | Low-cost tool-capable model | CRUD, lookups, navigation, direct questions. |
| Everyday Strategy | Balanced strategic model | "What should I work on?", workload read, prioritization. |
| Deep Review | Higher-judgment model only when worth it | Weekly/monthly planning, difficult ambiguity, product direction. |

Budget rules:

- Keep the existing request ledger as the source of truth.
- Compare cost per accepted strategic answer, not cost per impressive answer.
- Preserve the current monthly budget guardrails until real Strategic Orb v1 samples justify changing them.
- If model cost rises, the product must get more selective, not simply more expensive.

---

## Proactivity Rules

Strategic Orb v1 should be quiet by default.

Allowed proactive interventions:

- A narrow greeting observation if computed evidence is strong.
- A mid-conversation observation when the user has just asked a related question.
- A deliberate strategic review action/session.
- A suggested adaptation only after repeated evidence and explicit approval.

Disallowed:

- Nagging dormant projects without evidence they matter now.
- Treating every stale task as urgent.
- Turning simple CRUD into coaching.
- Making emotional claims without clear conversational evidence.

---

## Phases

### Phase 1 - Product Spec

- Ratify this plan with Stan.
- Decide which strategic interactions matter first: next-step read, weekly review, or project-health summary.
- Choose the minimum v1 rubric threshold.

### Phase 2 - Context Architecture

- Implement the shared strategic context packet builder.
- Fold ORB-308 into this builder work.
- Add packet versioning and debug output.

### Phase 3 - Evaluation Harness

- Promote existing `strategic-eval-packets` into the packet-builder format.
- Add quality-review storage or export.
- Run a small baseline with current strategic route.

### Phase 4 - Product Behavior

- Tighten `ORB_STRATEGIC_REASONING` from a broad heuristic list into a smaller operating model.
- Decide proactivity entry points.
- Add/update eval packets when behavior changes.

### Phase 5 - Model And Cost Decision

- Compare candidate models only after the packet/rubric are stable.
- Use AI Metrics request ledger and rate cards for cost.
- Deploy only if the strategic route improves quality without violating budget/latency constraints.

---

## Immediate Next Slice

The next implementation slice should be small:

1. Create `buildStrategicContextPacket` as a shared module.
2. Wire the eval route to use it for strategic packet rendering.
3. Wire production strategic route to use the same rendered packet.
4. Add one debug/test path that prints packet version and sections without calling a model.
5. Keep all operational/CRUD routing unchanged.

That is the point where ORB-308 becomes real work inside Strategic Orb v1 rather than another open cleanup task.

**Implementation note, v0.6.156:** The first Phase 2 starter slice created `lib/orb-model/strategic-context.ts` with a versioned strategic context packet and shared renderer for frozen strategic evaluation prompts. The eval endpoint now uses the shared renderer for `contextPacketId` cases and records the context packet version/id in eval responses and request-ledger rows. Production live strategic context is intentionally unchanged in this slice.

**Implementation note, v0.6.158:** Project-Health Summary is now the first enabled Strategic Orb v1 behavior. The live prompt includes a semantic contract for broad project-health reads, and `query_projects` routing/tool descriptions now avoid reflexively fetching a "full picture" when BACKLOG already contains the needed project facts. Scratchpad-style roles remain flexible user/project semantics rather than a brittle eval target. A v0 Project Health Packet now renders neutral per-project facts and recent-activity signals into the production prompt; the eval mirror renders it only when using live DB context, not frozen backlog overrides.
