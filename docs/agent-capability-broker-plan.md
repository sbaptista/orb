# Agent Capability Broker — restoring AI-agent data access without master credentials

**Status:** Approved by Stan on 2026-08-19 (all four layers, direct-DB transport). Implemented in this change; migration and sealing require Stan's execution.
**Plan owner:** Claude Code
**Created:** 2026-08-19 — Claude Code (Opus 5)
**Todo:** not yet created — Stan to assign an ORB number and link this document
**Source:** Extracted from the deferred `docs/orb-374-ai-tool-local-access-security-plan.md` Phase 1 items 4 and 7, which were preserved but never implemented
**Relationship to ORB-375:** additive. Nothing in `docs/security-hardening-phase-1.md` is weakened, reversed, or reopened.

---

## 1. Problem

`orb-dev` (ORB-375) removed every AI-agent path to Orb's data. This was correct
containment, but it was total: agent workflows for the backlog, the Knowledge
Repository, and database health all died with the plaintext `.env.local`.

The mechanism, verified by reading `scripts/security/orb-dev`:

| Location | Mechanism | Consequence |
|---|---|---|
| `orb-dev:162` | Command allowlist — `run`, `--check`, `--eval`, `--eval-t1`, `--eval-t2`, `--strategic-eval` | No mode performs a data read. The capability is absent, not merely restricted. |
| `orb-dev:139` | `openssl enc -d` with no `-pass` flag | The passphrase comes from the controlling terminal, so the unlock is not scriptable. |
| `orb-dev:151` | `preflight()` refuses to start while `$ORB_PROJECT_ROOT/.env.local` exists | The former `grep KEY .env.local` idiom cannot be restored without breaking the dev server. |
| `orb-dev:17-33` | 15 credentials sealed as one indivisible bundle | Reading the backlog required unsealing `ANTHROPIC_API_KEY`, `OPENAI_ADMIN_API_KEY`, and the Google billing service account too. |

**The root cause is that capability and credential were the same object.**
Agent workflows needed three of the fifteen names; there was no way to obtain
three without obtaining all fifteen. Revoking the credential therefore revoked
every capability attached to it.

The current replacement — manual clipboard mode — is enforced **only by prose in
`AGENTS.md`**, which is to say by model compliance. ORB-374 §5.4 already states
the governing principle: *"Prompt injection cannot be reliably solved by a
stronger prompt."* An instruction-enforced boundary is the weakest control in the
system, guarding a store that is otherwise strongly protected.

## 2. Objective

Restore unattended agent read access to todos, projects, tickets, the Knowledge
Repository, and database health, such that:

1. No agent ever holds a master credential.
2. The worst case for a fully compromised agent is *reading the backlog it is
   already working on* — no provider keys, no service role, no writes.
3. Every mutation remains human-approved, with the approval rendered from the
   resolved request by trusted code rather than from the model's description.
4. Access is time-boxed, so an idle or injected agent has no standing capability.
5. Enforcement is mechanical, not textual.

## 3. Research basis

