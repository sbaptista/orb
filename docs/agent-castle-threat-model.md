# The Castle — a spatial threat model for AI agents

**Status:** Analysis. Organizing frame for the enforcement rework in `docs/agent-enforcement-hardening.md`.
**Created:** 2026-08-20 — Claude Code (Opus 5), at Stan's request
**Companion:** every claim here traces to a verified finding F1–F14 in the hardening packet.

---

## 1. The terrain

| Feature | What it is | What is at stake |
|---|---|---|
| **The castle** | The Supabase database | Todos, Knowledge, tickets, users, the audit log |
| **The grounds** | The repository and local filesystem | Source, migrations, the security launchers, tool configs, `AGENTS.md` |
| **The keep** | `orb.env.enc` — the master store | Fifteen credentials. Holding it is holding everything. **Confidentiality only:** AES-256-CBC with PBKDF2 and **no authenticated encryption or MAC** (Codex R2-Q6). Ciphertext tampering is undetected, and CBC is malleable — an attacker able to write the file could alter decrypted values rather than merely corrupt them. Offline passphrase strength is also load-bearing |
| **The gates** | `orb-dev`, `orb-agent-approve` | The only sanctioned way in carrying credentials. *`orb-agent-session` was removed 2026-09-03 (ORB-382): it unlocked the keep on every window, spending the passphrase it was meant to protect, for an expiry that F18 showed did not behave as claimed* |
| **The gatekeeper** | Stan | The only one who can open a gate |
| **Visitors** | Claude Code, Codex, any future tool | Invited. Also potentially carrying something they cannot detect |

The keep sits **on** the grounds. That dependency is the whole story: the
castle's defenses are excellent, the keep's crypto is excellent, and both
depend on ground that is currently open to anyone who can walk on it.

## 2. Land — through the front gate

Direct, sanctioned-looking approach. An agent runs `psql`, `curl`, `git push`.

| | Status |
|---|---|
| Into the castle | ✅ **Held.** `orb_agent_ro` cannot write, cannot reach `audit_log`, `auth.users`, `public.users`. Verified 42/42, including routine privileges after F11 |
| Out to production | ❌ **Open.** Codex executes `git push` with no prompt (F3). Credentials answer non-interactively (F6). No `pre-push` hook (F7) |

**The land route carries legitimate traffic too.** You asking an agent to close
a todo travels the same road as an attacker. The gate therefore cannot check
*intent* — only *authority*. That is precisely why closure is split into
propose/approve: the gate validates a resolved payload, not a stated purpose.

## 3. Air — over the walls

Instructions that arrive without using any gate: a web page, a GitHub issue, a
pasted error message, a dependency's postinstall script, an MCP server's
response, another agent's text.

The agent is not attacking. It cannot distinguish carried instructions from
yours. This is the Hugging Face pattern — the model was not hostile, it was
goal-directed, and it left through a **permitted** egress.

**There is no perimeter defense against air.** You cannot inspect it, and a
stronger prompt does not filter it (ORB-374 §5.4). Everything must be defended
at the castle, assuming the instruction is already inside.

**The uncomfortable symmetry:** `AGENTS.md` is also air-delivered. An agent
reading and obeying it is the same mechanism as an agent reading and obeying a
malicious README. The channel that carries your rules is the attacker's channel.
This is why a rule enforced only by prose is not a defense — it is an
instruction competing with every other instruction the agent encounters.

## 4. Tunnelling — under the walls, through the ground

Not attacking the castle. **Replacing the gatehouse.**

- Rewrite `~/.local/bin/orb-dev` to capture the master passphrase (F8)
- Shadow it via `PATH`, a shell function, or an alias in a writable `~/.zshrc`
- Edit `.claude/settings.json` to remove a deny rule
- Edit the verifier so it passes
- Edit `AGENTS.md` so the rule no longer exists

| | Status |
|---|---|
| Tunnelling | ❌ **Completely open.** The launchers are owner-writable, `~/.local/bin` is owner-writable — so even root-owned files can be unlinked and replaced — and no deny rule mentions the path |

**A tunnel under the keep beats every wall.** Capture the passphrase and the
encryption, the read-only role, `VALID UNTIL`, and propose/approve all become
irrelevant in a single step.

