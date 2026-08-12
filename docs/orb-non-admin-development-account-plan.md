# Orb Non-Admin Development Account Migration Plan

**Status: ON HOLD as of 2026-08-12 — not approved, not scheduled, no successor
work planned**  
**Owner and final decision-maker:** Stan  
**Plan maintainer:** Codex  
**Prepared:** 2026-08-11 HST  
**Round 1 review recorded:** 2026-08-12 (Claude Code, Opus 5) — section 24  
**Target identity:** full name `Dev E. Loper`, short name `developer`, home
`/Users/developer`

---

## Hold notice — 2026-08-12

Stan has stopped work on this direction. His decision, recorded verbatim in
intent: **no further work on non-admin accounts, Docker, or VMs.**

The hold covers the whole class of "isolate the AI tools by giving them a
separate environment" approaches — a second macOS account (this plan),
containers, and virtual machines alike. It is a decision about direction, not a
rejection of any single finding below, and it is not a gate that further review
can satisfy. Section 22's implementation gate is therefore moot: implementation
was never authorized and is now not being pursued.

**What this hold does and does not mean:**

- Sections 1–23 are preserved unchanged as the historical record of the
  direction and are **not** to be treated as pending work.
- No decision in section 6 needs an answer. Stan does not need to choose a
  Git authority model, a FileVault posture, or an old-clone disposition.
- No Round 2 review is required or wanted. Section 21's review protocol is
  closed out by section 24 below.
- Nothing in the current setup changes. No account was created, no permission,
  credential, installer, browser, launcher, TLS, GitHub, Vercel, database,
  dev-server, or production state was touched at any point by this plan or its
  review.
- ORB-375 containment work and the existing push gate are **unaffected** — they
  never depended on this plan.

**Do not reopen this document as a task.** If AI-isolation work is ever revived,
start from the findings in section 25, which are the parts that survive the
hold; this plan's phase structure assumes a decision Stan has now declined.

Section 24 records the completed Claude Code Round 1 review. It is preserved
because several findings are facts about the current machine and current
controls that remain true whether or not this migration ever happens — see
section 25.

**Deviation from section 21 noted for the record:** section 21 specifies that
Claude Code writes its packet to
`docs/orb-non-admin-development-account-reviews/claude-R1-2026-08-11.md` and
does not edit this canonical plan. Stan directed on 2026-08-12 that the review
be folded into this document instead, so the work is wrapped up in one file
rather than leaving a separate review directory behind for a direction no
longer being pursued. No separate review file was created.

---

## 1. Decision sought

Approve a staged migration of routine Orb development out of Stan's personal
administrator account and into a dedicated **Standard** macOS account. The
migration must preserve Codex, Claude Code, Safari/Chrome/Edge testing, local
HTTPS on Mac/iPhone/iPad, Git, and the human-unlocked development environment
while making Stan's personal home, Keychain, browser profiles, SSH material,
AI histories, secrets, and unrelated projects unreachable to development AI
tools under normal OS permissions.

This is a planning and review artifact only. It does not authorize account
creation, installation, permission changes, credential movement, launcher or
GitHub changes, deletion, or any other implementation.

## 2. Desired end state

- Stan's existing account remains the personal administrator and trusted
  recovery/release authority.
- `Dev E. Loper` is a Standard user named `developer`.
- `/Users/developer/Projects/orb` is the only routine development clone.
- Codex and Claude Code run as `developer`, authenticate afresh, and operate
  inside enforced workspace boundaries.
- Safari, Chrome, and Edge run as `developer` with persistent local Orb-testing
  profiles and no personal cloud synchronization.
- Orb remains reachable through trusted HTTPS on Mac, iPhone, and iPad.
- No plaintext secret enters either repository or AI-readable configuration.
- Routine AI sessions cannot deploy or push production `main`.
- The administrator clone is either retired after acceptance or retained only
  as a clean, human-operated release clone.

## 3. Security claims and limits

### What the account boundary provides

A process running as `developer` should not be able to read Stan's personal
home, Keychain, browser data, SSH keys, AI state, secret directory, or unrelated
projects unless an administrator deliberately grants access. A Standard user
also cannot add users or change protected system settings without separate
administrator authorization.

### What it does not provide

- A compromised tool can read or change data owned by `developer` within its
  permitted workspace.
- It can use any service or credential deliberately made available there.
- After `orb-dev` decrypts the environment into Next.js, secrets exist in a
  same-user process. The new account protects Stan's personal account; it does
  not prove same-user development-secret isolation.
- Browser profiles within `developer` are organizational boundaries beneath the
  stronger macOS account boundary.
- Typing an administrator password for an AI-proposed operation can grant that
  operation elevated authority. Privileged changes therefore occur from the
  administrator session after independent review.
- Account separation supplements rather than replaces AI sandboxing, network
  limits, human approval, Git protection, backup, and source review.

## 4. Verified baseline — 2026-08-11

