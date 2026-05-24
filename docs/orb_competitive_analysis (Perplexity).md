# Orb competitive analysis and product focus

Orb is not competing only as another to-do list app. Its strongest differentiation is that it behaves like a conversational planning agent sitting on top of a structured task system, rather than just presenting lists, filters, and calendars.[cite:87][cite:71][cite:73][cite:74]

## Market context

Across current personal to-do apps, the names that repeatedly appear at the top are Todoist, TickTick, Things 3, Microsoft To Do, Apple Reminders, Google Tasks, and Any.do.[cite:71][cite:73][cite:74][cite:76][cite:77]

Among those, Todoist is commonly positioned as the best overall or power-user option because of filters, natural-language input, recurring tasks, and cross-platform support.[cite:71][cite:73][cite:74][cite:89]

Things 3 is usually positioned as the best Apple-only premium app because of its calm design, Today/Upcoming/Anytime/Someday planning model, and low-friction scheduling experience.[cite:73][cite:74][cite:96][cite:101]

TickTick is often framed as the “all-in-one” productivity option because it combines tasks with calendar views, habits, and focus timers.[cite:71][cite:73][cite:77]

Microsoft To Do is generally valued for simplicity, price, and Microsoft ecosystem integration rather than deep semantic planning.[cite:71][cite:73][cite:76]

## Orb product understanding

The Orb repository shows a modern app stack with `app/`, `components/`, `lib/`, `supabase/`, `next.config.ts`, `vercel.json`, and TypeScript configuration, which strongly indicates a Next.js/TypeScript web app deployed on Vercel with Supabase as the backend.[cite:86][cite:87]

The project also includes Orb-specific UI surfaces such as `OrbConversation.tsx`, `OrbDevPanel.tsx`, `OrbHelp.tsx`, and `OrbVersionLabel.tsx`, which suggests that conversation, guidance, and product introspection are first-class parts of the experience rather than add-ons.[cite:85][cite:86]

The HANDOFF file captures product decisions showing that Orb’s database is the single source of truth, that RLS is the safety net, and that query paths like `query_todos` are intended to be the AI’s verification path for reproducing claims about the user’s backlog.[cite:87]

The same file shows a deliberate semantic model with ACTIVE defined as open plus in progress, PARKED defined as deferred plus on hold, and BUSY/CALM/URGENT defined as separate urgency states rather than raw task statuses.[cite:87]

This makes Orb closer to an interpretable planning system than to a conventional list manager.[cite:87]

## Conversational surface versus mainstream list UIs

Mainstream to-do apps typically organize the product around explicit lists, projects, labels, priorities, and date-based views such as Today or Upcoming.[cite:71][cite:73][cite:74][cite:76]

In those products, the user usually interprets what matters next by scanning filtered lists, calendars, or sorted task sets.[cite:71][cite:73][cite:99]

Orb is different because the conversation surface appears to be central to the product. The system is designed to answer questions about workload, scope, and next steps using verified database queries and shared status logic.[cite:87]

That means Orb’s value proposition is not merely “store tasks,” but “help me understand my task reality and decide what matters next.”[cite:87]

This is a stronger differentiation than simple list design, but it also carries more onboarding risk because users immediately understand a Today list while they may not immediately understand an agent over tasks.[cite:87][cite:99][cite:101]

## Orb versus Todoist, Things, TickTick, and Microsoft To Do

| Dimension | Orb | Todoist | Things 3 | TickTick | Microsoft To Do |
|---|---|---|---|---|---|
| Core interaction model | Conversation-first planning plus dashboard logic.[cite:87] | List/project/filter workflow.[cite:71][cite:73][cite:89] | Calm Apple list workflow with Today/Upcoming/Anytime/Someday.[cite:73][cite:74][cite:96] | List plus calendar plus habits/focus tools.[cite:71][cite:73][cite:77] | Simple lists and My Day workflow.[cite:71][cite:73][cite:76] |
| Main promise | Interpret the backlog and guide the user.[cite:87] | Capture and organize flexibly across devices.[cite:71][cite:73][cite:89] | Elegant personal planning on Apple devices.[cite:73][cite:74][cite:96] | One app for tasks, time, and routines.[cite:71][cite:73][cite:77] | Simple synced task management.[cite:71][cite:73][cite:76] |
| Status model | ACTIVE/PARKED groups plus separate urgency layer.[cite:87] | Open/completed with priorities, labels, projects, dates.[cite:71][cite:73][cite:89] | Scheduling-oriented states rather than a rich semantic status taxonomy.[cite:73][cite:74][cite:96] | Open/completed with priorities, tags, dates, habits.[cite:71][cite:73][cite:77] | Mostly simple open/completed model.[cite:71][cite:73][cite:76] |
| AI role | Central and query-backed.[cite:87] | Secondary to core task workflows.[cite:71][cite:73] | Not central in normal usage.[cite:73][cite:74][cite:96] | Feature-rich productivity support, not primarily AI-first.[cite:71][cite:73][cite:77] | Conventional task management, not AI-first.[cite:71][cite:73][cite:76] |
| Collaboration foundation | Strong backend foundations with auth, RLS, user/admin separation.[cite:87] | Mature sharing and collaboration workflows.[cite:90][cite:100] | Personal-use oriented.[cite:96][cite:101] | Better shared usage than Things, but still consumer-oriented.[cite:71][cite:73][cite:77] | Shared lists, especially useful in Microsoft ecosystems.[cite:71][cite:73][cite:76] |
| Main strength | Original planning companion concept.[cite:87] | Flexibility and market maturity.[cite:71][cite:73][cite:99] | Calmness and polished Apple UX.[cite:93][cite:96][cite:101] | Breadth of features.[cite:71][cite:73][cite:77] | Simplicity and ecosystem fit.[cite:71][cite:73][cite:76] |
| Main risk | Harder to explain quickly; must earn trust through clarity and usefulness.[cite:87] | Can feel conventional in a crowded category.[cite:99] | Narrower platform scope and less collaboration power.[cite:96][cite:101] | Can feel busy or feature-dense.[cite:71][cite:73][cite:77] | Less differentiated for power users.[cite:71][cite:73][cite:76] |

