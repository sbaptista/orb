# ORB-374 review packet — Gemini Round 1

**Preservation:** Verbatim substantive review packet relayed by Stan. Formatting was normalized to repository Markdown; no substantive comment was omitted or rewritten.
**Imported by:** Codex (GPT-5.6 Sol), 2026-08-03 19:13 HST.

Here is the review packet for ORB-374 (Security Hardening Plan), conducted in strict accordance with the comment protocols defined in Section 16.

## 1. Review Metadata

- **Reviewer:** Gemini (Gemini 1.5 Pro / 2026-08-03 Engine)
- **Review Date/Time:** 2026-08-03 19:11 HST
- **Reviewed Revision:** Working-tree draft / Document Last updated: 2026-08-03 19:00 HST
- **Review Round:** Round 1 (Gemini)

## 2. Review Comments & Findings

### gemini-R1-C1 — Verified Finding

- **Category:** Verified finding
- **Section:** Section 8.3 (A-21) / Section 10 (Phase 1, Step 7)
- **Description:** Canonical agent workflows in AGENTS.md currently rely on command substitution (e.g., psql and curl commands with inline secret variables) that expose raw credentials in the process argument list (ps -ef / ps aux).
- **Evidence:** Verified in findings A-21 and A-22. Process arguments on multi-user systems or local inspection tools can be read by other local accounts depending on host kernel process visibility configuration.
- **Recommendation:** Ensure Phase 1 implementation requires a process-argument canary test (as outlined in Phase 1, Step 7) using a secondary local test account to verify process visibility controls before standardizing brokers that read strictly via environment variables, standard input streams, or secure local socket channels.

### gemini-R1-C2 — Recommendation

- **Category:** Recommendation
- **Section:** Section 7.2 (Tier B / Tier C Operational Footprint) / Section 12 (Performance Targets)
- **Description:** Running a full Node.js / Next.js development server and fast file watchers inside a Linux container on a 16 GB unified memory host (Apple M5) alongside browser instances and multiple AI agents may induce swap activity under heavy load.
- **Evidence:** Section 4.1 records 16 GB unified memory on the primary host with an isolation target allocation of 4–6 GB RAM for Tier B / C environments.
- **Recommendation:** Emphasize strict memory capping during the Tier B pilot phase. Ensure the versioned benchmark script explicitly monitors memory pressure spikes (vm_stat, sysctl -a vm.swapusage) during cold Next.js compilation passes before standardizing the isolated environment.

### gemini-R1-C3 — Recommendation

- **Category:** Recommendation
- **Section:** Section 10 (Phase 0 Containment / Secret Rotation Order) / Section 14
- **Description:** When rotating the 17 exposed credentials, shared API keys and database service-role credentials used by cross-project applications (e.g., Orb, Helm, shared Knowledge Repository) carry a high risk of service disruption if revoked out of sequence.
- **Evidence:** Finding A-03, Section 10 (Phase 0, Step 3), and Section 14 note that Knowledge Repository and Orb API credentials are shared cross-project infrastructure.
- **Recommendation:** Explicitly document the consumer dependency chain in the Phase 0 execution inventory prior to key invalidation: update local vault → deploy updated dependent applications (Orb, Helm, background workers) → verify endpoint functionality → revoke legacy credentials.

### gemini-R1-C4 — Blocker / Policy Decision

- **Category:** Blocker
- **Section:** Section 1 (Decision Sought) / Section 13 (Decisions Required) / Section 14
- **Description:** Pursuant to Section 1 and Section 14, implementation remains hard-blocked. Stan's explicit approval is required before Phase 0 execution or Knowledge Repository persistence can begin.
- **Evidence:** Section 2 and Section 13 confirm that while Stan activated the interim operating restriction on 2026-08-03 at 19:00 HST, the core ORB-374 plan itself is not yet approved for execution.
- **Recommendation:** Keep Phase 0 execution blocked until Stan explicitly signs off on decisions 1–5 in Section 13.

## 3. Summary & Next Steps for Document Maintainer (Codex)

## 4. Protocol Compliance

This packet is formatted per Section 16 for entry into `docs/orb-374-reviews/gemini-r1.md`.

## 5. Action Item for Codex

Import the above comments into Section 16 under Comment dispositions, assign appropriate disposition states, and update any affected document sections accordingly.

## 6. Standing Constraint

Normal AI feature development remains suspended under Stan's active interim restriction until Phase 0 is complete and verified.