| Item | Verified state |
|---|---|
| macOS | `27.0` build `26A5406e` |
| Current user | `stanleybaptista`, UID 501, member of `admin` |
| Orb | clean `main`; `origin/main` at `8aac1dd` |
| Current clone | `/Users/stanleybaptista/Projects/orb` |
| Codex | `/Applications/ChatGPT.app`, owner `stanleybaptista`, mode `0755`; embedded CLI `0.147.0-alpha.6.5` |
| Claude | `/Applications/Claude.app`, owner `stanleybaptista`, mode `0755`; no standalone `claude` command found |
| Browsers | Safari system app; Chrome and Edge under `/Applications` |
| Git/Node/npm | Git `2.54.0`; Node `v22.22.2`; npm `10.9.7` |
| Homebrew/TLS | Homebrew `6.0.15`; mkcert `1.4.4`; OpenSSL `3.6.2` |
| Launcher | `/Users/stanleybaptista/.local/bin/orb-dev`, owner-only `0700` |
| Encrypted store | `/Users/stanleybaptista/Project-secrets/orb-secrets/orb.env.enc`, `0600` below a `0700` root |
| Portability blocker | `scripts/security/orb-dev` hardcodes Stan's current project and secret paths |
| FileVault | unverified: sandboxed `fdesetup`/DiskManagement inspection failed; Stan must verify in System Settings |

No secret value was read.

## 5. Target ownership model

| Surface | Administrator account | `developer` account |
|---|---|---|
| Personal data/cloud sync | yes | no |
| Administrator password | human-held | never stored or disclosed |
| Orb clone | temporary or release-only | canonical development clone |
| Builds/dev server | no after cutover | yes |
| Codex/Claude | no routine use | yes |
| AI auth/config | existing | fresh; never copied |
| Browser profiles | personal | local Orb-testing only |
| Production push/deploy | human-only | denied initially |
| Development secrets | existing source retained through acceptance | encrypted-only transfer or later broker |

The accounts must not share a writable repository, browser profile, AI config,
Keychain, SSH directory, or plaintext environment.

## 6. Decisions Stan must make

1. Approve full name `Dev E. Loper`, short name `developer`, and home
   `/Users/developer`.
2. Decide whether `developer` may unlock FileVault at startup. Recommended: yes
   for daily use, with a distinct strong password and Standard-user status.
3. Decide the administrator clone's final role. Recommended: retain a clean,
   human-only release clone until a safer release workflow is proven.
4. Choose Git authority:
   - recommended: no direct `main` push credential under `developer`;
   - alternative: branch-only pushes with a GitHub ruleset protecting `main`;
   - not recommended: direct production push authority under `developer`.
5. Decide whether the first migration may copy only the encrypted environment
   bundle into `developer` ownership, explicitly accepting the existing
   same-user runtime limit, or must wait for the local capability service.
6. Approve administrator-owned Codex requirements and Claude managed settings
   so development-account config cannot weaken the boundary.
7. Approve no personal Apple/Google/Microsoft browser sync under `developer`.
8. Choose the post-acceptance retirement window for the old setup. Recommended:
   seven days including one complete normal development cycle and cold reboot.

## 7. Phase A — Recovery and preflight

**Run as:** Stan in the administrator account.

1. Confirm a current Time Machine or equivalent recovery point.
2. Confirm administrator login and store the FileVault recovery method outside
   the Mac.
3. Open **System Settings → Privacy & Security → FileVault**; record status and
   users permitted to unlock at startup.
4. Verify Orb is clean and remote-complete:

   ```bash
   cd /Users/stanleybaptista/Projects/orb && git status --short && git fetch origin && git log --oneline origin/main..main && git log -1 --oneline origin/main
   ```

5. Record versions and ownership for Git, Node/npm, Homebrew, OpenSSL, mkcert,
   ChatGPT/Codex, Claude, Safari, Chrome, Edge, and `orb-dev` without reading
   credential files.
6. Do not delete or alter the old clone, encrypted store, launcher, TLS material,
   app state, or authentication during preflight.

**Gate:** recovery, FileVault state, remote completeness, and rollback are known.

## 8. Phase B — Create `Dev E. Loper`

**Run as:** Stan in the administrator account.

1. Open **System Settings → Users & Groups → Add User**.
2. Choose **Standard**.
3. Enter full name `Dev E. Loper`, account name `developer`, and a new strong
   password distinct from both the administrator password and Orb passphrase.
4. Leave automatic login off and do not sign into Stan's Apple Account.
5. Apply the approved FileVault decision through **Privacy & Security →
   FileVault → Enable Users** if applicable.
6. Log into `developer` and verify:

   ```bash
   id && printf '%s\n' "$HOME"
   ```

   Expected: home `/Users/developer` and no `admin` group membership.
7. Do not enable Remote Login, Remote Management, Screen Sharing, or File
   Sharing for this migration.

## 9. Phase C — Prove isolation before installing AI tools

**Run as:** `developer` in Terminal.

1. Confirm sensitive administrator paths are not readable:

   ```bash
   test ! -r /Users/stanleybaptista/.ssh && test ! -r /Users/stanleybaptista/.codex && test ! -r /Users/stanleybaptista/Library/Keychains && test ! -r /Users/stanleybaptista/Project-secrets && test ! -r /Users/stanleybaptista/Projects
   ```

