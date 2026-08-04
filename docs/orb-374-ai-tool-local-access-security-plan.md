# ORB-374 — AI tools with local-file access: security hardening plan

**Status:** Draft for review; implementation is blocked until Stan approves this document
**Plan owner:** Codex
**Created:** 2026-08-03 17:07 HST
**Last updated:** 2026-08-03 18:39 HST
**Scope:** AI coding tools used on the primary Orb development Mac, their access to local files, commands, credentials, networks, source control, deployments, and databases
**Out of scope:** Changing Orb's end-user security model except where a local AI-development workflow can affect Orb data or production

## 1. Decision sought

Approve a layered security model in which:

1. AI output and model judgment are never treated as security boundaries.
2. Routine Orb work uses a restricted workspace with secrets denied, outbound network access limited, and consequential actions requiring deterministic human approval.
3. Dependency installation, untrusted repositories, and untrusted documents run in an ephemeral Linux container or VM with no host secrets.
4. Production credentials and production mutations are not directly available to a general-purpose AI shell. They are exposed only through narrow, audited, human-approved broker commands.
5. The first implementation action is incident containment and credential rotation because sensitive values were rendered into an AI-tool transcript during this audit.

No implementation may begin until Stan approves this plan. After approval, the approved plan and all pertinent comments, reviewer identities, timestamps, dispositions, and resulting revisions must be written to the Knowledge Repository before implementation begins.

## 2. Executive finding

The present workflow relies too heavily on approvals and agent instructions while several AI tools can read broadly, invoke general-purpose interpreters, use high-privilege database credentials, or persist detailed transcripts. That is unsafe against accidental disclosure and indirect prompt injection.

The highest-priority verified findings are:

- The shared Orb secret file is reachable through a repository symlink, is readable by every local account, and contains many unrelated development and production credentials in one place.
- Secret values from that file were rendered into an AI-tool transcript during the audit. This is a verified exposure event even though misuse has not been established.
- Claude and Gemini have durable approvals broad enough to perform material source-control, deployment, database, or arbitrary-code actions with less review than those actions warrant.
- Codex, Gemini, and Mistral Vibe retain representative session or message records with permissions readable by other local accounts. Claude's representative project transcript is owner-only.
- No active local Git hook or repository workflow was found that prevents a secret from being committed; the GitHub repository's server-side secret-scanning and branch-protection settings have not yet been verified.

The target is not “zero prompts” or “put everything in Docker.” It is a usable system where the blast radius is deliberately bounded even when a model is wrong, a prompt is malicious, a dependency is compromised, or a user approves the wrong thing.

**Proposed interim operating restriction:** until Phase 0 is complete and accepted, AI coding-agent use on Orb is limited to plan review in a no-secret/no-mutation context and the controlled Phase 0 containment workflow. Containment permits no unrelated external content, unrestricted network egress, general-purpose production credentials, or work outside the exact steps approved by Stan. A hidden shortcut, temporary permission broadening, or undocumented bypass is a security exception and is recorded with the same discipline as an incident. Because this document is still a draft, the restriction is not self-activating: Stan must decide in section 13 whether it takes effect immediately or when he approves the plan.

## 3. Evidence standard

- **Verified:** directly observed in files, permissions, configuration, command output, repository history, or an authoritative source. The evidence is named.
- **Inferred:** follows from verified evidence but was not exercised end to end.
- **Unverified:** requires external settings, credentials, a destructive test, or information not locally available.
- **Recommendation:** proposed control; not current state.

Sensitive values must never be copied into this plan. Evidence records names, classes, paths, counts, and permissions—not secret contents, personal identifiers, transcript text, or full environment dumps.

The same rule binds audit and evidence gathering, not only implementation. Never print or return a whole secret-bearing file. Enumerate environment variable names by parsing only the text before the first `=` and discard the value field before output; use `stat`, `readlink`, counts, hashes, and redacted policy summaries wherever possible. If a tool cannot prove that its inspection suppresses values before output, it must not inspect the secret-bearing source.

## 4. System and hardware context

### 4.1 Primary host

Verified on 2026-08-03:

| Attribute | Observed state | Planning consequence |
|---|---|---|
| Computer | 14-inch-class MacBook Pro, Apple M5 | Native Apple-silicon Linux virtualization is viable. |
| CPU | 10 cores: 4 performance, 6 efficiency | A 4-vCPU isolated development environment should preserve useful host responsiveness; benchmark before standardizing. |
| Memory | 16 GB unified memory | A lightweight container VM is practical. A continuously running full macOS VM plus browser, Next.js, and AI clients may create memory pressure. |
| Free storage | Approximately 254 GiB | Enough for a pilot VM/container disk, but images and `node_modules` need pruning and a size cap. |
| OS controls | System Integrity Protection enabled | Valuable host protection, but it does not restrict files readable by the logged-in user. |
| Installed isolation tools | No Docker Desktop, Podman, Colima, Lima, Multipass, or Tart executable found | Tool choice and installation are implementation decisions, not existing controls. |

Hardware serial numbers and device identifiers were observed by the system profiler but are intentionally excluded.

### 4.2 Workload needs

The isolation solution must preserve:

- Next.js/TypeScript editing, builds, linting, and deterministic tests.
- Local server access on port 3001 from the host and, when explicitly enabled, iPad/iPhone on the local network.
- Git diff and local commits, while keeping push/deploy behind Stan's approval.
- Fast file watching and dependency caches.
- Multiple AI clients without requiring each to receive the complete production secret set.

Model evals remain Stan-run because they incur cost and exercise external models. The isolated environment must support the same commands without automatically receiving production credentials.

## 5. Threat model

### 5.1 Assets

- Source code, uncommitted work, Git history, and release records.
- API keys, Supabase service-role access, database connection strings, deployment credentials, email/push credentials, and provider billing/admin credentials.
- Production and development data, including personal todo and knowledge data.
- AI transcripts, prompts, retrieved files, tool output, and local histories.
- The Mac host, other projects, Downloads/Documents, browser sessions, SSH/keychain material, and removable storage.
- Stan's authorization boundary: approval to edit, commit, push, deploy, delete, rotate, or mutate production.

### 5.2 Adversaries and failure modes

- Accidental model behavior: wrong path, overly broad command, bad assumption, fabricated verification, or destructive retry.
- Indirect prompt injection in a repository file, issue, web page, document, image, package output, test fixture, or another agent's message.
- Malicious or compromised dependency, package lifecycle script, MCP server, plugin, skill, extension, container image, or update channel.
- Credential disclosure through tool output, shell expansion, logs, transcripts, screenshots, crash reports, telemetry, Git history, or removable-media loss.
- Another local account reading world-readable secrets or AI records.
- Unauthorized or mistaken production change through a general-purpose shell holding service-role, database, GitHub, Vercel, or provider-admin authority.
- Cross-agent collision or laundering: one agent treats another agent's generated content or approval description as trusted.

### 5.3 Trust boundaries

1. Human instruction versus model-generated plan.
2. Trusted source code versus all externally sourced content.
3. Repository workspace versus the rest of the host filesystem.
4. Development data/credentials versus production data/credentials.
5. Read actions versus writes; reversible writes versus destructive or externally visible actions.
6. Agent process versus MCP/plugin/skill/tool subprocesses.
7. Host versus container/VM; container/VM versus any bind mount, shared clipboard, shared folder, socket, or credential injection.
8. Local commit versus remote push and production deployment.

The two primary boundaries—the defaults for every new workflow decision—are:

- **Workspace versus host:** can untrusted content or an agent reach anything outside the claimed Orb workspace?
- **Development/test versus production:** can a routine development session obtain production data, credentials, or mutation authority?

### 5.4 Security premise

Prompt injection cannot be reliably solved by a stronger prompt. OWASP documents that indirect content can cause unauthorized functions, command execution, or disclosure, and recommends least privilege, separation of untrusted content, adversarial testing, and human approval for high-risk actions. OWASP also warns that an approval dialog can be forged or misleading when its description comes from attacker-influenced model context. Therefore approvals must display the resolved executable action, exact targets, destination, credential class, and impact using trusted code—not only an AI-authored summary.

## 6. Best-practice control baseline

### BP-1 — Deny by default and grant per task

- Default AI access is read-only or workspace-write within one claimed project.
- Deny reads of secret vaults, `.env*`, key material, browser profiles, AI transcripts, shell histories, other projects, and personal folders unless a narrowly defined task requires one path.
- Grant network destinations, command families, and additional paths for one task or one run; avoid permanent wildcard approvals.

### BP-2 — Separate identities and credentials

- Separate development, test, and production identities.
- Separate read-only data inspection from data mutation.
- Give each provider/tool only the credential it needs; eliminate the shared “all secrets” file as an agent-readable interface.
- Prefer short-lived or revocable credentials and secret brokers. Never bake secrets into images, source, shell history, or agent configuration.

### BP-3 — Consequential actions use trusted approval gates

The following always require Stan's explicit approval at execution time, regardless of model confidence or previous approval:

- remote push, release, deploy, production database write/DDL, credential creation/rotation, external message, purchase, destructive file action, permission broadening, or installation of an executable plugin/MCP/skill.

The prompt must be generated from the resolved command or API request and show exact targets. “Allow always” is prohibited for these classes. For example, a production database approval should show trusted, resolved fields such as `ENVIRONMENT=production`, `DATABASE=<resolved name>`, `ACTION=DELETE`, `TABLE=todos`, `FILTER=is_archived=true`, and `MATCHED_ROWS=12`; it must not rely on “clean up archived todos” as the model-authored description.

### BP-4 — Treat external content as hostile data

- Web pages, GitHub issues, PDFs, images, emails, packages, logs, copied terminal output, and other agents' text may contain instructions but never acquire authority from their content.
- An agent reviewing untrusted content cannot simultaneously hold production credentials or an unrestricted outbound channel.
- Transitions from reading untrusted content to a consequential tool call require a fresh, deterministic approval.
- Orb example: a session reviewing a GitHub issue has no database credential and no arbitrary HTTP upload destination, even if the issue requests a database check or asks the reviewer to post diagnostics elsewhere.

### BP-5 — Minimize tools and supply chain

- Disable unused plugins, MCP servers, skills, browser/computer-use features, remote control, and model-provider integrations.
- Allowlist exact MCP/plugin identities and sources; pin versions or immutable digests where supported.
- Review repository-local agent configuration before trusting a workspace.
- Run package lifecycle scripts and newly downloaded executables only in the isolated tier.

### BP-6 — Constrain network egress

- Default shell network access is off.
- Allow only task-required domains and local endpoints.
- Block arbitrary upload destinations while any confidential workspace is mounted.
- Keep local/private-network binding off unless the dev-server acceptance test explicitly needs it.

### BP-7 — Protect records and minimize retention

- AI sessions, logs, caches, checkpoints, and histories are owner-only (`0600` files; `0700` directories).
- Default AI transcript and detailed tool-log retention is 30 days where the tool supports it, with a maximum routine retention of 90 days. Incident evidence may be retained longer in an encrypted, access-controlled location with a documented owner and deletion condition.
- Provide a deliberate, verified purge procedure for tools that do not enforce retention automatically.
- Disable detailed prompt logging and telemetry where not needed; ensure crash/feedback paths do not include secrets.

### BP-8 — Prevent and detect secret exposure

- Pre-commit and pre-push secret scanning use a reviewed scanner and project-specific patterns.
- CI/server-side scanning provides a second independent gate where the GitHub plan supports it.
- Scanning is supplemented by safe command practices: never print whole env files, never enable shell tracing around secrets, and redact subprocess output.
- Any secret rendered to an AI transcript or committed is presumed exposed and rotated.

### BP-9 — Recoverability and auditability

- Work occurs on branches with small commits and reviewed diffs.
- Database and destructive scripts validate the target environment, default to dry-run, and require explicit confirmation.
- Backups and restore procedures are tested; container/VM environments are reproducible and disposable.
- Security checks record control state without recording secret values.
- Inter-agent status claims about working-tree state, active claims, version, deployment/push state, or authorship are verified against the underlying artifact before being relied upon or written into a durable record. Relaying a claim through a human or another agent is not verification.

### BP-10 — Continuous governance

- Re-audit on AI-tool installation/update, new plugin/MCP/skill, new credential, permission change, or incident.
- Review the control profile at least quarterly.
- Run the complete ORB-374 audit at least annually and after a major AI-tool or isolation-architecture change; use focused delta audits for ordinary additions and updates.
- Use NIST's continuous Govern, Map, Measure, Manage cycle rather than treating this plan as a one-time checklist.

## 7. Isolation architecture: native sandbox, container, VM, and external media

### 7.1 Options

| Option | Isolation | Performance on this Mac | Main weaknesses | Appropriate use |
|---|---|---|---|---|
| Native tool sandbox plus OS permissions | Moderate when read-denies, workspace-only writes, and network restrictions are actually enforced | Best; negligible overhead | Tool-specific gaps; logged-in user may still have broad readable files; different tools enforce different policies | Routine work on reviewed Orb source with no hostile artifacts |
| Linux container inside Docker Desktop or Lima VM | Stronger process/filesystem boundary; on macOS the Linux VM adds a host boundary | Good with approximately 4 vCPU and 4–6 GB RAM; file mounts and watchers must be benchmarked | Writable bind mounts modify host; Docker socket/privileged mode can defeat isolation; secret mounts reintroduce exposure | Builds, dependency installs, untrusted documents/code, deterministic tests |
| Dedicated disposable Linux VM | Strongest practical local boundary with independently controlled disk, network, user, and snapshots | Acceptable for focused high-risk work; 6–8 GB allocation may pressure a 16 GB host when browsers and AI clients are active | More setup, storage, updates, context switching, and slower sync | Unknown repositories, malware-adjacent analysis, high-risk package/tool evaluation |
| Full macOS VM | Strong boundary with native macOS behavior | Highest RAM/storage cost; likely poor as the default on a 16 GB host | Licensing/setup complexity and material memory contention | Only for a Mac-specific high-risk test that Linux cannot represent |
| Remote ephemeral environment | Strong host separation if no local secrets are copied | Local Mac remains responsive; dependent on network | Source/data leaves host; cloud trust, cost, and latency; credentials still need brokering | Optional future tier after privacy and provider review |

### 7.2 Recommended three-tier operating model

#### Tier A — Restricted native workspace

Use for normal planning, source edits, linting, and inspected local tests.

- Workspace read/write only within the exact claimed worktree root. For the current main workspace that root is `/Users/stanleybaptista/Projects/orb`; every other worktree and project root is denied unless separately claimed and explicitly granted for that task.
- No production credential in the agent environment.
- Network off by default; narrowly approved reads when needed.
- No durable approvals for interpreters, deploy, DB, push, or broad file access.

#### Tier B — Disposable Linux development container

Use for `npm install`, package lifecycle scripts, builds of unfamiliar changes, external documents, and untrusted repository content.

