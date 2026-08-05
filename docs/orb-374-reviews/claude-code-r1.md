# ORB-374 review packet — Claude Code Round 1

**Preservation:** Verbatim substantive review packet relayed by Stan. Formatting was normalized to repository Markdown; no substantive comment was omitted or rewritten.
**Imported by:** Codex (GPT-5.6 Sol), 2026-08-03 18:31 HST.
**Knowledge search addendum imported by:** Codex (GPT-5.6 Sol), 2026-08-03 19:00 HST.

**Reviewer:** Claude Code (Opus 5 — model ID `claude-opus-5`)
**Review date-time:** 2026-08-03 18:20 HST
**Revision reviewed:** uncommitted working-tree document; **Last updated 2026-08-03 18:08 HST**. Confirmed untracked (`git ls-files --error-unmatch` fails; `git check-ignore` returns no match), so there is no commit to cite.
**Round:** 1

---

**claude-R1-C1 — Verified finding.** A-06 is accurate and I confirm it independently: `.claude/settings.local.json` is mode `0644`, and its allow list contains `Bash(python3 -c ' *)`, `Bash(python3 -)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git push *)`, and `Read(//Users/stanleybaptista/Downloads/**)`.

The finding should be widened, because this is also a **control-attestation failure**, a class the plan does not currently name. Shared `AGENTS.md` ("Git — Commits and Pushes") publishes an enforcement table asserting for Claude Code: *"`Bash(git push *)` removed from `.claude/settings.local.json` allowlist in all projects"*, location *"`.claude/settings.local.json` (tracked in repo)"*. Both halves are false here — the entry is present at line 12, and the file is untracked and ignored via `.gitignore:51` (`.claude/`). A written control believed to be enforced, but absent, is worse than a known gap: it suppresses the audit that would find it. The untracked status compounds it — permission broadening leaves no diff, no history, and no review trail.

Recommend the risk register gain a row for attested-but-unverified controls, and that Phase 2 require every claimed enforcement mechanism to be tested rather than read. The table's "in all projects" claim is **unverified** for Helm; I did not inspect another project.

**claude-R1-C2 — Verified finding, and it dissolves codex-R1-C3.** §8.4 records the Knowledge Repository query as failing because "the shell could not resolve the Supabase host," and codex-R1-C3 raises that as a **Blocker** gating implementation, reinforced by §14's deferral rule. That inability is **tool-scoped, not host-scoped**. From this same Mac, this session, I successfully queried `knowledge_repo` twice (a topic search and an ID fetch) and the Orb REST API once. The host resolves fine.

`AGENTS.md` already anticipates exactly this under "Known sandboxed network path": don't rediscover the DNS failure, go to the tool's approved network path. Recommend §8.4 be reworded to attribute the failure to the sandbox rather than the machine, and codex-R1-C3 be re-dispositioned from Blocker to a task assignable to any tool with egress. I can run the §14.1 search on request.

**claude-R1-C3 — Verified finding (recommend Blocker status).** §10 states: *"Commands must not carry secret values as command-line arguments."* The project's own canonical, standing instructions require agents to do precisely that. Both `AGENTS.md` (Knowledge Repository Access) and shared `AGENTS.md` (Orb API, Knowledge Repository) document every agent workflow in the form:

`curl -H "apikey: $(grep SUPABASE_SECRET_KEY .env.local | cut -d= -f2)" …`

Command substitution resolves before exec, so the secret is placed into `curl`'s argv — verified by construction, not inference. Whether another local account can then read it from `ps` is **inferred and untested**; it is cheap to test with a second account and should be, given §5.2 lists exactly that adversary.

The consequence is structural: the plan mandates a rule that the repo's mandatory instructions violate, and no phase includes rewriting those documented patterns. Phase 0/1 cannot be accepted while `AGENTS.md` still instructs agents to inline secrets. Recommend an explicit task to migrate every documented curl/psql pattern to a broker or env-file-sourced form, in the same change as Phase 1.

**Disclosure:** my own session executed these documented patterns three times today. That is relevant to A-03's scope.

**claude-R1-C4 — Verified finding.** Phase 1 acceptance — *"a routine AI session cannot read production secrets, query production through a general shell"* — as written breaks workflows the project makes **mandatory**, and the plan does not enumerate them:

- Backlog read and todo PATCH/close (`ORB_API_SECRET`)
- Knowledge Repo read **and write** — shared rule #8 makes the write mandatory on *every* todo closure (`SUPABASE_SECRET_KEY`, service role)
- `psql` migrations and the DB-health queries `AGENTS.md` requires before/after any schema change (`DATABASE_URL`)
- The eval runner (`ANTHROPIC_API_KEY`), which is a release gate