2. Confirm silent privilege elevation fails:

   ```bash
   sudo -n true
   ```

   Expected: non-zero exit with a password/authorization error. A successful
   result is a stop condition.

3. In **Privacy & Security**, verify ChatGPT, Claude, Terminal, Safari, Chrome,
   and Edge have no inherited Full Disk Access, Accessibility, Screen Recording,
   Automation, or Files and Folders grants.
4. Confirm `/Users/Shared` contains no secret, AI-auth, browser-profile, or repo
   symlink that bypasses the boundary.
5. Do not loosen Stan's home permissions for convenience.

**Stop:** any unexpected read of a sensitive administrator path.

## 10. Phase D — Install controlled applications and policy

**Privileged work runs from Stan's administrator session, never an AI-controlled
`developer` terminal.**

1. Reinstall or normalize ChatGPT/Codex and Claude in `/Applications` through
   vendor-supported installers so `developer` can execute but not modify them.
2. If standalone Claude Code is required, install the stable Homebrew cask:

   ```bash
   brew install --cask claude-code
   ```

   Do not use `sudo npm install -g`.
3. Verify ChatGPT, Claude, and Claude Code binaries are not writable by
   `developer`.
4. After a separate syntax review, install administrator-owned Codex policy at
   `/etc/codex/requirements.toml`. Required intent:
   - only read-only/workspace permission profiles;
   - no danger/full-access mode;
   - approvals for boundary crossings;
   - constrained network and local/private targets;
   - hooks, plugins, MCPs, Computer Use, external browser control, and Unix
     sockets off or explicitly allowlisted.
5. After a separate syntax review, install Claude managed settings at
   `/Library/Application Support/ClaudeCode/managed-settings.json`. Required
   intent:
   - deny `git push`, deploy, provider-admin, and secret-path operations;
   - deny Stan's home;
   - require approval outside the workspace or approved network scope;
   - prevent user/project settings from removing managed restrictions.
6. Do not invent policy keys during implementation; verify them against the
   installed versions and current vendor documentation.
7. Verify Git, Node/npm, Homebrew, OpenSSL, and mkcert are executable but not
   writable by `developer`. Do not make `/opt/homebrew` or `/usr/local` broadly
   writable and do not add `developer` to `admin`.

## 11. Phase E — Create the independent repository

1. Under `developer`:

   ```bash
   mkdir -p /Users/developer/Projects && chmod 700 /Users/developer/Projects && git clone https://github.com/sbaptista/orb.git /Users/developer/Projects/orb && cd /Users/developer/Projects/orb && git status --short && git log -1 --oneline
   ```

2. Clone from GitHub; do not copy the administrator tree, `.git` credentials,
   ignored files, `node_modules`, `.next`, or untracked artifacts.
3. Confirm expected `origin/main` and no `.env.local` file or symlink.
4. Configure Git author identity afresh. Do not copy `.ssh`, Keychain, Git
   credential storage, or signing keys.
5. Apply Stan's approved Git authority model. Clone convenience is not authority
   to deploy production.

## 12. Phase F — Configure Codex as `developer`

1. Launch `/Applications/ChatGPT.app` from the `developer` login.
2. Authenticate afresh using Stan's existing OpenAI entitlement. Do not copy
   `~/.codex`, `auth.json`, Keychain items, logs, sessions, memories, plugins,
   MCP state, or app containers.
3. Open only `/Users/developer/Projects/orb`.
4. Start with **Ask for approval** and workspace permissions; never Full Access.
5. Keep command network access off by default and allow only exact approved
   destinations or localhost paths.
6. Keep fresh `~/.codex/config.toml` non-secret. Inspect project `.codex` config
   before trusting it.
7. Confirm `/etc/codex/requirements.toml` is active and not overrideable.
8. Test a disposable in-workspace edit, denied Stan-home read, denied unmanaged
   out-of-workspace write, and denied push. Remove the disposable file.

## 13. Phase G — Configure Claude as `developer`

1. Launch `/Applications/Claude.app` and/or the administrator-installed
   `claude` command from `developer`.
2. Authenticate afresh using Stan's existing Anthropic entitlement. Do not copy
   `.claude`, auth caches, settings, transcripts, hooks, MCP state, or Keychain.
3. Open only `/Users/developer/Projects/orb`.
4. Treat tracked `.claude/settings.json` as convenience, not enforcement,
   because the workspace is writable.
5. Confirm administrator-owned managed settings cannot be weakened.
6. Test a disposable workspace edit, denied Stan-home read, denied managed
   policy modification, and denied push. Remove the file.
7. Run `claude doctor` and record installation type/warnings without exposing
   account identifiers or tokens.

## 14. Phase H — Configure three local browser profiles

All browser work occurs inside the `developer` macOS login. Shared app binaries
are acceptable; profile data must live only under `/Users/developer`.

### Safari

