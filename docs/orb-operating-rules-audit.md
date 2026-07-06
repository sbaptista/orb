# Orb Operating Rules Audit

**Status:** Draft audit
**Author:** 2026-07-04 - Codex (GPT-5)
**Purpose:** Apply the Orb Craft and Art Doctrine to Orb AI itself by mapping the rules that govern Orb's conversational and strategic behavior, identifying enforcement class, drift risk, and the first restructuring actions.

---

## Why This Exists

Orb's AI behavior is the reason this app exists. The rules that govern it have grown through real incidents: false mutation success, fabricated identifiers, prompt/eval drift, project-code leakage, RLS visibility gaps, strategic overclaiming, voice-state failures, and cost/routing decisions.

That history is valuable, but the current rule system is not yet tidy. Rules live in prompts, dynamic prompt strings, generated tool contracts, server guards, eval cases, user preferences, memories, adaptations, Knowledge Repo behavior entries, and docs. Some are enforced structurally. Some are checked by evals. Some are only instructions and Stan's judgment.

The doctrine says every invariant needs an enforcement class:

- **Structural:** code makes violation impossible or difficult.
- **Checked:** lint, eval, script, typecheck, telemetry, or test catches violations.
- **Arbitrated:** Stan's judgment is the governing check.

This audit applies that standard to Orb's own operating rules.

---

## Current Rule Sources

| Source | Role | Drift Risk |
|---|---|---|
| `lib/orb-prompt.ts` | Main live prompt-rule library: principles, routing, scope, strategic reasoning, voice, mutation verification, memory, preferences, adaptations, dev channel. | Medium. Many rules are live and shared, but the file is large and mixes stable law, domain rules, style, tools, and prompt builders. |
| `app/actions/orb-converse.ts` | Production assembly of prompt context, server-side mutation gates, provenance gate, tool execution, budget/routing, streaming behavior. | Medium-high. Contains dynamic rule text duplicated in eval route, especially SCOPE and prompt assembly. |
| `app/api/orb-eval/route.ts` | Eval mirror for Orb conversation behavior. | High. It independently rebuilds context/backlog and duplicates some prompt assembly. ORB-308 is the open structural fix. |
| `lib/orb-contract.ts` | Generated Anthropic tool contract. | Low for tools; high for `ORB_INTEGRITY_RULES`, which is generated but empty/dead and historically misleading. |
| `docs/api-spec.yaml` | Source for generated tool contract and external REST/API guidance. | Medium. Can contain agent guidance that does not reach the live prompt unless deliberately wired. |
| `scripts/eval-cases.ts` | Tier 1/Tier 2 regression guard for tool calls and speech behavior. | Medium. Strong for prompt/tool behavior; blind to handler execution unless a live path or endpoint test exists. |
| `lib/orb-model/*` | Routing, provider adapters, budget gates, request logging, false-claim guard. | Low-medium. Stronger where shared modules are used; still evolving around strategic routing quality. |
| Database tables: `orb_preferences`, `orb_memory`, `orb_adaptations`, `knowledge_repo` behavior entries | Persistent adaptation and memory surfaces. | Medium. Powerful, but rule precedence and visibility need clearer architecture. |
| Knowledge Repo | Case-law archive of incidents and durable lessons. | Low as archive; high if treated as binding law without promotion to a live mechanism. |

---

## Rule Inventory

### 1. Core Principles

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Honesty, no fabrication, show work, suggest not direct, adapt, reversibility, close loop, work with available data | `ORB_PRINCIPLES` in `lib/orb-prompt.ts`; `getCapabilities()` summary | **Arbitrated**, partly **Checked** by evals and structural guards below | Good high-level frame, but too broad to govern alone. | Keep as principles. Do not add more broad principles unless they drive a specific rule, eval, or structural guard. |
| Resolve before escalating; name uncertainty; no lazy escalation | `ORB_RESOLUTION_LAWS`; eval cases from ORB-205 | **Checked** for known cases, **Arbitrated** otherwise | Strong prompt law with examples. | Keep. Add specific evals only when a new lazy-escalation failure appears. |
| Identifier provenance | `ORB_RESOLUTION_LAWS`; `ORB_NO_SESSION_RECORD_NOTE`; `shownCodes` server gate in `orb-converse.ts` | **Structural** for task-code mutation targets; **Checked** by evals; **Arbitrated** for non-mutating speech | One of Orb's strongest laws. | Extend the audit later to non-task identities: project names, knowledge entries, memories, and ticket references. |
| Project fact provenance | `ORB_QUERY_ROUTING`; eval coverage from ORB-301 | **Checked** and **Arbitrated** | Live prompt rule prevents ownership/dormant/description fabrication, but still relies on model compliance. | Keep. Consider structural helper around project-detail answers if ORB-315-like leakage recurs. |