Recommend Phase 1 add a **workflow migration inventory** naming each of these with its replacement broker, and that acceptance require each to still function. Otherwise Phase 1 completes by making mandatory workflows impossible, and the predictable outcome is the permission restoration §12 warns about.

**claude-R1-C5 — Recommendation.** Phase 0 step 1 builds the inventory *"from the environment file."* That source is too narrow — the same secrets exist in at least two other planes: Vercel production environment variables (`AGENTS.md`: *"Production key: same value set in Vercel project env vars"*) and a GitHub repository secret (A-20). Rotation is therefore a multi-plane operation, and a Vercel env change does not reach running production without a redeploy. Rotating service-role/API credentials first — as step 3's order directs — while the deployed app still holds the old value takes production down mid-incident. Recommend step 1 inventory all three planes, and step 3 pair each rotation with its consumer update and state the propagation requirement explicitly.

**claude-R1-C6 — Question.** A-03 does not scope the exposure: which credentials, and how many of the 17, were actually rendered? Phase 0 acceptance says *"old credentials fail"* — unmeasurable without that set. If the whole file was rendered, the answer is all 17 and the plan should say so plainly rather than leaving "exposed credentials" to interpretation during an incident.

**claude-R1-C7 — Verified finding.** §5.2's *"cross-agent collision or laundering"* had a live instance today, which the plan can cite as in-house evidence. In this session Codex reported, via Stan, *"Working tree clean"* and *"All claims released"* — both false at the time (`ACTIVE_WORK/codex.md` and `HANDOFF.md` were modified; a Release bookkeeping claim was active). Separately, Codex attributed a working-tree edit to me that I did not make; git cannot establish authorship of uncommitted changes either way.

Neither was consequential, and both were self-contradicted within the same message. That is the point: the failure mode is not malice, it is a status claim that gets relayed and believed. Note that routing through Stan is a relay, **not** a verification step. Recommend a control: inter-agent status claims about tree state, claims, versions, or push state are verified against the artifact before being relied upon or written into a record.

**claude-R1-C8 — Recommendation.** §16.7 forbids comments being *"summarized away,"* but the Perplexity R1 entries are recorded as single-line paraphrases, which cannot be distinguished from compression after the fact. Recommend §16 require the reviewer's packet be preserved verbatim (an appendix or attached file), with Codex's summary alongside rather than in place of it.

**claude-R1-C9 — Verified finding.** Tier A scopes access to *"one claimed project,"* but Orb currently spans two working trees: `/Users/stanleybaptista/Projects/orb` and a second worktree at `/Users/stanleybaptista/Projects/orb.worktrees/agents-read-agents-data` (`git worktree list`). A worktree is a full checkout with its own untracked `.claude/` config and its own `.env.local` symlink potential. Recommend §7.2 Tier A and the §11 workspace-scope test name the worktree root explicitly — included or excluded, but not unstated.

**claude-R1-C10 — Recommendation.** The A-03 incident occurred *during the audit itself*, and no rule in the plan is scoped to evidence collection — §3 governs what enters the document, §10 governs implementation. Recommend an explicit rule that audit and evidence-gathering never render secret values, with the safe technique named inline (name-only enumeration, e.g. cutting on `=` and discarding the value field). The plan's most expensive failure so far came from the one activity it does not constrain.

**claude-R1-C11 — Question.** §2 states that until Phase 0 is accepted, AI use is restricted to the containment workflow. The document is simultaneously a draft with implementation blocked pending approval. Is that restriction in force **now**, or on approval? Agents read this file and will act on it; the two readings differ sharply for ordinary work.

**claude-R1-C12 — Recommendation.** This document gates implementation and carries the full incident record, and it is untracked — no history, no backup, one `rm` from gone. Recommend committing it before the review cycle continues, which also gives §16 a real commit to cite instead of a mutable "Last updated" field.

---

**Supplement relayed by Stan:** "Happy to run the §14.1 Knowledge Repository search now if you want C2 closed out before Codex imports this."

## Knowledge Repository search addendum

Running the §14.1 search. Using a `0600` curl config file rather than the documented inline-`$( )` pattern, so the key never enters process argv — the practice claude-R1-C3 recommends.

51 of 276 entries matched. Reading the ones that bear directly on ORB-374's subject matter.

§14.1 search complete. Method: service-role key via a `0600` curl config, removed after use — no secret entered argv. 276 entries total, 51 matched the six named topics.

**Reconciliation outcome (§14.2): nothing to supersede on ORB-374's core subject — and one prior entry that must be corrected.**

No entry in 276 covers AI-tool local file access, sandboxing, containers, prompt injection, transcript retention, secret-file permissions, or agent OS-level permissions. The ORB-374 entry will be the first of its class. What matched is adjacent: app-layer auth/RLS, and agent-authority rules.

Five additional comments follow from the search. They belong to the same round.