1. Do not sign macOS into Stan's Apple Account.
2. Use Safari's already separate per-user default data.
3. Optionally create **Safari → Settings → Profiles → Orb Testing**.

### Chrome

1. Decline Google sign-in/sync.
2. Create `Orb Testing` through the continue-without-account path.
3. Do not import personal bookmarks, passwords, extensions, cookies, or history.

### Edge

1. Select **Set up a new profile → Start without your data**.
2. Name it `Orb Testing`.
3. Do not sign into a personal Microsoft account or import personal data.

Use persistent profiles, not Guest mode, because acceptance needs durable
cookies and permissions. Do not grant browser Full Disk Access. Computer Use or
browser automation remains off unless Stan approves an exact test.

## 15. Phase I — Port `orb-dev`, encrypted storage, and TLS

This phase requires a separately reviewed code change.

1. Replace hardcoded Stan-home paths in `scripts/security/orb-dev` with a
   deterministic installation configuration for the new repository and an
   approved encrypted secret root.
2. Do not accept arbitrary project, secret, executable, or command paths from
   AI-controlled arguments/environment.
3. Install the reviewed launcher outside the repo so `developer` cannot modify
   the trusted executor.
4. Transfer only encrypted `orb.env.enc` through an administrator-mediated
   path. Never create plaintext, print values, copy `.env.local`, or copy the
   passphrase.
5. Preserve `0700` secret directories and `0600` encrypted file permissions.
6. Do not copy the existing mkcert CA private key casually. Create a dedicated
   development CA/certificate and deliberately install trust on Mac, iPhone,
   and iPad.
7. Extend launcher tests for the new paths and ownership plus arbitrary-path,
   writable-launcher, plaintext, symlink, mode, and missing-tool failures.
8. Continue to state that same-user runtime secret isolation is unproven.

**Stop:** any secret appears in argv, output, logs, repository, history,
temporary files, or AI-visible configuration.

## 16. Phase J — Validate the complete workflow

1. Install lockfile-defined dependencies in the clean `developer` clone.
2. Run deterministic static and launcher verification appropriate to the actual
   implementation.
3. Stan starts `orb-dev` and enters the passphrase; AI tools do not.
4. Verify localhost, Bonjour, and LAN-IP access on Mac, iPhone, and iPad.
5. In Safari, Chrome, and Edge separately verify trusted TLS, login/logout,
   dashboard load, one reversible create/update flow, refresh, and persistence.
6. Verify Codex and Claude independently against the same clone and enforced
   boundaries.
7. Confirm no personal browser data or Stan-home content is reachable.
8. Do not run model evals unless implementation changes Orb's conversation
   surface. Report nondeterministic sample sizes honestly.

## 17. Phase K — Cut over and retire the old setup

1. Complete one normal development cycle under `developer`.
2. Cold reboot and reverify FileVault, AI login, browser profiles, TLS, dev
   startup, Git handoff, and rollback.
3. Stop routine development from Stan's administrator account.
4. Apply Stan's old-clone decision:
   - release-only: keep a clean human-operated clone, remove build artifacts,
     and never open it with AI tools; or
   - retire: confirm remote completeness and remove it only through a separate,
     recoverable, explicitly approved action.
5. Retain old encrypted storage, launcher, TLS, and account state until the
   retirement window passes and rollback is verified.
6. Update governing docs, handoff, changelog, and Knowledge Repository only
   with verified implementation facts.

## 18. Acceptance matrix

| Area | Must work | Must fail/remain absent |
|---|---|---|
| Account | `developer` login and daily use | admin membership; silent elevation |
| Personal data | administrator account unchanged | reads of personal home, Keychain, SSH, browsers, AI state, projects, secrets |
| Repository | clean independent clone | shared writable clone; `.env.local`; ignored-state or credential copy |
| Codex | fresh login; workspace edit | Full Access; Stan-home read; policy override; push/deploy |
| Claude | fresh login; workspace edit | Stan-home read; policy override; push/deploy |
| Browsers | persistent local Safari/Chrome/Edge tests | personal Apple/Google/Microsoft sync/import |
| Secrets | human unlock starts Orb | plaintext/passphrase/token in repo, logs, argv, history, temp files |
| TLS | trusted Mac/iPhone/iPad access | warning bypass; copied old CA private key |
| Release | approved human path works | routine AI production authority |
| Rollback | old setup recoverable during window | premature deletion of only working copy |

All negative tests are mandatory before cutover.

## 19. Rollback

At a failed gate: stop using `developer`, stop/lock the server, revoke only new
development credentials, remove new app permissions, return to the unchanged
administrator setup, preserve only non-secret evidence, and inspect the
`developer` home before any account deletion. Rollback must not restore
plaintext `.env.local`, broaden AI permissions, or silently grant production
authority.

## 20. Performance and eval classification

This plan is documentation-only: performance instrumentation and model evals
are not applicable.

Implementation must time and verify login, Codex/Claude startup, dependency
installation, dev startup, file-watch response, and Mac/iPhone/iPad access. If
application runtime or an existing critical flow changes, apply the normal
instrumentation/matrix rule. Any Orb conversation change also requires matching
`scripts/eval-cases.ts` coverage and the risk-based Stan-run eval gate.

