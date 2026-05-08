# Orb Design Notes

The ambient dashboard's orb is the primary surface of TODOS. It is a presence, not a list. This document captures the design principles that govern its behavior so future changes stay coherent with the original intent.

## What the orb is

The orb represents one product's open todo load at a glance. It is alive — it breathes, it glows, it speaks — and its visual state communicates urgency without requiring the user to read a list. The list is a destination you can travel to; the orb is where you start.

## Three moods

Open todos for the selected product are reduced to one of three moods:

- **Calm** — no urgent items, fewer than 6 open total
- **Active** — more than 5 open, no urgent
- **Urgent** — at least one priority-1 (urgent) item open

Mood is derived deterministically from data in `computeUrgency()`. Mood is also overridable via the DEV panel for design tuning.

## Multi-signal urgency (accessibility)

Color alone cannot communicate urgency — colorblind users, screen-reader users, and anyone with `prefers-reduced-motion` enabled all need fallbacks. The orb conveys mood through a layered set of signals so any single one can be removed without losing meaning:

| Signal | Calm | Active | Urgent |
|---|---|---|---|
| Pulse speed | 5.5s | 3.5s | 3.5s |
| Pulse amplitude | 1.025 | 1.04 | 1.045 |
| Edge stability | perfect circle | gentle morph | perfect circle |
| Glow inset | -16px | -28px | -44px |
| Glow blur | 20px | 28px | 38px |
| Glow opacity peak | 1.0 | 1.0 | 1.0 (warmer color) |
| Color | sage green | lavender | warm orange |
| Solar flares | none | none | 13 sporadic plumes |

Reduced-motion users get a still orb with mood still legible from glow size and color. Screen readers receive an `aria-label` reporting the open count.

The urgent pulse speed deliberately matches active. Once flares, glow intensity, and warm color are present, a fast pulse becomes redundant and aggressive. The pulse no longer carries the urgency signal; the surrounding signals do.

## Solar flares

Urgent mode adds a layer of solar flares emerging from the sphere edge. Design constraints, learned through iteration:

- **Many** (13), **wispy**, **short**, **slow**, **mostly dormant**. A field of constant fountains reads as decorative motion; a sparse field of occasional eruptions reads as tension.
- Flares are wider than they are tall (24–38px), heavily blurred (6px), with a soft radial gradient core. They are plasma plumes, not flame spikes.
- Each flare cycles 13–18s with a long dormant phase (55% of cycle invisible). Staggered delays (0–13s) decorrelate eruptions across the orb.
- `mix-blend-mode: screen` makes them glow additively over the orb body, like real solar phenomena.
- Rendered behind the sphere in DOM order so only the part outside the surface shows — flares appear to emerge from the body, not float above it.

The first flare implementation used straight thin spikes that read as mechanical and aggressive. The second iteration added border-radius warping to the sphere itself, which felt unstable. The current design — clean sphere + sparse plasma plumes — preserves the orb's identity while signaling urgency through atmospheric phenomena.

## Curved product code

The product code (e.g. `HELM`, `TODOS`) arcs along the inside top of the sphere, rendered via SVG `<textPath>`. This makes the product identity part of the orb's body rather than a label attached to it. Color shifts with mood. Clamped to 10 characters with ellipsis; the product pills below show the full code.

## The speech zone

The orb has a voice. A fixed-height (52px) zone directly below the sphere accepts text that fades in (280ms) with a small upward drift, lingers, and fades out (500ms). Used for:

- **Acknowledgements** — auto-fade after 3–4s ("Added — TODOS-26")
- **Query summaries** — persist until dismissed ("3 urgent open: TODOS-22, HELM-18, ...")
- **Explanations** — answers to "what does this mean?" — persist
- **Errors** — graceful fallback when the API fails

Rules:
- One line by default; two when needed.
- Three or more lines means it is a list, not speech, and should hand off to a fragment view (not yet built).
- Sentence case, third-person about state, no anthropomorphic "I". Personality is reserved for future iteration.
- `aria-live="polite"` so screen readers announce new content.

## Conversational input (Claude API)

The input field below the speech zone is the orb's only interaction surface. It accepts natural language for four intents:

- **create** — `remind me to fix the migration bug`
- **query** — `what's urgent on helm?`
- **update** — `mark TODOS-23 done`
- **explain** — `what does this mean?`

Implementation: a Next.js server action (`app/actions/orb-converse.ts`) calls the Anthropic API with three tools (`create_todo`, `query_todos`, `update_todo`) plus a no-tool path for explanations. The current backlog across all products is serialized into the system prompt and marked for prompt caching (5-min TTL) so repeat queries stay cheap.

Safety:
- Server-only — API key never reaches the browser
- Auth-gated via Supabase user session
- Rate limit: 10 calls/min per user (in-memory)
- Anthropic console spend cap as the hard backstop
- Dry-run toggle in the DEV panel runs the input pipeline without burning a real call

The deterministic insert that previously powered the input field has been removed. If the API call fails, the speech zone shows a graceful message and no todo is created — better to surface the failure than to silently fall back to behavior the user no longer expects.

## DEV panel

A development-only panel (gated on `NODE_ENV === 'development'`) sits in the bottom-right corner, mirroring Helm's `DevDebugPanel` pattern. It exposes:

- **Orb mood overrides** — Auto / Calm / Active / Urgent — for tuning animations against any state
- **Speech presets** — Short, Two-line, Ack (auto-fade), Overflow (3+ lines), Clear — for prototyping the speech surface
- **Claude API** — Dry-run toggle so the input pipeline can be exercised without API spend

The panel is a prototyping tool, not a feature. It exists because the visual states it triggers are hard to reach from real data on demand.

## Open design questions

These haven't been settled yet and will be resolved through use:

- **Fragment view** — when query results have multiple items, where do they render? Inline below the orb? As floating cards? As a transition into the list view?
- **Cross-product context** — currently the orb shows one product's load at a time. Should there be a global view? An "all products" mood that aggregates?
- **Personality** — the orb is currently neutral and direct. There is room for warmth, dry wit, or pacing — but it should emerge from use, not be designed in advance.
- **Session memory** — currently each conversational turn starts fresh. Conversational threads (referring back to "that one" from a prior turn) would require persisted context.

## What this is not

The orb is not a dashboard widget. It is not a status indicator. It is not a chatbot. It is the entry point of a tool that wants to feel like a presence rather than software. Design decisions should preserve that frame — when a feature would be easier to build by treating the orb as a list with extra animation, the right answer is usually to build it differently or not at all.
