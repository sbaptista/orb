# Orb AI Capability Broker — Stan Decision Worksheet

**Status:** Awaiting Stan's decisions
**Prepared:** 2026-08-07
**Authority:** This worksheet is a decision aid. The authoritative final
decisions and rationale will be copied into section 16 of
`docs/orb-ai-capability-broker-plan.md`.

## What can be decided now

Claude Code completed three review rounds. All architectural contradictions and
review comments are resolved. D2 alone remains blocked on client evidence.

Accepting decisions in this worksheet does **not** authorize implementation.
Under D14, Phases A–E remain blocked until the applicable decisions are recorded
in the plan and Stan changes the plan status to Approved.

### Recommended decision package

- Accept D1 and D3–D17 as proposed below.
- Authorize bounded Phase 0 evidence work that creates no Orb product
  capability or production authority.
- Leave D2 undecided until Phase 0 verifies the real Codex and Claude Code
  authentication and credential-storage paths.
- After that evidence is recorded, decide D2 and determine whether the plan can
  be marked Approved without another architectural review.

Stan may accept that package with exceptions, or decide each item separately.

## Immediate procedural authorization

### P0 — May Phase 0 evidence gathering begin?

**Recommended: Yes.**

This permits Codex and Claude Code to inspect their actual authentication and
credential-storage capabilities. Read-only inspection is preferred. If that is
insufficient, a harmless canary enrollment must be separately approved by Stan,
contain no production authority, and be removed after testing. Phase 0 does not
permit application code, routes, schemas, production credentials, database
mutations, client-guardrail changes, or production changes.

**Stan's decision:**
Yes

**Rationale or constraints:**

## Decisions requiring Stan's judgment now

### D1 — Adopt the capability-broker direction

**Recommended: Yes.** Use bounded capabilities instead of restoring
AI-readable production secrets or making Stan the permanent intermediary.

**Alternative:** retain manual relay indefinitely, or restore secret access.
Manual relay is safer but cumbersome; restoring broad secret access reverses
ORB-375 containment.

**Stan's decision:**
Yes

**Rationale or constraints:**

### D3 — Role of a local broker

**Recommended:** recovery or pilot fallback only. It must never decrypt secrets
into an agent-controlled command.

**Alternative:** make a local broker the primary transport. That increases
same-user process, socket, binary, update, and credential-store exposure.

**Stan's decision:**
Need more explanation.

**Rationale or constraints:**

### D4 — Initial clients

**Recommended:** Codex and Claude Code, separately enrolled, scoped, audited,
and revocable.

**Alternative:** pilot one client first. This reduces initial exposure but does
not prove that the shared design works across both tools.

**Stan's decision:**
Pending (see constraints)

**Rationale or constraints:**
How is this done and enforced? If more tools are added -- which is likely -- how are they enrolled?

### D5 — Initial read capabilities

**Recommended:** bounded Knowledge Repository, todo, and project reads.

**Alternative:** start with fewer read surfaces. Knowledge-only is the smallest
useful pilot; omitting project resolution makes todo operations less reliable.

**Stan's decision:**
bounded Knowledge Repository, todo, and project reads.

**Rationale or constraints:**

### D6 — Initial mutation capabilities

**Recommended:** todo create/update/close and Knowledge create/update. Exclude
delete and project mutation.

**Alternative:** begin read-only and approve each mutation family later. The
recommended rollout already enables these capabilities one at a time after the
read-only pilot.

**Stan's decision:**
todo create/update/close and Knowledge create/update. Exclude
delete and project mutation.

**Rationale or constraints:**

### D7 — Approval policy for allowed mutations

**Recommended:** an explicit instruction from Stan in the AI client is
sufficient for an enabled capability. Require exact targets, idempotency,
before/after receipts, and audit; do not add a second Orb UI confirmation.

**Alternative:** hold every mutation as a proposal until Stan confirms it in
Orb. This provides a stronger human commit boundary but recreates much of the
go-between workflow the broker is meant to remove.

**Stan's decision:**
an explicit instruction from Stan in the AI client is
sufficient for an enabled capability. Require exact targets, idempotency,
before/after receipts, and audit; do not add a second Orb UI confirmation.

**Rationale or constraints:**

### D8 — Todo-close invariant

**Recommended:** while todos, audit, and Knowledge share one database, close
them in one transaction. If Knowledge moves, use a durable pending close and
transactional outbox. Never report closure complete before all required
receipts persist.

**Alternative:** allow eventual best-effort Knowledge creation after closing.
This weakens the existing rule that a closed todo must have resolution notes and
a Knowledge entry.

**Stan's decision:**

**Rationale or constraints:**

### D9 — Credential principle

**Recommended:** one scoped, revocable grant per client and environment, stored
outside repositories; never reuse `ORB_API_SECRET` for this surface.

The principle is decidable now. Phase 0 evidence determines the safe storage and
authentication mechanism later.

**Alternative:** one shared agent credential. This makes attribution and
per-client revocation unreliable and increases blast radius.

**Stan's decision:**