## 21. Claude Code review protocol

Claude performs a read-only Round 1 review and does not edit the canonical plan
or implement any step. If Stan later authorizes a packet, Claude claims only
its ledger and `docs/orb-non-admin-development-account-reviews/*`, then writes
`docs/orb-non-admin-development-account-reviews/claude-R1-2026-08-11.md`.

Use stable IDs `claude-R1-C1`, `claude-R1-C2`, and so on. Each comment includes
severity, section, finding, evidence classification, risk, and recommendation.

### Copy/paste review instruction

```text
Perform a read-only Round 1 security and operability review of
docs/orb-non-admin-development-account-plan.md.

Follow Orb's AGENTS.md session-start and concurrency requirements. Do not edit
the canonical plan, app code, launcher, settings, credentials, account state,
permissions, GitHub/Vercel/provider state, release files, or database.

Evaluate the complete migration into the Standard macOS account with full name
"Dev E. Loper", short name "developer", and home /Users/developer. Verify that
Codex, Claude Code, Safari, Chrome, Edge, local HTTPS, Mac/iPhone/iPad testing,
encrypted startup, Git/release separation, rollback, and old-clone disposition
are complete.

Look for privilege escalation, personal-data leakage, user-writable policy
mistaken for enforcement, secret exposure, unsafe installers/updates, browser
sync leakage, push/deploy bypasses, incomplete recovery, and claims unsupported
by tests. Cross-check ORB-374, ORB-375, the local-unlock draft, and current
official vendor documentation where needed.

Return a complete packet with stable comment IDs. For every comment include
severity, section, finding, evidence classification, risk, and recommendation.
End with: Ready for Stan's decisions; Ready after specified revisions;
Re-review required; or Direction should not proceed. Do not approve
implementation or summarize away individual findings.
```

## 22. Implementation gate

Implementation remains blocked until Claude's packet is preserved, every
comment has a disposition, Stan decides section 6, Stan marks this plan
Approved, exact managed-policy/launcher/TLS/Git/secret/deletion procedures are
reviewed, and Stan explicitly authorizes the first phase. Plan approval never
authorizes deletion; that remains separately approved after acceptance.

## 23. Sources

Orb: `docs/orb-374-ai-tool-local-access-security-plan.md`,
`docs/security-hardening-phase-1.md`, `docs/orb-ai-local-unlock-plan.md`,
`docs/multi-agent-concurrency-protocol.md`, and `scripts/security/orb-dev`.

Official guidance:

- Apple users: https://support.apple.com/guide/mac-help/mchl3e281fc9/mac
- Apple FileVault: https://support.apple.com/guide/mac-help/mh11785/mac
- Apple Safari profiles: https://support.apple.com/guide/safari/create-profiles-ibrwf3a9e7d6/mac
- OpenAI Docs approvals: https://learn.chatgpt.com/docs/agent-approvals-security.md
- OpenAI Docs config: https://learn.chatgpt.com/docs/config-file/config-basic.md
- OpenAI Docs managed policy: https://learn.chatgpt.com/docs/enterprise/managed-configuration
- Anthropic installation: https://code.claude.com/docs/en/installation
- Anthropic managed settings: https://code.claude.com/docs/en/admin-setup
- Google Chrome profiles: https://support.google.com/chrome/answer/2364824
- Microsoft Edge profiles: https://support.microsoft.com/en-us/edge/sign-in-and-create-multiple-profiles-in-microsoft-edge

---

## 24. Claude Code Round 1 review — 2026-08-12

**Reviewer:** Claude Code (Opus 5) · **Scope:** read-only · **Verdict at close:**
Re-review required — superseded by the hold notice above; no Round 2 will occur.

No canonical plan text was edited during the review itself, and no account,
credential, permission, application, GitHub, Vercel, database, dev-server, or
production state was changed. This section was added afterwards at Stan's
direction (see the deviation note in the hold notice).

### 24.1 Verification performed

Baseline claims in section 4 were checked against the live machine rather than
reasoned about. This changed the review materially — see `claude-R1-C1`.

