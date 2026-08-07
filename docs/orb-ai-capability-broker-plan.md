# Orb AI Capability Broker Plan

**Status:** Draft for multi-AI review — not approved for implementation
**Document owner and final decision-maker:** Stan
**Current document maintainer:** Codex
**Created:** 2026-08-07
**Last updated:** 2026-08-07 10:54 HST
**Related:** `docs/orb-374-ai-tool-local-access-security-plan.md`, `docs/security-hardening-phase-1.md`

## 1. Decision sought

Approve a safe operational interface through which Codex, Claude Code, and
later explicitly approved AI clients can perform narrowly defined Orb work
without receiving or reading production credentials.

The immediate workflows to restore are:

1. Search and read the complete Knowledge Repository at task start.
2. Query and create todos.
3. Update and close todos under Orb's existing domain rules.
4. Create and update Knowledge Repository entries, including the mandatory
   entry written when a todo is closed.

This document is the controlled planning record. Review comments, their
dispositions, and Stan's final decisions must be recorded here. The existence
of this draft does not authorize implementation.

## 2. Problem statement

ORB-375 correctly removed the shared plaintext environment from AI-readable
repository paths. That containment also removed the only practical path agents
had used for mandatory operations: the Orb API secret, Supabase service-role
reads and writes, and direct database access. The predictable result has now
been observed: agents try browser sessions, localhost sessions, shell
workarounds, or ask Stan to relay content manually.

The two obvious responses are both incomplete:

- Making Stan the permanent intermediary preserves credential secrecy but
  makes routine, mandatory operations slow and error-prone.
- Restoring environment-variable access restores convenience by recreating
  the exposure ORB-375 was built to remove.

The required model is **capabilities without credentials**: agents receive a
small typed operation surface, while a trusted service resolves identity,
holds credentials, enforces authorization, executes the operation, and returns
only bounded results.

This is the workflow-migration requirement already identified by ORB-374. It
is a focused continuation of that security design, not a replacement for it.

## 3. Evidence and current state

### Verified

- `.env.local` is intentionally absent from the repository and the current
  Codex process does not inherit the encrypted runtime environment.
- Orb's Realtime and production server can still use their server-side secrets;
  the access failure is in external AI-tool workflows, not Orb's deployed
  application runtime.
- The existing REST task API authenticates with a shared `ORB_API_SECRET`.
- Mandatory Knowledge Repository instructions require the Supabase service-role
  key so reads bypass RLS and see the complete cross-project repository.
- Existing instructions expand secrets into command arguments for `curl` and
  `psql`; ORB-374 records that as a blocker requiring broker migration.
- Current tool sessions may have restricted filesystem and network access but
  those restrictions differ by tool and are not an application authorization
  model.
- During the triggering session, Codex could not create the requested todo:
  the production in-app browser was unauthenticated and the agent did not have
  the Orb API credential. No todo was created.

### Inferred

- Without a supported replacement, the pressure to restore broad secret access
  or rely on undocumented workarounds will grow.
- A single interface shared by AI clients will reduce policy drift relative to
  per-tool shell scripts.

### Not yet verified

- Which current Codex and Claude Code credential stores are inaccessible to
  their general-purpose shells on this Mac.
- Whether both clients can use the same remote MCP authentication mechanism
  without exposing bearer material to the model or shell.
- Whether a local broker or remote MCP adapter provides the best balance of
  security, reliability, maintenance, and interaction cost.

## 4. Goals and non-goals

### Goals

- Preserve the secret containment achieved by ORB-375.
- Restore mandatory agent workflows without making Stan copy data between
  systems.
- Give every AI client its own revocable identity and least-privilege scopes.
- Enforce Orb domain invariants in server-owned code, not in prompts or client
  wrappers.
- Return structured, bounded, attributable results.
- Keep consequential actions auditable and fail closed.
- Use the same domain services for web, conversational Orb, REST, and the new
  capability interface wherever their authorization semantics match.
