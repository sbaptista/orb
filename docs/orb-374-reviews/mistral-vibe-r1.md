# ORB-374 review packet — Mistral Vibe Round 1

**Preservation:** Verbatim substantive review packet relayed by Stan. Formatting was normalized to repository Markdown; no substantive comment was omitted or rewritten.
**Imported by:** Codex (GPT-5.6 Sol), 2026-08-03 19:29 HST.
**Timestamp note:** The reviewer-supplied 20:15 HST timestamp was 46 minutes later than the importing system's 19:29 HST clock. It is preserved as supplied; the discrepancy is unresolved.
**Revision note:** Commit `8984117` is the earlier checkpoint baseline, not the uncommitted 19:13 HST working-tree revision. Both identifiers are preserved below as supplied.

**Mistral Vibe (mistral-medium-3.5) — 2026-08-03 20:15 HST — Round 1**

**Revision reviewed:** working-tree draft; document Last updated **2026-08-03 19:13 HST** (commit `8984117`).

---

## Comments

**mistral-R1-C1 — Recommendation:**
Section 2 (Executive finding) states “Secret values from that file were rendered into an AI-tool transcript during the audit.” Clarify *which* AI tool(s) and *how many times* this occurred, and whether the transcript is stored on the same Mac or in a cloud service. The current phrasing implies one event, but the risk calculus differs if this was repeated across multiple tools or sessions.

**mistral-R1-C2 — Verified finding:**
Section 8.2, A-22 documents that canonical agent commands expose secrets in process arguments via command substitution. However, section 13 (Decisions required) decision 2 asks Stan to choose a secret store, but does not explicitly require that the *interim* Phase 0 containment work (credential rotation) itself use a secure method that avoids command-line exposure. The interim must not re-create the same vulnerability it is meant to fix.

**mistral-R1-C3 — Recommendation:**
Section 5.4 cites OWASP guidance on prompt injection and approval forgery. Explicitly cite that the same OWASP material warns that *approval dialogs generated from model-influenced context can be forged*, and therefore the trusted approval gate (BP-3) must display the *resolved* action using code that is not itself subject to the same model influence. The current text implies this but should state it directly for completeness.

**mistral-R1-C4 — Verified finding:**
Section 8.3, A-26 identifies the missing production read-only database identity. The plan states this must be created via a reviewed migration. Add an explicit task to verify that the new identity *cannot* be escalated (e.g., via `SET ROLE` or inherited privileges) and that its grants are revoked if the underlying role membership changes.

**mistral-R1-C5 — Inference:**
Section 7.2 defines Tier A as “workspace read/write only within the exact claimed worktree root” with `/Users/stanleybaptista/Projects/orb` as the example. The current Orb setup has two registered worktrees (A-23). The plan should explicitly state whether Tier A covers *both* worktrees or only the primary, and how a tool claims access to a secondary worktree without broadening its trust boundary.

**mistral-R1-C6 — Recommendation:**
Section 10 (Phase 0) step 3 requires rotating every secret-bearing credential in dependency-safe order. Add a verification step that *after* rotation, no application, script, or workflow fails silently or falls back to a default/legacy credential path that re-introduces the old value.

**mistral-R1-C7 — Question:**
Section 12 (Performance and usability acceptance) proposes thresholds but does not specify *how* performance will be measured (e.g., which benchmarking tools, scripts, or commands). Given the emphasis on repeatable measurement in 7.4, add a reference to the versioned benchmark script that will be used, or state that one must be created in Phase 3.

**mistral-R1-C8 — Recommendation:**
Section 11 (Verification matrix) lists “Transcript privacy” with a negative test that “Other local test account cannot traverse/read records.” Explicitly add a test that *no* secret value appears in any transcript, log, or cache file controlled by the AI tools, using harmless canaries.

**mistral-R1-C9 — Inference:**
Section 6 (BP-10) includes “Re-audit on AI-tool installation/update.” The plan does not specify *who* is responsible for performing these re-audits or how they are triggered. Recommend adding a clear ownership statement (e.g., “Codex as maintainer” or “Stan”) to avoid silent drift.

**mistral-R1-C10 — Verified finding:**
Section 8.2, A-25 notes Orb’s `query_db` for admins uses the service-role admin client, bypassing RLS. The risk register (section 9) correctly flags this, but the verification matrix (section 11) for Orb database reader should explicitly test that a non-admin user *cannot* use the admin bypass path and that the admin path is audit-logged.

---
