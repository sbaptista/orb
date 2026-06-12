# The Orb Design Brief

> This document is the standard every design decision is measured against.  
> Read it before building UI. Update it when the standard evolves.

---

## Philosophy: Art and Technique

Orb is a piece of art. Not art as decoration — art as the inseparable union of vision and craft, where the technique elevates the experience and the experience gives the technique purpose.

A beautifully typeset todo list isn't polish — it's part of the feeling of using something made with care. The Orb's intelligence isn't a feature bolted on — it flows through an interface that deserves it.

Every surface is a canvas. The settings page, the error message, the checkbox animation, the way a task appears when you create it — all held to the same standard. The user should never encounter a screen that feels like it was built in a different session with a different level of attention.

**The test:** Would this hold up next to Things, Todoist, or Linear in a blind comparison? Not because it needs to — because we want it to.

---

## What is Orb?

Orb is a personal project manager with a living AI companion. Without the Orb, it's just another task app. The Orb is the moat.

### The two modes

**Orb mode** — The user is thinking with a partner. "What should I focus on today?" "Create 20 meaningful tasks for delivery days." "What's falling through the cracks?" This is where no competitor can follow. It costs money (API calls) and must earn every cent by genuinely making the user's life better.

**Nuts-and-Bolts mode** — The user is doing. Tap a button, fill in a title, check something off, scan a list. No AI needed, no cost incurred. This must be fast, tactile, and zero-friction — matching the best manual task managers in the market.

Both modes must be world-class. The transition between them should be seamless — the user never consciously "switches." They just do what they need, and the app responds with the right tool.

### The Orb's role

The Orb is the person you wish you had on staff but can't justify hiring. A chief of staff who knows your priorities, watches for problems, and only speaks when it matters. Not a chatbot. Not a search box. A thinking partner who also happens to track your tasks.

**Proof point:** A pre-alpha tester (cheese distributor) asked the Orb to help with delivery-day tasks. The Orb generated a domain-specific task list that impressed him — for a domain it was never taught. His immediate instinct: "Make a project and fill it with todos." Trust earned in a single interaction.

---

## Visual Identity

### Personality

Orb has a personality that competitors lack: it's *alive*. The breathing animation, the ambient state, the fractal mural, the green palette — these aren't decoration. They're the signature.

- **Organic, not mechanical.** Rounded forms, breathing motion, natural greens. Not grid-locked, not sharp-cornered, not clinical.
- **Calm confidence.** The app never shouts. It never uses exclamation marks. It presents information clearly and trusts the user to act.
- **Warm minimalism.** Generous whitespace, restrained palette, purposeful typography. Every element earns its place.
- **Living, not static.** The orb breathes. State changes are animated. The app feels like it's aware, not asleep.

### Color

The palette is green — not neon, not forest, but the muted sage-to-emerald range that feels natural and unstressed.

| Role | Value | Usage |
|------|-------|-------|
| Background | `#e8ede8` | Page canvas — warm gray-green, not cold white |
| Surface | `#f2f5f2` | Cards, panels — slightly lighter |
| Sunken | `#dde5dd` | Inset areas, grouped content |
| Text primary | `#2a332a` | Body text — near-black with green undertone |
| Text secondary | `#4a5a4a` | Supporting text |
| Text tertiary | `#4b6b4b` | Labels, captions |
| Muted | `#547054` | Placeholders, disabled text |
| Accent | `#408040` | Buttons, active states, the Orb's identity |
| Accent dark | `#2d5a2d` | Hover states, emphasis |

Green is the brand. Every shadow, every border, every tint carries it: `rgba(60, 110, 60, ...)`. This is unusual — most apps use neutral gray shadows. The green tint is a signature detail.

### Typography

Two typefaces, three roles:

| Role | Typeface | Weight | Usage |
|------|----------|--------|-------|
| UI | DM Sans | 300–500 | Everything: labels, body, buttons, navigation |
| Display | Cormorant Garamond | 300 | The orb's count number only — elegant, editorial |
| Mono | System monospace | — | Code, project codes, slash commands |

**DM Sans** is the workhorse — geometric but warm, highly legible at small sizes, excellent on screens. It's not a statement font; it gets out of the way.

**Cormorant Garamond** at light weight (300) for the orb count is a deliberate contrast — a serif among sans-serifs, thin among medium weights. It says: this number is special. It's the most art-forward typographic choice in the app.

### Motion

Motion in Orb is biological, not mechanical.

- **The orb breathes.** A slow `ease-in-out` scale pulse (5.5s cycle). Calm = gentle (1.0–1.05). Busy = noticeable (1.0–1.12). Urgent = insistent (1.0–1.18).
- **Transitions are smooth.** Panels, modals, dropdowns — no jarring pop-in. Elements arrive and depart, they don't appear and vanish.
- **Nothing moves without reason.** If an animation doesn't communicate state or guide attention, it shouldn't exist.
- **Reduced motion is respected.** `prefers-reduced-motion: reduce` disables all decorative animation.

### Spacing and density

- **Generous.** Orb is not a dense power tool. It's a calm workspace. Whitespace is a feature.
- **Rhythmic.** Vertical spacing follows the `--sp-*` scale (4, 8, 12, 16, 20, 24, 32px). Consistent rhythm creates visual harmony even when the user can't articulate why something feels "right."
- **Platform-adaptive.** Mac can be denser. iPad is intermediate. iPhone is spacious with large touch targets. Same content, different breathing room.

---