## 5. The dimension that breaks the metaphor: legitimate behaviour

A castle assumes attackers and defenders are different people. Here the
highest-privilege actor on the grounds is **a helpful agent doing exactly what
it was asked**. Four distinct hazards, none of them malice.

### 5.1 Legitimate work indistinguishable from attack

Every improvement made to the security tooling in this project was a tunnel.
`install -m 755 … ~/.local/bin/` was run roughly eight times on 2026-08-19 to
*harden* these controls. **A hostile edit would have been byte-for-byte the same
class of action.** No mechanism separated them; only intent did, and intent is
not observable.

*Consequence:* detection cannot key on the shape of the action. It must key on
who is permitted to take it — which means ground the agent does not own.

### 5.2 Legitimate work that damages through competence gaps

Real examples from a single day, all well-intentioned:

- A migration that would have run `ENABLE ROW LEVEL SECURITY` on tables where it
  was off, denying every authenticated application read.
- A pre-commit secret scan that crashed on regex complexity, exited non-zero,
  and was reported as "clean" — failing open in a security check.
- `REVOKE … FROM orb_agent_ro`, which does not remove what `PUBLIC` grants,
  leaving `audit_log` readable through `get_audit_log_page` for as long as the
  boundary was being reported as verified (F11).

*Consequence:* the gatekeeper must be able to verify the work, cheaply and
often, without trusting the worker's report.

### 5.3 Legitimate erosion — the tunnel dug one shovel at a time

Each step is individually reasonable: allow this command, trust this project,
add this to the allowlist. Codex's `trust_level`. The `Bash(git push *)` that
once drifted into `settings.local.json` with no commit to show when.

*Consequence:* permissions need an expiry or a review cadence, because
accumulation is the default and nobody ever revokes.

### 5.4 Legitimate documentation that manufactures false confidence

The most damaging category, because it stops you looking:

- A push-gate table asserting universal coverage while omitting one of two
  writable agents (F3).
- An audit row recording "notes AND Knowledge — enforced" while the code warned
  and continued.
- 53 passing tests that never executed a single SQL statement.

This is painting walls on canvas. The castle is not weaker than before — but you
now believe it is stronger, and you stop patrolling.

*Consequence:* every claimed defense must name the command that exercises it,
and be re-exercised on a schedule. A wall nobody has pushed on is a painting.

## 6. Where the defenses actually stand

| Zone | Land | Air | Tunnel |
|---|:-:|:-:|:-:|
| **Castle** (database) | ✅ grants + RLS, verified 42/42 | ✅ same grants apply | ✅ needs owner privileges |
| **Grounds** (files) | ⚠️ same-user perms only | ❌ no filter possible | ❌ **open** |
| **Keep** (master store) | ✅ AES at rest | — | ❌ **passphrase capture** |

The asymmetry is the finding: **we spent the day fortifying the castle, which
was already the best-defended structure, while the grounds remain open and the
keep's protection depends on them.**

## 7. Doctrine

1. **Assume the walls are breached.** Defend the treasury, not the perimeter.
   *Qualified 2026-08-20 (Codex R2-Q6): "there is no perimeter defense against
   air" is too absolute. Origin isolation, content/tool separation, network
   allowlists, and sandboxing all reduce air paths. None makes model judgment a
   boundary, which was the real point.*
2. **Gates check authority, never intent.** Legitimate and hostile traffic are
   identical at the gate. Design for that rather than around it.
3. **The ground you stand on must not be yours to dig.** A defense the agent can
   edit is a defense the agent has already edited. This is the argument for
   root-owned launchers and, ultimately, a separate OS account.
4. **Count the treasury, not the guards.** Measure what is reachable, not what
   is configured. Section E replaced an assumption with 11 → 0.
5. **Convenience is a slow tunnel.** Every allowlist entry is a shovel-load.
6. **One road for everyone.** A bypass kept for the gatekeeper's convenience is
   the attack surface.
7. **An unexercised defense is a painting.** Name the command, run it, record
   the result.

## 8. The magical realm — slumber as the resting state

*Stan's evolution of the model, 2026-08-20.*