## Brutally honest view: Orb vs Todoist and Things

### Where Orb is ahead

Orb is ahead in semantic intelligence because it distinguishes raw task state from high-level workload state. ACTIVE/PARKED and BUSY/CALM/URGENT give the product a richer vocabulary than the normal open/completed plus due-date model.[cite:87]

Orb is ahead in explainable guidance potential because the design requires the AI to justify claims through reproducible queries rather than vague summarization.[cite:87]

Orb may also be ahead architecturally for future collaboration because the repo already reflects multi-user and admin-aware backend thinking through Supabase auth and RLS.[cite:87]

### Where Orb is behind Todoist

Orb is likely behind Todoist on capture speed, recurring task ergonomics, mature filter exposure, and battle-tested collaboration workflows.[cite:89][cite:90][cite:97][cite:100]

Todoist also benefits from a widely understood workflow and years of product muscle memory across platforms.[cite:99]

### Where Orb is behind Things

Orb is likely behind Things on immediate calmness, visual cohesion, and the fast “I instantly know what to do today” feeling that Things is known for.[cite:93][cite:96][cite:101]

Things is easier to grasp quickly because its conceptual model is lighter, especially for Apple-focused solo use.[cite:96][cite:101]

### What Orb appears to be missing or needing proof

Orb still needs a crystal-clear onboarding path that explains its mental model in under a minute.[cite:87]

It also needs dead-simple task capture that feels at least competitive with Todoist quick add and Things-style fast entry.[cite:89][cite:90][cite:101]

Finally, it needs repeated proof that Orb’s guidance is actually better than what a motivated user could infer from Today-style views or filters in competing apps.[cite:87][cite:89][cite:101]

## Top three product areas to focus on

### 1. “What should I do next?” guidance

This is the highest-leverage area because it is the clearest test of whether Orb’s conversational model is genuinely better than a traditional task list.[cite:87][cite:99]

The product should answer questions like “What should I do next?” or “Why am I busy?” with a small, credible, actionable set of recommendations and a short rationale for each one.[cite:87]

The goal is for Orb to reduce cognitive load more effectively than scanning Today in Things or a filter in Todoist.[cite:89][cite:101]

### 2. Capture speed and daily loop

Orb must become reliable for everyday use, not just reflective planning moments. That means capture has to be quick, forgiving, and easy on mobile/PWA surfaces.[cite:87][cite:89][cite:90]

A successful daily loop would likely be: open Orb, get a short plan, add tasks quickly, and close the day with a small review or reset.[cite:87]

Without this everyday rhythm, Orb risks becoming impressive but non-habitual.[cite:99]

### 3. Mental model clarity

Orb has more conceptual richness than typical competitors, but that richness can feel like product friction unless the language is extremely clear.[cite:87]

ACTIVE vs PARKED, BUSY/CALM/URGENT, and the logic behind Orb’s recommendations should be legible in one glance, with “show me why” affordances near any important summary or guidance statement.[cite:87][cite:99]

The target is transparency without forcing the user to read documentation.[cite:87]

## Suggested next-step framing for development AIs

The strongest near-term product framing is probably not “make Orb match Todoist feature for feature.” Instead, it is “make Orb the most trustworthy and useful interpreter of personal task reality.”[cite:87][cite:89][cite:101]

That framing suggests the following planning order:

1. Tighten the “What should I do next?” flow until it is obviously useful.
2. Reduce capture friction until it feels routine and low-effort.
3. Clarify the mental model in the UI so Orb feels wise and transparent rather than clever but opaque.

## Practical product questions

These are the key questions worth giving to development AIs:

- What exact UI and prompt flow should Orb use for “What should I do next?” so the response is brief, trusted, and actionable?[cite:87]
- What is the fastest possible capture flow across desktop and PWA mobile usage that still fits Orb’s richer model?[cite:87][cite:89][cite:101]
- What inline UI language best explains ACTIVE/PARKED and BUSY/CALM/URGENT without a tutorial wall?[cite:87]
- What non-conversational fallback views should exist for moments when the user wants immediate scannability instead of dialogue?[cite:87][cite:93][cite:101]
- What evidence or instrumentation will show that Orb guidance is actually reducing decision time and stress versus traditional list views?[cite:87][cite:99]