### 2. Scope and Project Identity

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Query all visible projects; mutations default to current project | Dynamic SCOPE block in `orb-converse.ts` and eval route; ORB-203 history | **Arbitrated**, partly **Checked** | Works, but SCOPE block is duplicated in production/eval. | Move shared SCOPE builder into `lib/orb-prompt.ts` as a near-term extraction or cover under ORB-308. |
| Use project codes internally for todo-level tools, project names for project-level tools | Dynamic SCOPE block; tool descriptions; project resolver | **Structural** for project-level server resolution; **Arbitrated** for speech | Good architecture, but rule is embedded in duplicated dynamic prompt text. | Extract to shared prompt builder. |
| User-facing speech uses project names, not project codes | Dynamic SCOPE block; ORB-315 open | **Arbitrated** currently; not reliable | Known open bug. The model can echo `[code: ...]` tags from backlog headers. | Resolve ORB-315 early: tighten speech rule and add Tier 2 `speechNotContains` for project code tags. |
| Scope transparency for counts/summaries | `ORB_SCOPE_RULES`; dynamic SCOPE block; eval cases | **Checked** partially | Important and mostly stable. | Consolidate duplicate wording into one shared builder. |

### 3. Tool Routing and Read Behavior

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Backlog-direct access when context fully answers | `ORB_QUERY_ROUTING` | **Checked** by routing evals | Correct live design. Contradicted by older/dead guidance in ORB-314 history. | Resolve ORB-314: remove or reconcile dead/conflicting integrity guidance. |
| Tool selection: query_todos, query_projects, query_db, search_knowledge, update_knowledge, query_repository | `ORB_QUERY_ROUTING`; tool descriptions | **Checked** for selected cases | Good, but large and dense. | Split routing by domain section in the audit doc only for now; avoid code churn until ORB-314/315 are done. |
| Knowledge precise read/update routing | `ORB_QUERY_ROUTING`; shared resolver in `lib/orb-mutations.ts` | **Structural** for resolution, **Checked** for routing | Strong after ORB-302. | Keep. Document as a model for future read/write resolver sharing. |
| UI referent ambiguity | `ORB_RESOLUTION_LAWS` | **Arbitrated** | Good rule; likely under-tested. | Add eval only if it regresses; otherwise leave as arbitration. |

### 4. Mutation Integrity

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Todo mutations held for confirmation | `GATED_MUTATIONS` in `orb-converse.ts`; `buildMutationApprovalPrompt` | **Structural** | Strong for todo create/update/delete/move. | Track future migration to server-held flow shared with project/knowledge mutations. |
| Project/knowledge mutations use server-held propose/confirm/execute | `PROJECT_MUTATIONS`, `KNOWLEDGE_MUTATIONS`, `lib/orb-mutations.ts` | **Structural** | Stronger than legacy todo gate. | Model for future mutation architecture. |
| False completion claims blocked | `lib/orb-model/false-claim-guard.ts`; production/eval import | **Structural/Checked** | Good after ORB-306/307. | Keep shared. Watch non-task mutation claims. |
| Mutation result verification | `ORB_MUTATION_VERIFICATION`; `_verification` signals in tool results | **Structural** where tool handlers return verification; **Arbitrated** in speech | Strong pattern from ORB-225/266. | Audit all mutation tools for consistent `_verification` shape in a later implementation pass. |
| Consequential mutations require reversal trace | Audit log, tool handlers, server result data | **Structural** unevenly | The doctrine makes this an invariant, but coverage is not yet audited per mutation tool. | Add a follow-up audit row to object capability matrix or a mutation-surface checklist. |

### 5. Strategic Partnering

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Strategic reads route by intent and avoid mutation tools | `lib/orb-model/routing.ts`; strategic read mode prompt; Gemini provider path | **Structural** for tool exclusion in strategic route, **Checked** by strategic evals | Good foundation. Strategic partnering now needs deeper quality standards. | Keep separate from operational mutation rules. Build a Strategic Orb v1 plan after this audit. |
| Strategic advice weighs urgency, momentum, quick wins, project balance, blocking potential, staleness | `ORB_STRATEGIC_REASONING` | **Arbitrated**, partly **Checked** by strategic evals | Good heuristic list, but not yet an explicit strategic operating model. | Convert into a smaller strategic rubric with eval packets for representative scenarios. |
| Blocking/dependency claims require explicit evidence | `ORB_STRATEGIC_REASONING`; Knowledge Repo ORB-293 | **Checked** in some evals, **Arbitrated** otherwise | Important and hard-won. | Add to the invariant audit as "fact vs judgment boundary." |
| Strategic recommendations scoped to current user's owned projects | Dynamic SCOPE block; ORB-212 | **Arbitrated/Checked** | Correct but duplicated in production/eval prompt text. | Extract to shared SCOPE builder. |