- Make adding a future client an explicit enrollment decision rather than
  sharing a universal secret.

### Non-goals

- General Supabase access, raw SQL, arbitrary HTTP, or arbitrary shell access.
- Giving agents Vercel, provider-admin, database-owner, or credential-rotation
  authority.
- Replacing the human-run dev launcher or eval workflow.
- Solving all ORB-374 isolation work in this project.
- Treating a prompt instruction as a security boundary.
- Letting a capability caller supply an arbitrary destination, table, query, or
  executable command.

## 5. Threat model

Protect:

- Supabase service-role and database credentials.
- Orb API and provider credentials.
- Cross-project Knowledge Repository contents.
- User todo/project data and mutation integrity.
- Audit history and AI attribution.
- Stan's ability to revoke one client without breaking every other client.

Defend against:

- A model or untrusted document asking the agent to reveal or transmit a key.
- A client shell reading a credential store, environment, process argument,
  temporary file, log, or inherited child environment.
- A compromised client using a broad credential outside Orb.
- A confused agent widening project scope or mutating the wrong record.
- Replay, duplicate submission, stale-state mutation, and false success.
- One AI client impersonating another.
- A generic escape hatch hidden behind a nominally safe broker.
- Operational failure that encourages a return to the shared environment file.

Security premise: the broker is an authorization and execution boundary. The
model chooses from declared operations; trusted code resolves identity,
validates exact targets, applies authorization and domain rules, and records
the result.

## 6. Proposed architecture

### 6.1 Separate the domain service from its transports

Build one **Orb Capability Service** inside Orb's trusted server boundary. It
owns schemas, authorization, domain dispatch, idempotency, auditing, and
sanitized results. Transports are adapters:

```text
Codex ──────┐
            ├── authenticated MCP adapter ── Orb Capability Service ── domain services ── database
Claude Code ┘

Stan/human ─── optional recovery CLI ─────── Orb Capability Service
```

The MCP adapter must not implement database logic independently. The optional
CLI is a recovery and administration surface, not the normal agent path.

### 6.2 Recommended primary transport

**Proposed:** a remotely hosted Orb MCP endpoint backed by the Orb Capability
Service.

Reasons:

- Both AI clients receive the same typed contract.
- Production credentials remain only in Orb's deployed server environment.
- The model does not need filesystem access to a secret bundle.
- Per-client revocation, scopes, rate limits, and audit are centralized.
- Schema and domain-rule changes ship with Orb rather than separate local
  binaries.
- It avoids turning the browser UI into an automation API.

This recommendation remains pending until client authentication and credential
storage are verified on both Codex and Claude Code. If either client exposes
its MCP credential to the general shell, that credential must still be narrowly
scoped, short-lived where practical, and unable to call anything outside the
Capability Service.

### 6.3 Local broker alternative

A local daemon or compiled CLI can be used if the remote MCP authentication
path is unsuitable. It must live outside AI-writable roots, retrieve credentials
from a human-controlled store, expose only fixed typed methods, bind only to an
owner-protected local socket, and never place secret values in argv, inherited
environment, stdout, stderr, logs, or temporary files.

A wrapper that merely decrypts the existing environment and launches an
agent-controlled command is explicitly rejected.

### 6.4 Human fallback

Stan may always perform an operation manually. Manual relay is the documented
emergency fallback when the Capability Service is down or a client is revoked;
it is not the normal workflow and is not an acceptance substitute.

## 7. Identity, authentication, and authorization

### 7.1 Client identity

Each enrolled client receives a distinct server-side identity, initially:

- `codex`
- `claude_code`

The durable record should include owner user, client name, granted scopes,
environment, creation, expiry, revocation, last-use timestamp, and credential
fingerprint/hash. Raw credentials are never stored in Orb tables.

The service records both:

- the authenticated human owner whose data authority is being exercised; and
- the AI client/tool identity performing the operation.

