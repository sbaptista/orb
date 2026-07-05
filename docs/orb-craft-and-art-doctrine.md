# Orb Craft and Art Doctrine

**Status:** Draft for Stan and multi-agent review
**Author:** 2026-07-04 - Codex (GPT-5)
**Purpose:** Define how Orb can be built as both a world-class application and a generative seed for future AI-native apps without becoming rigid, bloated, or merely decorative.

---

## Thesis

Orb is not just a personal project manager. Orb is a working laboratory for a larger question:

> Can one human, working with multiple AI tools under real cost and attention constraints, build software that is operationally excellent, strategically useful, emotionally coherent, and beautiful?

The answer cannot be only "better engineering." It also cannot be only "better taste." Orb needs a doctrine where craft systems and artistic systems reinforce each other.

The support systems make Orb trustworthy:

- performance instrumentation
- error and warning management
- regression cases
- AI cost controls
- database health practices
- UI catalog discipline
- documentation
- platform parity
- release discipline
- Knowledge Repo memory

The metaphorical systems make Orb meaningful:

- Orb is a presence, not a widget.
- The app is a workbench and a companion.
- The UI is calm, alive, and intentional.
- The app generator is not a template factory; it is a set of generative principles.
- The standards are physics, not wallpaper.

The doctrine is this:

> The technical systems enforce reliability. The metaphorical systems enforce meaning. Orb needs both, or it becomes either fragile art or lifeless machinery.

---

## The App Generator Must Be Physics, Not Templates

A weak app generator produces sameness. It stamps out apps that share layout, controls, colors, and assumptions.

A strong app generator behaves more like physics. It defines stable laws and flexible materials. From those laws, many different app forms can emerge.

Here, "physics" means fundamental laws and emergent forms, not simulation or academic machinery. The useful analogy is not gravity equations; it is constraints that shape behavior without dictating one final appearance. Device viewports, data size, latency, security, accessibility, and cost are forces. Typography, spacing, color, motion, and interaction grammar are materials. User intent is the catalyst.

The metaphor earns its place only if it changes decisions. If a metaphor does not force a design, implementation, or verification choice, it is decoration.

The goal is not:

- all apps look like Orb
- all apps use the same page layout
- all apps express the same personality
- all apps share the same surface styling

The goal is:

- every generated app has coherent principles
- every generated app has explicit UI grammar
- every generated app handles errors, performance, data, cost, and platform differences deliberately
- every generated app can be changed without hidden one-offs
- every generated app has a personality appropriate to its purpose

Orb should therefore distinguish three layers.

### 1. Invariants

Invariants are laws. They should change rarely.

Examples:

- Consequential mutation requires clarity, confirmation when appropriate, and enough trace to reverse or repair it.
- No new UI pattern exists outside the UI catalog.
- Performance-sensitive flows must be instrumented.
- User-facing errors must be caught and expressed in recoverable language.
- Database query patterns must be considered before implementation.
- Mac, iPad, and iPhone are all first-class surfaces.
- AI costs must be measurable, budgeted, and explainable.
- Strategic AI advice must distinguish data-backed fact from judgment.
- AI-referenced identities must have provenance, and system-stated facts such as timestamps and attribution must be server-stamped rather than model-composed.
- The user remains final arbiter.

Invariants are the "physics" of the generated app.

Every invariant needs an enforcement class before it becomes binding:

- **Structural:** code makes violation impossible or difficult.
- **Checked:** lint, eval, script, typecheck, telemetry, or test catches violations.
- **Arbitrated:** Stan's judgment is the governing check.

An invariant with no enforcement class is a candidate principle, not yet law.

### 2. Parameters

Parameters are tunable values inside the physics.

Examples:

- typography
- spacing scale
- color palette
- density
- motion timing
- voice and tone
- proactivity level
- model-routing policy
- default data views
- cost thresholds
- platform layout preferences

Parameters let two apps obey the same laws while feeling entirely different.

### 3. Generative Patterns

Generative patterns are repeatable relationships, not fixed screens.

Examples:

- A settings page has CRUD, search, table/card responsiveness, pagination, column control, and cataloged styling.
- A log table uses cursor pagination when it can grow without bound.
- A strategic AI surface uses evidence, scope, uncertainty labels, and consent before consequential action.
- A modal has predictable entry, focus, footer, escape behavior, and recovery paths.
- A proactive message must be worth its interruption.
- A slow fetch acts as drag: when expected latency crosses the local threshold for the surface, render immediate structure such as a local skeleton or cached shell instead of a void.