### 6. Voice, Tone, and Personality

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Openness controls personality level | `buildVoicePrompt`; `orb_preferences.openness` | **Arbitrated** | Good parameter, but "voice" means written personality here, while voice mode also uses TTS. | Consider renaming later to avoid ambiguity; not urgent. |
| Voice mode no re-greeting, concise speech, no filler, ask before long readout | `buildVoiceConversationPrompt`; eval coverage from ORB-307 | **Checked** | Strong after shared extraction. | Keep shared builder; do not duplicate. |
| Feedback tone: effort, no cheerleading, earned warmth | `buildFeedbackTonePrompt` | **Arbitrated**, some Tier 2 coverage | Good art-side behavior, naturally subjective. | Ratify specific failures into Tier 2 cases when they occur. |
| Proactive guidance: one observation, action-oriented, quiet/active levels | `buildProactiveTonePrompt`, observations prompt, preferences | **Arbitrated**, partially data-constrained | Useful but risk of noise. | Define "worth interruption" proxy before expanding proactive behavior. |

### 7. Adaptation, Preferences, and Memory

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Session adaptation | `ORB_SESSION_ADAPTATION` | **Arbitrated** | Useful and low risk. | Keep as soft behavior. |
| Persistent preferences | `VALID_PREFERENCE_KEYS`, `get_preferences`, `set_preference`, `buildPreferencesPrompt` | **Structural** for allowed keys, **Arbitrated** for model choice to set | Good source of truth. | Document precedence: preferences override defaults, but not safety invariants. |
| Self-proposed adaptations | `ORB_ADAPTATION_BEHAVIOR`, `ORB_ADAPTATION_TOOL`, `orb_adaptations` | **Structural** for approval before activation, **Checked** by one Tier 2 case | Promising, but should stay rare. | Add this to Strategic Orb v1 as a controlled learning path. |
| Cross-session memory | `ORB_MEMORY_BEHAVIOR`, `save_memory`, `recall_memories`, `orb_memory` | **Structural** for table/tools, **Arbitrated** for when to save | Powerful and sensitive. | Audit memory visibility, deletion, and "do not re-save deleted memory" enforcement before expanding. |
| Commitment integrity | `ORB_COMMITMENT_INTEGRITY` | **Checked** by evals for known case | Strong prompt law. | Keep; add evals when new unsupported-commitment classes appear. |

### 8. Cost and Model Routing

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Role-based model routing | `lib/orb-model/routing.ts`, runtime policy, Settings > Orb AI | **Structural** | Good. Orb already routes by role, not fixed model identity. | Document model-role policy in a dedicated short doc or Settings help, not in the doctrine. |
| Budget gates | `checkOrbBudget`, budget block path, request ledger | **Structural** | Strong. | Keep. Ensure strategic eval traffic remains excluded where intended. |
| Cost telemetry | `recordOrbModelRequest`, rate cards, AI Metrics | **Structural** | Strong after ORB-310/311. | Use this data when changing strategic model routing. |
| Provider incidents | `classifyProviderFailure`, `notifyOrbIncident` | **Structural** | Good operational guard. | Keep. |

### 9. Eval and Verification

| Rule Family | Live Source | Enforcement | Current State | Recommended Action |
|---|---|---|---|---|
| Orb eval suite protects conversation behavior | `scripts/eval-cases.ts`, `app/api/orb-eval/route.ts` | **Checked** | Essential but incomplete. It asserts tool calls and speech; it does not execute handlers. | Each new handler still needs at least one live/dev verification path. |
| Eval/production prompt parity | Shared imports in `lib/orb-prompt.ts`; duplicated context builder | **Checked** unevenly | Known structural weakness. ORB-308 is open. | Do not let this block ORB-314/315, but treat ORB-308 as the larger structural cleanup. |
| Verification blind spots are named | Doctrine, Knowledge Repo entries | **Arbitrated** | Newly formalized. | Add a short "Blind spot" field to future eval-case descriptions when non-obvious. |

---

## Drift and Contradiction Findings

### Finding 1: Dead Integrity Constant