- Start from a pinned image digest, run as non-root, drop capabilities, read-only root filesystem where practical, no privileged mode, and no Docker socket.
- Copy or clone source into a VM-managed volume. Avoid a writable bind mount of the live repository for hostile workloads. Export changes as a patch for human review.
- Hostile repositories default to patch-only exchange, not live host edits: clone or copy into the disposable environment, work and test there, export `git diff --binary` plus a redacted verification report, inspect both on the host, and only then apply the patch to a clean claimed branch.
- Provide no host `.env.local`, home directory, Downloads, SSH agent, keychain, browser profile, AI histories, or other project mount.
- Egress allowlist only for package registries and task-specific provider endpoints.
- Proposed pilot ceiling: 4 vCPU, 4 GB initially, up to 6 GB only if measured builds require it; 1–2 GB swap; 40–60 GB capped disk image.
- Publish port 3001 only when needed. Bind to loopback by default; local-LAN acceptance requires a deliberate temporary profile.

#### Tier C — Disposable VM

Use when content or executable code is materially untrusted, the container engine itself is in scope, or the task needs stronger separation.

- Fresh snapshot/clone, separate non-admin account, encrypted disk, controlled NAT/egress, no shared clipboard, no host folder, and no host credentials.
- Transfer source in as an archive or clone; transfer results out as text patches or reviewed artifacts.
- Proposed pilot: Linux VM, 4 vCPU, 6 GB RAM, 60 GB sparse disk. Shut down when not in use. Do not run simultaneously with unnecessary AI clients or memory-heavy local services.

Tier C is not a dependency for ordinary Orb development. Hardened Tier A and Tier B provide the day-to-day path; Tier C is implemented only when a documented high-risk scenario justifies its operational cost.

These resource values are hypotheses, not final settings. Acceptance requires measuring idle host memory, clean install, Next.js build, lint, file-watch responsiveness, dev-server latency, and Mac/iPad/iPhone reachability. No workflow becomes standard if it materially degrades routine work.

### 7.3 External SSD, hard drive, and SD card

External media can contain the container/VM disk, caches, or disposable workspace. It changes storage location and physical custody; it does not create a security boundary by itself.

| Medium | Viability | Recommendation |
|---|---|---|
| Thunderbolt/USB4 NVMe SSD | High. Suitable random I/O for images, `node_modules`, and VM disks. Docker Desktop officially supports moving its disk-image location. | Best external option. Use APFS (Encrypted), a dedicated volume, a short auto-lock policy, and a separate backup. Benchmark against the internal SSD. |
| External spinning HDD | Technically viable but poor random-I/O and latency for package trees, image layers, and live VM disks; cable shock is an availability risk. | Use for encrypted backups or cold snapshots, not the active sandbox. |
| SDXC/UHS-II card in the MacBook slot | Technically mountable and the Mac supports UHS-II, but sustained/random write performance, endurance, and accidental removal vary greatly. | Use only for encrypted transfer or cold, reproducible snapshots. Do not use as the active Docker/VM disk or sole backup. |

External-media requirements:

- APFS (Encrypted) with a password stored separately; Apple documents encrypted formats for removable media.
- Never store the only copy of uncommitted work or the only recovery image on removable media.
- Do not auto-mount the volume into general AI sessions.
- Treat removal as an availability event: stop the VM/container cleanly before disconnecting.
- Keep source images reproducible from pinned configuration; the external disk is not the backup strategy.
- If the primary goal is containment rather than saving internal storage, prefer a disposable VM with no host shares. Merely moving Docker's disk image to an external SSD does not stop a container from reaching explicitly bind-mounted host files.

### 7.4 Pilot decision gate

Before purchasing hardware or choosing a platform, run two short pilots:

1. **Internal-disk Linux isolation pilot:** compare a minimal Docker Desktop or Lima-based environment against native Orb workflows.
2. **External-SSD pilot, only if desired:** repeat using an encrypted USB4/Thunderbolt SSD.

Capture peak host memory pressure, CPU, clean dependency-install time, warm build time, file-watch delay, disk use, dev-server response, battery effect, and platform reachability. Use a versioned benchmark script and a small results document that records hardware, OS, isolation tool/version, resource allocation, command, sample count, median, 95th percentile where meaningful, and raw timing output. Choose the simplest tier that meets the security boundary and keeps routine development comfortable.

## 8. Current-state audit

### 8.1 Secrets and filesystem

| ID | Finding | Evidence/confidence | Risk |
|---|---|---|---|
| A-01 | `.env.local` is a symlink to a shared secret file outside the repository. Its parent directories are `0755` and target is `0644`. | Verified with `readlink` and `stat`. | **Critical:** every local account can traverse and read it. |
| A-02 | The shared file contains 17 variables spanning model APIs, provider admin access, Supabase service role/database, Orb API, email, push, and billing. | Verified by variable-name-only inventory. | **Critical:** one read compromises unrelated systems and environments. |
| A-03 | The complete `.env.local` contents were rendered into an AI-tool transcript during this audit: all 17 entries entered the transcript. Some entries may be public identifiers, but every entry must be classified and every secret-bearing credential in that set treated as exposed. | Verified from the tool output; values are not repeated here. | **Critical incident:** rotate every secret-bearing credential in the exposed set; transcript deletion alone is insufficient. |
| A-04 | Local TLS private key is ignored and `0600`; certificate is `0644`. | Verified with Git ignore and `stat`. | Low for current file permissions; confirm certificate lifecycle. |
| A-05 | `.gitignore` covers `.env*`, PEMs, common AI/worktree folders, build output, and Vercel state. | Verified in `.gitignore`. | Helpful but not a secret-scanning control. |

### 8.2 AI tools

| ID | Finding | Evidence/confidence | Risk |
|---|---|---|---|
| A-06 | Claude's Orb-local configuration permits wildcard Python, `git add`, `git commit`, `git push`, and broad Downloads reads. Shared `AGENTS.md` simultaneously attests that the push rule was removed from a tracked per-project file, but Orb's file is ignored/untracked and still contains the rule. | Verified in `.claude/settings.local.json`, `.gitignore`, Git index, and shared `AGENTS.md`. Helm's state was not inspected. | **High:** arbitrary interpreter plus source/deploy authority defeats narrow approvals; the false attestation can suppress future audits. |
| A-07 | Claude representative project transcript is `0600`. | Verified with `stat`; content not read. | Good control; verify all records and retention. |
| A-08 | Codex user config is `0600`, uses `approval_policy = "untrusted"`, but trusts both Orb and the parent Projects directory. Current runtime can read broadly while writes/network are restricted. | Verified in config and current runtime permission profile. | **Medium/High:** parent trust and broad reads exceed one-project least privilege. |
| A-09 | Codex `session_index.jsonl` and representative session files are `0644`; parent directories are traversable. | Verified with `find`/`stat`; content not read. | **High confidentiality risk** on a multi-account Mac. |
| A-10 | Gemini grants durable access to Orb/Helm secret files and broad commands including `psql`, Vercel, package execution, and Git mutations. Its session files and several configs are `0644`. | Verified from redacted configuration inventory and `stat`. | **Critical/High:** secret access and consequential commands coexist; transcripts are locally readable. |
| A-11 | Mistral Vibe has permission bypass disabled, but telemetry, detailed prompt logging, and session logging enabled. Message logs/config/trust files are `0644`; metadata is often `0600`. | Verified from configuration and `stat`. | **High:** detailed records readable by other local accounts; unnecessary retention/telemetry. |
| A-12 | OpenCode config is `0644` and names a model; no explicit permission policy was found. | Verified locally. | Unverified runtime behavior; audit before further use. |
| A-13 | Enabled Codex plugins and local/remote tool integrations increase reachable data and supply-chain surface. | Verified from local config. | Medium until necessity, identities, and update policies are reviewed. |