Model name/version is supplied as attribution metadata and recorded, but is not
trusted for authorization.

### 7.2 Proposed scopes

| Scope | Operations |
|---|---|
| `knowledge:read` | Search and read bounded Knowledge Repository results across the owner's permitted scope |
| `knowledge:write` | Create and update entries; no delete |
| `todos:read` | Query exact or bounded lists |
| `todos:create` | Create a todo in an allowed project |
| `todos:update` | Update allowed mutable fields and move only when both projects are authorized |
| `todos:close` | Close through the canonical transaction requiring resolution notes and Knowledge entry |
| `projects:read` | Resolve project names/codes and permitted project metadata |

No initial scope grants project mutation, todo deletion, raw database reads,
schema changes, user administration, deployment, provider administration, or
credential operations.

### 7.3 Authorization rules

- Authorization derives from authenticated identity and scopes, never
  `NODE_ENV`, client-supplied role names, or model claims.
- Project names/codes are resolved server-side to exact permitted rows.
- Ambiguity fails closed and returns candidates only when safe.
- All list/search operations have server-set limits and pagination.
- Todo close uses the canonical transactional dispatcher so resolution notes,
  status, audit, and Knowledge Repository creation succeed atomically or not at
  all.
- Knowledge update resolves an exact stored entry and preserves attribution.
- Every mutation accepts an idempotency key and returns the stored receipt on
  replay.
- Stale target versions fail rather than silently overwriting newer work.

### 7.4 Consequential-action approval

This is a required Stan decision. Proposed initial policy:

- Reads: execute without an additional prompt.
- Todo creation: execute when the client invokes the tool in response to an
  explicit user request; audit and idempotency are mandatory.
- Todo update and Knowledge create/update: same policy initially, with exact
  before/after receipt.
- Todo close: execute only through the dedicated close operation with mandatory
  resolution notes and Knowledge entry; no generic status update may close.
- Delete, project mutation, schema mutation, credential change, external
  message, push, or deploy: unavailable, not merely confirmation-gated.

Alternative under review: make every mutation a server-held proposal requiring
a trusted Orb UI confirmation. This is safer but recreates some of the
go-between friction the project is intended to remove.

## 8. Initial capability contract

The names below describe the intended semantic contract; exact MCP naming is
decided during schema review.

### `knowledge_search`

Input: topic query, optional product code, limit/cursor.
Output: bounded entry summaries with stable IDs, titles, product, timestamps,
tags, and content only when requested.
Rules: uses the trusted server path needed for complete authorized results;
never exposes a service-role credential or generic table query.

### `knowledge_read`

Input: stable ID or exact/unique title reference.
Output: one entry or a structured ambiguity/not-found result.

### `knowledge_create`

Input: product, title, content, tags, idempotency key, attribution metadata.
Output: stored entry ID and canonical receipt.

### `knowledge_update`

Input: stable ID or uniquely resolved title, replacement fields, expected
version/updated timestamp, idempotency key, attribution metadata.
Output: before/after summary and canonical receipt.
Rules: no delete; stale updates fail; same-topic curation/supersession remains
an explicit domain behavior rather than free-form client SQL.

### `todos_query`

Input: exact code or bounded product/status/text filters and cursor.
Output: exact or bounded todo results.
Rules: server resolves product scope and enforces valid statuses/fields.

### `todo_create`

Input: project name/code, title, optional supported fields, idempotency key,
attribution metadata.
Output: permanent UUID, current project-code/number address, stored fields, and
canonical receipt.

### `todo_update`

Input: UUID or exact current code, supported changes, expected version,
idempotency key, attribution metadata.
Output: before/after summary and canonical receipt.
Rules: cannot set closed status; immutable fields remain immutable.

### `todo_close`

Input: UUID or exact code, resolution notes, Knowledge title/content/tags,
expected version, idempotency key, attribution metadata.
Output: closed todo receipt plus created Knowledge entry receipt.
Rules: one transaction; first line attribution is added by trusted code; no
client can bypass the Knowledge entry.