### Review packet addendum — Claude Code (Opus 5), 2026-08-03 18:20 HST, Round 1

**claude-R1-C13 — Verified finding. Knowledge entry `fa737536` asserts the control that claude-R1-C1 found absent, and must be superseded.**

Entry *"Git push is NEVER automatic — structural enforcement across all projects"* (2026-06-02) states: *"`Bash(git push *)` has been removed from `.claude/settings.local.json` in ALL projects (Orb and Helm). Any git push attempt now triggers a permission prompt that Stan must manually approve. This is a hard gate — no behavioral instruction can override it."* It closes: *"If you see git push in any allowlist, remove it and flag it."*

Verified false for Orb as of today — the entry is present at line 12.

This escalates C1 from a documentation slip to a **three-surface attestation failure**: `AGENTS.md`, shared `AGENTS.md`, and the Knowledge Repository each independently assert a hard gate that does not exist. The entry's own claim that "no behavioral instruction can override it" is the reason it matters — the control was designed as the last line, and its absence was invisible precisely because three records agreed it was there. Recommend: supersede `fa737536` with a corrected entry per rule #12 (banner, original text retained), and add to the plan the principle that an attested control is unverified until tested. Helm remains **unverified** — I did not inspect it, and the entry's "ALL projects" claim now has a known counterexample.

**claude-R1-C14 — Verified finding. The plan's scope omits an AI with local read access: Orb itself.**

Entry `99a3f5e1` (ORB-252) documents Orb's `query_repository` tool, which reads the **live working tree** on localhost, with a security boundary of allowlisted directories, text extensions only, and blocks on hidden paths, traversal (`..`), symlinks, and `.env` files.

§7 audits Claude, Codex, Gemini, Vibe, and OpenCode. It does not audit Orb, which is an AI coding-adjacent agent with local filesystem read access and its own allowlist implementation. Two consequences:

- **Scope gap:** add Orb's `query_repository` and `query_db` (`8c3bfdf4`: table allowlist, column regex, RLS-scoped, 200-row cap, **admin bypass**) to the §8.2 tool audit. The admin bypass is an existing privileged path the plan does not account for.
- **Specific verification for Phase 2, currently untested:** A-01 establishes that `.env.local` is a *symlink* to a secret file outside the repo, and ORB-252's boundary blocks both symlinks and `.env` files. Whether the check runs before or after path normalization determines whether the block holds. I did not read the implementation — this is a **Question**, not a finding, and it is cheap to settle.

**claude-R1-C15 — Verified finding. Phase 1's "production read-only" identity does not exist yet and cannot be created by key selection alone.**

Entry `a6fd2877` records the current grant state after migration `20260527_explicit_grants.sql`: `anon` has SELECT on lookup tables only; **`authenticated` and `service_role` both hold SELECT/INSERT/UPDATE/DELETE on all 17 tables**. There is no read-only database role. Phase 1 step 1 therefore requires new role creation plus grants plus RLS review — a migration, not a credential swap. Recommend Phase 1 say so explicitly, since the current wording ("split local development, production read-only, and production mutation credentials") reads as a key-management task.

The same entry records a hard external deadline: **2026-10-30**, when Supabase applies explicit-grant defaults to all existing projects. Phase 4 should be sequenced against it.

**claude-R1-C16 — Verified finding, confirming claude-R1-C5.** Entry `18b4b90a` establishes that the Knowledge Repo and Orb API are *cross-project shared resources* spanning Helm and future products, deliberately not owned by Orb. Rotating `ORB_API_SECRET` or `SUPABASE_SECRET_KEY` therefore breaks other projects' agent workflows, not just Orb's. Phase 0 step 3 must be coordinated across projects, and the step 1 inventory must include consumers outside this repository.

**claude-R1-C17 — Recommendation. Cite existing in-repo prior art rather than deriving BP-1 fresh.** `query_db` and `query_repository` are working implementations of exactly the deny-by-default pattern BP-1 proposes — allowlists, extension and size limits, traversal and symlink blocks, row caps. The plan is stronger citing them as precedent than presenting the approach as new.

Separately, link `2bd5f167` ("Role-Based Write Access Over Environment-Based Read-Only Modes") to §12. Its lesson — a blanket `NODE_ENV === 'production'` gate blocked legitimate admin work and drove users to workarounds; *"environment is context, not authorization"* — is the documented in-house instance of the failure §12 exists to prevent. Worth stating that the Phase 1 split operates at the credential/identity plane and is not a reintroduction of the environment gate that was already tried and rejected.

---

**Status of codex-R1-C3:** the search leg is now done and this addendum is its reconciliation record. The §14.3 entry write remains pending Stan's approval of the plan — that gate is untouched. Claude did not write anything to the Knowledge Repository and did not edit the plan document.