### 8.3 Repository, commands, network, and production

| ID | Finding | Evidence/confidence | Risk |
|---|---|---|---|
| A-14 | No active Git hooks, custom hooks path, Dependabot/Renovate, CodeQL, or repository secret-scanning workflow was found. | Verified locally. GitHub server settings unverified. | **High:** no verified independent prevention gate before a push. |
| A-15 | The only tracked secret-like scanner hits reviewed were environment-variable references, not literal credentials. | Verified by inspecting the two matched files. | No tracked leak found by this limited pattern scan; this is not a full-history or entropy scan. |
| A-16 | Package and eval scripts can execute lifecycle code; local dev/eval scripts disable TLS verification. | Verified in `package.json`. | Medium; dependency and interception risks need isolated execution and scoped exceptions. |
| A-17 | Dev binds `0.0.0.0:3001`; allowed dev origins include local-network ranges. | Verified in project config/instructions. | Medium; required for device testing but should be temporary and authenticated. |
| A-18 | Service-role scripts and migrations can delete users/data, archive/delete todos, create and delete verification rows, or drop tables. | Verified by script inventory and source inspection. | **High:** general-purpose agent shell can reach destructive production-capable paths. |
| A-19 | Git remote uses HTTPS. Commit signing is not configured locally. | Verified by Git config. | Medium provenance gap; branch/ruleset enforcement unverified. |
| A-20 | GitHub Actions usage check uses a repository secret and has a narrow scheduled HTTP role; no checkout or broad token use was observed. | Verified in `.github/workflows/usage-check.yml`. | Low in observed workflow; external settings still need review. |
| A-21 | Canonical Orb/shared instructions embed secret values into `curl` and `psql` argument vectors through command substitution, contradicting the proposed no-secret-in-argv control. | Verified by reading both `AGENTS.md` files and shell expansion semantics. Cross-account visibility through `ps` remains untested. | **High/Blocker for Phase 1 acceptance:** mandatory workflows would continue leaking secret values into process arguments. |
| A-22 | Mandatory workflows depend on high-privilege secrets: backlog/todo API, Knowledge Repository read/write, schema migration/health checks, and the model-eval execution path. | Verified in Orb/shared `AGENTS.md` and package instructions. | **High usability/control conflict:** removing direct access without replacement brokers would break required work and encourage bypasses. |
| A-23 | Orb has two registered Git worktrees. The main worktree has the external `.env.local` symlink; the secondary `agents-read-agents-data` worktree currently has no `.env.local`. | Verified with `git worktree list` and exact-path checks. | **Medium:** worktree-local ignored configuration and future secret links can escape a project-name-only boundary. |

### 8.4 Governance and audit limitations

- The mandatory Knowledge Repository query failed twice from Codex's restricted network path because that sandbox could not resolve the Supabase host. Claude independently reported successful Knowledge Repository and Orb API queries from the same Mac, establishing that the failure is tool-scoped rather than host-scoped. The ORB-374 topic search remains **pending** and may be assigned to an agent with approved egress.
- GitHub branch protection, repository visibility, secret scanning, push protection, Dependabot settings, collaborator list, and deployment protection are **unverified** because local files cannot establish them.
- Credential misuse, other local user accounts, FileVault state, backups, external-disk inventory, router isolation, and provider audit logs were not inferred from absence of local evidence.
- This is a configuration and workflow audit, not a penetration test or malware scan.

## 9. Risk register and required treatment

| Priority | Risk | Baseline | Required treatment |
|---|---|---|---|
| P0 | Transcript exposure of live secrets | BP-2, BP-7, BP-8 | Inventory affected credentials without printing values; rotate/revoke in dependency order; invalidate sessions/tokens; review provider/database/deployment logs; record incident. |
| P0 | World-readable shared secret vault | BP-1, BP-2 | Immediately make directories `0700` and files `0600`; then replace the shared mega-file with separated, least-privilege secret delivery that AI tools cannot read. |
| P0 | AI tools combine secret access, arbitrary code, and consequential commands | BP-1, BP-2, BP-3 | Remove broad durable approvals; deny secret reads; force deploy/DB/push through deterministic broker gates. |
| P1 | World-readable AI transcripts and logs | BP-7 | Correct permissions recursively using an explicit, reviewed target list; set retention and purge policy; disable unnecessary detailed logging/telemetry. |
| P1 | Indirect prompt injection can reach host/network/tools | BP-1, BP-4, BP-6 | Adopt Tier A/B/C isolation model; separate untrusted-content review from credentials and unrestricted egress. |
| P1 | No verified secret-prevention gate | BP-8 | Add an early local scanner, followed by CI/server gates and current-tree/full-history review; enable GitHub protection if available. |
| P1 | Production service-role and destructive scripts available to general shell | BP-2, BP-3, BP-9 | Create read-only/dev identities, target assertions, dry-run defaults, and explicit production broker commands. |
| P2 | Broad trust, plugins, MCPs, and update sources | BP-1, BP-5 | Narrow trusted roots; inventory/disable unused integrations; pin and allowlist sources/identities. |
| P2 | Development network and TLS exceptions | BP-6 | Scope to dev commands, bind loopback by default, use temporary LAN profile, and remove blanket TLS-disable patterns where practical. |
| P2 | Provenance/recovery settings unverified | BP-5, BP-9, BP-10 | Review GitHub rules, commit signing, backups, and restore tests; document accepted residual risk. |
| P1 | Published control attestations do not match enforced configuration | BP-3, BP-9, BP-10 | Inventory every claimed enforcement mechanism, test it against the live artifact, correct false documentation, and make permission changes reviewable. |
| P1 | Canonical agent commands expose secrets in process arguments and mandatory workflows lack safe replacements | BP-1, BP-2, BP-3, BP-8 | Replace every documented inline-secret pattern with reviewed brokers; preserve each required workflow and test cross-account process visibility with a harmless canary. |

## 10. Implementation plan

Every phase starts with a snapshot/backout artifact, uses redacted verification, and stops on unexpected scope. Security changes must not print secret values. Commands must not carry secret values as command-line arguments or be pasted interactively into a general shell; use the approved broker or secret store so history suppression is not the primary control.

### Phase 0 — Contain the verified exposure

**Goal:** reduce present risk before building new infrastructure.

1. Build a secret-name/owner/consumer inventory without outputting values across every credential plane: the local shared environment source, Vercel development/preview/production variables, GitHub repository secrets, provider dashboards, Supabase/database credentials, and any human password/secrets manager.
2. Correct secret-vault ownership and permissions (`0700` directories, `0600` files) using exact paths.
3. Rotate or revoke every secret-bearing credential among the 17 exposed entries in a dependency-safe order. For each credential, identify every consumer, create the replacement, update local and hosted consumers, trigger any required redeploy/restart, verify the new credential, revoke the old credential, and verify the old credential fails. Do not revoke first and strand a deployed consumer on the obsolete value. Public identifiers are classified separately and need not be rotated merely because they appeared in the file.
4. Review provider, Supabase, Vercel, GitHub, and email audit logs where available; document whether evidence of misuse exists.
5. Purge exposed transcript records only after incident evidence and required handoff details are safely recorded; assume deletion cannot retract data already transmitted.

