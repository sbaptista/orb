# ORB-188: AI Presentation Model — Design Exploration

## The Core Tension

The Orb is two things at once:
1. **A presence** — ambient project health, visual state (calm/busy/urgent), the fractal, the brand identity. Wants the whole screen.
2. **A tool** — conversational AI that manages your backlog, answers questions, surfaces insights. Needs to coexist with data.

These have opposite spatial needs. The presence wants spaciousness. The tool wants to sit alongside the task list. The current split-pane layout tries to serve both and satisfies neither fully — the Orb feels cramped, and on iPhone one of them is always squeezed.

---

## Design Answers (2026-05-30)

Stan answered the five foundational questions. These narrow the design space significantly.

### 1. Who is the primary user?
**Non-admin users.** The app must work for alpha testers first — people who didn't build it and need it to be immediately useful.

### 2. What is the first impression?
**The Orb greeting.** But the greeting experience will evolve significantly. The user should feel welcomed by an intelligent presence, not confronted by a blank dashboard or a chat widget.

### 3. Is the Orb the product?
**No. The user getting work done efficiently is the product.** The Orb is an aid — "a very smart butler." Its purpose is to make the user's life less chaotic in a way that builds trust and confidence. The user must feel in control and in charge at all times.

### 4. Does the fractal need to be always-visible?
**No.** Stan personally values it as art, but it's not core UX. The app must work without it. The fractal is a personal touch — appreciated by some, invisible to others.

### 5. Different behavior per device?
**Same app, different layout.** One mental model, responsive to screen size. Not different modes per device.

---

## The Orb Identity: Brownie Temperament, Butler Intelligence

*Inspired by the Watchmakers ("Brownies") from The Mote in God's Eye (Niven & Pournelle).*

The Brownies in the novel are tiny creatures that silently fix, repair, and optimize everything around them overnight. The crew leaves a broken component; by morning it's not just fixed but improved. They work without being asked, without demanding attention, without explaining themselves.

The Orb borrows the Brownie **ethos** — the instinct to make things better without being asked, to work in the background, to not demand the spotlight. But there are two critical differences:

1. **The Orb has judgment.** Brownies are compulsive and instinctive — they optimize everything they touch without understanding why. That's what makes them dangerous in the book: helpful without being aligned. The Orb understands intent. It knows *when* to surface something ("you have 3 overdue tasks approaching deadline") and when to stay quiet.

2. **The Orb communicates.** Brownies never interact with the humans. The Orb can explain its reasoning, take direction, and back off when told. The user can have a conversation about what the Orb is doing and why.

**The model: Brownie temperament, butler intelligence.** The instinct to help without being asked, but with the awareness to know what's appropriate and the ability to have a conversation about it when needed.

---

## Direction: Adaptive UI (Radical Concept)

Beyond the four fixed layout options originally considered (A–D below), a more ambitious idea emerged: **there is no single app.** The Orb reshapes the interface to match each user. One user gets a minimal kanban. Another gets a dense spreadsheet. A third gets mostly conversation with data surfaced inline. The UI may bear no resemblance from one user to the next.

### Why this is different from preference toggles
Preference toggles let you choose between 3 pre-built layouts. An adaptive UI lets an AI **compose** the interface from components based on understanding your work style — through conversation and observation. No app does this today. The closest analogies are Notion (user-arranged blocks) and Retool (dev-assembled component layouts), but neither has an AI doing the arranging based on understanding the user.

### What it would take technically

1. **Component library, not fixed pages.** The building blocks are atomic and self-contained: task table, kanban column, priority chart, conversation panel, urgency indicator, quick-add form, calendar view, etc. Each works independently at any size.

2. **Layout schema per user.** Stored in the database. Something like:
   ```json
   {
     "layout": "split",
     "panels": [
       { "type": "task-table", "position": "main", "config": { "defaultFilter": "active", "density": "compact" } },
       { "type": "orb-conversation", "position": "sidebar", "config": { "showGreeting": true } }
     ]
   }
   ```
   The Orb reads and writes this schema. The app renders from it.

3. **`reshape_ui` tool for the Orb.** A new tool that lets the Orb add, remove, reposition, and configure components. "Show me my tasks as a kanban" → Orb updates the layout schema → app re-renders.

4. **Blessed default layout.** New users start with a sane default — the first impression. Dynamic reshaping starts from there, driven by conversation and user feedback.