**Rationale or constraints:**

### D10 — Complete Knowledge Repository access

**Recommended:** permit complete owner-authorized cross-project search through
bounded typed tools. Search returns metadata by default; full content requires
an explicit request.

**Alternative:** project-scoped search only. This reduces exposure but breaks
the mandatory cross-project research workflow and can hide relevant prior
decisions.

**Stan's decision:**

**Rationale or constraints:**

### D11 — Initial acceptance test

**Recommended:** Codex creates and verifies one ORB todo, closes it with
resolution notes and a Knowledge entry, then updates and verifies that entry.
Claude Code verifies independently through its own identity, and Stan verifies
the persisted rows through a trusted path outside the broker.

**Alternative:** a read-only acceptance test. That cannot prove mutation,
atomic close, idempotency, attribution, or Knowledge update behavior.

**Stan's decision:**

**Rationale or constraints:**

### D12 — Manual fallback

**Recommended:** retain a documented Stan-operated path for outages or
revocation only, without restoring AI access to secrets.

**Alternative:** no fallback. This makes a broker outage block mandatory work
entirely and creates pressure for improvised secret workarounds.

**Stan's decision:**

**Rationale or constraints:**

### D13 — Production rollout

**Recommended:** read-only pilot first, then enable mutation capabilities one at
a time in this order: todo create, todo update, Knowledge write, todo close.

**Alternative:** enable the complete approved scope at once. This is faster but
makes attribution and rollback harder if the first live test reveals a defect.

**Stan's decision:**

**Rationale or constraints:**

### D14 — Final implementation gate

**Recommended:** no build in Phases A–E until every applicable decision is
Decided and the authoritative plan is Approved. Separately authorized Phase 0
evidence gathering is permitted because it creates no Orb product capability
or production authority and is not implementation.

**Alternative:** allow implementation to begin around unresolved decisions.
That would weaken the controlled planning process and recreate the procedural
deadlock if the exception were not precisely bounded.

**Stan's decision:**

**Rationale or constraints:**

### D15 — Existing shared-secret REST task surface

**Recommended:** coordinate with Helm; retain the existing surface only for
identified non-AI integrations that still require it, otherwise narrow or
deprecate it on an approved schedule after the broker pilot.

This decides policy now. The actual schedule waits until legitimate Helm and
other non-AI consumers are identified.

**Alternative:** leave the shared-secret surface indefinitely. That preserves a
broader bypass beside the broker and weakens the containment objective.

**Stan's decision:**

**Rationale or constraints:**

### D16 — Contract source of truth

**Recommended:** keep the conversational Orb and external-agent declarations
separate because their authorization semantics differ, but map both explicitly
to shared canonical domain services and invariants.

**Alternative:** force both surfaces into one tool declaration. This reduces
schema duplication but risks coupling Realtime/conversational behavior to an
external automation contract with different authority and safety rules.

**Stan's decision:**

**Rationale or constraints:**

### D17 — Tickets

**Recommended:** exclude tickets from the initial broker. Reconsider them only
after the todo/Knowledge pilot and a separate review of reporter-facing safety
and notification behavior.

**Alternative:** add ticket creation now. It expands the first release beyond
the workflows that triggered this plan and introduces reporter-facing side
effects before the core broker is proven.

**Stan's decision:**

**Rationale or constraints:**

## Decision intentionally deferred

### D2 — Primary transport

**Current proposal:** an Orb-hosted remote MCP adapter backed by the
transport-neutral Capability Service.

**Status:** Blocked on Phase 0 evidence. Do not decide yet.

The evidence must verify whether both Codex and Claude Code can authenticate to
remote MCP without exposing reusable bearer material to their general shells,
and whether each client has an acceptable credential-storage boundary. If both
pass, remote MCP remains the recommendation. If either fails, compare the local
broker fallback against the same containment tests before returning D2 to Stan.

## Fast response format

Stan can respond directly in this form:

```text
P0: Approve / Reject / Modify — rationale
D1: Accept / Reject / Modify — rationale
D3: Accept / Reject / Modify — rationale
D4: Accept / Reject / Modify — rationale
D5: Accept / Reject / Modify — rationale
D6: Accept / Reject / Modify — rationale
D7: Accept / Reject / Modify — rationale
D8: Accept / Reject / Modify — rationale
D9: Accept / Reject / Modify — rationale
D10: Accept / Reject / Modify — rationale
D11: Accept / Reject / Modify — rationale
D12: Accept / Reject / Modify — rationale
D13: Accept / Reject / Modify — rationale
D14: Accept / Reject / Modify — rationale
D15: Accept / Reject / Modify — rationale
D16: Accept / Reject / Modify — rationale
D17: Accept / Reject / Modify — rationale
D2: Deferred pending Phase 0 evidence
```

If the recommended package is acceptable without changes, the concise response
is: **“Accept the recommended package and authorize Phase 0.”** Codex will then
record every decision and the package rationale individually in the
authoritative plan; D2 will remain blocked and no implementation will be
authorized.