**Acceptance:** all secret-bearing files and parent directories are owner-only; old credentials fail; applications work with replacements; no secret value appears in command output, shell history, Git diff, or plan; incident disposition is recorded.

**Rollback:** restore service one credential at a time from the secure manager; never re-enable a known-exposed key except as a time-boxed incident action approved by Stan.

### Phase 1 — Establish credential and authorization boundaries

1. Split local development, production read-only, and production mutation credentials.
2. Select a secure store/broker appropriate to a single-user Mac (evaluate macOS Keychain and a dedicated secrets manager). The repository receives only variable names and broker commands.
3. Remove AI read/write access to the secret vault. Agents receive short-lived, task-specific variables only when necessary.
4. Replace direct production actions with narrow wrappers that resolve and show target environment, operation, and affected resources before Stan approves. Each broker is small, single-purpose, idempotent where the operation permits it, fail-closed, and independently testable.
5. Ensure push/deploy, production SQL/DDL, destructive scripts, credential changes, and external messages can never be permanently auto-approved.
6. Add an early local secret scanner for the working tree and staged diff before general AI development resumes. Use harmless canaries and a reviewed configuration; defer full-history, CI, and server-side integration to Phase 4.
7. Replace every inline-secret `curl`/`psql` pattern in Orb and shared `AGENTS.md` with the approved broker or secret-store interface in the same change. Use a harmless canary and a second local test account to determine whether process arguments are cross-account visible; record the actual result without exposing a real credential.
8. Create a mandatory-workflow migration inventory and replacement acceptance test for: backlog read and todo create/update/close; Knowledge Repository read/write; schema migration and required pre/post health queries; and the human-run model-eval/dev-server path. The eval runner remains Stan-run, but its credential must be supplied without becoming agent-readable.

**Acceptance:** a routine AI session cannot read production secrets, query production through a general shell, push, or deploy; an approved broker action succeeds and leaves a redacted audit record; the local scanner blocks harmless canary credentials in both the working tree and staged diff; both `AGENTS.md` files contain no inline secret expansion; and every mandatory workflow in step 8 still succeeds through its replacement path.

**Rollback:** broker can be disabled and previous manual human-only procedure restored without restoring agent access to the mega-file.

### Phase 2 — Harden each AI tool and local records

1. Claude: remove wildcard interpreter/Git push/Downloads rules; allow only exact low-risk read/test commands; keep consequential actions prompted.
2. Codex: narrow trusted root to Orb; define project security requirements/permissions with workspace-only writes, secret/history deny-reads, restricted network, exact MCP/plugin allowlists, and remote/browser/computer-use features disabled unless needed.
3. Gemini: enable and verify folder trust and tool sandboxing; remove secret-file grants and global `psql`/Vercel/material Git approvals; disable permanent approvals and YOLO mode; enable environment-variable redaction.
4. Vibe: make directories/files owner-only; disable detailed prompt/session telemetry unless Stan explicitly accepts it; retain bypass-off and prompt for network/task actions.
5. OpenCode and every future AI tool: block use until permission, sandbox, log, network, plugin, and credential behavior is documented against this baseline and its log/session files are verified owner-only by default.
6. Add a safe local security audit that reports paths, modes, policy categories, and pass/fail without reading or printing secrets.
7. Convert every published control attestation into an executable or artifact-backed check. At minimum, verify Claude's push gate, tracked/ignored status of its policy file, Codex trust/permission scope, Gemini durable approvals, transcript modes, and each active worktree. Correct shared documentation when a claim is false; do not mark a control present because instructions say it is present.

**Acceptance:** automated audit passes; negative tests prove each tool cannot read the secret vault or other projects and cannot perform a protected action without the trusted approval path.

**Rollback:** restore versioned configuration from an owner-only backup; do not restore broad wildcard approvals.

### Phase 3 — Pilot and adopt isolation tiers

1. Choose a minimal Apple-silicon Linux isolation implementation after comparing Docker Desktop and a lighter Lima/Colima alternative for security features, maintenance, licensing, and performance.
2. Create a pinned, reproducible Tier B environment with non-root user, minimal capabilities, no host socket, no secrets, limited mounts, and controlled egress.
3. Benchmark native versus isolated Orb workflows using the hardware metrics in section 7.4.
4. Create a Tier C disposable VM profile only if the documented threat scenarios justify the additional overhead.
5. Optionally pilot an encrypted external NVMe SSD. Do not purchase or standardize external media before the internal-disk baseline is measured.
6. Document patch-based change export, environment reset, backup, restore, and emergency shutdown.

**Acceptance:** isolation negative tests pass; expected workflows meet agreed performance thresholds; deleting the environment removes all workspace state; no host secret or unrelated path is visible inside it.

**Rollback:** delete the disposable environment and return to hardened Tier A. Source remains in Git; no unique state depends on an image or external disk.

### Phase 4 — Repository and supply-chain gates

1. Extend the Phase 1 local scanner to pre-push and full-history audits; include Orb-specific patterns without storing real examples.
2. Add CI protection independent of local AI configuration. Verify GitHub secret scanning/push protection availability before choosing the server mechanism.
3. Add dependency and vulnerability review, lockfile integrity checks, pinned GitHub Actions, and controlled package lifecycle execution.
4. Harden destructive scripts with environment assertions, dry-run default, explicit identifiers/counts, and confirmation at the final mutation boundary.
5. Review GitHub repository visibility, collaborators, rulesets/branch protection, signed commits, deployment protection, Actions permissions, and audit logging.

**Acceptance:** harmless canary secrets are blocked locally and by the selected server gate; false-positive bypass requires a documented human decision; destructive-script tests cannot target production by default.

**Rollback:** hooks can be bypassed only through a documented Stan-approved emergency procedure; CI changes revert independently without weakening local controls.

### Phase 5 — Operate and verify

1. Add quarterly control-profile review, annual full-audit, and change-triggered delta-audit checklists.
2. Test credential revocation, environment recreation, backup restore, and production-action denial.
3. Add prompt-injection simulations using inert canaries: untrusted files request secret reads, uploads, broad commands, misleading approval text, and cross-agent action. No real secret is used.
4. Record residual risks, tool versions, model versions, policies, and test results.
5. Update Orb's Knowledge Repository when controls or conclusions change; link superseded entries rather than silently overwriting them.

**Acceptance:** repeatable red-team cases fail safely three times each; restore/recreation succeeds; review owner and next review date are recorded.

## 11. Verification matrix

| Control | Positive test | Negative test | Evidence retained |
|---|---|---|---|
| Secret deny-read | Human broker supplies one dev credential to an approved command | Agent cannot `stat`, read, copy, archive, or transmit secret vault or `.env.local` | Path/mode/policy result only |
| Workspace scope | Agent edits a file beneath its exact claimed worktree root | Agent cannot read/write another registered Orb worktree, other project, home config, `.git`, or host settings | Claimed root, enumerated worktrees, resolved target, and denial |
| Network | Approved docs/provider endpoint works | Arbitrary domain, local subnet, and upload endpoint fail | Domain and decision, no payload |
| Consequential approval | Stan-approved dry-run then mutation succeeds | Model-generated approval wording cannot authorize push/deploy/DB/delete | Resolved operation/target/actor |
| Transcript privacy | Current user can resume session | Other local test account cannot traverse/read records | Modes/ACLs, not content |
| Container/VM boundary | Build and tests complete | No host secrets, socket, home, other project, clipboard, or broad mount visible | Mount/network/process inventory |
| Secret scanning | Harmless canary blocked | Known exclusions do not hide real patterns | Scanner version/config/result |
| Recovery | Clean environment recreated and backup restored | Deleting sandbox cannot delete host source/backups | Timings and checksums |