5. **Constrained grid, not freeform.** Not "any component anywhere" — that makes testing combinatorics explode. Instead: choose from N vetted layout templates (split, stacked, single-pane, etc.), each with configurable slots the Orb fills. Still dynamic, but bounded and testable.

### The Brownie guardrails

The lesson of the Brownies: they were helpful until they weren't. They colonized the ship and remade it to suit *their* needs. The Orb must never run amok.

| Guardrail | Rule |
|---|---|
| **Propose, don't impose** | The Orb suggests changes: "I notice you always filter to urgent first. Want me to make that the default?" User says yes → change happens. Never silent reshaping. |
| **Everything is reversible** | "Undo that" or "Reset to default" always works. Every layout change is logged and rollback-able. |
| **Bulkheads the Orb can't eat** | Core controls never move: the nav bar, the ability to talk to the Orb, the reset button. These are structural — the Orb cannot remove or relocate them. |
| **User is always in charge** | The Orb can propose, the user disposes. No change without consent. No "I know better" overrides. |
| **Transparency** | The user can always ask "Why does my layout look like this?" and get an answer. The Orb explains its reasoning. |

### Open questions — answered (2026-05-30)

1. **How much of the component library needs to exist before this is viable?** Minimum viable set: task table, conversation panel, urgency indicator. That's what exists today — enough to start extracting into a schema.

2. **Does the layout schema live in `orb_preferences` or need its own table?** Decision deferred — do whatever is most manageable. `orb_preferences` already stores per-user key/value pairs; a single `layout_schema` key with a JSON value could work initially. Migrate to a dedicated table only if the schema outgrows that.

3. **How does the Orb learn preferences?** Three channels:
   - **Explicit conversation** — user tells the Orb what they want ("show me a kanban")
   - **Behavioral observation** — Orb notices patterns (which filters the user picks, how they size the split pane, which views they linger on)
   - **Research** — if the Orb has internet access (like Claude Code does), it could research best practices, suggest layouts based on the user's work style, or pull inspiration from established tools. This requires user approval before acting on anything external.

4. **What is the migration path from the current fixed layout to a schema-driven one?** To be designed. The first step is extracting the current layout into a schema representation — even if there's only one template. That proves the rendering pipeline without changing anything the user sees.

5. **Performance: does rendering from a dynamic schema add meaningful overhead?** No. By definition, the app renders the same number of components either way — the schema just determines *which* components and *where*. A JSON lookup at render time is negligible.

### Multiple views per user, not just one layout

A user doesn't want just one interface — they want the right interface for the moment. Orb already offers a list view and a checklist view. Kanban is planned. The vision extends this:

- A **curated set of best-practice views** ships as defaults: list, checklist, kanban, calendar, etc. Each is a vetted component.
- The user can **use all of them, some of them, or customize their own.** The Orb helps them discover which views fit their work style.
- Users may not know what they want — most people don't think in terms of "I want a kanban board." But if the Orb notices they keep grouping tasks by status and dragging priorities around, it can suggest: "Would it help to see this as a board instead of a list?" The user tries it. If they hate it, one word undoes it.
- Custom views could be **user-named and saved**: "My Sprint View," "Quick Triage," "Weekly Review." Each is a layout + filter + sort configuration that the Orb (or the user) can create and switch between.

The Orb's role here is **discovery, not prescription.** Most users won't invent a custom view from scratch. But if the Orb does the work — assembles the view, names it, presents it — and it can be backed out instantly, the friction of experimentation drops to near zero.

### Risk: maintenance and testing
Every component must work in any slot, at any size, alongside any neighbor. The mitigation is the constrained grid — vetted layout templates with defined slots, not freeform positioning. The Orb selects a template and configures the slots, but the templates themselves are hand-built and tested.

---

## Competitive Landscape (2026 research)

### The three AI philosophies in task management
1. **Full delegation** (Motion, Reclaim) — AI schedules everything automatically; user reviews but doesn't manually plan
2. **AI-assisted control** (Todoist, Notion, Asana, ClickUp, monday.com) — AI suggests, automates busywork, user decides
3. **Intentional resistance** (Sunsama, OmniFocus, Things 3) — minimal AI, human judgment first

**Orb is none of these.** Closest to #2 but with a distinctive identity: the Brownie/butler model. It doesn't just suggest — it has a presence. It doesn't automate everything — it communicates.

