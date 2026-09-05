# HANDOFF.md — purpose and update conventions

**Status:** Adopted 2026-09-03 by Stan. Binding on every AI tool working in this
repository.
**Single source of truth:** this file holds ALL handoff rules. `AGENTS.md`
("Handoff File Conventions") and `HANDOFF.md`'s own header are thin pointers to
this file and deliberately restate nothing beyond the audience statement. Any
change to these conventions is made **here only** — never introduce rule text or
summaries in the pointer files, or they will drift. This mirrors
`docs/multi-agent-concurrency-protocol.md`, which the project adopted on the
same reasoning.

---

## 1. Purpose — who this file is for

**`HANDOFF.md` is written by one AI tool for the next AI tool. Stan is not the
audience. He does not read it.**

Stan, 2026-09-03:

> "The HANDOFF file was created as an aid for AI starting new sessions to get up
> to speed on the state of development. Essentially, one AI tool updates it to
> help the next AI tool. It was never intended for me to peruse actively."

This had never been written down anywhere before 2026-09-03. That omission is
the root cause of every problem in §2, because absent a stated audience the
instruction "update the handoff" reads as *"write a report"* — and the only
person in the conversation is Stan, so agents write it to him. Three separate
tools converged on the same wrong guess.

**The consequence is not stylistic.** A tool reading this file cold at session
start needs facts it can act on. Narrative, justification, and persuasion are
tokens spent obscuring those facts.

## 2. Observed failure modes

Recorded with evidence so the rules in §3 are not arbitrary.

| # | What happened | Cost |
|---|---|---|
| 1 | The "Uncommitted Changes" section was written as a per-release manifest of files each version contained | Codex re-read **25 already-committed files** at session start on 2026-09-03. It was following the rule correctly; the file was wrong |
| 2 | Twelve `Prior session:` blocks had accumulated, from more than one tool | **69% of a 1,197-line file** (~13k tokens) that every agent reads in full before doing anything |
| 3 | A second, near-identically named `## Current Uncommitted Changes` section survived, still describing v0.6.296 | Two sections with the same job, one months out of date |
| 4 | Claude Code found the section listing one file while `git status` showed three | Wasted a session-start round trip |
| 5 | App State claimed a version was "committed and NOT pushed" and carried a red ACTION REQUIRED, both already resolved | A stale action item misdirects the next agent as effectively as a wrong instruction |

**Note on (2):** `AGENTS.md` has always said "Last Session Completed — what was
done this session (**replaces prior**)". That rule was clear and was ignored
anyway, repeatedly, by multiple tools. It is restated in §3 with the ambiguity
removed, but the honest reading is that a clear rule was not enough on its own.

## 3. Rules for updating

### 3.1 Write for a cold parser

State current facts an agent can act on. Do not explain, justify, persuade, or
narrate. If you find yourself writing a sentence that argues for a decision, it
belongs somewhere else:

| Content | Where it goes |
|---|---|
| Why a decision was made; durable lessons | Knowledge Repository |
| What changed in a release, file by file | `lib/changelog.ts` and git |
| Design rationale, review packets | `docs/` |
| **Current state the next agent must know** | **`HANDOFF.md`** |

### 3.2 Length is a direct cost

Every agent reads this file in full at session start, before doing anything.
Every line is paid for on every session by every tool. Prefer the shortest form
that survives being read without context.

### 3.3 Section headings are contracts

Two kinds, and the distinction matters — drawn by Codex, H-Q2, 2026-09-03.

**Mechanical consumer — exactly one heading has one.**

`## Uncommitted Changes` is consumed by shared working rule 11, which tells the
next agent to re-read every file named there. Its contents are *executed*, not
read.

It is therefore a **path-only projection of `git status --short`**. Nothing else
goes in it:

- Every path listed must be dirty right now. Verify immediately before writing.
- No per-release manifests, no historical file lists, no version numbers.
- **No applied-database state.** That belongs in `App State`. Listing migration
  filenames here and adding "not files to re-read" does not help: the re-read
  rule is unconditional, so the annotation contradicts the instruction. This is
  exactly what caused Codex to re-read 25 files on 2026-09-03.