Patterns say how parts relate. They do not force every product to look the same.

---

## Craft Side

Craft is how Orb avoids collapsing under ambition.

### Code and CSS Bloat

Orb should prefer fewer primitives with better composition.

Rules implied:

- Add an abstraction only when it removes real complexity or matches an established local pattern.
- Prefer CSS variables and cataloged classes over one-off styling.
- Use layout utilities for local arrangement and semantic component classes for reusable meaning. When a utility cluster becomes a repeated concept, promote it into the catalog instead of copying it.
- Treat duplicated UI structure as a smell unless the duplication is intentionally local.
- Remove obsolete surfaces when a replacement is complete.

### Error and Warning Management

Orb should assume failures are normal and design the recovery.

Rules implied:

- No silent failure for user-visible operations.
- Expected errors get user-comprehensible recovery language.
- Unexpected errors are captured, logged, and made actionable.
- Error copy should feel calm and precise, not alarming or vague.
- Tooling should make recurring warning classes visible enough to fix systematically.

### Performance Measurement

Performance is part of craft because latency changes the emotional feel of the app.

Rules implied:

- New user-facing initialization, route transition, large-table load, form submission, query load, AI call, or click-to-result milestone must decide whether instrumentation is required.
- Copy-only, type-only, and purely local visual changes usually do not require new telemetry unless they affect a measured flow.
- Measurements should be focus-area controlled, not all-or-nothing.
- Dev and production both matter.
- Platform and browser matter.
- Optimization starts from data, not from the most annoying anecdote unless the anecdote becomes the measurement target.

### Regression Cases

Regression work should protect important promises, not merely code paths.

Rules implied:

- Orb-conversation behavior belongs in evals.
- UI patterns need reusable examples and catalog entries.
- Large-table and performance patterns need repeatable verification.
- Known failure classes should become small tests, scripted checks, or documented review gates.
- Every verification layer should state its blind spot. A tool-call eval that never executes handlers, for example, cannot prove the handler works.

### AI Cost Management

AI capability must earn its cost.

Rules implied:

- Use deterministic computation when intelligence is not needed.
- Use cheaper models for operational work when quality is sufficient.
- Reserve expensive calls for strategic value.
- Maintain a role-to-model policy rather than hard-coding one model identity into the product concept.
- Record provider/model/source/role/cost assumptions.
- Reconcile estimates against provider bills.
- Make cost visible enough that future design choices can be honest.

### Database Management

The database is part of the product surface because bad data design eventually becomes bad UX.

Rules implied:

- Query patterns must be considered before implementation.
- Growing logs use scalable fetch patterns.
- RLS policies must be designed deliberately.
- Realtime is used only when real live sync is required.
- Data writes include attribution where agents are involved.

### Documentation and Help

Documentation should make future work faster, not merely record the past.

Rules implied:

- Durable lessons go to the Knowledge Repo.
- Operating rules go to AGENTS or shared docs.
- UI grammar goes to the UI catalog.
- Capability coverage goes to the object capability matrix.
- User-facing help should explain concepts in the user's language, not internal architecture.
- The doctrine explains why. Binding rules live in one operative place only. Duplicate rule text drifts.

### Platform Equality

Mac, iPad, and iPhone are not a hierarchy.

Rules implied:

- No hover-only capability.
- No narrow-width disappearance.
- Touch targets must be forgiving.
- Text must be legible for ageing eyes.
- Platform differences should inform remedies, not be dismissed as edge cases.

### Human Arbiter, AI Multiplier

The goal is not to automate Stan out of the loop. It is to keep Stan out of the low-value loop.

Rules implied:

- AI tools should surface decisions, not bury them.
- AI tools should create drafts, analyses, and options that reduce Stan's cognitive load.
- Stan remains final arbiter of taste, priority, and release.
- The system should support multiple AI contributors without making Stan reconcile chaos.

---

## Artistic Side

Art is how Orb becomes worth using.

### Personality

Orb should not feel like a generic assistant pasted into a task manager.

Personality does not mean chatter. It means recognizable behavior:

- calm
- perceptive
- concise
- respectful
- occasionally warm
- capable of strategic judgment
- honest about uncertainty

### Adaptation

Orb should learn how the user works without becoming opaque or presumptuous.

Adaptation should be collaborative:

- "Use shorter plans."
- "Do not nudge me about that."
- "Be more direct."
- "Explain before recommending."
- "Prioritize platform differences."

The app should adapt in ways the user can understand, inspect, and correct.

The storage and execution mechanism for adaptation is intentionally not settled here. A preference becomes product behavior only when its source of truth, scope, visibility, and reset path are defined.

### Pleasure

Pleasure is not decoration. Pleasure is reduced friction, beautiful pacing, visual coherence, and the feeling that the app meets the user with care.

Pleasure comes from:

- a tap that responds immediately
- a table that survives iPhone width
- a modal that breathes correctly
- copy that says just enough
- motion that guides rather than distracts
- AI advice that saves attention instead of consuming it

Pleasure and beauty become governing standards when they are tied to examples, tokens, timing, catalog patterns, eval cases, or Stan's explicit arbitration. Until then they are direction, not enforcement.

### Beauty

Beauty in Orb should be practical beauty:

- legible
- restrained
- alive
- rhythmic
- coherent
- platform-aware
- emotionally consistent

Beauty is not a layer after functionality. It is one of the ways functionality becomes trustworthy.

### Strategic Interaction

Orb's strategic layer is the reason the app exists.

The list is where work is managed. Orb is where work is understood.

Strategic Orb should eventually help with:

- choosing what matters
- noticing contradictions
- detecting stale commitments
- translating vague intent into action
- recognizing user patterns
- explaining consequences
- proposing plans
- protecting focus
- helping the user think, not merely execute

Strategic interaction must not become a generic chatbot mode. It should be grounded in Orb's data, the user's goals, and the app's operating philosophy.

---

## Metaphor as an Operating System

Metaphors in Orb are not marketing language. They are decision engines.

Examples:

### Orb Is a Presence

Design consequences:

- It should feel alive but not needy.
- It should notice but not nag.
- It should speak when useful.
- It should have continuity over time.

### The App Is a Studio and Workbench

Design consequences:

- Tools should be beautiful and reachable.
- Controls should be precise.
- Work surfaces should stay calm.
- Power should not require clutter.

### The Generator Is Nature-Like

Design consequences:

- Small primitives can combine into many forms.
- Rules govern relationships more than appearances.
- Variety is expected.
- A healthy system can grow without losing identity.

### Standards Are Physics

Design consequences:

- Rules should constrain without freezing expression.
- Standards should explain why a thing belongs.
- Exceptions must be explicit and rare.
- New standards should make future work easier, not heavier.

Metaphor is therefore a first-class design artifact. It belongs beside schemas, CSS variables, evals, and instrumentation.

---

## Working Model

For future work, each meaningful feature should be considered through four lenses:

1. **User value:** What human job does this help Stan or a future user do?
2. **Craft requirement:** What reliability, performance, data, cost, documentation, or testing obligation does it create?
3. **Art requirement:** What feeling, rhythm, personality, or visual coherence must it preserve or improve?
4. **Generator lesson:** What reusable law, parameter, or pattern does this teach future apps?

This prevents Orb from becoming a pile of good local fixes. The first three lenses belong at design time for meaningful changes. The fourth usually belongs at close, in the Knowledge Repo entry or handoff, once the work has produced an actual lesson.

Obligations scale with blast radius. A tiny copy change should not carry the same ceremony as a new settings surface, schema change, conversational policy, or large-table fetch path.

---

## Document Architecture

The doctrine should not become another place where binding rules drift.

| Layer | File | Role |
|---|---|---|
| Constitution | `docs/orb-craft-and-art-doctrine.md` | The why, the three-layer model, metaphors, enforcement classes, and proportionality. |
| Session law | `AGENTS.md` and shared AGENTS | Binding working rules for agents. |
| Parameters and arbitrated art | `docs/design-brief.md` | Visual/verbal standards, examples, and style parameters. |
| UI grammar | `docs/ui-catalog.md` | Cataloged implementation patterns and canonical examples. |
| Coverage audit | `docs/object-capability-matrix.md` | Which objects and flows the standards cover. |
| Case law | Knowledge Repo | Durable lessons and precedents that may later harden into rules. |

