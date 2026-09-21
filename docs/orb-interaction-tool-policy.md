# Orb conversational tool policy map

Status: local implementation, 2026-09-20; P1–P3 recommendations accepted by Stan’s “continue”. Not deployed.
Scope: all 29 tools in the fully enabled shared operational inventory, not
settings-page actions, arbitrary REST operations, or dormant Realtime tools.
Text, submitted dictation, and live voice share this inventory subject to the
runtime's access and feature filters. Strategic turns expose a smaller set.

Rules U/A/G/J are defined only in the [interaction contract](orb-interaction-contract.md).
The tables describe local code and remaining verification, not a blanket
assertion that authorization is complete or production acceptance passed.

## Confirmed domain changes

These enter shared command preparation/batching on the durable interaction
path. Server-generated proposal text precedes a distinct confirmation event;
the transaction returns a receipt. Permission and expected-state checks must
be exercised in the isolated database, not inferred from a tool description.

| Tool | Current target and validation | Policy and replacement verification |
|---|---|---|
| `create_todo` | Accessible active project; title and due/reminder preparation. | Proposal then confirmation; U/A/G checks on fields, project, single execution, receipt. |
| `update_todo` | Accessible existing todo; expected record state and changed fields. | Proposal then confirmation; stale target, corrections, close behavior and linked-ticket side effects. |
| `delete_todo` | Accessible todo identities, including resolved sets. | Proposal then confirmation; exact set, soft deletion, replay. |
| `move_todo` | Accessible source todo and destination project. | Proposal then confirmation; source/destination permissions and actual resulting identifier. |
| `create_project` | Non-empty name; duplicate/reserved-name checks. | Proposal then confirmation; exact corrected spelling, owner, collision handling. |
| `update_project` | Resolved accessible project; non-empty requested change; expected state. | Proposal then confirmation; ambiguity, stale version, title/description preservation. |
| `delete_project` | Resolved accessible project; expected state; deletion scope in summary. | Proposal then confirmation; exact target and cascade/survival behavior from actual RPCs. |
| `add_knowledge` | Non-empty title/content; accessible project required; server attribution. | Proposal then confirmation; project and content preserved, attribution comes from server. |
| `update_knowledge` | Title resolution and preparation use RLS for non-admins; expected entry fields. | Proposal then confirmation; transaction authorization still requires isolated database evidence. |
| `create_ticket` | Allowed type, bounded summary/detail; reporter is authenticated user. | Proposal then confirmation; receipt identifies stored ticket; notification delivery is separate evidence. |
| `confirm_mutation` | Server pending proposal/batch; actual user input checked by shared authorizer. | It cannot manufacture a proposal. Test current binding, distinct event, expiry, decline, modification, replay and missing receipt. |

Sources: [serial todo preparation](../lib/orb-operations/serial-todos.ts),
[project/knowledge preparation](../lib/orb-mutations.ts),
[batch preparation](../lib/orb-operations/command-batches.ts),
[confirmation](../lib/orb-operations/confirmation.ts),
[latest interrupt RPC definitions](../scripts/migrations/20260916_orb_intentional_interrupts.sql).

## Reads and capability inspection

