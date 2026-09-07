# Agent security — open findings

**What this file is.** The live register of unresolved security findings for
Orb's agent tooling. Each entry says what is wrong, what established it, and why
it is not fixed.

**What it is not.** It was, until 2026-09-06, a 1,820-line transcript of four
cross-model review rounds — questions, reviewer packets, dispositions, and
dispositions about dispositions. That history is preserved in git at
**`6e47488`** (`git show 6e47488:docs/agent-enforcement-hardening.md`) and was
deleted here because its findings already live in the code, in the two documents
below, and in the register that follows. Reading 1,800 lines to learn nine open
items is a cost every agent paid at session start.

**Related:** `docs/agent-castle-threat-model.md` (threat model). The broker's
design is the code itself — `scripts/security/orb-agent`,
`scripts/migrations/20260819_orb_agent_ro_role.sql`, and its verifier; the
separate plan document was deleted on 2026-09-06 once the thing it planned was
built and verified.

**Standing rule for anything added here.** Label every claim **Verified** (you
ran it), **Inferred** (it follows from something you ran), or **Suspected**
(plausible, unchecked). Every one of the four review rounds overturned a
maintainer claim that had been reported as verified. Round 4 overturned one that
had already shipped.

---

## 1. Push gates — nothing tool-agnostic exists

| Id | Finding | Established by | Status |
|---|---|---|---|
| **F3** | **Codex has no push gate.** It ran `git push --dry-run origin main` with no approval prompt, exit 0. `git ls-remote` confirmed the remote did not move, so the only thing preventing a production deploy was the `--dry-run` flag in the command string | Direct test, 2026-08-19 | **Verified. Open — highest priority** |
| **F6** | GitHub push credentials answer **non-interactively** to any process running as Stan | `git credential fill` returned username and password with no prompt | **Verified. Open** |
| **F7** | No `pre-push` hook exists — there is no gate at the git layer that binds every tool | `ls .git/hooks/pre-push` | **Verified. Open** |
| **F5** | A parent `[projects."…/Projects"]` entry exists in Codex's config. The claim that it *recursively covers Helm and every sibling* was **inferred, not tested**; recursive inheritance is undocumented | `grep` of `~/.codex/config.toml` | **Partly verified. Untested until exercised from Helm** |
| **F13** | Codex's runtime explicitly allows `git push` as an approved prefix, and cannot remove that approval from inside a session | Codex self-report | **Reported; not independently verifiable by the maintainer** |

**The durable lesson (F12, verified):** per-tool push gates do not compose. Every
new tool starts ungated, the gate lives in that tool's own config, and "unlisted
tools must flag it" depends on the tool reading and obeying a file — exactly what
a gate must not rely on. Root-owned git hooks are **not** a control either:
`--no-verify`, `-c core.hooksPath=`, another clone, or the API all skip them.

**The only tool-agnostic gate is the credential layer** — an SSH key whose
passphrase is not in `ssh-agent` or the login keychain fails closed for every
tool. **Caveats before acting:** `git credential reject` clears `github.com` for
all repositories including Helm, and `gh` CLI holds separate auth this does not
touch.

## 2. Same-user capture after unlock

| Id | Finding | Status |
|---|---|---|
| **F8** | Launcher-**file** tampering is mitigated: the five passphrase-taking launchers and their directory are `root:wheel` in `/usr/local/orb-bin`, verified unwritable from the agent side, PATH from root-owned `/etc/paths.d`. **Post-unlock capture is not** | **PARTIALLY mitigated** (downgraded 2026-09-05; a top-line "Mitigated" was stronger than the evidence) |
| **R3-N2** | `orb-dev` decrypts the master store, `cd`s into the agent-writable repository, and `exec`s `npm run dev`. Every decrypted value reaches writable `node_modules`, npm lifecycle hooks, `next.config.ts` and server code **by design**. `node_modules` is gitignored, so a change there survives any "review a clean tree" check | **Verified. Open** |
| **§PATH** | Root ownership protects the launcher *files*, not which file is *reached*. `~/.zshrc` is **mode 644** and prepends `~/.local/bin`, an IDE bin directory, and `/opt/homebrew/bin` (`drwxrwxr-x`, group `admin`) **ahead of** `/usr/local/orb-bin`. Nothing shadows `orb-dev` today — a fact about the current filesystem, not a control | **Verified. Open** |

| **N-install** | Root-owning an installed launcher constrains what **PATH resolves**, not what an agent **executes**. Tested 2026-09-06: `scripts/security/*` is owner-writable and agents edit it routinely; promotion is a `sudo install` command the **agent composes** and Stan runs, so absent a diff the agent's bytes become the running program; and `bash scripts/security/orb-agent` reaches the database with neither PATH nor sudo. The integrity check makes an unannounced change **detectable** — that is its whole value. *Mitigating: the broker's read-only-ness is enforced by database grants, not by the broker, so rewriting it yields only the soft-delete filter and the audit log — both already reachable with plain `psql` under F17* | **Verified. Open by design; recorded so root ownership is not over-claimed again** |

**There is no fix at this boundary.** The dev server must receive the secrets and
must execute mutable source. Runtime secrecy from a same-user writable agent
requires a separate OS identity or a VM. The available lever is blast-radius
reduction:

