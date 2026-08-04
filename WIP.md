# ORB-374 WIP — AI-tool local-file security hardening

## Current status

Planning document drafted at
`docs/orb-374-ai-tool-local-access-security-plan.md`. No security controls or
application behavior have changed. The required Knowledge Repository search
was attempted twice with the service-role method but is pending because the
current shell cannot resolve the Supabase host.

## Design decisions

- Define the threat model and best practices before judging the current state.
- Separate verified evidence, inference, and untested assumptions throughout.
- Preserve multi-round AI review in an append-only Comments section with tool,
  model, date, time, and timezone on every review round.
- Keep a single document maintainer: other AIs send structured review comments
  to Stan, who passes them to Codex for attributed import and controlled edits.
- Imported Perplexity Round 1 (reviewed the 2026-08-03 17:54 HST draft),
  recorded 17 recommendations and dispositions, and updated the controlled
  plan at 2026-08-03 18:08 HST.
- Imported Claude Code Round 1 (reviewed the 2026-08-03 18:08 HST draft),
  preserved both external review packets under `docs/orb-374-reviews/`, and
  updated the controlled plan at 2026-08-03 18:31 HST.
- Claude's review exposed two Phase 1 structural blockers: shared instructions
  falsely attest to a Claude push gate that is absent in Orb, and mandatory
  curl/psql examples expand secrets into process arguments. The plan now
  requires artifact-tested controls and broker migration without breaking the
  backlog, Knowledge Repository, migration/health, or human-run eval workflows.
- Two decisions remain with Stan: when the proposed interim restriction takes
  effect. Stan approved a local checkpoint commit of the draft/review record;
  that approval does not approve the plan, implementation, or a push.
- Claude offered to run the section 14.1 Knowledge Repository topic search
  through its approved-egress path. Codex recommends accepting that offer now.
- Until Phase 0 acceptance, normal AI development is stopped; only the exact
  controlled containment workflow is permitted. Knowledge Repository downtime
  also defers implementation.
- Do not begin implementation until Stan approves the planning document.
- After approval, persist the approved plan and pertinent review comments to
  the Knowledge Repository before implementation begins.
- Use a three-tier isolation model: restricted native workspace, disposable
  Linux development container, and disposable VM for the highest-risk work.
- Benchmark on the actual M5/10-core/16-GB Mac before selecting resource limits
  or making an isolation tier the normal workflow.
- Treat external media only as an encrypted storage/custody layer. Prefer an
  external USB4/Thunderbolt NVMe SSD for active VM/container disks; do not use
  HDD or SDXC as the active sandbox disk.
- Begin implementation with containment and credential rotation because secret
  values were rendered into an AI-tool transcript during the audit.

## Immediate next steps

1. Present the planning document for Stan's review and multi-round AI comments.
2. Reconcile every comment in the append-only disposition table.
3. After Stan approves the plan, complete the Knowledge Repository search and
   write the approved plan plus comments before implementation.
4. Implement only after both approval gates are complete.
