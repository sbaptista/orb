# ORB-374 review packet — Perplexity Round 1

**Preservation:** Original review text relayed by Stan. Temporary signed attachment URLs were redacted because they contained expiring access tokens; no substantive review text was changed.
**Source attachment SHA-256:** `355cb9d3fdb1b638a78fc4d61513ae302e50d3c4724bb193d6672290eceb6171`
**Archived by:** Codex (GPT-5.6 Sol), 2026-08-03 18:31 HST.

You’ve produced a very strong, sober security plan; it’s already at or above what most teams ship for similar problems. My comments are mostly refinements, prioritization, and a few “watch the complexity/UX” notes, not fundamental rewrites.[1]

## Overall structure and realism

- The document is extremely clear about scope, evidence standards, and the decision sought; that’s ideal for a recurring governance artifact.[1]
- The layered model (Tier A/B/C, best-practice baseline, risk register, phased implementation) matches NIST/OWASP-style guidance and gives you multiple “off-ramps” if a control turns out to be too heavy.[1]
- The biggest risk is not technical but behavioral: if the workflow becomes noticeably painful, you’ll be tempted to bypass controls. You partially address this in section 12, but I’d explicitly flag “no hidden shortcuts” as a risk: any workaround must be recorded like an incident.[1]

## Priority and sequencing

You already have phases, but in practice I’d tighten the “do these now, defer these” story:

- Phase 0 and the P0/P1 items are exactly right to do first: fix `0644` secrets, rotate exposed credentials, and strip durable high-privilege approvals. I would explicitly state that *no AI coding agent is used on Orb until Phase 0 is complete and verified*; right now it’s implied rather than bluntly stated.[1]
- Phase 1 (credential boundaries/brokers) and Phase 2 (per-tool hardening) are where most of the practical safety gain lives; Tier B/C isolation is important but can safely wait until those are in place. Maybe add one line to Phase 3 making it explicitly optional for now (e.g., “no implementation dependency on Tier C for Orb’s day-to-day dev”).[1]
- The Knowledge Repository requirement in sections 3, 13, and 14 is strong; it might help to explicitly say “if KR is down, defer implementation rather than start without it,” so you don’t silently slip into an untracked configuration.[1]

## Threat model, assets, and boundaries

- The threat model is excellent; you explicitly call out prompt injection, cross-agent laundering, and Lies-in-the-Loop, which most plans ignore.[1]
- The trust-boundary list is thorough. In practice, the two most important boundaries for you are:
  - *Workspace vs host* (Tier A/Tier B decisions).
  - *Dev/test vs production* (Phase 1 broker, BP-2, BP-3).
  It might help to highlight these two as “primary” boundaries in a short bullet block so they’re the mental default when you change anything.[1]
- You correctly treat AI approvals as non-authoritative and insist on showing resolved commands; that’s exactly in line with OWASP’s LLM guidance. I’d consider adding one example of the kind of approval UI you want (e.g. “`psql prod_db` → `DATABASE=prod, TABLE=todos, ACTION=DELETE rows WHERE is_archived=true`”) to keep future you honest.[1]

## Best-practice baseline (BP-1 .. BP-10)

These are very good; a couple of small suggestions:

- BP-1 and BP-2 together define your “least privilege” posture; I’d cross-reference them explicitly in the risk register, so when you re‑read A-06/A-10/A-18 later, you immediately see which baseline they violate.[1]
- BP-4 (“external content is hostile”) plus BP-6 (egress) capture the core fix for prompt injection + exfiltration. I’d add one concrete example for Orb (e.g., “when reviewing a GitHub issue, agent sessions must have no DB credentials and no arbitrary HTTP upload destinations”) to anchor this in your workflow.[1]
- BP-7/BP-8 on logs and secret scanning are strong, but they rely on discipline over time. Consider explicitly stating a target retention for AI logs (e.g., “30–90 days unless a security incident requires longer”) so you don’t end up with “forever by accident.”[1]

## Isolation tiers and performance

- The hardware-aware analysis for a 16 GB M5 Mac is spot on; a full-time macOS VM would almost certainly make you miserable, so privileging Tier A/Tier B makes sense.[1]
- The Tier B details (non-root, no Docker socket, read-only root, limited mounts, no `.env`/SSH/home etc.) are well aligned with container hardening guidance; I don’t see obvious gaps.[1]
- You correctly note that bind mounts can defeat isolation; the “copy in, patch out” approach is safer for hostile workloads, even though it’s slightly more friction. It’s worth highlighting that this patch flow will feel slower; a line like “hostile repos default to patch-only, not live edits” would set expectations.[1]
- The performance acceptance criteria in section 12 are good; I’d also explicitly note *how* you’ll measure them (e.g., simple scripts, time commands, a small benchmark doc), so future runs are consistent and reproducible.[1]