## The Orb Experience

### The ambient face

What you see when you're not talking to it. The breathing orb, the count, the state label.

**The standard:** A single glance — less than one second — should tell you how your work life feels right now. Not "you have 14 tasks" but *calm* or *you need to pay attention*.

**Current states:**
- **Calm** — gentle breathing, steady glow. All is manageable.
- **Busy** — faster pulse, wider scale. You have a lot going on.
- **Urgent** — insistent pulse, flare effects. Something needs attention now.

**Aspiration:** Richer ambient communication without adding text. The orb's visual behavior should encode more: trending direction (getting better/worse), time sensitivity (deadlines approaching), freshness (when did you last engage).

### The conversational face

What happens when you engage. This is where the magic lives.

**The standard:** The Orb's responses should feel like a beautifully typeset note from someone who respects your time. Not like ChatGPT output. Not like a log dump. Concise, structured, confident.

**Principles:**
- **Short.** One sentence when one sentence will do. A paragraph is a luxury.
- **Structured.** When listing, use clean formatting. When summarizing, lead with the conclusion.
- **Factual tone.** The Orb observes and suggests. It doesn't cheerlead, hedge, or over-explain.
- **Scope transparency.** Every number states where it comes from: "across Orb and Helm" not just "30 tasks."

### The proactive face

The greeting, the observations, the unsolicited nudge. This is the killer feature — the thing no competitor can do.

**The standard:** Every proactive message must pass the nickel test: would the user pay $0.05 for this nudge? If it saves them from forgetting something, yes. If it tells them something they already know, no.

**Principles:**
- **One observation, max.** Never pile on. One useful thing is better than three noisy things.
- **Actionable.** "ORB-173 is 3 days overdue — want to update or close it?" Not: "You have overdue items."
- **Suggest, don't direct.** The user is always in control. The Orb offers; it never commands.
- **Worth the cost.** If a proactive feature can be done deterministically (no API call), do it that way. Reserve LLM calls for genuine intelligence.

---

## Interaction Principles

### Every tap must feel intentional

Touch feedback on press. Visual change on hover. The user should never wonder "did that work?" Buttons depress. Toggles snap. Lists respond to scroll momentum.

### No dead ends

Every screen answers: what can I do here? Empty states are friendly and actionable ("No tasks yet — ask Orb to help you plan, or tap + New"). Error states offer recovery. Loading states show progress, not void.

### Speed is a feature

The manual task management path (Nuts-and-Bolts mode) must be *instant*. No spinners for local operations. Optimistic updates. The Orb conversation path can take a moment — the user expects it — but even there, streaming and typing indicators maintain the feeling of responsiveness.

### Consistency is trust

Every modal behaves the same way. Every dropdown opens the same way. Every delete requires the same confirmation. Predictability builds trust — and trust is what makes a user hand the Orb their task list and say "fill this in."

---

## Platform Expression

The same identity, adapted — not compromised — for each device.

### Mac (desktop, keyboard + mouse)

The power user environment. Hover states are rich. Keyboard shortcuts work. Layout is side-by-side (orb + list). Information density is higher — smaller spacing, more visible at once. The split pane divider gives the user control over the balance.

### iPad (tablet, touch)

The lean-back environment. Touch targets are generous. Typography bumps up one tier. The split pane works in landscape; portrait may stack. The orb is comfortable to glance at from arm's length on a couch or table.

### iPhone (mobile, touch)

The capture-and-check environment. Stacked layout. Large touch targets. Typography at maximum legibility. The orb is front and center when you open the app — a quick glance tells you the state. Dropping into the task list is one tap away. Creating a task should be possible in under 5 seconds.

### Cross-platform rules

- No hover-only interactions. Everything reachable by touch.
- Safe areas (notch, home indicator) always respected.
- The same task, done on any device, should feel natural — not "the mobile version of the desktop app."

---

## Quality Bar

### The blind comparison test

Screenshot any screen in Orb. Put it next to the equivalent screen in Things, Todoist, or Linear. Does it hold up? Not "is it as good" but "does it belong in the same conversation?"

If the answer is no, the screen needs work. No exceptions, no "we'll fix it later."

### The art test

Does this feel like it was made with care? Would you want to show it to someone? Not because of what it does — because of how it feels to use?

### The technique test

Can every visual property be changed from one place? Is every pattern used consistently? Does the app feel like one thing or a collection of screens? The CSS variable system exists to make this possible — use it.

### The Orb test

Does the Orb feel like a living presence or a chatbot widget? Would a new user instinctively trust it with their work after one interaction?

---

## Current State (June 2026)

### Foundation (complete)
- CSS variable system: font sizes, weights, families, line heights, letter spacing, opacity — all tunable from `:root`
- Three-tier responsive scaling: desktop → tablet → phone
- Button conformity: all buttons use established CSS classes
- Touch targets: 44pt minimum on interactive elements

### Needs work
- **Visual hierarchy:** No systematic audit of reading order, heading levels, content density
- **Component consistency:** Modals, dropdowns, forms, tables — not yet audited for family resemblance
- **Interaction polish:** Transitions, loading states, empty states — inconsistent
- **Accessibility beyond sizing:** Contrast ratios, screen reader support, reduced motion sweep
- **Platform parity:** No systematic cross-device test pass
- **Orb experience:** Proactive behavior is basic (greeting + observations). Ambient state is three levels. Conversational presentation hasn't been styled as premium.

---

*This brief is a living document. Update it as the standard evolves.*