| Check | Result |
|---|---|
| `fdesetup status` | **FileVault is On** — settles section 4's "unverified" row; the command needs no elevation and failed only under Codex's sandbox |
| `ls -lde /Users/stanleybaptista` | `drwxr-x---+`, owner `stanleybaptista`, **group `staff`**; sole ACL is `group:everyone deny delete` (no read restriction) |
| `dscl . -read /Groups/staff PrimaryGroupID` | `20` — the same gid as Stan's primary group |
| `/Users/stanleybaptista/Projects` | `drwxr-xr-x` (0755); contains `helm`, `orb`, `orb.worktrees`, `shared`, `todos`, `_Sessions`, `Documents` |
| `~/.claude`, `~/.codex` | `drwxr-xr-x` (0755); `~/.codex/auth.json` is `0600`, `~/.claude/sessions` is `0700` |
| `~/Project-secrets` | `drwx------` (0700) — correctly protected |
| `~/.ssh` | **does not exist** |
| `/opt/homebrew` | `drwxr-xr-x stanleybaptista:admin`; `/opt/homebrew/bin` is `drwxrwxr-x` (admin-group writable) |
| `node` / `npm` | `/usr/local/bin/node`, `root:wheel`; `/usr/local/lib/node_modules` root-owned |
| `/Applications/ChatGPT.app`, `Claude.app` | owner `stanleybaptista`, `0755` — **not** `root:wheel` |
| `brew info --cask claude-code` | valid cask, **2.1.220**, artifact `claude` — section 10.2 is correct |
| git remote / credentials | HTTPS `https://github.com/sbaptista/orb.git`; `credential.helper = osxkeychain` (global and local) |
| `gh` CLI | not installed — repo visibility **could not** be determined |

### 24.2 Findings

Evidence is classified per `AGENTS.md`: **Verified** (ran it / read the code path
/ queried the data), **Inferred** (follows from something verified), **Suspected**
(plausible, unchecked).

#### claude-R1-C1 — Standard-account isolation is not the default; it must be created
**Critical · Sections 3, 9 · Verified (permissions), Inferred (new-user group)**

Section 3 asserts a `developer` process "should not be able to read Stan's
personal home ... unless an administrator deliberately grants access." That is
false before any grant is made. Stan's home is `0750` with group `staff`; `staff`
is gid 20; macOS assigns gid 20 as the primary group of new local accounts.
`developer` would land inside the group that already holds `r-x` on Stan's home,
making everything at `0755` beneath it readable: **all of `~/Projects`** (Helm,
shared `AGENTS.md`, todos, the Orb clone and worktrees), **`~/.claude`**
(transcripts, telemetry, shell snapshots, session env, backups), and
**`~/.codex`** (all but `auth.json`). Only `~/Project-secrets` is genuinely out
of reach.

The group membership is Inferred, not Verified — the account does not exist. One
command in Phase B would settle it.

*Risk:* the migration ships believing it has a boundary while the AI account can
read nearly all of Stan's project work and both tools' histories. Phase C would
catch it, but as a stop condition with no remedy.

*Recommendation:* rewrite section 3 as "provides, once these are applied"; add an
explicit hardening step (assert the new account's `PrimaryGroupID`, then tighten
`/Users/stanleybaptista` to `0700` or move `developer` off `staff`, then re-test).
Section 9.5's "do not loosen Stan's home permissions" forbids the wrong direction
and never requires the right one.

#### claude-R1-C2 — The Phase C isolation test passes for the wrong reasons
**Critical · Section 9.1 · Verified**

`test ! -r <path> && test ! -r <path> && …` has three live defects:

1. **`test ! -r` is true for a path that does not exist.** `~/.ssh` is absent, so
   that clause passes while proving nothing; any future rename silently converts
   a real check into a pass.
2. **The `&&` chain short-circuits** — one exit status for five paths; the first
   failure hides the rest and you cannot tell which path leaked.
3. **It tests the directory, not the tree** — it never reaches the group-readable
   files inside `~/Projects/helm`, which is where the real exposure sits.

*Risk:* a green Phase C is the gate that authorizes installing the AI tools. This
is the "looks like it authenticates" failure from the cron incident, relocated.

*Recommendation:* per-path loop printing path, existence, mode, owner and read
result separately; a positive control proving the test can report success; at
least one deep read attempt inside `~/Projects/helm`. Absence must report
`ABSENT`, never `PASS`.

#### claude-R1-C3 — Push denial rests on string-matching a model's tool call
**High · Sections 10.5, 13.4–13.5, 18 · Verified (documented gap), Inferred (applies to managed settings)**

Section 13.4 rightly calls the repo's `.claude/settings.json` "convenience, not
enforcement." Section 10.5 then rests the real weight on administrator-owned
managed settings denying `git push`. `shared/AGENTS.md` records that Claude
Code's deny matching strips a *fixed* wrapper list and **not** `npx`,
`docker exec`, `devbox run`, `direnv exec`, or `mise exec`; managed settings
inherit that gap verbatim, and `gh`, raw `git send-pack`, and `.git/config` edits
are uncovered too. Separately, section 18 lists "Release" and "push/deploy" as
distinct rows — on this project they are **one control**, because pushing `main`
*is* the production deploy.

*Recommendation:* make push impossible by **capability, not policy** — a
read-only credential for `developer` — and demote policy denial to defence in
depth. Merge the duplicated matrix rows; add the wrapper-stripping gap to
section 3's limits.

#### claude-R1-C4 — The clone has no credential story, and the obvious fix restores push
**High · Section 11 · Verified (HTTPS remote + osxkeychain), Suspected (repo private — unverified)**

Section 11.1 clones over HTTPS with no authentication step while 11.4 forbids
copying `.ssh`, Keychain, or credential storage. If the repo is private that
command fails, and the natural remedy is a PAT in the fresh Keychain, which
`credential.helper = osxkeychain` will persist. A default-scoped PAT carries
write access — quietly granting the production authority decision 6.4 exists to
withhold, with no visible change to any policy file.