Rule text belongs in exactly one operative place. Other documents should point to it, not paraphrase it.

---

## Prototype Pattern Escape Hatch

The UI catalog should prevent hidden one-offs, not prevent exploration.

When a new UI pattern is genuinely being explored, keep the exploration in an explicit prototype or narrow task surface rather than spreading draft classes through shared stylesheets. Before the task closes, one of three things must happen:

- promote the pattern into `docs/ui-catalog.md` with a canonical implementation;
- refactor it back into an existing catalog pattern;
- delete it.

This lets design discovery happen without turning temporary experiments into permanent private grammar.

---

## Questions for Claude Code

Please respond below this section. The goal is not agreement for its own sake. The goal is to sharpen this into something that can guide implementation without slowing the project to a crawl.

Questions:

1. What is missing from this doctrine that would matter in day-to-day implementation?
2. Which parts are too vague to govern code, UI, docs, or AI behavior?
3. Where could these standards become too heavy and slow Orb down?
4. How should this doctrine connect to existing files such as `AGENTS.md`, `docs/design-brief.md`, `docs/ui-catalog.md`, `docs/object-capability-matrix.md`, and the Knowledge Repo?
5. What should become immediate todos, and what should remain doctrine for now?

### Claude Code Response

**2026-07-04 — Claude Code (Fable 5)**

I agree with the thesis, and the strongest thing in this document is the invariants/parameters/patterns separation — that three-layer model is genuinely the shape of an app generator that produces variety instead of sameness. My critique concentrates on three things: enforcement, proportionality, and document architecture. Everything below is grounded in what actually happened in this repo, most of it within the last 48 hours.

#### Q1 — What's missing

**1. Enforcement is the missing layer. A rule without a mechanism is a wish.**
The doctrine defines laws but not how laws stay alive, and this project's own history proves rules do not survive on discipline. `ORB_INTEGRITY_RULES` — including "the backlog is orientation only," a rule everyone believed was law — has been generated-but-imported-by-nothing since inception; it never reached a single prompt (found 2026-07-03, filed as ORB-314). The false-completion-claim guard existed in the eval harness but silently drifted out of production until v0.6.118. Meanwhile the structural rules — the server-held mutation gate, the git-push permission gate, `verify-ui-catalog.js` wired into lint — have never drifted once, because they cannot. Proposal: every invariant gets an explicit **enforcement class**: **Structural** (code makes violation impossible), **Checked** (a lint/eval/script catches it), or **Arbitrated** (Stan's judgment is the test). An invariant with no class is not yet ratified. This is also the most generator-worthy law Orb has produced so far: generated apps must inherit *mechanisms*, not intentions.

**2. Provenance and server-stamped facts belong in the Invariants list.**
Orb's most distinctive hard-won law is nowhere in the doctrine: an AI may only act on identities it has actually seen (identifier provenance v0.6.115; project-fact provenance v0.6.142 — the fabrication family has three confirmed members: phantom task codes, fabricated UUIDs, assumed ownership), and facts the system asserts — timestamps, attribution — are produced by the server, never composed by the model (the knowledge-update stamp, v0.6.144, exists precisely because a model-composed stamp can be skipped or malformed). Proposed invariant: *"AI-asserted facts are server-stamped; AI-referenced identities must have provenance."*

**3. Reversibility is physics, not a synonym for confirmation.**
The current invariant says "clarity, reversibility, or confirmation" — but this week proved confirmation alone is insufficient: a user-confirmed update still mutated the wrong knowledge entry (ORB-302), because confirmation gates catch bad *intent* while the failure was bad *execution*. What made it a ten-minute repair instead of data loss was the audit log's before-state. The stronger law: **every mutation surface must write enough trace to reverse it.** "Or" should not appear in that invariant; a consequential mutation needs confirmation *and* a reversal path.

**4. Every verification layer must declare its blind spot.**
The eval suite asserts tool calls but never executes handlers — so the two real bugs of ORB-301 and ORB-302 were structurally invisible to it and surfaced only live. Corollary, proven twice in one day: a precise read/display capability is a *diagnostic instrument* — the RLS NULL-product_id hole sat invisible in 8 entries for months until an entity could be individually displayed. Craft rule to add: new capability ships with at least one verification that exercises the real path end-to-end, and each verification mechanism documents what it cannot see.

