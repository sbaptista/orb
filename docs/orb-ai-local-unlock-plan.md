# Orb AI Local Unlock Plan

**Status:** Draft — lightweight replacement for the capability-broker proposal
**Owner and final decision-maker:** Stan
**Date:** 2026-08-09

## Outcome

Give every current shell-capable AI tool the same CRUD command for:

- Knowledge Repository entries;
- todos; and
- projects.

Stan enters the existing encrypted-environment password once. AI tools never
receive the password, decrypted environment, Supabase key, or database URL.

## Small design

Install one local service and one command:

```text
Stan:  orb-ai-unlock  ──password──> local service ──> Supabase
AI:    orb-ai ...     ──Unix socket──┘
Stan:  orb-ai-lock
```

This is not MCP and has no Codex-, Claude-, Gemini-, or Mistral-specific setup.
Any AI tool that can run a local command can use it.

### Unlock

`orb-ai-unlock`:

1. Prompts Stan in his terminal for the existing `orb.env.enc` passphrase.
2. Decrypts through a pipe and extracts only `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` into the service's memory.
3. Never exports those values to the AI shell, writes plaintext, prints a
   secret, or puts one in process arguments.
4. Starts a user-local Unix-socket service.
5. Locks automatically after four hours or immediately when Stan runs
   `orb-ai-lock`.

The service socket lives in an owner-only runtime directory (`0700`) and has
mode `0600`. It is not reachable over the LAN or internet.

### Shared access model

While unlocked, every AI process running as Stan's macOS user has the same
authority. There is no per-tool enrollment, token, or revocation. Locking the
service removes access for all tools at once.

This is the deliberate simplification. It trades per-client attribution and
revocation for low setup and compatibility with all current AI coding tools.
Audit records use the trusted actor `local-ai`; a caller-supplied tool name may
be recorded for convenience but is not trusted as identity.

## Command surface

All commands return bounded JSON to stdout and structured errors to stderr.

```text
orb-ai status

orb-ai knowledge list [--project ORB] [--query words] [--limit 25]
orb-ai knowledge get --id UUID
orb-ai knowledge create --project ORB --title ... --content-file ... [--tags ...]
orb-ai knowledge update --id UUID [--title ...] [--content-file ...] [--tags ...]
orb-ai knowledge delete --id UUID --confirm-id UUID

orb-ai todo list [--project ORB] [--status open] [--query words] [--limit 50]
orb-ai todo get --id UUID
orb-ai todo create --project ORB --title ... [supported fields]
orb-ai todo update --id UUID [supported fields]
orb-ai todo close --id UUID --resolution-file ... --knowledge-title ... --knowledge-file ...
orb-ai todo delete --id UUID --confirm-id UUID

orb-ai project list [--query words] [--include-dormant]
orb-ai project get --id UUID
orb-ai project create --name ... [--code ...] [--description ...]
orb-ai project update --id UUID [--name ...] [--description ...] [--dormant true|false]
orb-ai project delete --id UUID --confirm-id UUID
```

Content is passed by file or stdin, not embedded in shell arguments. The CLI
accepts only documented fields; it has no raw SQL, arbitrary table, arbitrary
URL, shell, deployment, provider, user-admin, or secret command.

## Data rules

- The service uses one fixed owner ID: Stan's existing Orb user.
- Reads are bounded and exclude soft-deleted rows unless an explicit recovery
  command is added later.
- Todo deletion remains a soft delete.
- Todo close requires resolution notes and creates the Knowledge entry in the
  same canonical database operation; a generic todo update cannot set `closed`.
- Project deletion uses the existing database behavior that preserves
  Knowledge entries and removes the project's todos.
- Knowledge deletion is a deliberate local-admin exception to Orb's
  conversational no-delete policy. It requires an exact UUID repeated in
  `--confirm-id` and writes an audit event before deletion.
- Every mutation returns the persisted row or receipt. Transport success alone
  is not reported as operation success.
- Every mutation writes an audit event with operation, target ID, before/after
  summary, timestamp, and actor `local-ai`.

## Installation boundary

The reviewed service and unlock launcher are installed outside AI-writable
repositories as root-owned, non-writable executables. The repository holds
their source and tests; Stan performs the one-time install/update command after
review. The `orb-ai` client contains no credential and may be ordinary
user-owned code because the service validates every request independently.

## What this does not solve

- A compromised AI tool can perform the allowed CRUD operations while the
  service is unlocked.
- All AI tools share one local identity, so audit cannot cryptographically prove
  which tool acted.
- This does not serve browser-only AI tools that cannot run a local command.
- Same-user process-memory isolation remains weaker than a VM or separate OS
  account. The design avoids environment, argv, files, and network exposure but
  does not claim a strong hostile-user boundary.

These are accepted tradeoffs only if Stan approves this lightweight model.

## Build and acceptance

Implementation is small:

1. One fixed-purpose local service.
2. `orb-ai-unlock`, `orb-ai-lock`, and `orb-ai` commands.
3. Deterministic contract/security tests using a harmless encrypted canary.
4. Installation instructions and replacement of unsafe agent instructions.

Acceptance:

1. Stan unlocks once with the password; no secret appears in repo files,
   environment readback, argv, stdout/stderr, or logs.
2. Codex performs create/read/update/delete tests on disposable Knowledge,
   todo, and project records.
3. Claude Code performs the same commands without separate configuration.
4. At least one other installed shell-capable AI tool runs `orb-ai status` and
   a read command unchanged.
5. Stan locks; all tools receive a clear `locked` result.
6. Stan independently verifies the database rows and audit events.

No hosted service, MCP server, OAuth flow, per-client credential, database
migration, or production deployment is required for the first version.

## Decisions for Stan

1. **Shared unlocked authority:** approve one local authority shared by all
   shell-capable AI tools, rather than per-tool enrollment.
2. **Scope:** approve full CRUD for Knowledge, todos, and projects, including
   the exact-ID destructive safeguards above.
3. **Unlock duration:** approve four hours plus manual lock, or specify another
   duration.
4. **Installation:** approve root-owned installed service/launcher so AI tools
   cannot modify the trusted executor before use.
5. **Supersession:** approve this plan as the replacement for the larger
   capability-broker plan; preserve the larger plan and reviews as history but
   do not implement them now.