`lib/orb-contract.ts` exports `ORB_INTEGRITY_RULES`, generated from the API spec, but it is currently empty and not part of the live prompt assembly. Historically, this was worse: meaningful rules existed there but never reached production, and one contradicted the live backlog-direct-access design.

**Doctrine class:** candidate law with no enforcement.

**Action:** ORB-314 should be first. Decide whether external-agent rules belong only in `docs/api-spec.yaml` or whether any belong in the live prompt. Do not keep a dead "integrity" export that implies law.

### Finding 2: Dynamic SCOPE Rule Duplication

The SCOPE block is hand-written in both production and eval. It contains important rules: global query scope, mutation default project, project-code vs project-name tool distinction, name-first speech, scope transparency, and strategic ownership scoping.

**Doctrine class:** binding law with duplicated source.

**Action:** Extract a shared builder from `lib/orb-prompt.ts` or cover it under ORB-308. ORB-315 should still be fixed first because it is user-visible and smaller.

### Finding 3: Eval Mirror Still Rebuilds Context Independently

The eval route still has a separate context/backlog builder. Prior audits already found prompt drift and missing capability wiring. ORB-308 tracks the deeper refactor.

**Doctrine class:** checked mechanism with known blind spot.

**Action:** Keep ORB-308 open. Do not fold it into the first cleanup unless Stan explicitly wants a larger refactor.

### Finding 4: Strategic Partnering Has Rules but Not Yet a Product Model

`ORB_STRATEGIC_REASONING` is a good heuristic. It is not yet a complete strategic partner design. The current rules say how to prioritize; they do not yet define the strategic relationship, long-term planning style, intervention thresholds, or how Orb should help the user think.

**Doctrine class:** arbitrated art/craft behavior with partial eval coverage.

**Action:** Create a future "Strategic Orb v1" todo/plan after ORB-314 and ORB-315. This should be the main product direction, not a side feature.

---

## Proposed Target Structure

### Near Term

Keep `lib/orb-prompt.ts` as the live prompt-rule library, but divide future changes mentally into:

- **Stable law:** principles, provenance, mutation integrity, scope, strategic fact-vs-judgment.
- **Domain routing:** tool selection and data-source rules.
- **Style/tone parameters:** voice, feedback, proactive guidance.
- **Learning systems:** preferences, memory, adaptations.
- **Prompt assembly helpers:** shared builders used by production and eval.

Do not create new rule documents that duplicate prompt text. If a rule is binding, it needs one live source plus a mechanism.

### First Implementation Slice

1. **ORB-314:** resolve dead `ORB_INTEGRITY_RULES` and reconcile API-spec agent guidance with live prompt law.
2. **ORB-315:** enforce name-first project speech with prompt tightening and a Tier 2 eval.
3. **Shared SCOPE builder:** either as part of ORB-315 or just after it, remove duplicated SCOPE text from production/eval.

### Second Slice

1. Plan ORB-308 context-builder consolidation.
2. Audit mutation surfaces for reversal trace and `_verification` consistency.
3. Document model-role policy where admins actually configure it.

### Strategic Product Slice

Create a plan for **Strategic Orb v1**:

- What strategic partner role Orb should play.
- Which strategic claims require explicit evidence.
- Which recommendations can be judgment-labeled.
- How memory/adaptation should influence strategy.
- How user preferences constrain strategic voice.
- What eval packets represent high-value strategic scenarios.
- How to measure whether a strategic interaction was worth its AI cost.

---

## Immediate Recommendations

**Implementation note, v0.6.153:** The first implementation slice is complete. ORB-314 was resolved by removing the dead generated `ORB_INTEGRITY_RULES` export path and reframing `docs/api-spec.yaml` as REST/API integration guidance rather than conversational prompt law. ORB-315 was addressed by tightening name-first project speech and adding a Tier 2 eval against raw `[code: ...]` leakage. The duplicated dynamic SCOPE prompt was extracted into `buildOrbScopePrompt` and is now shared by production and eval prompt assembly.

**Planning note, v0.6.155:** Strategic Orb v1 now has a dedicated plan in `docs/strategic-orb-v1-plan.md`. ORB-308 should be treated as the context/eval architecture workstream inside that plan unless Strategic Orb stalls.

1. Do not start by rewriting the whole prompt. Start by eliminating dead/duplicated/conflicting rule sources.
2. Treat ORB-314 and ORB-315 as doctrine proof cases.
3. Keep the audit doc as the map; do not promote it into another binding rule source.
4. When a rule matters, choose one enforcement class before calling it done.
5. After the first cleanup, put real product energy into Strategic Orb v1. That is where Orb stops being another project manager.