## 9. Data, audit, and error behavior

Every request records:

- correlation/request ID and idempotency key;
- authenticated owner and client identity;
- declared tool/model attribution;
- capability and resolved scope;
- target stable IDs, never credentials;
- start/end time, duration, outcome, error category, and receipt ID;
- mutation before/after fields appropriate for Orb's audit policy.

Do not record raw credentials, authorization headers, full prompts, unrelated
conversation history, or secret-bearing environment values.

Errors are typed: unauthenticated, unauthorized scope, invalid input,
ambiguous target, not found, stale target, rate limited, unavailable, and
internal failure. Internal database/provider text is logged only in the trusted
server plane and is sanitized before returning to the client.

The client must never infer success from HTTP/MCP transport success. A mutation
is successful only when the response contains the canonical persisted receipt.

## 10. Credential lifecycle and containment

- One credential or OAuth grant per client and environment.
- No shared `ORB_API_SECRET` for the new surface.
- Credential material is shown only once during human enrollment and stored by
  an approved client credential mechanism, not in the repository.
- Server stores only a verifier/hash or OAuth grant state.
- Grants expire or are periodically renewed; Stan can revoke one client.
- Rotation overlaps old/new grants only for a bounded migration window.
- Revoked credentials are tested to fail; active credentials are tested to
  succeed, so a reject-everything guard cannot pass as working.
- No capability credential grants direct Supabase, Vercel, provider, or generic
  Orb REST access.

## 11. Performance and reliability

Instrumentation is required because this adds authenticated network operations
and server/database paths. Record per-capability latency, outcome, client,
environment, and result count without argument contents. Update Part 2 of
`docs/object-capability-matrix.md` with the new agent-operation flow.

Proposed initial service targets, subject to measured baseline:

- Warm reads: p50 under 500 ms and p95 under 1.5 s.
- Single-record mutations: p50 under 750 ms and p95 under 2 s.
- No retry may duplicate a mutation.
- A broker outage fails clearly and does not trigger browser or shell fallback.
- Rate limiting is per owner, client, and capability rather than one universal
  bucket.

## 12. Implementation phases

Implementation is blocked until Stan marks the relevant decisions in section
16 as decided and changes this document's status to approved.

### Phase A — Contract and security harness

- Freeze initial capabilities and schemas.
- Decide primary transport and authentication after verifying both clients.
- Define agent identities, scopes, idempotency, receipts, and audit schema.
- Add harmless-canary tests for credential exposure through config, argv,
  environment, logs, temp files, child processes, and local sockets where
  applicable.
- Establish negative tests before enabling production mutation.

### Phase B — Shared domain service

- Extract or reuse canonical project resolution, todo create/update/close, and
  Knowledge create/update services.
- Keep close atomic with resolution notes, Knowledge creation, and audit.
- Add authorization, stale checks, idempotency, and structured receipts.
- Add database migrations on the required short-lived branch.

### Phase C — Read-only pilot

- Enroll Codex and Claude Code separately with `knowledge:read`, `todos:read`,
  and `projects:read` only.
- Prove complete authorized Knowledge searches without service-key exposure.
- Test revocation, scope denial, pagination, rate limits, and sanitized errors.

### Phase D — Controlled mutation pilot

- Add `todos:create`, then `todos:update`, `knowledge:write`, and finally
  `todos:close` in that order.
- Run the acceptance sequence in section 13.
- Do not add delete, project mutation, raw DB, deployment, or provider tools.

### Phase E — Documentation and operating migration

- Replace unsafe inline-secret instructions in Orb and shared `AGENTS.md` with
  the approved capability interface and human-only recovery procedure.
- Update `docs/api-spec.yaml`, `docs/object-capability-matrix.md`, Help or
  operator documentation where applicable, and security audit controls.
- Record the approved architecture and acceptance results in the Knowledge
  Repository before declaring the migration complete.