| Finding | Source | How this plan applies it |
|---|---|---|
| The agent holds a capability, never the credential | [Doppler](https://www.doppler.com/blog/mcp-server-credential-security-best-practices) | Layer 2 broker verbs; the master bundle is never decrypted in an agent shell |
| Excessive Agency is now OWASP LLM03:2026 (up from #6), root causes: excessive functionality, permissions, autonomy | [ReversingLabs](https://www.reversinglabs.com/blog/owasp-top-10-for-llm-apps-excessive-agency), [Mend](https://www.mend.io/blog/owasp-llm-top-10-2026/) | Layer 1 read-only role (permissions); Layer 2 verb allowlist (functionality); Layer 2 propose/approve split (autonomy) |
| Short-lived, scoped, revocable beats static env vars | [Descope](https://www.descope.com/blog/post/ai-agent-credential-management), [Aembit](https://aembit.io/blog/securing-ai-agents-without-secrets/) | Layer 3 expiring sessions with explicit revoke |
| Inject at runtime; let the secret die with the subprocess | [1Password](https://www.1password.dev/cli/secret-references) | Already correct in `orb-dev`; the broker uses the same `export`-then-`exec` discipline |
| Deny-rules bind built-in tools, not Bash | [Developers Digest](https://www.developersdigest.tech/blog/claude-code-permissions-settings-guide), [ahmet.ee](https://ahmet.ee/your-claude-code-setup-is-probably-not-as-safe-as-you-think/) | Layer 4 deny-rules are treated as a speed bump; the real control is that the master DSN is never in a file an agent can use |
| Best practice is no plaintext secret on disk | [Backslash](https://www.backslash.security/blog/claude-code-security-best-practices) | Preserved — the agent DSN is sealed with its own passphrase, distinct from the master passphrase |
| Human approval must show resolved fields from trusted code | ORB-374 BP-3, citing OWASP on forged approval dialogs | Layer 2 `orb-agent-approve` prints resolved target/action/rows before prompting |
| Enforce scopes at the server, not the tool list | [obot.ai](https://obot.ai/resources/learning-center/mcp-security/) | Layer 1 grants and RLS policies are the real boundary; the CLI allowlist is defence in depth |

## 4. Architecture

```text
  Stan (human, holds both passphrases)
    │
    ├─ orb-agent-seal ──────────► Project-secrets/orb-agent/agent.env.enc   (0600, own passphrase)
    │                              contains ONLY the orb_agent_ro DSN
    │
    ├─ orb-agent-session --hours 8 ──► Project-secrets/orb-agent/session    (0600, expiring)
    │                                   decrypted DSN + hard expiry
    │
    └─ orb-agent-approve <id> ──► master orb.env.enc ──► Orb REST / Supabase REST (writes)

  Agent (unattended, within an active session window)
    │
    └─ orb-agent <verb> ──► session DSN ──► psql as orb_agent_ro ──► SELECT only
                        └─ propose ──► proposal JSON (never executes)
```

Two separate encrypted stores with two separate passphrases is deliberate. The
agent store holds one low-value credential; the master store holds fifteen
high-value ones. Compromising the agent passphrase yields read access to the
backlog and nothing else.

### Layer 1 — Separate identity

A PostgreSQL role `orb_agent_ro`:

- `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`
- `GRANT USAGE ON SCHEMA public` and `SELECT` on exactly: `todos`, `projects`,
  `statuses`, `priorities`, `categories`, `groups`, `knowledge_repo`, `tickets`.
- **`audit_log` is deliberately excluded.** Its `before`/`after` JSONB columns
  can contain arbitrary prior row contents and it carries `user_id`. It is not
  needed for any documented agent workflow.
- Row-level security policies scoped `TO orb_agent_ro`, `FOR SELECT` only. Soft
  delete is enforced in the policy (`USING (deleted_at IS NULL)`) for `todos`,
  `categories`, and `groups`, so a broker bug cannot expose deleted rows there.
- **`tickets` and `knowledge_repo` use `USING (true)` instead — verified
  2026-08-19.** Permissive policies are OR'd and evaluated as the querying role.
  Those tables carry pre-existing `TO public` policies that dereference
  `public.users`, which this role deliberately cannot read. `true OR <anything>`
  is constant-folded at plan time so the subquery never enters the plan;
  `deleted_at IS NULL OR <subquery>` cannot be folded and fails with
  "permission denied for table users". Using `true` avoids granting any access
  to `users`; the broker's own `WHERE deleted_at IS NULL` carries soft-delete
  filtering for `tickets`. This was found by section C of the verification
  script, which exists precisely to catch over-restriction.
- `NOINHERIT` plus no role memberships means it cannot reach `authenticated`,
  `anon`, or `service_role` privileges.

Read-only is enforced by the database, not by the CLI. Even a fully rewritten
`orb-agent` executing arbitrary SQL through this role cannot write.

### Layer 2 — Allowlisted verbs; reads execute, writes only propose

```bash
orb-agent status
orb-agent todos list --project ORB --status open
orb-agent todos get ORB-381
orb-agent projects list
orb-agent tickets list
orb-agent knowledge search "realtime confirmation"
orb-agent db health
orb-agent propose todo-close ORB-381 --notes-file notes.md --knowledge-file k.md
orb-agent proposals list
```

Reads run immediately. Writes never run: `propose` serialises a JSON proposal to
`Project-secrets/orb-agent/proposals/`. Applying one requires the human-run
`orb-agent-approve <id>`, which unlocks the **master** store, prints the resolved
target, action, and affected identifiers, and requires a typed `yes`.

Writes go through the Orb REST API rather than direct SQL, because `closed_at`
is server-managed from `status` (`docs/api-spec.yaml`); a direct `UPDATE` would
silently skip that. Knowledge Repository writes use the Supabase REST endpoint,
which is the documented path and has no equivalent Orb route.

### Layer 3 — Time-boxed sessions

`orb-agent-session --hours N` (default 8, maximum 24) is human-run. It prompts
for the agent passphrase, decrypts the DSN, and writes a `0600` session file
carrying a hard expiry epoch. `orb-agent` refuses and unlinks the session once
expired. `orb-agent-session --end` revokes immediately.

Without an active session there is no unattended agent access at all. An agent
prompt-injected outside a session window has nothing to act with.

### Layer 4 — Mechanical enforcement

- `permissions.deny` in the tracked `.claude/settings.json` gains
  `Bash(orb-secrets-seal*)`, `Bash(orb-secrets-set*)`, `Bash(orb-agent-seal*)`,
  `Bash(orb-agent-session*)`, and `Bash(orb-agent-approve*)` — every
  passphrase-bearing command. Patterns are anchored at the start of the command
  per the confirmed 2026-08-05 wildcard finding.
- Both `AGENTS.md` files replace the inline-secret `curl`/`psql` blocks with
  `orb-agent` verbs. This closes ORB-374 Phase 1 item 7.
- Every broker invocation appends a redacted line to
  `Project-secrets/orb-agent/audit.log` — timestamp, verb, arguments, row count,
  outcome. No values, no DSN, no query results.

## 5. What this does not claim

- **Not process isolation.** A same-user agent can read the session file during
  an active window and call the broker directly. That is the granted capability,
  scoped and expiring — not a bypass.
- **Not protection against a compromised human session.** Anyone who can run
  `orb-agent-approve` and type the master passphrase can write.
- Container, VM, separate-account, and per-tool sandbox boundaries remain
  deferred under ORB-374 and the on-hold non-admin account plan.
- `orb-dev`, the dev server, and every eval path are untouched.

## 6. Database impact analysis

| Question | Answer |
|---|---|
| New query pattern? | Yes — `orb_agent_ro` reads. All are indexed lookups (`todo_number`, `product_id`, `status`) or `ilike` searches over `knowledge_repo`, matching existing app query shapes. No new index is required. |
| Realtime / `postgres_changes`? | No. Zero continuous WAL load. |
| Frequent writes? | No. The broker performs no writes at all. |
| New table? | No. One new role and eight `FOR SELECT` policies. |
| New column in WHERE/JOIN? | No. |

The new RLS policies use constant predicates (`true`, `deleted_at IS NULL`) with
no `auth.uid()` call, so the initplan-wrapping rule does not apply to them and
they add no per-row function evaluation.

## 7. Verification

**Deterministic, runnable by an agent:**

- `bash scripts/security/test-orb-agent.sh` — shell syntax, verb allowlist
  completeness, refusal without a session, refusal on an expired session,
  refusal of unknown verbs, refusal of SQL metacharacters in arguments, proposal
  round-trip, and confirmation that no script contains a credential.

**Requires Stan (agent shells cannot reach the database):**

Both SQL files run in the **Supabase SQL Editor** (paste whole file) or psql.
They contain no psql meta-commands and report through returned tables rather
than `RAISE NOTICE`, which the editor does not surface.

- Apply `scripts/migrations/20260819_orb_agent_ro_role.sql`; read its returned
  step/result table.
- Set the password: `ALTER ROLE orb_agent_ro WITH PASSWORD '<random>'`. The SQL
  Editor retains recent queries, so clear it afterwards and do not save the
  snippet — this is a real, if modest, exposure and should not be glossed over.
- Run `scripts/migrations/verify-orb-agent-ro.sql` — negative tests proving the
  role cannot `INSERT`, `UPDATE`, `DELETE`, create/alter tables, or read
  `audit_log`, `auth.users`, and `public.users`, **and** positive tests proving
  it can read all eight allowed tables. Both directions, per the standing
  "verify both directions" lesson. Every returned row must read `PASS`.
- Caveat: the verification uses `SET ROLE`, which exercises grants and RLS but
  **not** per-role settings such as `default_transaction_read_only` — those
  apply only to real logins. The grant-based denial is the control being
  proven; the session setting is additional depth.
- `orb-agent-seal`, then `orb-agent-session`, then confirm each read verb from a
  separate agent shell.

**Unverified and requiring Stan's test — stated plainly:**

Supabase's transaction pooler expects a `<role>.<project-ref>` username. Whether
a **custom** role authenticates through the pooler on this project is not
established; I could not test it, having no database access. The migration
documents both the pooler (`:6543`) and direct (`:5432`) connection forms. If
the pooler rejects the custom role, use the direct connection — the broker is
low-frequency and does not need pooling.

**CONFIRMED 2026-08-19:** Supabase refused `GRANT pg_read_all_stats`
("permission denied to grant role") because its `postgres` role is not a
superuser. `extensions.pg_stat_statements` itself was granted. This matters more
than it first appears: without `pg_read_all_stats` the view does **not** error —
it silently returns only the querying role's own statements, so a near-empty
table would read as a clean bill of health. `orb-agent db health` therefore
checks `pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')` first and
prints **UNMEASURED** with the exact SQL for Stan to run in the SQL Editor,
rather than printing a misleading result. The other three health checks
(sequential scans, dead rows, RLS initplan) are unaffected.

**Eval:** not applicable — no Orb-conversation capability, tool, routing rule,
prompt, or defined speech behavior changes. This is developer tooling outside
the conversational surface.

**Performance instrumentation:** not required. No user-facing route, server
action, component, or application load path changes. The broker is a human- and
agent-run CLI outside the Next.js application.

## 8. Rollback

`orb-agent-session --end` revokes access immediately. `DROP ROLE orb_agent_ro`
(after dropping its policies) removes the identity entirely. Neither affects the
application, `orb-dev`, or the master store. Manual clipboard mode remains
available as the fallback and its documentation is retained, not deleted.