*Recommendation:* record repo visibility in section 4; add an explicit credential
sub-step naming type, exact scopes, storage and revocation; make "credential
scope is read-only" a *tested* row in section 18 by attempting a push and
requiring **server-side** rejection. That test cannot be bypassed by wrapper
tricks, which is what makes it worth more than the managed-settings test.

#### claude-R1-C5 — The secret bundle is all-or-nothing, and lands in the AI's own account
**High · Sections 15.4, 6.5 · Inferred from the ORB-375 containment model**

Section 15.4 transfers `orb.env.enc` wholesale — the production credential set
(service-role Supabase key, `DATABASE_URL`, `ORB_API_SECRET`, provider keys).
After unlock these live in a process running as `developer`, beside the AI tools.
Sections 3 and 15.8 admit same-user runtime isolation is unproven, but never draw
the conclusion: **the account boundary protects Stan's personal data and buys
very little for Orb's production data**, because the crown jewels are moved to
the AI's side of the line by design.

*Recommendation:* add a per-variable secret inventory to section 15 (moves /
replaced with a development-scoped equivalent / stays behind), and make decision
6.5 three-way rather than two-way with the residual exposure stated per option.
Ranked highest of these findings for long-term consequence.

#### claude-R1-C6 — The passphrase entry path is hijackable from inside `developer`
**High · Sections 15.3, 16.3 · Inferred**

Section 15.3 correctly puts the launcher beyond `developer`'s reach, but 16.3 has
Stan type the passphrase into a shell **inside the developer account**, where
`~/.zshrc`, `~/.zprofile`, `~/.local/bin` and `PATH` all remain writable. A
compromised tool need not modify `orb-dev` — it need only shadow the name or add
one line to a shell rc file.

*Recommendation:* invoke by absolute path from a root-owned location; root-own
`developer`'s shell rc files or verify their integrity at unlock; add a negative
test that a `PATH`-shadowed `orb-dev` is not what runs. Record in section 3 that
passphrase entry inside the developer account is a same-account trust
assumption, not a boundary.

#### claude-R1-C7 — The migration breaks the binding concurrency protocol
**High · Sections 5, 17.4 · Verified against `docs/multi-agent-concurrency-protocol.md`**

Section 5 keeps a release-only clone in the administrator account while section 2
puts both agents in `/Users/developer/Projects/orb`. The concurrency protocol
makes `ACTIVE_WORK/` claims **working-tree signals read from disk, with no
committed audit trail**, and makes the Release-bookkeeping claim exclusive over
`HANDOFF.md`, `package.json`, `lib/version.ts` and `lib/changelog.ts`. Two clones
in two accounts means two ledgers that cannot see each other, and release
bookkeeping done in the admin clone leaves no signal at all in the tree the
agents read — structurally re-creating the 2026-07-29 v0.6.256 collision.

*Recommendation:* name the canonical clone for release bookkeeping during and
after migration, and either keep all four files edited only in the developer
clone or amend the concurrency protocol in the same change.

#### claude-R1-C8 — Application updates train elevation approval, and no phase owns them
**Medium · Sections 10, 17 · Verified (ownership), Inferred (updater behavior)**

`ChatGPT.app` and `Claude.app` are owned by `stanleybaptista` at `0755`, not
`root:wheel`, and Homebrew is `stanleybaptista:admin`, so `developer` cannot
`brew upgrade`. Every self-update attempt from the developer session either fails
or raises an administrator prompt — and section 3 already names "typing an
administrator password for an AI-proposed operation" as an escalation vector. No
phase assigns update ownership.

*Recommendation:* add an update policy (`chown -R root:wheel` the apps or accept
stan-ownership explicitly; disable in-app auto-update; route updates through a
scheduled administrator action), plus the standing rule that an admin prompt
arising from a developer-session action is declined and re-performed from Stan's
session.

#### claude-R1-C9 — `developer`'s own home permissions are never set
**Medium · Sections 8, 11.1 · Verified**

Section 11.1 sets `0700` on `/Users/developer/Projects` but nothing sets
`/Users/developer`, `~/.codex`, or `~/.claude`. Left at macOS defaults these
reproduce the C1 pattern inside the new account.

*Recommendation:* set and verify `0700` on all four, and list the modes in
section 18.

#### claude-R1-C10 — The toolchain trust root is the account being isolated from
**Medium · Sections 3, 10.7 · Verified**

`/opt/homebrew` is `stanleybaptista:admin` with `bin` group-writable by `admin`.
Section 10.7's requirement is satisfied, but the inverse deserves stating: every
Homebrew binary `developer` executes is controlled by Stan's account. The
boundary is one-directional — correct for this threat model, but section 3 reads
as though it were symmetric.

*Recommendation:* one sentence in section 3 — the boundary protects Stan from
`developer`, not `developer` from Stan; compromise of the administrator account
compromises the development account by construction.

