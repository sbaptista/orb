<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Orb Conceptual Plan

## Overview

Orb is a hybrid productivity environment built around two complementary modes of engagement: direct task management and ambient AI-guided sensemaking. The conventional list interface remains the operational source of truth for creating, editing, filtering, sorting, grouping, and completing work, while the Orb functions as an adaptive advisory presence that interprets project health, detects workload risk, and helps the user decide what to do next.[^1][^2][^3]

The central product idea is not simply “chat for tasks.” Orb is intended to combine ambient project-health signaling, conversational assistance, explainable recommendations, and proactive cross-project guidance in a way that conventional to-do lists do not. The user chooses the interface that fits the moment: list mode for precise execution, Orb mode for planning, triage, reflection, and workload interpretation.[^3][^4][^5]

## Product Purpose

Orb should help the user answer four recurring questions:

- What is the current health of my projects?
- What deserves my attention now?
- Why does it matter?
- What is the best next move for me, given how I actually work?

This makes Orb more than a task manager. It becomes a continuously learning advisor that understands both the workload and the user, then uses that understanding to support decision-making, reduce overwhelm, and improve execution quality over time.[^4][^5][^6]

## Core Experience

### Dual interaction model

Orb should preserve two explicit but connected modes:

- **Do mode**: direct manipulation of tasks through lists, checklists, boards, filters, bulk actions, and detail panels. This is where the user performs explicit task operations with speed and certainty.[^2][^1]
- **Plan and Review mode**: the Orb interprets status, detects problems, offers suggestions, summarizes tradeoffs, and helps the user plan the day, week, or project sequence.[^7][^3][^4]

The value of the product comes from the user being able to move fluidly between these modes without losing context. The AI should not replace the list; it should elevate it.

### Ambient project health

The Orb’s visual state should communicate project health at a glance. It should convey whether the current state is calm, busy, strained, or urgent, using visual change as a lightweight signal rather than forcing the user to inspect a dashboard or parse dense metrics. This ambient quality differentiates Orb from ordinary task tools by allowing the system to be felt before it is interrogated.

The ambient representation should be backed by real conditions such as workload density, deadline proximity, blocked work, accumulated urgent tasks, and detected overload patterns. Visual calm should correspond to actual breathing room; visual agitation should correspond to meaningful strain.

## UI Direction

### Primary structure

The UI should distinguish clearly between execution and interpretation.

A strong structure would include:

- **Context bar**: active project set, health state, horizon, and immediate attention cue.
- **Work surface**: the main list, checklist, board, or calendar-derived task view where the user directly edits and completes work.
- **Advisory rail**: a compact Orb area showing current observations, recommendations, warnings, digests, and pending approvals.
- **Expanded Orb workspace**: a deeper conversational and planning view for triage, replanning, review, and explanation.

This prevents the Orb from feeling like a gimmicky alternative input method. Instead, it becomes a distinct advisory layer above task execution.

### Three practical modes

The product should make three user intents explicit:

- **Plan**: What should happen next, and what should be restructured?
- **Do**: What task should be acted on now, and how should it be managed?
- **Review**: What happened, what worked, what slipped, and what should change?

These modes give Orb a clear purpose at different moments in the day and help users understand when to use lists and when to use the advisory interface.[^8][^9][^10]

## Recommendation System

### The role of “Why it matters”

“Why it matters” should be a core product pattern, not just supporting copy. Every consequential recommendation should explain not only what Orb suggests, but why the suggestion is important in practical terms such as deadline risk, stress reduction, focus preservation, dependency management, or capacity recovery.[^11][^12][^13]

Each recommendation should contain five elements:


| Element | Purpose |
| :-- | :-- |
| Observation | What Orb sees right now. |
| Why it matters | What consequence is likely if nothing changes. |
| Suggested move | The concrete change Orb recommends. |
| Confidence and assumptions | What Orb is relying on in its reasoning. |
| Action controls | Accept, modify, dismiss, snooze, or inspect further. |

This pattern turns the Orb into an advisor rather than an authority. It helps users trust the system because recommendations are tied to understandable consequences instead of unexplained automation.[^3][^4]

### Categories of importance

Orb should standardize a small set of importance categories so users can recognize the basis of advice over time:

- **Deadline risk**: a commitment is likely to slip.
- **Capacity risk**: the planned work exceeds realistic availability.
- **Focus cost**: too many context switches or fragmented blocks reduce effective progress.
- **Dependency risk**: uncompleted work is blocking other work.
- **Stress signal**: the current shape of work is likely to feel overwhelming or unsustainable.
- **Opportunity gain**: a small change would create calm, margin, or momentum.

These categories are useful because they translate raw project state into human consequences.[^6][^14][^4]

### Two-layer explanation

“Why it matters” should eventually be personalized into two internal layers:

- **Work reason**: why the recommendation matters based on project and schedule data.
- **Personal reason**: why this recommendation is especially suitable for this user, based on learned habits, response patterns, and preferred working style.[^5][^15]

The visible explanation can remain concise, but the system should know the difference. This is how Orb moves from generic productivity advice to trusted, user-specific guidance.

## Key Functional Capabilities

Orb should incorporate the most powerful ideas from established task and project tools while organizing them around its advisory identity.[^1][^2][^3]

### Execution features

These remain essential and should be fast, reliable, and boring in the best sense:

- Rapid capture.
- Filtering and sorting.
- Status workflows.
- Priorities and due dates.
- Recurring logic.
- Bulk operations.
- Multiple views over the same task set.
- Cross-project reference and navigation.[^16][^1]


### Advisory features

These differentiate Orb:

- Deadline collision detection.
- Capacity and overload analysis.
- Fragmentation and context-switch analysis.
- Daily and weekly planning guidance.
- Cross-project prioritization.
- Smart rescheduling proposals.
- Review summaries and postmortems.
- Explainable, consequence-based recommendations.[^4][^7][^3]


### Communication features

Orb should proactively communicate through multiple channels, with behavior shaped by urgency, user preference, and learned response patterns:

- In-app Orb conversation for nuanced guidance.
- Push notifications for short, timely interventions.
- Email for structured digests and reflective summaries.
- SMS or iMessage only for explicit opt-in, high-signal situations.[^12][^17][^18][^11]


## Adaptive Learning

Orb should learn on two fronts simultaneously: the structure of the work and the behavior of the user.[^15][^19][^5]

### Learning from the data

Orb should learn which patterns in project data predict success or trouble. Over time, it should become better at recognizing conditions that lead to missed deadlines, overloaded days, task abandonment, recurring rollover, or hidden project expansion.

Examples of learnable project signals include:

- combinations of tasks that routinely collide,
- meetings that reliably reduce execution later in the day,
- project types that create hidden follow-up work,
- dependency patterns that produce bottlenecks,
- deadline classes that are truly fixed versus merely aspirational.


### Learning from the user

Orb should also learn how this specific user works best. That means observing not only what the user says, but what they actually do.

Important learnable traits include:

- best focus hours,
- realistic start and finish patterns,
- preferred level of planning detail,
- tolerance for proactive nudging,
- effective motivational framing,
- reliability of estimates,
- tendency to overcommit,
- response to urgency language,
- preferred communication channels,
- signs of overwhelm or avoidance.[^14][^20][^12]


### Adaptive guidance

The result should not be superficial personalization. Orb should adapt its strategy.

Examples:

- If the user responds best to bounded next steps, Orb should prefer specific prompts over broad advice.
- If mornings are consistently productive, Orb should place demanding work there whenever possible.
- If urgency language causes resistance, Orb should reframe recommendations around relief, clarity, or momentum.
- If the user edits AI plans but rejects full automation, Orb should bias toward approval-first proposals rather than silent changes.[^18][^12][^14]

This is the basis for Orb becoming a partner rather than a recommendation engine.

## Motivation Model

Orb should learn what best motivates the user, but it should do so supportively and transparently. The goal is not pressure; the goal is effective encouragement calibrated to the person.[^20][^5]

Useful motivational styles include:

- **Encouragement**: reinforce progress and competence.
- **Clarity**: reduce ambiguity and define the immediate next move.
- **Consequence**: explain the practical cost of inaction.
- **Momentum**: create quick wins and visible movement.
- **Relief**: emphasize load reduction and regained breathing room.
- **Commitment**: reconnect work to goals and promises.

Orb should infer a weighted mix of these styles and refine it over time based on what actually leads to action, lower stress, and better follow-through.[^19][^21][^20]

## Notification Philosophy

Orb should use notifications intelligently and sparingly. Notification value comes from relevance, timing, personalization, and channel fit, not from sheer volume.[^17][^11][^12]