- Keep the manual fallback documented and tested without restoring AI secret
  access.

## 13. Initial end-to-end acceptance test

The first mutation acceptance is deliberately a real, durable workflow rather
than a fake success response.

### Preconditions

- Stan has approved the plan, client enrollment, mutation policy, exact test
  title, and execution window.
- Codex has only the scopes required for the sequence.
- No credential value is visible to Codex, its shell, transcript, argv,
  environment, logs, or repository.
- Claude Code's independent read-only verification path is available.
- The test project is explicitly `ORB`; no default-project inference is used.

### Sequence

1. Codex calls `todo_create` to create one ORB todo with an agreed title that
   clearly identifies it as the capability-broker acceptance record.
2. Codex reads the canonical receipt and queries the returned UUID/code to
   verify the stored title, project, status, and attribution.
3. Codex calls `todo_close` with accurate resolution notes describing the
   successful create/read test and with a useful Knowledge entry title/content.
4. The server atomically closes the todo, stores trusted first-line
   attribution, creates the linked Knowledge entry, writes audit events, and
   returns both receipts.
5. Codex queries the todo and Knowledge entry independently and verifies the
   persisted closed state, resolution notes, entry content, linkage, and
   attribution.
6. Codex calls `knowledge_update` on that exact entry to add the final
   acceptance results, using its stable ID and expected version.
7. Codex reads the entry again and verifies the update receipt and stored
   content.
8. Claude Code independently reads the same todo, Knowledge entry, and audit
   evidence through its own identity. It does not reuse Codex's credential or
   accept Codex's reported result as proof.
9. Stan reviews the durable records and decides whether mutation access remains
   enabled.

### Required negative tests

- Missing, expired, and revoked credentials fail while an active credential
  succeeds.
- A read-only client cannot create, update, or close.
- A client cannot request an ungranted project or capability.
- `todo_update` cannot close a todo.
- `todo_close` without resolution notes or Knowledge content fails.
- Ambiguous title references do not mutate.
- Stale expected versions fail.
- Replaying each mutation idempotency key returns the original receipt and does
  not create a duplicate todo, audit event, or Knowledge entry.
- Raw SQL, arbitrary tables, caller-supplied URLs, todo delete, Knowledge
  delete, project mutation, push, deploy, and secret access are structurally
  absent.
- Returned errors, logs, and telemetry contain no credentials.

The durable workflow may pass once and be reported as `passed 1/1`; variable
security/revocation and replay tests must pass at least three times before being
called verified.

## 14. Verification, release, and rollback

### Verification

- Unit/contract tests for every input schema, scope, resolver, and error type.
- Database rollback tests for atomic close, replay, stale checks, and audit.
- Integration tests against a non-production identity before production pilot.
- Client-specific canary tests for Codex and Claude Code credential containment.
- Baseline comparison before attributing any failure to this change.
- Direct readback after every mutation; one HTTP/MCP success is not evidence of
  persisted success.

This interface is not automatically an Orb-conversation change. If no live Orb
prompt, conversational tool schema, routing, or speech policy changes, record
`Eval: not applicable — no conversation surface changed`. If shared Orb tool
contracts are changed, add matching cases and apply the risk-based gate from
`AGENTS.md`. Realtime-only evidence remains separate from serial evals.

### Release documentation

Every implementation release follows the repository release protocol:
`package.json` and `lib/version.ts` patch bump, a detailed
`lib/changelog.ts` release entry, updated `HANDOFF.md`, exact risk-based eval
record, and the mandatory Release bookkeeping claim. A push still requires
Stan's explicit in-chat approval.

### Rollback

- Revoke the affected client grant.
- Disable the MCP/capability route without restoring the shared secret file.
- Leave durable audit, todo, and Knowledge records intact.
- Return temporarily to the documented Stan-operated manual procedure.
- Roll back migrations only when their down path preserves audit and existing
  application behavior; otherwise disable by configuration and retain schema.