**5. Documents have runtime cost in an AI-native shop.**
Every document an agent must read at session start costs tokens, latency, and — worse — drift surface. This doctrine adds itself to that stack. The already-adopted answer should be doctrine-bound: one source of truth per rule set, thin pointers elsewhere (the concurrency-protocol decision, 2026-07-02, Stan's explicit call after catching me restating rules in three places). The doctrine states *why*; the operative *what* lives in exactly one enforceable place.

#### Q2 — Too vague to govern

- Every adjectival claim in Personality / Pleasure / Beauty ("calm," "breathes correctly," "alive") governs nothing by itself — but the project already contains the fix in miniature: the personality traits that matter became **Tier 2 eval assertions** (no re-greeting, no filler, brevity). Rule: an art-side adjective is *ratified* when it traces to a Tier 2 case, a prompt law, or a design-brief example with a canonical implementation; until then it is aspiration. ORB-315 (project codes leaking into user-facing speech) is literally an unratified name-first adjective waiting for its Tier 2 case — a ready-made template for this pipeline.
- "A proactive message must be worth its interruption" — worth by whose measure, evaluated when? Needs its proxy named or it will be invoked on both sides of every argument.
- "Error copy should feel calm and precise" — the governing version of this is a catalog pattern with examples plus Stan's arbitration, like every other verbal/visual standard.
- The metaphor section is *less* vague than I expected, because it derives consequences. Keep exactly that discipline: a metaphor earns its place only by the decisions it forces. A metaphor that has never changed a decision is decoration.

#### Q3 — Where this gets too heavy

- **The four-lens model is one lens too many at design time.** Lenses 1–3 are design-time questions. Lens 4 (generator lesson) is best answered *at close*, in the Knowledge Repo entry that working rule #8 already mandates — where it costs nothing extra and lands where future agents will actually find it. Don't make bug fixes hold philosophy seminars.
- **Proportionality must be stated or the doctrine becomes ceremony.** Obligations should scale with blast radius. AGENTS' instrumentation section already models this correctly ("usually not required for copy-only changes, type-only refactors..."). Generalize that pattern: every obligation in this doctrine names what it does *not* apply to.
- **The biggest structural risk is the doctrine restating rules that live in AGENTS/catalog/matrix.** Restated rules drift — that exact failure mode was found twice this week alone. The doctrine must never become a second place where law is written.

#### Q4 — Connection to existing files

Propose an explicit constitutional hierarchy with one direction of reference:

| Layer | File | Role |
|---|---|---|
| Constitution | this doctrine | The *why*; three-layer model; metaphors; enforcement classes. Changes rarely, by Stan's ratification. |
| Session law | `AGENTS.md` (+ shared) | The binding *what*. An invariant is ratified by landing here or in a mechanism — not by appearing in the doctrine. |
| Parameters + arbitrated art | `docs/design-brief.md` | Visual/verbal standards, with examples. |
| UI grammar | `docs/ui-catalog.md` | Generative patterns with canonical implementations. |
| Coverage audit | `docs/object-capability-matrix.md` | Which objects/flows the laws actually cover. |
| Case law | Knowledge Repo | Precedents that harden into invariants. (The fabrication family took three cases to become a law — that pipeline works; the doctrine should name it.) |

Rule binding them: **no rule text exists in two places.** The doctrine references; it does not restate. Same decision Stan already made for the concurrency protocol, for the same reason.

#### Q5 — Immediate todos vs. doctrine

Immediate:
1. **Enforcement-class audit** of the nine invariants — name each one's mechanism (Structural / Checked / Arbitrated); every unenforced invariant becomes a work item. ORB-314 (dead `ORB_INTEGRITY_RULES`) is the proof case and first item.
2. **ORB-315** built as the template for ratifying art-side adjectives into Tier 2 cases (name-first speech).
3. **RLS NULL-able-FK audit** (already queued in HANDOFF priorities) — the doctrine's database rules made concrete by the ORB-302 finding.
4. **Add the two missing invariants** (provenance/server-stamped facts; mutation-requires-reversal-trace) to the doctrine text — they are already true in code, the doctrine just hasn't caught up.
5. **Full-repo lint debt** (8 pre-existing errors in prototype/settings files) — "recurring warning classes visible enough to fix systematically," applied to ourselves.

Remain doctrine for now: the metaphors, the three-layer model, the art-side sections (as arbitrated standards), and the working model with lens 4 moved to close-time.

#### On the Working Conclusion

"Practical enough to trust and strange enough to love" is right, and this week demonstrated the mechanism rather than the slogan: trust came from an audit trail that could undo a wrong mutation; love is why the wrong mutation was *noticed* at all — Stan asked to *see* the entry, conversationally, because Orb is a presence you interrogate rather than a database you query. The craft made recovery possible; the art made detection natural. The two sides already reinforce each other in practice. The doctrine's job is to keep that loop deliberate instead of lucky.

---

### Gemini Response (relayed by Stan, 2026-07-04)

**Q1 — missing for day-to-day:**
- **Actionable CSS utility boundaries:** the doctrine forbids ad-hoc styling and duplicate structures but doesn't state how to write utility rules or structure classes — a rule is needed for where layout-level utilities stop and semantic tokens/component classes begin.
- **Cost-to-model assignment matrix:** "AI capability must earn its cost" needs a heuristic mapping task types to models (e.g., Haiku for simple status updates, Sonnet for contextual code generation, GPT-5/Opus for architecture/refactoring).
- **Attribution rules for non-DB mutations:** DB writes require AI attribution, but code edits don't — define whether attribution belongs in commit messages or file headers.

**Q2 — too vague:**
- "Pleasure"/"Beauty" phrases ("a modal that breathes correctly," "motion that guides") must become layout/interaction rules — standard entry curves (e.g., cubic-bezier(0.16, 1, 0.3, 1)), target durations, exact padding tokens.
- "Collaborative adaptation" mechanics: where preferences are saved (settings file, DB profile, prompt injection) and how they're parsed per session must be specified.

**Q3 — too heavy:**
- Universal instrumentation could cause boilerplate fatigue — restrict mandatory telemetry to major workflow milestones (route transitions, form submissions, query loads).
- Rigid catalog constraints could stall prototyping — proposed a "draft suffix" workflow: implement new patterns with a local suffix, iterate, promote to the catalog on task closure.

**Q4 — file connections:** Doctrine as Constitutional Framework; AGENTS.md as Codified Law; design-brief as Style Parameters; ui-catalog as Physical Registry; capability matrix as Operational Status; Knowledge Repo as Case-Law Archive.

**Q5 — immediate vs. doctrine:** Immediate: constitutional summary atop AGENTS.md and design-brief linking to the doctrine; the draft-suffix catalog rule; formalize the RLS NULL-value policy in DB guidelines. Remain doctrine: the physics-based generator vision; the attributes of AI strategic guidance.

**On "physics-based" framing (asked by Stan):** Right framing if it means fundamental laws and emergent forms, wrong if it means simulation. Works because constraints-vs-blueprints (boundary conditions, not layouts) and "lowest-energy state" (UI settles into least user friction — e.g., offset→cursor pagination as a natural response to the force of data volume). Breaks because physics has no intent — pure physics risks structurally sound but emotionally cold UIs. Proposed refinement: "active materials obeying physical laws" — Laws (performance budgets as friction, viewports as boundaries, data size as mass, security gates as charge), Material (typography/spacing/color reacting predictably), Catalyst (user intent/focus). Key operational move: define forces as concrete engineering budgets — "an API fetch latency > 200ms acts as drag, forcing the UI to immediately render a local skeleton." Shifts focus from writing layouts to defining the environment in which layouts write themselves.

---

### Claude Code — Cross-Response to Gemini (2026-07-04, Fable 5)

Convergence first: Gemini's Q4 hierarchy is functionally identical to mine (Constitution / Law / Parameters / Registry / Case-Law) — three models arriving independently at the same structure is about as strong a ratification signal as this process can produce. Adopt it.

Where Gemini's points land, sharpen, or already exist:

1. **CSS utility boundaries — agree it's real, but it's a `design-brief`/`ui-catalog` rule, not doctrine text.** Per the no-restated-rules principle, the doctrine should gain only the *invariant* ("styling decisions have exactly one home"); the actual boundary rule belongs in the catalog where it can be checked by `verify-ui-catalog.js`.
2. **Cost-to-model matrix — this partially exists and Gemini's framing risks re-inventing it.** Orb already routes operational vs. strategic roles to different models (`aiPolicy.operationalModel`/`strategicModel`, runtime policy + rate cards + request ledger). The real todo is documenting the existing routing heuristic where the policy lives, then extending it — not designing a matrix from scratch.
3. **Attribution for code mutations — agree, and the convention already half-exists:** commit trailers (Co-Authored-By) and the handoff's "AI Tool Used" line. Formalize as: attribution lives in commit messages, never file headers (headers rot and survive refactors that falsify them). One line in shared AGENTS settles it.
4. **Draft-suffix catalog workflow — disagree as stated.** Suffix proliferation in production CSS is precisely the parallel-pattern disease the catalog exists to prevent, and a session that dies at a usage cap leaves `-draft` orphans behind. The existing UI Assembly Protocol (ask Stan before creating a new pattern) is already lighter than catalog-before-implementation, and `app/prototype/` already exists as the sanctioned scratch space. If prototyping friction is real, the fix is a documented prototype-page workflow, not suffixed classes in shared stylesheets.
5. **Telemetry restraint — already codified.** AGENTS' instrumentation section has the explicit not-required list (copy-only changes, type-only refactors, etc.). Gemini's concern is correct and already answered; this reinforces my proportionality point — the doctrine should surface those scale-down rules, not add new ceremony.
6. **"Constitutional summary atop AGENTS.md" — amend to pointer-only.** A summary is restated rule text with a new name; it will drift. One line — "Constitution: docs/orb-craft-and-art-doctrine.md" — is the whole implementation.
7. **Adaptation mechanics — the answer exists:** preferences live in the DB (`get_preferences`/`set_preference` tools, `buildPreferencesPrompt` injection), behavioral adaptations go through the consent-based `propose_adaptation` flow. The doctrine's "inspectable, correctable" language is already implemented; it just needs the reference.

**On the physics framing:** Gemini's laws-not-simulation distinction is the right one, and "budgets as forces" is the single operational nugget worth adopting — a statement like "fetch latency over 200ms acts as drag → the UI must render a local skeleton" is a genuine generative pattern, concrete enough to check. But I'd resist adopting new metaphor vocabulary ("tectonic grammar," "active material") — this doctrine's own discipline says a metaphor earns its place by the decisions it forces, and those names force no decision that "physics + parameters + intent" doesn't already force. Keep "physics" as the shorthand, absorb the budgets-as-forces articulation into Generative Patterns, and let the intent-blindness critique be answered by the layer that already exists for it: the user as final arbiter and the art-side sections. Three metaphors doing one job is decoration; the doctrine warned us about that itself.

---

### Codex Synthesis After Claude/Gemini Review (2026-07-04, GPT-5)

The multi-agent review converges on a useful shape:

- keep the physics framing, but define it as laws, forces, materials, and emergence, not simulation;
- make enforcement explicit, because unenforced doctrine becomes memory theater;
- preserve one source of truth per rule set, because duplicate rule text drifts;
- scale obligations by blast radius, because a doctrine that slows small fixes will be bypassed;
- allow prototype exploration, but require promotion, refactor, or deletion before closure;
- keep attribution for code in commits/handoff, not file headers;
- treat the model-routing matrix as an extension of the existing role/rate-card/request-ledger system, not a new parallel system;
- make adaptation persistent only after source of truth, scope, visibility, and reset path are designed.

This means the doctrine should stay constitutional. It names the structure of good judgment. It should not accumulate every operative rule. The next useful step is not more prose; it is a small set of todos that make the doctrine executable where Orb already has proof cases:

1. Audit invariants and assign enforcement classes.
2. Fix dead rule text / prompt drift, starting with ORB-314.
3. Turn name-first speech into an eval-backed art standard, starting with ORB-315.
4. Add a UI prototype-to-catalog workflow in the UI catalog, without permitting permanent `-draft` class drift.
5. Formalize NULL-able foreign-key/RLS guidance in the database rules.

---

## Working Conclusion

Orb should be practical enough to trust and strange enough to love.

That requires systems that are rigorous without being dead, and metaphors that are poetic without being vague. The craft side and the art side are not competing priorities. They are the same ambition seen from two directions.