### Channel roles

| Channel | Best use |
| :-- | :-- |
| In-app Orb conversation | nuanced planning, reflection, explanation |
| Push | time-sensitive, lightweight prompts |
| Email | daily briefings, weekly reviews, reasoning-heavy summaries |
| SMS / iMessage | urgent, opt-in, high-signal alerts only |

### Notification rules

Notifications should be:

- behavior-aware rather than purely scheduled,
- sensitive to repeated dismissals,
- delayed when non-urgent and poorly timed,
- grounded in a single clear action,
- traceable so the user can understand why Orb sent them.[^11][^12][^14]

Orb should learn not only what to say, but when to say it, through which channel, and how often.

## Trust and Control

A system that learns from the user must also be inspectable and correctable. Trust depends on users being able to understand, influence, and constrain the model Orb is building of them.[^5][^15]

Orb should therefore expose a clear “how Orb works with you” area showing things such as:

- inferred focus windows,
- inferred planning style,
- notification preferences and sensitivity,
- preferred motivational framing,
- current overload sensitivity,
- what signals Orb uses to interpret risk.

Users should be able to correct the system directly with simple controls such as:

- that’s not true,
- use less urgency,
- don’t message me this way,
- give me shorter plans,
- explain more before suggesting changes.

This keeps personalization collaborative instead of opaque.

## Product Identity

Orb should be defined as an adaptive advisory productivity system with two simultaneous responsibilities:

- maintain a precise operational workspace for direct task execution,
- provide a continuously learning advisory layer that interprets project health and helps the user make better decisions.

Its novelty lies in the combination of ambient project-health signaling, explainable AI advice, adaptive learning about the user, and proactive communication across channels.[^3][^4][^5]

The list remains the place where work is managed. The Orb becomes the place where work is understood.

## Guiding Principles

A coherent conceptual direction for Orb can be summarized in the following principles:

- Keep execution direct and dependable.
- Make project health visible before it becomes a problem.
- Explain every important recommendation in consequence-based terms.
- Learn from both work patterns and user patterns.
- Personalize strategy, not just language.
- Use notifications as interventions, not noise.
- Keep the user in control of consequential changes.
- Treat the AI as a trusted advisor, not an invisible manager.


## Final framing

Orb should ultimately feel like a calm but perceptive companion that watches the shape of work, notices strain before collapse, understands how the user actually operates, and helps them navigate toward better outcomes. It should not merely organize tasks. It should cultivate better timing, better planning, better pacing, and better self-understanding around work.[^6][^4][^5]

<div align="center">⁂</div>

[^1]: https://www.morgen.so/blog-posts/motion-vs-todoist

[^2]: https://monday.com/blog/project-management/project-management-apps/

[^3]: https://www.nytimes.com/wirecutter/reviews/best-ai-scheduling-apps/

[^4]: https://www.morgen.so/blog-posts/ai-task-manager

[^5]: https://www.ibm.com/think/topics/ai-personalization

[^6]: https://blog.rivva.app/p/best-productivity-apps-for-2026

[^7]: https://www.lindy.ai/blog/ai-scheduling-assistant

[^8]: https://efficient.app/compare/motion-vs-sunsama

[^9]: https://www.morgen.so/blog-posts/sunsama-vs-motion

[^10]: https://reclaim.ai/blog/sunsama-vs-reclaim

[^11]: https://onesignal.com/blog/onesignal-guide-push-notification-best-practices-2026/

[^12]: https://appbot.co/blog/app-push-notifications-2026-best-practices/

[^13]: https://messageflow.com/blog/transactional-push-notifications-examples/

[^14]: https://www.jotform.com/blog/push-notification-best-practices/

[^15]: https://evam.com/blog/the-role-of-artificial-intelligence-in-mobile-app-personalization

[^16]: https://www.nytimes.com/wirecutter/reviews/best-to-do-list-app/

[^17]: https://appmaker.xyz/blog/effective-push-notification-strategies

[^18]: https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026

[^19]: https://www.salesforce.com/au/artificial-intelligence/ai-reinforcement-learning/

[^20]: https://www.personos.ai/post/ai-habit-reinforcement-research-insights

[^21]: https://www.linkedin.com/pulse/ai-powered-neuroscience-personalized-habit-formation-lasting-singh-wfv9f

