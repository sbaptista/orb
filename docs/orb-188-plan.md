# ORB-188: AI Presentation Model — Design Exploration

## The Core Tension

The Orb is two things at once:
1. **A presence** — ambient project health, visual state (calm/busy/urgent), the fractal, the brand identity. Wants the whole screen.
2. **A tool** — conversational AI that manages your backlog, answers questions, surfaces insights. Needs to coexist with data.

These have opposite spatial needs. The presence wants spaciousness. The tool wants to sit alongside the task list. The current split-pane layout tries to serve both and satisfies neither fully — the Orb feels cramped, and on iPhone one of them is always squeezed.

## Stan's Design Instincts (from prior sessions)

- "Orb needs space — cramped is a dealbreaker"
- "The Orb is a presence, not a chat box"
- "Don't promote the list and demote the Orb"
- "The spaciousness of AmbientDashboard is a feature"
- "It depends on the user" — different users may want different balances between Orb and list

## What Exists Today

| Mode | Layout | Strength | Weakness |
|---|---|---|---|
| **Ambient** | Full-screen fractal, Orb centered, no list | Spacious, distinctive, the Orb IS the product | No task visibility — user must talk to Orb or navigate away |
| **Dialogue** | Split pane (Orb left, list right) | Both visible | Orb is cramped, competing for space |
| **iPhone vertical** | Stacked (Orb top, list bottom) | Works | One is always squeezed — usually the list |

## Possible Directions

### A. Orb-Primary, List-on-Demand
The Orb owns the screen (like ambient mode). The task list is a panel that slides in when needed — tapped, swiped, or the Orb itself opens it.

- **Pros:** Preserves the presence. The Orb is unmistakably the product. List appears when you need it, disappears when you don't.
- **Cons:** Users who live in the list (power users, planners) will find it friction-heavy. Every list interaction requires summoning it.
- **Best for:** Users who think of the Orb as the experience, not just a tool.

### B. List-Primary, Orb-as-Companion
The list is home base. The Orb lives in a floating bubble, compact bar, or collapsible section that expands into a conversation overlay when tapped.

- **Pros:** Task management front and center. The Orb is always accessible but doesn't consume space.
- **Cons:** The Orb becomes a feature of a todo app, not the distinctive presence Stan envisioned. Feels like every other AI-assistant-in-a-chat-bubble.
- **Best for:** Users who want a task manager first, AI second.

### C. Mode-Switching (Current Pattern, Refined)
Ambient mode is the landing. Tapping the Orb or starting a conversation transitions into dialogue mode which reveals the list. But the transition is smoother — the list slides up from below on mobile, or fades in as a panel on desktop, rather than a hard split.

- **Pros:** Preserves both modes. The Orb gets its full-screen moment. The list appears in context.
- **Cons:** Two modes means two mental models. "Where's my list?" if the user forgets how to trigger it.
- **Best for:** A balanced user who appreciates both the presence and the utility.

### D. User-Chosen Default (Preference-Driven)
A `presentation_mode` preference (e.g., `orb-first` / `list-first` / `balanced`) determines the default layout. The infrastructure already exists — `orb_preferences` table, `get_preferences`/`set_preference` tools, preference injection into system prompt.

- **Pros:** Each user gets the experience that fits them. No one-size-fits-all compromise.
- **Cons:** Three layouts to build and maintain. Onboarding must help new users choose wisely.
- **Best for:** A product with diverse users. Exactly what Stan described.

## The "It Depends on the User" Insight

Stan named this explicitly. The preference system from ORB-186 already supports per-user calibration of the Orb's *behavior* (guidance_level, verbosity). Extending this to *presentation* is architecturally natural:

- `presentation_mode: orb-first` → Direction A
- `presentation_mode: list-first` → Direction B
- `presentation_mode: balanced` → Direction C

The Orb could even propose this during onboarding: "How do you prefer to work — Orb front and center, task list front and center, or both visible?"

## Open Questions for Stan

1. **Who is the primary user?** Is it Stan (power user, admin, builder) or the alpha testers (potentially less technical, first impression matters)?
2. **What does "first impression" mean?** When someone logs in for the first time, what should they see? The fractal? The list? The Orb greeting?
3. **Is the Orb the product, or is the Orb a feature of the product?** This is the foundational question. If the Orb IS the product, it gets the screen. If it's a feature, it shares.
4. **Does the fractal need to be always-visible?** The ambient health state (calm/busy/urgent) is powerful, but could it be communicated smaller (a glowing dot, a color strip, a border effect) when the list is visible?
5. **Would you use the Orb differently on Mac vs iPad vs iPhone?** Desktop might be split-pane; mobile might be Orb-first with list-on-demand.

## Recommendation

Don't decide abstractly — prototype the two extremes (A and B) as lightweight variants and live with each for a day. The answer will be felt, not reasoned.

Direction D (user-chosen) is likely the final answer, but the *default* matters enormously — it's the first impression. That default should come from experiencing A and B, not from a planning doc.

---

*Analysis by Claude Code (Opus 4.6) — 2026-05-30*
*Based on ORB-188, prior key decisions, and conversation with Stan.*