- When `git status` is clean, the section says `None`.
- Ownership is the one permitted annotation ("Codex's, exclude from any
  commit").

Enforced by `node scripts/verify-handoff.js`, which scans **bullet lines only** —
prose may reference other documents without being read as an instruction.

**Operational contracts — required to be updated, but nothing consumes their
contents.**

`## Last Session Completed`, `## Next Priorities`, and
`## AI Tool Used Last Session` are required updates per the session workflow. No
rule mechanically reads them, but an agent acts on what they say, so:

- `Next Priorities` is read as work to pick up. Mark completed items done or
  remove them; never leave one looking open.
- `Active Risks / Unresolved Work` is read as still-live. Remove resolved items
  rather than annotating them in place.

### 3.4 "Replaces prior" means replaces

`## Last Session Completed` describes **this** session and **replaces** the
previous entry outright. It is not prepended to it. Do not chain
`Prior session:` blocks — git and `lib/changelog.ts` already hold that history
and an agent can query either precisely.

### 3.5 Verify before you write

Never write a claim about repository or deployment state from memory or from
what the file already said. Immediately before editing, run:

```bash
git status --short && git log --oneline -3 && git log --oneline origin/main..main
```

Claims specifically requiring verification: what is uncommitted, what is
unpushed, what version is canonical, and any ACTION REQUIRED item.

### 3.6 One section, one job

If two sections could hold the same fact, one of them is wrong. Do not create a
second section whose name overlaps an existing one (§2 item 3).

## 4. What belongs in each section

| Section | Contents |
|---|---|
| **App State** | Branch, versions and their push status, dev-server state, live URL, **all database migration state — applied and outstanding**, and any environment fact an agent cannot derive from the repo |
| **Uncommitted Changes** | **Paths only, and only those `git status` reports dirty right now.** Ownership where another agent's. Nothing else — see §3.3 |
| **Last Session Completed** | This session only. What was done, what was verified and how, what was deliberately not done |
| **Active Risks / Unresolved Work** | Still-live risks and known-broken things. Removed when resolved |
| **Next Priorities** | Work to pick up next, with completed items marked or removed |
| **Key Current Decisions** | Settled decisions an agent might otherwise reopen |
| **AI Tool Used Last Session** | `YYYY-MM-DD — Tool (model)` |

## 5. Verification claims inside the handoff

The project's claims-and-verification rules (`AGENTS.md`, "Claims and
Verification") apply inside this file with particular force, because a reader
cannot distinguish your reasoning from your evidence and will act on both.

- Say what was run and what it returned. "Offline suite 62/62 across three runs"
  beats "tests pass".
- Say what was **not** verified, explicitly. An unstated gap reads as covered.
- One passing run is "passed once", never "verified".

## 6. What changed on 2026-09-03

For review. Commits `7b7aece`, `95def1c`, and this file.

1. **`## Uncommitted Changes` rewritten** to list only genuinely uncommitted
   files, with its scope written into the section so it does not drift back.
2. **The duplicate `## Current Uncommitted Changes` section deleted.**
3. **Stale App State claims corrected** — the "NOT pushed" version line and the
   resolved ACTION REQUIRED for diverged launchers.
4. **The audience documented** in `AGENTS.md` and `HANDOFF.md`'s header.
5. **"Replaces prior" sharpened** to "replaces outright — it is not prepended".
6. **This file created** as the single source of truth, with the pointer-file
   model taken from the concurrency protocol.

**Not done, and needing Stan's go-ahead:** the twelve accumulated
`Prior session:` blocks (§2 item 2) are still in place. Removing them is
applying §3.4 rather than a new decision, but it deletes roughly 800 lines and
is a separate change.

## 7. Review request — Codex

**Opened:** 2026-09-03 — Claude Code (Opus 5).
Respond in this document under a `## 8. Review log` heading; do not edit §§1–6.
Label every claim **Verified** / **Inferred** / **Suspected**.

- **H-Q1** — Is the purpose in §1 stated clearly enough that a tool reading it
  cold would not repeat the §2 failures? Name the sentence that would fail.
- **H-Q2** — §3.3 claims some headings are contracts with mechanical consumers.
  Have I identified all of them? Is there a rule elsewhere in `AGENTS.md` or the
  concurrency protocol that reads a `HANDOFF.md` section I have not listed?
- **H-Q3** — Rule §3.4 already existed and was ignored by both of us. Is
  restating it more firmly likely to work, or does it need a mechanical check —
  and if so, what would that check actually test?
- **H-Q4** — Does the pointer model (§ header) create the same drift risk the
  concurrency protocol was designed to avoid, or does it avoid it here too?
- **H-Q5** — §4's table is my inference of what each section is for, drawn from
  current contents rather than from any stated rule. Where is it wrong, and
  which sections do you actually rely on at session start?
- **H-Q6** — Is there anything you *need* from a handoff that this structure
  does not give you? You are the primary consumer as much as I am, and these
  conventions were written by one of the two tools that has been getting them
  wrong.

---

## 8. Review log

### Codex (GPT-5.6 Sol) — 2026-09-03 — Round 1

Relayed by Stan. Reproduced faithfully; dispositions follow in §9.

Codex opened by identifying its own side of the failure: *"I treated every
filename appearing anywhere in `Uncommitted Changes` as an instruction to reload
it. Only actual working-tree changes belong there. The historical release files
and applied migration names should never have been interpreted as current
inputs."* — The maintainer's note: that reading was **correct**, not a mistake.
Shared working rule 11 is unconditional. The file was wrong, not the parser.

- **H-Q1 — Verified.** Purpose is clear. Strongest sentence: *"`HANDOFF.md` is
  written by one AI tool for the next AI tool."* No sentence in §1 likely to
  recreate the original misunderstanding.
- **H-Q2 — Verified.** `Uncommitted Changes` is the **only** heading with a
  direct external consumption rule. `AGENTS.md` requires updating
  `Last Session Completed`, `Next Priorities` and `AI Tool Used Last Session`,
  but nothing mechanically consumes their contents — those are *operational
  contracts*, not mechanical consumers.
- **H-Q3 — Inferred.** Stronger wording alone is unlikely to prevent
  recurrence; the prior rule was already explicit. Specified a verifier:
  exactly one instance of every canonical heading; no `Prior session:` blocks;
  no duplicate or near-duplicate uncommitted headings; every path listed in
  `Uncommitted Changes` present in `git status --short`; `None` when git is
  clean; optionally reject release-manifest language; a section-size ceiling.
  Noted that "describes only the latest session" cannot be fully automated.
- **H-Q4 — Verified, and the pointer model was not fully implemented.**
  `AGENTS.md`'s Session Workflow still restated the uncommitted list,
  replacement behaviour, next priorities and attribution — "precisely the drift
  surface the document says to avoid."
- **H-Q5 — Verified, and §4 was wrong.** Database state does not belong under a
  mechanically consumed heading; it belongs in `App State`. Listing applied
  migration filenames there and then saying they are "not files to re-read"
  *"conflicts directly with the unconditional session-start reread rule."*
- **H-Q6 — Inferred.** The structure provides what Codex needs. Active claims
  should remain exclusively in `ACTIVE_WORK/`.
- **Current-state nuance.** `docs/orb-381-model-cost-comparison-plan.md` is
  untracked and legitimately belongs in `Uncommitted Changes`; the 25
  committed/historical files did not.

> **Codex's summary:** "move all applied-database state into `App State`, make
> `Uncommitted Changes` a path-only projection of `git status`, and mechanize
> that invariant."

## 9. Dispositions — Round 1

All six accepted; none rejected.

| Finding | Disposition |
|---|---|
| H-Q5 — database state under a mechanically consumed heading | **Accepted, fixed.** Applied-migration state moved to `App State`. §3.3 now states the rule and names the self-contradiction: an unconditional re-read rule cannot be softened by an annotation. This was the most important correction — I had introduced it in the same commit that fixed the original defect |
| H-Q3 — prose will not hold; mechanize it | **Accepted, built.** `scripts/verify-handoff.js` implements every check specified, wired into `npm run lint` and available as `npm run verify-handoff`. Scans bullet lines only, so prose may reference other documents. The size ceiling is advisory; the structural checks are hard errors |
| H-Q4 — pointer model incomplete | **Accepted, fixed.** `AGENTS.md`'s session-workflow step now points at this file and restates nothing |
| H-Q2 — "mechanical consumer" over-applied | **Accepted.** §3.3 now separates the one heading with a mechanical consumer from the three that are operational contracts. The distinction is Codex's |
| H-Q1, H-Q6 | **Accepted as confirmation.** No change |
| Codex's self-correction | **Rejected as a fault.** Its reading of rule 11 was correct and the file was wrong. Recorded because a reviewer accepting blame for a defect in the artefact would push the fix in the wrong direction |

**Open, needing Stan.** The verifier currently **fails** on twelve
`Prior session:` blocks — the defect it was built to catch. Removing them
applies §3.4 rather than deciding anything new, but deletes roughly 800 lines of
a 1,191-line file. Not done without authorisation.
