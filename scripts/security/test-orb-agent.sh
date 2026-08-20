#!/bin/bash
#
# test-orb-agent.sh — deterministic checks for the agent capability broker.
#
# Runs with NO database, NO credentials, and NO network. It verifies the
# parts that are provable offline: syntax, refusal behaviour, input
# validation, proposal round-trip, and the absence of embedded secrets.
#
# It CANNOT verify the database boundary. That is what
# scripts/migrations/verify-orb-agent-ro.sql is for, and only Stan can run it.

set -uo pipefail

readonly HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPTS=(orb-agent orb-agent-session orb-agent-approve)

PASS=0
FAIL=0

ok()   { printf '  ok    %s\n' "$*"; PASS=$((PASS+1)); }
bad()  { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
check(){ if eval "$1" >/dev/null 2>&1; then ok "$2"; else bad "$2"; fi; }
check_fails(){ if eval "$1" >/dev/null 2>&1; then bad "$2 (command SUCCEEDED — it must fail)"; else ok "$2"; fi; }

printf '\n== 1. Syntax and permissions ==\n'
for s in "${SCRIPTS[@]}"; do
  check "bash -n '$HERE/$s'" "$s parses"
  check "[[ -x '$HERE/$s' ]]" "$s is executable"
done

printf '\n== 2. No embedded credentials ==\n'
for s in "${SCRIPTS[@]}"; do
  if /usr/bin/grep -nE '(sb_secret_|sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|postgres://[^<$"]*:[^<$"@]+@)' "$HERE/$s" >/dev/null 2>&1; then
    bad "$s contains something shaped like a credential"
  else
    ok "$s contains no credential-shaped literal"
  fi
done

printf '\n== 3. Broker refuses everything without a session ==\n'
# Point the broker at a scratch root so a real session cannot satisfy these.
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
BROKER="$SCRATCH/orb-agent"
sed "s|^readonly SECRET_ROOT=.*|readonly SECRET_ROOT=\"$SCRATCH/secrets\"|" "$HERE/orb-agent" > "$BROKER"
chmod 755 "$BROKER"
mkdir -p "$SCRATCH/secrets/orb-agent/proposals"

check_fails "'$BROKER' todos list"        "todos list refuses without a session"
check_fails "'$BROKER' todos get ORB-1"   "todos get refuses without a session"
check_fails "'$BROKER' projects list"     "projects list refuses without a session"
check_fails "'$BROKER' knowledge search x" "knowledge search refuses without a session"
check_fails "'$BROKER' db health"         "db health refuses without a session"
check "'$BROKER' status | grep -q 'none'" "status reports no session without failing"

printf '\n== 4. Expired sessions are rejected and removed ==\n'
SESS="$SCRATCH/secrets/orb-agent/session"
printf 'EXPIRES=1\nPGHOST=h\nPGPORT=5432\nPGDATABASE=d\nPGUSER=orb_agent_ro\n' > "$SESS"
printf 'h:5432:d:orb_agent_ro:pw\n' > "$SCRATCH/secrets/orb-agent/session.pgpass"
chmod 600 "$SCRATCH/secrets/orb-agent/session.pgpass"
check_fails "'$BROKER' todos list" "an expired session is refused"
check "[[ ! -f '$SESS' ]]"         "an expired session file is deleted on use"
check "[[ ! -f '$SCRATCH/secrets/orb-agent/session.pgpass' ]]" "the expired pgpass file is deleted too"

printf '\n== 4b. Loose credential-file permissions fail closed ==\n'
printf 'EXPIRES=%s\nPGHOST=h\nPGPORT=5432\nPGDATABASE=d\nPGUSER=orb_agent_ro\n' "$(( $(date +%s) + 3600 ))" > "$SESS"
printf 'h:5432:d:orb_agent_ro:pw\n' > "$SCRATCH/secrets/orb-agent/session.pgpass"
chmod 644 "$SCRATCH/secrets/orb-agent/session.pgpass"
check_fails "'$BROKER' todos list" "a world-readable pgpass file is refused (psql only warns)"
chmod 600 "$SCRATCH/secrets/orb-agent/session.pgpass"

printf '\n== 5. Unknown verbs and options are rejected ==\n'
check_fails "'$BROKER' delete-everything"        "unknown top-level verb rejected"
check_fails "'$BROKER' todos drop"               "unknown todos verb rejected"
check_fails "'$BROKER' proposals nuke"           "unknown proposals verb rejected"
check_fails "'$BROKER' propose todo-delete ORB-1" "unsupported proposal kind rejected"

printf '\n== 6. Input validation (checked before any session is required) ==\n'
# A far-future session so validation, not session state, is what rejects these.
printf 'EXPIRES=%s\nPGHOST=h\nPGPORT=5432\nPGDATABASE=d\nPGUSER=orb_agent_ro\n' "$(( $(date +%s) + 3600 ))" > "$SESS"
printf 'h:5432:d:orb_agent_ro:pw\n' > "$SCRATCH/secrets/orb-agent/session.pgpass"

check_fails "'$BROKER' todos get 'ORB-1; DROP TABLE todos'" "SQL metacharacters in a todo ref rejected"
check_fails "'$BROKER' todos get notaref"                   "malformed todo ref rejected"
check_fails "'$BROKER' todos list --project \"a'b\""        "quote in project code rejected"
check_fails "'$BROKER' todos list --status bogus"           "invalid status rejected"
check_fails "'$BROKER' todos list --status done"            "'done' rejected (valid set has no 'done')"
check_fails "'$BROKER' todos list --limit 99999"            "out-of-range limit rejected"
check_fails "'$BROKER' todos list --limit abc"              "non-numeric limit rejected"
check_fails "'$BROKER' knowledge get not-a-uuid"            "malformed uuid rejected"
check_fails "'$BROKER' proposals show ../../etc/passwd"     "path traversal in proposal id rejected"

printf '\n== 7. Proposals record without writing, and enforce attribution ==\n'
NOTES="$SCRATCH/notes.md"
KNOW="$SCRATCH/knowledge.md"
printf 'no attribution line here\nbody\n' > "$NOTES"
check_fails "'$BROKER' propose todo-close ORB-1 --notes-file '$NOTES'" \
  "notes without 'YYYY-MM-DD — Tool (Model)' rejected"

printf '2026-08-19 — Claude Code (Opus 5)\nResolved by doing the thing.\n' > "$NOTES"
printf '2026-08-19 — Claude Code (Opus 5)\nThe distilled lesson.\n' > "$KNOW"
check "'$BROKER' propose todo-close ORB-1 --notes-file '$NOTES' --knowledge-file '$KNOW' --knowledge-title 'A lesson' --knowledge-tags 'a,b'" \
  "a well-formed proposal is recorded"
check "[[ \$(ls '$SCRATCH/secrets/orb-agent/proposals'/*.json 2>/dev/null | wc -l) -eq 1 ]]" \
  "exactly one proposal file was written"
check "'$BROKER' proposals list | grep -q pending" "the proposal lists as pending"
check_fails "'$BROKER' propose todo-close ORB-1 --notes-file '$NOTES' --knowledge-file '$KNOW'" \
  "a knowledge file without --knowledge-title is rejected"
check_fails "'$BROKER' propose todo-close ORB-1 --notes-file '$NOTES'" \
  "a closure with NO Knowledge entry is rejected (working rule 8, both or neither)"
check_fails "'$BROKER' propose todo-close ORB-1 --notes-file '$NOTES' --knowledge-file '$KNOW' --knowledge-title 'T' --knowledge-tags 'bad;tag'" \
  "malformed knowledge tags are rejected"

printf '\n== 8. The broker cannot write to the database by construction ==\n'
if /usr/bin/grep -nE '^\s*[^#]*\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|CREATE)\b' "$HERE/orb-agent" \
   | /usr/bin/grep -v 'agent-approve' >/dev/null 2>&1; then
  bad "orb-agent contains a write-shaped SQL keyword"
else
  ok "orb-agent contains no write SQL"
fi
check "/usr/bin/grep -q 'PGPASSFILE' '$HERE/orb-agent'" "the broker uses PGPASSFILE (no secret in argv or env)"
check_fails "/usr/bin/grep -q 'PGPASSWORD=' '$HERE/orb-agent'" "the broker never exports PGPASSWORD"

printf '\n== 8b. db health refuses to present unmeasured stats as clean ==\n'
check "/usr/bin/grep -q 'pg_has_role' '$HERE/orb-agent'" \
  "db health checks pg_read_all_stats before printing pg_stat_statements"
check "/usr/bin/grep -q 'UNMEASURED' '$HERE/orb-agent'" \
  "db health says UNMEASURED rather than printing a partial table"

printf '\n== 8c. bash 3.2 empty-array safety (macOS ships bash 3.2) ==\n'
# "${arr[@]}" on an EMPTY array is an unbound-variable error under `set -u` on
# bash 3.2. Verbs passing no psql variables (projects list, db health) hit it.
check_fails "/usr/bin/grep -nE 'for v in \"\\$\{vars\[@\]\}\"' '$HERE/orb-agent'" \
  "run_sql does not expand vars[@] unguarded"
check "/usr/bin/grep -q 'vars\[@\]+' '$HERE/orb-agent'" \
  "run_sql uses the \${arr[@]+...} guard for a possibly-empty array"
check "bash --posix -n '$HERE/orb-agent'" "orb-agent parses under stricter mode"

printf '\n== 9. Session credentials genuinely expire (option C) ==\n'
check "/usr/bin/grep -q 'VALID UNTIL' '$HERE/orb-agent-session'" \
  "expiry is stamped server-side with VALID UNTIL, not just a local file"
check "/usr/bin/grep -q 'openssl rand -hex 32' '$HERE/orb-agent-session'" \
  "each window mints a fresh 256-bit password"
check "/usr/bin/grep -q -- '--file -' '$HERE/orb-agent-session'" \
  "the ALTER ROLE statement goes via stdin, never argv (it carries the password)"
check "/usr/bin/grep -q 'readonly AGENT_ROLE=\"orb_agent_ro\"' '$HERE/orb-agent-session'" \
  "the agent role is a fixed constant — a privileged role cannot be substituted"
check "/usr/bin/grep -q 'trap cleanup EXIT' '$HERE/orb-agent-session'" \
  "the temporary master pgpass file is removed on every exit path"
check "/usr/bin/grep -q 'did not authenticate' '$HERE/orb-agent-session'" \
  "a session is not reported open until the new credential is proven to work"
check "/usr/bin/grep -q 'revocation FAILED' '$HERE/orb-agent-session'" \
  "--end fails loudly if the rotation did not take"
check_fails "/usr/bin/grep -q 'orb-agent-seal' '$HERE/orb-agent-session'" \
  "the obsolete seal step is gone (the DSN is derived from DATABASE_URL)"

printf '\n== 10. The approval gate verifies its writes ==\n'
check "/usr/bin/grep -q 'did NOT reach status=closed' '$HERE/orb-agent-approve'" \
  "approve confirms the PATCH response before continuing"
check "/usr/bin/grep -q 'curl --config -' '$HERE/orb-agent-approve'" \
  "approve passes credentials via --config, never argv"
check "/usr/bin/grep -q 'Type exactly: yes' '$HERE/orb-agent-approve'" \
  "approve requires a typed confirmation"

printf '\n────────────────────────────────\n'
printf '  passed: %d   failed: %d\n' "$PASS" "$FAIL"
printf '────────────────────────────────\n\n'
if (( FAIL > 0 )); then
  printf 'NOT SAFE TO USE. Fix the failures above before sealing a credential.\n'
  exit 1
fi
printf 'Offline checks passed. The DATABASE boundary is still unproven —\n'
printf 'run scripts/migrations/verify-orb-agent-ro.sql before trusting this.\n'