## 15. Risks and residual limitations

- A scoped credential can still be abused within its granted capabilities if
  its client is compromised. Least privilege limits blast radius; it does not
  make the client trustworthy.
- MCP/client credential-storage behavior must be tested, not assumed.
- The Capability Service becomes a privileged production surface and must be
  simpler and more rigorously tested than a general REST endpoint.
- Complete Knowledge access may expose sensitive historical content even when
  credentials remain hidden; result scope and logging require review.
- Trusted execution still depends on Orb's server-side service credentials.
- A same-user local broker is not a strong boundary if the general shell can
  inspect or modify its process, socket, binary, or credential store.
- Manual fallback remains slower; an outage must not silently weaken security.
- Adding too many operations recreates excessive agency. New capabilities
  require explicit threat review and Stan approval.

## 16. Decision register

Only Stan changes a row to **Decided**. Reviewer recommendations are recorded
in section 17 and do not become authority by repetition or consensus.

| ID | Decision | Proposed choice | Status | Stan's final decision / rationale |
|---|---|---|---|---|
| D1 | Proceed with a capability broker rather than restoring AI-readable secrets or permanent manual relay | Yes | Pending | |
| D2 | Primary transport | Orb-hosted remote MCP backed by a transport-neutral Capability Service | Pending | |
| D3 | Local broker role | Recovery/pilot fallback only; never decrypt into an agent-controlled command | Pending | |
| D4 | Initial clients | Codex and Claude Code, separately enrolled and revocable | Pending | |
| D5 | Initial read scopes | Knowledge, todo, and project reads | Pending | |
| D6 | Initial mutation scopes | Todo create/update/close and Knowledge create/update; no delete or project mutation | Pending | |
| D7 | Mutation approval policy | Explicit user instruction in the client is sufficient for initial allowed operations; trusted receipts and audit required | Pending | |
| D8 | Todo-close invariant | Atomic resolution notes + Knowledge entry + audit through canonical dispatcher | Pending | |
| D9 | Credential model | Per-client, scoped, revocable grant stored outside repositories; never shared `ORB_API_SECRET` | Pending | |
| D10 | Complete Knowledge access | Permit complete owner-authorized cross-project search through bounded tools | Pending | |
| D11 | Initial acceptance | Codex creates, verifies, closes one ORB todo, then updates and verifies its Knowledge entry; Claude independently verifies | Pending | |
| D12 | Manual fallback | Retain a documented Stan-operated path for outages/revocation only | Pending | |
| D13 | Production rollout | Read-only pilot first, then capabilities enabled one at a time | Pending | |
| D14 | Final implementation gate | No build until all applicable decisions are Decided and document status is Approved | Pending | |

## 17. Controlled review record

### Review protocol

1. Reviewers do not silently edit this document. They return a complete packet
   to Stan; Stan passes it to the document maintainer for attributed import.
2. Each packet includes tool, exact model, date/time/timezone, reviewed
   document `Last updated` value or commit, review round, and stable comment IDs
   such as `claude-R1-C1`.
3. Each comment is labeled **Verified finding**, **Inference**,
   **Recommendation**, **Question**, or **Blocker**, with evidence.
4. Complete packets are preserved under
   `docs/orb-ai-capability-broker-reviews/`; this section contains dispositions
   and navigational summaries, not replacements for the review text.
5. Existing comments are never overwritten or silently removed. A later pass
   is a new round.
6. The maintainer may revise proposal text in response, but every material
   change cites the comment ID and records its disposition.
7. Conflicting recommendations remain visible. Stan makes and records the final
   decision in section 16.
8. A reviewer may recommend approval but cannot approve implementation for
   Stan.

### Comment disposition table

| Comment ID | Reviewer | Disposition | Sections changed | Maintainer note |
|---|---|---|---|---|
| *(none yet)* | | | | |

### Review rounds

*(none yet)*