| Id | Finding | Status |
|---|---|---|
| **R4-N4** | `ANTHROPIC_ADMIN_API_KEY`, `OPENAI_ADMIN_API_KEY` and `GOOGLE_BILLING_CREDENTIALS_JSON_BASE64` are **organisation-scoped**, decrypted into the dev process on every `orb-dev`, and consumed only by `lib/orb-model/usage-monitor.ts` via `app/api/cron/usage-check/route.ts` — which returns 401 locally because `CRON_SECRET` is deliberately absent. **Removing them from `orb-dev`'s `required_environment` would narrow nothing**: the loader exports every name in the store, so that array is a presence check only. Real narrowing needs the loader to become a runtime allowlist, **or** the keys removed from the local store (with matching `orb-secrets-seal` / `orb-secrets-set` changes) | **Verified. Needs Stan's decision on which** |

## 3. Master store has no integrity protection

| Id | Finding | Status |
|---|---|---|
| **R2-Q6** | `orb.env.enc` is AES-256-CBC with PBKDF2 and **no MAC**. `openssl enc` does not support authenticated modes and OpenSSL documents that it will not add them. Confidentiality only: ciphertext tampering is undetected, and CBC is malleable, so an attacker able to *write* the file can alter decrypted values rather than merely corrupt them. Also replay: any older valid ciphertext can be restored | **Accepted, NOT fixed. Open** |

**Now doubly relevant.** R4-N1 established that a truncated store decrypts
genuine plaintext for every complete block before failing — 880 bytes and 60
valid assignments in the measured case. Write access to this file is therefore
enough to feed a launcher a deliberately partial environment. The launchers now
check the decrypt exit status, which closes that, but the underlying absence of
integrity protection is unchanged.

**Least-risk repair, if taken up:** a maintained authenticated-encryption tool
with a passphrase mode (for example `age`), root-pinned like the launchers. An
OpenSSL-only encrypt-then-MAC envelope is possible but means a shell script
implementing a cryptographic protocol — versioned format, independent keys,
separate salts, MAC over header plus ciphertext, verification before decryption
— which is a larger assurance burden than one audited dependency.

## 4. Approval gate

| Id | Finding | Status |
|---|---|---|
| **R3-N1** | `orb-agent-approve` hashes the proposal, displays it, re-hashes and re-validates after the typed `yes` — then **reopens the same owner-writable path** to build the Knowledge body (lines ~225–231) and the PATCH body (~254–257). A same-user writer can replace the proposal after the last check. Post-check TOCTOU | **Verified by control-flow reading. Open** |
| — | Confirmation is not full-content review: the banner shows the first notes line, Knowledge title and tags, not the complete payload. Hashing unseen bytes binds a file version to a shallow summary | **Verified. Open** |

**Repair:** parse the proposal once into an in-memory snapshot, derive both
request bodies and the complete review text from that snapshot before prompting,
and after `yes` use only those immutable values — never reopen the path. A temp
file owned by the same UID is not an integrity boundary against this attacker.

## 5. Database

| Id | Finding | Status |
|---|---|---|
| **F17** | **Accepted trade.** The `todos` agent policy was folded to `USING (true)` so the planner never permission-checks `is_admin` (which had enabled the F15 forgery). DB-level soft-delete for `todos` is gone; the broker's `WHERE deleted_at IS NULL` is the only remaining filter — two layers to one. 23 deleted todos are visible at the DB layer. **The broker's filter does not constrain a credential holder using plain `psql`** | **Accepted and visible.** Verifier section B records it on every run |
| **R3-N3** | `20260820b_anon_definer_sweep.sql` selects every `prosecdef` row but emits `REVOKE ... ON FUNCTION`. PostgreSQL distinguishes FUNCTION, PROCEDURE and ROUTINE, so a `SECURITY DEFINER` **procedure** hits the caught exception, logs `FAILED`, and the migration still succeeds. The allowlist is also by `proname`, not signature, so any future `is_admin` overload is exempt | **Verified. Open** — needs a follow-up migration using `ROUTINE` (or branching on `prokind`) and failing on exception |

## 6. Tooling

| Id | Finding | Status |
|---|---|---|
| **Bash/deny gap** | `.claude/settings.json` denies Claude Code `Read()` on `Project-secrets/**`. **Bash is not covered** and can read the same files. Claude Code used this gap on 2026-09-05 to read `credential.pgpass` while building a test — the value was not printed, but the boundary is not what the rule implies | **Verified. Needs a decision** |

## 7. Not in this file

- **Realtime `Cancel. Stop.` authorization hazard** — `HANDOFF.md` Active Risks,
  and a warning comment at `app/api/orb-realtime/session/route.ts:59`.
- **Everything closed.** F1, F2, F4, F9, F10, F11, F12, F15, F16, F18, R2-Q1–Q5,
  R2-Q7–Q9, R3-N4, R4-N1, R4-N2, R4-N3, R4-N5, R4-Q1, R4-Q7. Recorded here only
  so they are not re-opened; the evidence is in git at `6e47488` and in
  `lib/changelog.ts`. Two worth remembering because they were live exposures:
  **F16**, nine `SECURITY DEFINER` routines executable by `anon` including one
  that writes; and **F15**, a confirmed identity forgery where the agent role
  could set a real UUID as its JWT claim and make `is_admin()` return true.