#### claude-R1-C11 — The branch-only Git option has no downstream propagation
**Medium · Sections 6.4, 17 · Verified against `AGENTS.md`**

Decision 6.4's middle option replaces "AI commits on `main` locally, Stan pushes"
with a PR/merge model. Nothing in Phase K, section 18, `AGENTS.md`, or the
handoff conventions is updated to match.

*Recommendation:* state, per 6.4 option, the resulting release workflow and which
governing documents change. A decision whose consequences are not written down
gets made on convenience.

#### claude-R1-C12 — Section 4 baseline corrections
**Low · Section 4 · Verified**

- **FileVault: On** — the row can move from unverified to verified.
- **`~/.ssh` does not exist** — record the absence, or Phase C's reference to it
  reads as coverage (see C2).
- Missing rows that are load-bearing for findings above: Stan's home mode and
  group, `/opt/homebrew` ownership, node install location, git credential helper,
  repo visibility.

#### claude-R1-C13 — Section 10.2 verified correct
**Informational · Section 10.2 · Verified**

`brew install --cask claude-code` is a real cask (2.1.220, artifact `claude`), and
no standalone `claude` exists on this machine, matching section 4. The cask
installs into stan-owned Homebrew, so updates require Stan (see C8). Section
10.6's "do not invent policy keys" discipline should extend to install commands
generally — this one happens to be right.

#### claude-R1-C14 — The acceptance matrix has no row for the vectors above
**Medium · Section 18 · Verified**

"All negative tests are mandatory" is the right posture, but the matrix predates
C1–C6. Missing: group-readable home after hardening; deep reads inside
`~/Projects/helm`; `PATH`/rc shadowing of `orb-dev`; server-side push rejection
with the actual credential; admin-prompt-on-update; per-variable secret
inventory. Each should be phrased as an executed test with an observable result,
not as a property.

#### claude-R1-C15 — Rollback omits credential revocation specifics
**Low · Section 19 · Verified**

"Revoke only new development credentials" does not enumerate them. After C4 there
is at least a GitHub PAT or deploy key, fresh OpenAI and Anthropic sessions, and
a `developer` login Keychain.

*Recommendation:* list them, and destroy the `developer` Keychain as part of
account deletion rather than leaving it in a home directory that survives the
account.

### 24.3 Closing assessment

The plan was unusually disciplined: phase gating, an explicit "what it does not
provide" section, refusal to invent policy keys, recognition that a
repo-writable `.claude/settings.json` is not enforcement, and honest treatment of
same-user runtime limits. C2 and C13 exist only because the plan wrote concrete
commands down.

The verdict was nonetheless **Re-review required**, because C1 and C2 together
meant the migration as written would have produced an account able to read nearly
all of Stan's project work and both AI tools' histories while Phase C reported
success, and because C3–C7 were structural rather than editorial. That verdict is
now moot: Stan has stopped the direction rather than revising it.

---

## 25. Findings that outlive this plan

These are true of the machine and the current controls regardless of whether any
migration ever happens. They are the only part of this document that should be
carried forward.

1. **Stan's home is group-readable by any future local account** (C1).
   `/Users/stanleybaptista` is `0750`, group `staff`, and macOS gives new local
   accounts `staff` as their primary group. `~/Projects` (including Helm and
   `shared/`), `~/.claude`, and `~/.codex` are `0755` beneath it. No second
   account exists today, so nothing is currently exposed — but the exposure is
   one "Add User" click away, and it would be silent. `~/Project-secrets` (0700)
   and `~/.codex/auth.json` (0600) are correctly protected. Tightening
   `/Users/stanleybaptista` to `0700` is a one-command, one-account change that
   is worth making on its own merits, independently of this plan.

2. **FileVault is On** (C12) — verified 2026-08-12 via `fdesetup status`, which
   needs no elevation. The earlier "unverified" record reflected a sandbox
   limitation in one tool, not an unknowable fact. Worth remembering the general
   shape: a tool-specific failure was recorded as a property of the system.

3. **The push gate is policy matching, not capability denial** (C3). The deny
   rule in the tracked `.claude/settings.json` is a real guardrail and `git push`
   was verified blocked, but `shared/AGENTS.md` already records that wrapper
   stripping misses `npx`, `docker exec`, `devbox run`, `direnv exec`, and
   `mise exec`, and it covers neither `gh` nor `.git/config` edits. The
   structural control — a credential that cannot push — remains available and
   unused. This is independent of any account migration.

4. **`test ! -r` returns true for a path that does not exist** (C2). Any check
   written in that form reports "protected" for something that is merely absent.
   The same shape as the cron guard that skipped authentication when its secret
   was missing: absence of a thing is being read as success.

5. **Secrets are an all-or-nothing bundle** (C5). `orb.env.enc` decrypts as one
   unit, so any environment that can start the dev server necessarily holds the
   production service-role key and `DATABASE_URL`. Per-variable scoping was never
   designed. This is the constraint that made the account boundary worth much
   less than it appeared, and it will constrain any future isolation attempt in
   exactly the same way.