### The generative UI trend
- Gartner: 30% of new apps will use AI-driven adaptive interfaces by 2026 (up from <5% two years ago)
- Vercel AI SDK already supports generative UI — streaming React Server Components the AI composes dynamically. Orb already uses the AI SDK for conversation streaming.
- Google's A2UI project: agent-driven interfaces in production that generate different layouts from the same data based on context
- Users prefer AI-generated interactive UI over static markdown 83% of the time
- No existing app lets a persistent AI entity compose the interface based on conversational understanding of the user's work style. That's Orb's unique position.

### The Sunsama counterpoint
Sunsama's founders: "Until there's an AI that's a functional simulation of your entire consciousness, the AI can't be an arbiter of your intentions." Wirecutter named Sunsama best scheduling app 2025. The intentional, manual approach works for some users. **Orb must respect this** — the adaptive UI is opt-in, not forced. Some users want a fixed, predictable interface. That's valid.

### Sources
- [Perplexity audit](docs/Use%20of%20AI%20in%20Todo-Project%20Manager%20Apps%20(Perplexity).md)
- [Personalization in UX Using AI: 2026 Guide](https://www.parallelhq.com/blog/personalization-in-ux-using-ai)
- [Vercel AI SDK: Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [Google A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [Sunsama: When Less is More](https://www.sunsama.com/blog/when-less-is-more-building-thoughtful-products-in-the-age-of-ai)
- [awesome-generative-ui](https://github.com/narrowin/awesome-generative-ui)

---

## Original Directions (for reference)

### A. Orb-Primary, List-on-Demand
The Orb owns the screen. The task list slides in when needed.
- **Verdict:** Ruled out as default. Friction-heavy for users who live in the list. Conflicts with "user getting work done is the product."

### B. List-Primary, Orb-as-Companion
The list is home base. The Orb is a floating bubble or collapsible section.
- **Verdict:** Ruled out in its generic form. Makes the Orb feel like every other AI chat widget. Conflicts with "builds trust and confidence" and the Brownie/butler identity.

### C. Mode-Switching (Current Pattern, Refined)
Ambient mode is the landing. Conversation reveals the list. Smooth transitions.
- **Verdict:** Closest to what exists. The current split-pane layout works reasonably well. Needs refinement, not replacement — unless the adaptive UI direction is pursued.

### D. User-Chosen Default (Preference-Driven)
A `presentation_mode` preference determines the default layout.
- **Verdict:** Subsumed by the adaptive UI concept. If the Orb can reshape the UI per user, fixed preference toggles are the simple fallback, not the destination.

---

## What Already Works

The current UnifiedDashboard layout is functional and has good bones:

| Element | Status | Notes |
|---|---|---|
| Split pane (Orb + List) | Working | Draggable divider, remembers position, responsive |
| Panel toggles | Working | Show/hide Orb or List independently |
| Project search dropdown | Working | Follows `admin-search-*` pattern from UI catalog |
| Task table | Working | `tv-*` pattern — responsive, mobile-optimized |
| Orb sphere + urgency states | Working | Calm/busy/urgent with animations, glow, solar flares |
| Conversation panel | Working | Markdown rendering, auto-scroll, session persistence |
| Fractal background | Working | MuralCanvas at z:0, purely decorative |
| Settings CRUD pattern | Working | `settings-crud-list` — reusable table with actions |

**Builder mandate:** All future UI work must use established patterns from `docs/ui-catalog.md`. The CRUD table pattern in Settings is the gold standard for data lists. New components must be proposed before creation. Consistency across the app is a first-class priority — every screen should feel like the same product.

---

## Recommendation

### Near-term (current cycle)
Refine Direction C. The split-pane layout works. Focus on:
- Consistent component patterns across all screens (Settings CRUD table as the model)
- Orb greeting experience for first-time users
- Responsive polish on iPad and iPhone

### Medium-term (after pre-alpha)
Build toward the adaptive UI. Start with:
1. Extract the current layout into a schema (even if there's only one template)
2. Add 1–2 alternative layout templates (e.g., list-only, orb-only)
3. Give the Orb a `reshape_ui` tool that switches between them
4. Store layout preference per user

### Long-term (hobby/exploration)
Full component composition — the Orb assembles the interface from atomic components based on user conversation and observation. This is the Brownie vision with butler guardrails.

---

*Analysis by Claude Code (Opus 4.6) — 2026-05-30*
*Based on ORB-188, Stan's design answers, Brownie/butler identity discussion, and adaptive UI concept.*