| Tool | Current access/data path | Validation and reporting to verify |
|---|---|---|
| `query_todos` | Filters the request's loaded todo context. | Exact code/set, status definitions, selected/named scope, completeness. Unknown project must not widen results (P1). |
| `query_projects` | Filters visible context; dormant context is admin-only. | Distinguish all visible projects, dormant projects, and projects with active tasks. |
| `query_users` | Admin gate in dedicated directory handler; role-aware safe fields. | Reject non-admin calls even if a model requests one; preserve super-admin filtering. |
| `query_invitations` | Admin gate, fixed safe fields and allowed status values. | Permission, field minimization, search and bounded results. |
| `query_tickets` | Admin tool filtering plus handler/getTickets enforcement. | Correct ticket domain, filters and current result scope; never treat a ticket code as a todo. |
| `query_db` | Allowlisted root tables; admin client for admins, RLS client otherwise. | Validate select/join exposure, filters, bounds, soft deletion and actor scope. Projection guard allows only documented columns and one-level safe joins; aliases, nested joins, and arbitrary relation fields are rejected. |
| `search_knowledge` | Topic search over loaded context; exact-title resolution/read uses RLS for non-admins. | Disclose truncation; resolve ambiguity; establish intended visibility for exact reads (P1). |
| `query_audit_trail` | RLS for non-admins; optional target/table/action/date filters. | Existing RLS defines visibility; unknown target must fail without returning broader history (P1). |
| `query_repository` | Tool availability and reader check `canInspectRepository`. | Allowed role, requested local/production source, bounded paths/content. |
| `query_capabilities` | Static capability sections, repository visibility parameter. | Returned capability must match exposed runtime tools; no inference of unsupported tools. |
| `get_preferences` | User-scoped RLS query; default definitions if empty. | Own-user access and actual/default values distinguished. |
| `recall_memories` | User-scoped query; memory-off returns empty; expiry filter. | No cross-user/expired memories, and limits/categorization reflected accurately. |

Sources: [shared handlers](../app/actions/orb-converse.ts),
[context loading](../lib/orb-model/context.ts),
[directory reads](../lib/orb-operations/admin-directory.ts),
[database schema](../lib/db-schema.ts), [repository reader](../lib/repository-reader.ts).

## Other effects: do not silently impose universal confirmation

| Tool | Current authority and effect | Proposed policy and evidence |
|---|---|---|
| `client_action` | Sends UI instruction; switch resolves a visible project; other advertised actions are open settings/help, set voice, exit voice. | Keep explicit navigation direct. Distinguish dispatch from acknowledged client success; validate action/target at boundary. |
| `set_dormancy` | Direct projects update; owner filter for non-admins. | Retain direct explicit-request behavior unless Stan chooses otherwise (P2); test current permissions and persistence before success. |
| `set_preference` | Validates known key/value; user-scoped upsert. | Explicit preference requests can authorize direct save. Test invalid values and no extra write from discussion. |
| `save_memory` | User-scoped insert; mode/track/category/content validation, two distinct recorded observations for autonomous saves, exact duplicate lookup, expiry. | Explicit remember requests need no second yes. Evidence is checked in production; relevance of inference and offered-track consent remain model judgments. |
| `propose_adaptation` | Validates fields/category/email; creates proposed row and sends approval email. | Proposal is not activation. Preserve separate approval flow; test notification failure and lack of evidence. |
| `send_to_developer` | Direct admin-client insert into dev channel, using selected product; explicit admin gate before dispatch. | Explicit relay intent can authorize sending, but administrator role is required. Do not claim external delivery from an inserted relay row. |

Sources: [handlers](../app/actions/orb-converse.ts),
[memory/adaptation tool definitions](../lib/orb-prompt.ts),
[client action schema](../lib/orb-contract.ts),
[adaptation approval route](../app/api/orb-adaptation/route.ts).

## Adopted policies and limits

- **P1 — access and scope:** unknown project scopes fail closed; explicit
  knowledge and audit reads use RLS for non-admins; developer relay requires
  administrator access; generic projections constrain root and joined fields.
  Offline helper checks passed; no live unauthorized-disclosure test was run.
- **P2 — direct effects:** preference, dormancy, navigation, and requested
  developer relay remain direct under their access policies. Domain mutations
  retain proposal/confirmation. Client dispatch is not proof of UI completion.
- **P3 — autonomous memory:** retained with server-checked quotes from two
  distinct recorded user messages, mode/expiry checks and exact duplicate lookup.
  Insufficient evidence returns an offer-to-remember instruction. Quote presence
  does not prove an inference; semantic duplicates and offered consent remain
  model judgments. Concurrent identical inserts are not transactionally deduped.

No conversational `delete_knowledge` tool is exposed. The earlier conversational
table inventory overstated that capability; admin UI deletion is not a voice
or text tool. No conversational tools create/edit categories, groups, statuses,
roles, invitations, or user accounts simply because some of those are readable.