Security tests with variable outcomes must be run at least three times before being called verified. A single pass is recorded as “passed once.”

## 12. Performance and usability acceptance

The security solution fails if it is so slow or awkward that broad permissions are routinely restored.

Proposed pilot thresholds, subject to Stan's approval after baseline measurement:

- Host remains responsive with no sustained memory-pressure warning during ordinary editing/builds.
- Warm isolated build is no more than 25% slower than native; clean dependency install no more than 40% slower.
- File change reaches the dev server within 1 second at the 95th percentile.
- Local page response is not materially changed after compilation.
- Starting or restoring the Tier B environment takes no more than 60 seconds after warm-up.
- The isolated disk uses no more than 60 GiB before pruning and is reproducible from configuration.
- Mac, iPad, and iPhone local acceptance remain possible through a temporary, explicit LAN profile.

These are initial targets, not findings. Measure native baseline first and revise from evidence.

Performance evidence is collected by the versioned benchmark script and results format defined in section 7.4. Run at least three samples per deterministic timing case, retain raw output, and compare the same commit and dependency state across native and isolated runs.

## 13. Decisions required before implementation

1. Approve immediate rotation of every credential confirmed rendered to an AI transcript, even if no misuse is visible.
2. Choose the preferred human-controlled secret store for the pilot: macOS Keychain or an existing dedicated password/secrets manager.
3. Decide whether Vibe telemetry and detailed session logging provide value worth retaining.
4. Approve evaluation—not yet purchase—of an external USB4/Thunderbolt NVMe SSD after the internal-disk isolation benchmark.
5. Approve the Tier A/B/C model and the principle that production mutation credentials are never present in a general-purpose agent shell.
6. Decide when the proposed interim operating restriction in section 2 becomes binding: immediately, or when this plan is approved.
7. **Decided 2026-08-03 18:39 HST:** Stan approved a local checkpoint commit of the planning document, WIP, claim, and preserved review packets before further review. This records the draft; it does not approve the plan, authorize implementation, or authorize a push.

## 14. Knowledge Repository publication after approval

Before implementation:

If the Knowledge Repository remains unavailable, implementation is deferred. An outage is not permission to begin with an unrecorded plan or to backfill governance later.

1. Assign an agent/tool with approved egress to run the mandatory service-role Knowledge Repository search for local-file security, agent permissions, secret handling, prompt injection, sandboxing, and ORB-374. Codex's sandbox DNS failure does not require waiting for the host network to recover.
2. Reconcile prior entries: link or supersede; do not assume older guidance remains correct.
3. Create the ORB-374 entry with the approved threat model, best practices, verified audit, risk decisions, implementation phases, acceptance/rollback criteria, sources, and residual risks.
4. Include all pertinent Comments content: commenter tool/model, original timestamp/timezone, round, comment IDs, dispositions, document revisions, and unresolved objections. Preserve attribution; do not flatten comments into unattributed prose.
5. Link the entry to ORB-374's todo ID and record the Knowledge entry ID in the handoff and eventual resolution notes.

The Knowledge Repository write is an approval gate. Implementation cannot begin merely because this Markdown file exists.

## 15. Sources

Authoritative guidance reviewed 2026-08-03:

- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
- [OWASP HITL Dialog Forging / Lies-in-the-Loop](https://owasp.org/www-community/attacks/Lies_in_the_Loop)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [NIST Generative AI Profile, NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [OpenAI Codex configuration reference: `requirements.toml`](https://learn.chatgpt.com/docs/config-file/config-reference#requirementstoml)
- [Anthropic Claude Code security](https://docs.anthropic.com/en/docs/claude-code/security)
- [Anthropic Claude Code CLI permissions](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [Gemini CLI trusted folders](https://geminicli.com/docs/cli/trusted-folders/)
- [Gemini CLI sandboxing](https://geminicli.com/docs/cli/sandbox/)
- [Gemini CLI security settings](https://geminicli.com/docs/cli/settings/)
- [Mistral Vibe safety, approvals, and permissions](https://docs.mistral.ai/vibe/code/safety-approvals-permissions)
- [GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [Docker Desktop for Mac permission and VM boundary](https://docs.docker.com/desktop/setup/install/mac-permission-requirements/)
- [Docker bind-mount security](https://docs.docker.com/engine/storage/bind-mounts/)
- [Docker Desktop resource and disk-image settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/)
- [Apple encrypted removable storage](https://support.apple.com/guide/disk-utility/encrypt-protect-a-storage-device-password-dskutl35612/22.7/mac/26)
- [Apple SD/SDXC support](https://support.apple.com/en-us/102352)

## 16. Comments

### Controlled review and update protocol

This section is an append-only review record. To prevent competing edits and preserve one coherent document history, reviewing AI tools must **not edit this file directly**. The review workflow is:

1. A reviewing AI returns its comments to Stan. Stan passes the comments to Codex, which is the document maintainer for this review cycle.
2. The reviewer supplies:
   - AI tool name and exact model;
   - review date-time with an explicit timezone such as HST or UTC;
   - reviewed Git commit or, for an uncommitted document, the document's **Last updated** value;
   - review round number;
   - substantive comments with stable IDs in the form `<tool>-R<round>-C<number>`.
3. Every comment is labeled **Verified finding**, **Inference**, **Recommendation**, **Question**, or **Blocker**. “Ruled out” may be used only for something actually tested.
4. The reviewer cites evidence and authoritative sources and must not include secrets, transcript contents, personal identifiers, or sensitive configuration values.
5. Codex preserves each complete reviewer packet under `docs/orb-374-reviews/` and appends an attributed summary here. The packet is the authoritative review text; the summary does not replace it. Codex records when it imported the packet and updated the document, evaluates each comment, updates plan text where warranted, and adds the disposition below.
6. Codex preserves the reviewer's wording and attribution in the packet. If content must be redacted for security or privacy, the archived packet identifies the redaction and reason at that location.
7. Existing comments are never overwritten, reordered, summarized away, or silently resolved. A later review creates a new round.
8. If a reviewer omits its model, timestamp, timezone, reviewed revision, or evidence, Codex records the omission and asks Stan for the missing information before treating the review as complete.
9. A reviewer may recommend implementation but may not mark the plan approved on Stan's behalf.
10. Stan may assign a different document maintainer, but that change must be explicit and recorded here before another AI edits the file.
11. When reviewers conflict, Codex records both recommendations and the specific conflict without silently merging them. Codex may recommend a disposition, but Stan decides unresolved policy, risk-tolerance, cost, and usability tradeoffs.

Preserved packets:

- [Perplexity Round 1](orb-374-reviews/perplexity-r1.md) — temporary signed attachment URLs redacted; source attachment hash retained.
- [Claude Code Round 1](orb-374-reviews/claude-code-r1.md) — substantive packet preserved verbatim with normalized Markdown formatting.

### Comment dispositions

| Comment ID | Disposition | Applied by / timestamp | Sections changed | Notes |
|---|---|---|---|---|
| codex-R1-C1 | Incorporated | Codex / 2026-08-03 17:18 HST | 4, 7, 10, 12 | Made isolation hardware-aware for the M5/16 GB Mac. |
| codex-R1-C2 | Incorporated | Codex / 2026-08-03 17:18 HST | 7, 10, 13, 15 | Added Docker/VM tiering and external SSD/HDD/SDXC analysis. |
| codex-R2-C1 | Incorporated | Codex / 2026-08-03 17:49 HST | 7, 13, 16 | Recorded Stan's confirmation that SDXC is the intended removable medium and removed the obsolete question. |
| codex-R3-C1 | Incorporated | Codex / 2026-08-03 17:54 HST | 16 | Centralized all document edits through Codex; other AI reviewers submit attributed comment packets through Stan. |
| perplexity-R1-C1 | Incorporated | Codex / 2026-08-03 18:08 HST | 2 | Undocumented shortcuts and permission bypasses are security exceptions. |
| perplexity-R1-C2 | Modified | Codex / 2026-08-03 18:08 HST | 2, 10 | Normal AI development stops until Phase 0 acceptance, but tightly controlled AI-assisted containment remains permitted. |
| perplexity-R1-C3 | Incorporated | Codex / 2026-08-03 18:08 HST | 7, 10 | Clarified that Tier C is not required for ordinary Orb development. |
| perplexity-R1-C4 | Incorporated | Codex / 2026-08-03 18:08 HST | 14 | Knowledge Repository unavailability defers implementation. |
| perplexity-R1-C5 | Incorporated | Codex / 2026-08-03 18:08 HST | 5 | Highlighted workspace/host and development/production as primary boundaries. |
| perplexity-R1-C6 | Incorporated | Codex / 2026-08-03 18:08 HST | 6 | Added a synthetic deterministic production-approval example. |
| perplexity-R1-C7 | Incorporated | Codex / 2026-08-03 18:08 HST | 9 | Mapped every risk-register item to applicable best-practice controls. |
| perplexity-R1-C8 | Incorporated | Codex / 2026-08-03 18:08 HST | 6 | Added an Orb-specific hostile GitHub-issue example. |
| perplexity-R1-C9 | Incorporated | Codex / 2026-08-03 18:08 HST | 6 | Set a 30-day default and 90-day maximum routine AI-log retention target. |
| perplexity-R1-C10 | Incorporated | Codex / 2026-08-03 18:08 HST | 7 | Made hostile repositories patch-only and documented the exchange flow. |
| perplexity-R1-C11 | Incorporated | Codex / 2026-08-03 18:08 HST | 7, 12 | Required versioned, repeatable performance measurement and raw results. |
| perplexity-R1-C12 | Incorporated | Codex / 2026-08-03 18:08 HST | 10 | New AI tools must prove owner-only logs before use. |
| perplexity-R1-C13 | Incorporated | Codex / 2026-08-03 18:08 HST | 9, 10 | Moved basic local secret scanning into Phase 1; full-history/server integration remains Phase 4. |
| perplexity-R1-C14 | Modified | Codex / 2026-08-03 18:08 HST | 10 | Rejected history suppression as the primary control; secret values must not enter general shell commands. |
| perplexity-R1-C15 | Incorporated | Codex / 2026-08-03 18:08 HST | 10 | Brokers must be small, single-purpose, fail-closed, testable, and idempotent where possible. |
| perplexity-R1-C16 | Incorporated | Codex / 2026-08-03 18:08 HST | 6, 10 | Added annual full-audit and change-triggered delta-audit cadence. |
| perplexity-R1-C17 | Incorporated | Codex / 2026-08-03 18:08 HST | 16 | Conflicting reviews are recorded; Stan decides unresolved tradeoffs. |
| codex-R1-C3 | Reclassified | Codex / 2026-08-03 18:31 HST | 8, 14, 16 | Codex DNS failure is tool-scoped; the required topic search is pending but assignable to an approved-egress agent. |
| claude-R1-C1 | Incorporated | Codex / 2026-08-03 18:31 HST | 8, 9, 10 | Added control-attestation failure and executable enforcement verification. |
| claude-R1-C2 | Incorporated | Codex / 2026-08-03 18:31 HST | 8, 14, 16 | Corrected host-versus-tool network attribution and reclassified the prior blocker. |
| claude-R1-C3 | Blocker accepted | Codex / 2026-08-03 18:31 HST | 8, 9, 10 | Phase 1 must replace every documented inline-secret command and test harmless canary visibility. |
| claude-R1-C4 | Incorporated | Codex / 2026-08-03 18:31 HST | 8, 10 | Added mandatory-workflow migration inventory and preservation tests. |
| claude-R1-C5 | Incorporated | Codex / 2026-08-03 18:31 HST | 10 | Expanded inventory and coordinated rotation across local, hosted, GitHub, provider, and secret-manager planes. |
| claude-R1-C6 | Answered | Codex / 2026-08-03 18:31 HST | 8, 10 | The complete file was rendered: all 17 entries; rotate every secret-bearing member after classification. |
| claude-R1-C7 | Incorporated | Codex / 2026-08-03 18:31 HST | 6 | Artifact verification is required for relayed inter-agent status and authorship claims. |
| claude-R1-C8 | Incorporated | Codex / 2026-08-03 18:31 HST | 16, review artifacts | Full review packets are preserved; summaries remain navigational. |
| claude-R1-C9 | Incorporated | Codex / 2026-08-03 18:31 HST | 7, 8, 11 | Tier A and tests use exact claimed worktree roots; two current worktrees were inventoried. |
| claude-R1-C10 | Incorporated | Codex / 2026-08-03 18:31 HST | 3 | Added value-suppressing audit/evidence rules and safe name-only enumeration. |
| claude-R1-C11 | Pending Stan | — | 2, 13 | Stan must choose immediate or approval-time activation of the proposed interim restriction. |
| claude-R1-C12 | Approved | Codex / 2026-08-03 18:39 HST | 13, release bookkeeping | Stan authorized a local checkpoint commit only; no plan approval, implementation authority, or push authority was granted. |

### Codex (GPT-5.6 Sol) — 2026-08-03 17:18 HST — Round 1

**Revision reviewed:** working-tree revision; document Last updated 2026-08-03 17:18 HST.

- **codex-R1-C1 — Verified finding:** The target Mac is an Apple M5 system with 10 CPU cores, 16 GB unified memory, and approximately 254 GiB free. No common local container/VM tool was detected. A Linux isolation pilot is viable, but the 16 GB memory ceiling makes a full-time macOS VM a poor default without measurement. Sections 4, 7, 10, and 12 were updated.
- **codex-R1-C2 — Recommendation:** Use external storage only as an encrypted storage location or custody boundary, not as the sandbox boundary. A fast encrypted USB4/Thunderbolt NVMe SSD is viable for a VM/container disk; spinning HDD is for backup; SDXC is for transfer/cold snapshots. Sections 7, 10, 13, and 15 were updated.
- **codex-R1-C3 — Blocker:** The required Knowledge Repository search is not complete because the shell could not resolve the Supabase host on two attempts. This must succeed and be reconciled before the approved-plan Knowledge entry is written and implementation starts.
- **codex-R1-C4 — Verified finding:** Secret values were rendered into an AI-tool transcript during evidence collection. The implementation plan must begin with credential rotation and log review, not only permission changes.

### Codex (GPT-5.6 Sol) — 2026-08-03 17:49 HST — Round 2

**Revision reviewed:** working-tree revision; document Last updated 2026-08-03 17:49 HST.

- **codex-R2-C1 — Verified finding:** Stan confirmed that SDXC is the intended removable medium. Section 7 now evaluates only the confirmed SDXC option, and the resolved clarification was removed from section 13.

### Codex (GPT-5.6 Sol) — 2026-08-03 17:54 HST — Round 3

**Revision reviewed:** working-tree revision; document Last updated 2026-08-03 17:54 HST.

- **codex-R3-C1 — Recommendation incorporated:** Stan directed that reviewing AIs no longer edit the planning document directly. Section 16 now requires reviewers to send structured, attributed comments to Stan; Codex imports the comments, controls plan changes, records dispositions, and timestamps each document update.

### Perplexity (frontier model; OpenAI/Anthropic-comparable assistant) — 2026-08-03 18:00 HST (approximate) — Round 1

**Revision reviewed:** working-tree revision; document Last updated 2026-08-03 17:54 HST.
**Imported by:** Codex (GPT-5.6 Sol), 2026-08-03 18:08 HST.
**Metadata note:** Perplexity supplied the reviewer description above; an exact underlying model identifier was not exposed. The review timestamp is an approximate start time supplied by Perplexity.

- **perplexity-R1-C1 — Recommendation:** Treat hidden shortcuts and undocumented control bypasses as a behavioral security risk and record them like incidents.
- **perplexity-R1-C2 — Recommendation:** Stop AI coding-agent use on Orb until Phase 0 is complete and verified.
- **perplexity-R1-C3 — Recommendation:** Prioritize credential boundaries and per-tool hardening; make clear that Tier C is not a day-to-day dependency.
- **perplexity-R1-C4 — Recommendation:** If the Knowledge Repository is unavailable, defer implementation rather than backfill governance later.
- **perplexity-R1-C5 — Recommendation:** Highlight workspace/host and development/production as the two primary trust boundaries.
- **perplexity-R1-C6 — Recommendation:** Add a concrete deterministic approval example showing resolved production targets and impact.
- **perplexity-R1-C7 — Recommendation:** Cross-reference least-privilege baseline controls from the risk register.
- **perplexity-R1-C8 — Recommendation:** Add an Orb-specific example joining hostile external content with network and credential restrictions.
- **perplexity-R1-C9 — Recommendation:** Define a concrete routine AI-log retention target rather than allowing indefinite retention by default.
- **perplexity-R1-C10 — Recommendation:** Make hostile repositories patch-only and document a practical Tier B patch-export workflow.
- **perplexity-R1-C11 — Recommendation:** Define repeatable scripts and result records for isolation performance measurements.
- **perplexity-R1-C12 — Recommendation:** Require owner-only logs as a prerequisite for enabling any new AI tool.
- **perplexity-R1-C13 — Recommendation:** Move a basic local secret scanner into Phase 1 or 2 for earlier protection.
- **perplexity-R1-C14 — Recommendation:** Prevent secret-related commands from entering shell history.
- **perplexity-R1-C15 — Recommendation:** Keep production brokers small, single-purpose, idempotent, and independently testable.
- **perplexity-R1-C16 — Recommendation:** Add a full annual ORB-374 audit while retaining smaller change-triggered reviews.
- **perplexity-R1-C17 — Recommendation:** Define how conflicting AI recommendations are recorded and decided.

### Codex (GPT-5.6 Sol) — 2026-08-03 18:08 HST — Round 4

**Revision reviewed:** Perplexity Round 1 against working-tree document Last updated 2026-08-03 17:54 HST.
**Document updated:** 2026-08-03 18:08 HST.

- **Review disposition:** Fifteen recommendations were incorporated as proposed. Two were modified rather than accepted literally.
- **perplexity-R1-C2 conflict:** A complete prohibition on AI work would also prohibit the AI-assisted Phase 0 implementation Stan requested. The plan now stops normal development but permits an exact, tightly constrained containment workflow with no untrusted content, unrestricted egress, or general production credentials.
- **perplexity-R1-C14 refinement:** Disabling shell history is fragile and tool/shell dependent. The stronger control is that secret values never enter general shell command lines or interactive paste paths; approved brokers or the secret store supply them outside the ordinary command history.

### Claude Code (Opus 5; model ID `claude-opus-5`) — 2026-08-03 18:20 HST — Round 1

**Revision reviewed:** uncommitted working-tree document; Last updated 2026-08-03 18:08 HST.
**Imported by:** Codex (GPT-5.6 Sol), 2026-08-03 18:31 HST.
**Authoritative packet:** [Claude Code Round 1](orb-374-reviews/claude-code-r1.md).

- **claude-R1-C1 — Verified finding:** Orb's live Claude push permission contradicts the shared documented enforcement claim, and the ignored policy file leaves no review trail.
- **claude-R1-C2 — Verified finding:** Knowledge Repository DNS failure is specific to Codex's sandbox; Claude reached the services from the same host.
- **claude-R1-C3 — Verified finding / recommended blocker:** Canonical agent commands expand secrets into process arguments and must be migrated.
- **claude-R1-C4 — Verified finding:** Required Orb, Knowledge, database, and eval workflows need safe replacement paths rather than simple removal.
- **claude-R1-C5 — Recommendation:** Credential inventory and rotation must cover local, Vercel, GitHub, and provider planes and coordinate propagation before revocation.
- **claude-R1-C6 — Question:** Scope exactly which of the 17 entries entered the transcript.
- **claude-R1-C7 — Verified finding:** Relayed inter-agent status and authorship claims have been wrong or unverifiable and require artifact checks.
- **claude-R1-C8 — Recommendation:** Preserve complete reviewer packets, not only summaries.
- **claude-R1-C9 — Verified finding:** Exact worktree roots must be part of the workspace boundary and tests.
- **claude-R1-C10 — Recommendation:** Apply value-suppression controls to audit/evidence gathering itself.
- **claude-R1-C11 — Question:** Decide when the draft's proposed interim restriction becomes operative.
- **claude-R1-C12 — Recommendation:** Commit a checkpoint of the untracked plan and incident record before further review.

### Codex (GPT-5.6 Sol) — 2026-08-03 18:31 HST — Round 5

**Revision reviewed:** Claude Code Round 1 against working-tree document Last updated 2026-08-03 18:08 HST.
**Document updated:** 2026-08-03 18:31 HST.

- **Review disposition:** Nine comments were incorporated, one question was answered, one control conflict was accepted as a Phase 1 blocker, and two owner-level decisions remain with Stan.
- **claude-R1-C2 correction:** The earlier blocker incorrectly generalized Codex's sandbox DNS failure to the Mac. The mandatory search is still outstanding, but any approved-egress tool can perform it.
- **claude-R1-C3 consequence:** Phase 1 cannot pass while either canonical `AGENTS.md` teaches inline secret expansion. The plan now requires broker migration and workflow preservation in the same phase.
- **claude-R1-C6 answer:** The entire `.env.local` output entered the transcript—all 17 entries. Classification distinguishes public identifiers from credentials; all secret-bearing entries are exposed.
- **claude-R1-C11 and C12:** The plan does not presume Stan's decision about immediate restriction activation or a checkpoint commit. Both are explicit section 13 decisions.

### Codex (GPT-5.6 Sol) — 2026-08-03 18:39 HST — Round 6

**Revision reviewed:** Stan's decisions and Claude's supplemental offer against working-tree document Last updated 2026-08-03 18:31 HST.
**Document updated:** 2026-08-03 18:39 HST.

- **claude-R1-C11 — Pending Stan:** Codex explained the proposed interim restriction; Stan has not yet activated it or selected approval-time activation.
- **claude-R1-C12 — Approved:** Stan authorized a local checkpoint commit of the draft and review record. The authorization explicitly excludes plan approval, implementation, and push.
- **claude-R1-C2 — Follow-up available:** Claude offered to run the section 14.1 Knowledge Repository search through its approved-egress path. Codex recommends accepting that offer now; the result packet can close the outstanding topic-search task.