The castle and its workers live for only N hours. A wizard **from another realm**
must appear **in the keep** to unlock the door that brings everything to life.
Otherwise everything stops and the castle slumbers until reawakened.

### 8.1 What this inverts

Today only `orb_agent_ro` expires. Everything else rests **on**: the dev server
holding fifteen decrypted credentials, `SUPABASE_SECRET_KEY` valid forever,
`ORB_API_SECRET` valid forever. Forgetting produces exposure.

Under slumber, forgetting produces **safety**. That is the property that matters
against a compromise nobody detects.

### 8.2 The workers expire, not the keys

Provider keys cannot self-expire — the providers control them. But they only
ever exist **inside a running process**. Stop the process and they are locked in
the keep again.

| Sleeps | Mechanism |
|---|---|
| Dev server | Self-terminates after N hours |
| `orb_agent_ro` | `VALID UNTIL` — built |
| `ORB_API_SECRET` | Server-side expiry check |
| All provider keys | **Implicitly** — nothing holds them once the server stops |

**CORRECTED 2026-08-20 (Codex R2-Q6).** The claim above — that expiring live
holders is sufficient — is **false**. A provider key remains valid *at the
provider* after the local process stops. A same-user process can copy it out of
the running environment during a window and use it indefinitely; a child process
can inherit the environment and outlive the dev server. Stopping one holder
removes one copy, not every copy.

Slumber is **exposure-window reduction, not revocation.** Claiming revocation
would require provider-side short-lived credentials, or a broker holding the
long-lived keys outside the agent's realm and issuing scoped, time-bound
requests. Where a provider offers only static keys, rotation is the only real
answer.

### 8.3 The wizard is the answer to F8

A passphrase is **a secret that becomes data on the ground** the moment it is
typed. A trojaned gatehouse captures it. The wizard currently lives in the
castle's own realm, so the castle's corruption reaches them.

A wizard from another realm authenticates without any secret crossing onto
compromised ground:

| Wizard | Realm | Defeats a trojaned gatehouse? |
|---|---|---|
| Passkey / Touch ID | Secure Enclave | ✅ No secret crosses — an assertion cannot be captured and replayed |
| Separate macOS account | Another user | ✅ The tunnel does not reach |
| Phone approval | Another device | ✅ |
| Typed passphrase | **This realm** | ❌ This is F8 |

**The passkey minting plan and this metaphor are the same idea**, and a passkey
does prevent capture and replay of a reusable passphrase.

**But it is NOT "the answer to F8" — corrected 2026-08-20 (Codex R2-Q6).**
Malicious local code can initiate a *genuine* challenge, induce Stan to approve
what looks like a legitimate prompt, then use the resulting live authorization
and read the environment it unlocks. A biometric proves a human was present; it
does not prove the human authorized *that* action, and it does not make a
trojaned gatehouse trustworthy. Transaction-bound approval showing the resolved
action, duration, and target — on a device the Mac does not control — is what
narrows this, which is why §8.4's realm separation matters more than the
biometric itself.

### 8.4 One wizard is a single point of failure — Stan's caution

A wizard is powerful, but so are other wizards. A biometric on the same Mac is
**one factor**: possession of a compromised machine. A local process cannot
forge an assertion, but it can request one and rely on the keyholder touching
the sensor for what looks like a legitimate prompt.

**Genuine two-factor requires a second realm, not a second secret.** A factor on
a different device (phone approval) means a compromised Mac cannot produce both.
A passphrase *plus* a passkey on the same machine is one realm twice.

Design consequence: the second factor should be chosen for **realm separation**,
not for strength.

### 8.5 The break-glass path is where this dies

If the wizard cannot appear — dead phone, failed biometric, travel — there must
be a recovery route. Recovery routes are used rarely, tested never, and designed
to be easy under stress. **A passphrase fallback re-opens F8 completely and
turns the biometric into decoration.**

This must be designed before the happy path, not after.

### 8.6 "Isn't this excessive for a development environment?"

It would be, if it were one. Per `docs/security-hardening-phase-1.md`, the
local environment holds **production** credentials: `SUPABASE_SECRET_KEY`,
`ORB_API_SECRET` (shared with Helm), the provider keys, and `RESEND_API_KEY` are
the same values production uses.