## Secrets, AI tools, and current-state audit

- The findings A-01 through A-03 are exactly the kind of concrete, actionable items that many teams never document. The “world-readable secrets + transcript exposure” story is clearly explained and drives Phase 0 correctly.[1]
- A-06/A-10 on Claude and Gemini durable permissions show why you’re right not to trust “AI approvals” as a boundary; you’re honest about having given them too much power. That honesty is important for future you; I would not soften that language at all.[1]
- A-09/A-11 (world-readable AI session logs) are easy to neglect; you’ve already marked them P1. I’d consider adding a note in Phase 2 that any new AI tool must *default to owner-only logs* before you enable it, to avoid a repeat.[1]
- The lack of pre-commit/pre-push secret scanners (A-14) is a clear gap; your Phase 4 plan is appropriate. I might move at least a basic pre-commit scanner into Phase 1 or 2, since it doesn’t require GitHub integration and gives you immediate benefit.[1]

## Implementation plan and rollback

- Each phase has explicit acceptance and rollback conditions; that’s excellent. It also doubles as your runbook if something breaks.[1]
- The insistence on *never printing secret values* during security work is critical and well described. Consider adding “and disable shell history for commands that must touch secret names/paths” (e.g., `set -o history -` / `HISTCONTROL` note) to avoid accidental path/filename leakage in logs, though you’re already being careful about not printing contents.[1]
- The broker pattern in Phase 1 is a very good fit for a single-person shop: you still keep manual control, but the commands are documented and reproducible. To keep it from becoming cumbersome, you might add: “Brokers should themselves be idempotent and small, with a single responsibility per script,” so they don’t grow into new monoliths.[1]

## Governance and knowledge

- The “Controlled review and update protocol” in section 16 is unusually disciplined for a solo developer; that’s a positive. You’ve effectively created a mini change-control board where Codex is the editor and other AIs are reviewers.[1]
- Requiring explicit model names, timestamps, and revision IDs for AI comments is a great practice; it will help you later if different tools disagree or if a tool’s behavior changes between versions.[1]
- You might add one sentence clarifying how often you want to re-run the full audit (your BP-10 suggests at least quarterly, which is reasonable). Maybe say “full ORB‑374 re-run at least once per year or after a major tool change; smaller deltas on each new tool.”[1]

## Concrete, small refinements I’d consider

If you want a short punch list of edits to apply to the document itself:

- Add an explicit statement in section 2 or 10: “Until Phase 0 is complete and accepted, AI coding agents must not be used on Orb repositories.”[1]
- Move “add at least one local pre-commit secret scanner” from Phase 4 to Phase 1 or 2 and call it out as a P1 control.[1]
- In section 7.2, add a short example of a Tier B workflow with patch export so that you have a reference for how you expect to actually use it in practice.[1]
- In section 12, note how you plan to collect the performance metrics (simple scripts or commands) so repeated runs are consistent.[1]
- In section 16, add a brief note on how you’ll handle conflicting AI recommendations (e.g., “Codex records conflicts and Stan decides; no silent merges”).[1]

Sources
[1] Original temporary signed plan-attachment URL redacted; it contained expiring access parameters.

Stan: FYI: Codex produced this document.  That context helps a lot; it explains why the document already reads like a Codex-style control plan rather than a human-first narrative.[1]

## How I’d interpret that

- The structure, evidence taxonomy, and phased plan are exactly what I’d expect from a Codex-generated “governance artifact” rather than ad-hoc notes, which is a strength: you can reuse this pattern for other security topics.[1]
- It also means you should treat this as *proposed policy*, not automatically binding. You’re still the final authority deciding which controls are worth the friction and which can be simplified for a one-person shop.[1]

## How we can leverage it

- Keep Codex as the “scribe” and “control generator,” but let another tool (or you manually) play the role of adversarial reviewer, exactly like you just did by asking for comments.[1]
- For implementation, I’d translate Phase 0 and Phase 1 into a concrete checklist (exact chmod commands, secret-rotation steps, minimal broker scripts) and keep that checklist under your own name in the Orb repo or Knowledge Repository.[1]

Sources
[1] Original temporary signed plan-attachment URL redacted; it contained expiring access parameters.