It is not a development environment in the security sense. It is a
**production-credential environment that happens to be used for development.**
The treatment follows the credentials, not the label.

**Production itself must not slumber.** Alpha testers use it, no AI agents run
there, and it holds its own Vercel credentials. The castle is the *local* realm.

### 8.7 Where slumber is weak

- **Ritual becomes reflex.** A wizard appearing every eight hours without
  thinking is a rubber stamp — §5.3 erosion. Mitigated, not solved, by rotating
  credentials on wake: even reflexive renewal invalidates what leaked in the
  previous window.
- **Slumber mid-work is disruptive.** A server dying at hour eight during
  debugging is how the feature gets disabled. Needs warning and in-place renewal.

## 9. What this defends against beyond AI

The controls are not AI-specific. The threat model is *"an untrusted process
running as Stan, hunting for credentials"* — an AI agent is one instance.

**Downgraded 2026-08-20 after Codex R2-Q9.** The original table said
"Strongly" in five rows. Persistent same-user code defeats most of them, and two
were unverifiable in this environment.

| Traditional vector | Protected? | Honest scope |
|---|---|---|
| **Infostealer — non-persistent at-rest scraping** | ✅ Strong | No `.env.local`; the store is ciphertext |
| **Infostealer — persistent code** | ⚠️ Partial | Can modify a launcher or shell startup, keylog, wait for unlock, or inherit the decrypted environment |
| **Malicious npm postinstall** | ⚠️ Partial | Same distinction: strong against grab-and-go, weak against code that persists and waits |
| **Stolen laptop** | ❓ **Unverified** | Depends on FileVault state, session lock, passphrase entropy, keychain contents. `fdesetup status` could not be determined here |
| **Backup exposure** | ❓ **Unverified** | Only if backups hold ciphertext and *not* the passphrase, old `.env.local` copies, shell history, or an unlocked snapshot. No backup inventory was taken |
| **Accidental secret commit** | ⚠️ Partial | That specific file cannot be committed. Logs, patches, crash dumps, pasted commands remain, and no commit/push secret gate is proven |
| **Another account on the machine** | ⚠️ **Scoped — my claim was wrong** | The home directory is **`0750` with group `staff`**, not `0700`. Only `Project-secrets` and `.local/bin` measured `0700`. The cross-account boundary holds for those subdirectories, not the home |
| **Compromised dependency** | ⚠️ Partial | "Only while the server runs" is **false** for persistent code: it can alter owner-writable ground and wait for the next unlock, or copy a static provider key during one window and use it after slumber |

**The overlap is not a coincidence.** Removing plaintext credentials from disk
defeats the most common real-world macOS credential theft in exactly the way it
defeats an agent: neither can decrypt what it cannot unlock.

**Where they diverge, and it favours the agent:**

1. **Malware follows a script. An agent reasons.** A stealer greps for `.env`
   and leaves. An agent can *observe* that `orb-dev` takes a passphrase and
   decide to modify it — the tunnelling category. That is why F8 is more
   dangerous from an agent than from commodity malware.
2. **An agent can wait.** Persistence plus patience beats a smash-and-grab.
3. **An agent is invited.** Malware is never given legitimate access to your
   repository and told to be helpful. §5 — legitimate behaviour — has no
   traditional analogue at all.

## 10. The order the work should be done in

Ranked by what actually moves the line, not by effort:

1. **Root-own the gatehouse** — the launchers *and* their directory, since
   unlinking needs directory write. **Interim measure**, not the destination:
   it raises the cost of tunnelling without removing the passphrase-on-open-
   ground problem.
2. **Close the land route out** — remote branch protection, required checks,
   deployment approval. Production deploy is currently open to one agent.
3. **Summon a wizard from another realm** — passkey/biometric unlock (§8.3),
   with the second factor chosen for realm separation (§8.4) and the
   break-glass path designed first (§8.5). This is the destination.
4. **Separate the ground** — a distinct macOS account. The structural answer to
   tunnelling, PATH hijack, and same-user process inspection.
5. **Slumber by default** (§8.2) — the dev server self-terminates, so provider
   keys stop being held by any live process.
6. **Keep counting the treasury** — re-run the verifier after every grant,
   policy, or migration change.

Everything below that is refinement of a castle that already holds.
