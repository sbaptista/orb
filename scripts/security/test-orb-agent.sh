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
readonly SCRIPTS=(orb-agent orb-agent-approve)

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

printf '\n== 3. Broker refuses everything without a credential ==\n'
# Point the broker at a scratch root so a real session cannot satisfy these.
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
BROKER="$SCRATCH/orb-agent"
sed "s|^readonly SECRET_ROOT=.*|readonly SECRET_ROOT=\"$SCRATCH/secrets\"|" "$HERE/orb-agent" > "$BROKER"
chmod 755 "$BROKER"
mkdir -p "$SCRATCH/secrets/orb-agent/proposals"

CRED="$SCRATCH/secrets/orb-agent/credential.pgpass"

check_fails "'$BROKER' todos list"        "todos list refuses without a credential"
check_fails "'$BROKER' todos get ORB-1"   "todos get refuses without a credential"
check_fails "'$BROKER' projects list"     "projects list refuses without a credential"
check_fails "'$BROKER' knowledge search x" "knowledge search refuses without a credential"
check_fails "'$BROKER' db health"         "db health refuses without a credential"
# NOTE: piping into `grep -q` under `set -o pipefail` fails spuriously — grep
# exits on the first match and closes the pipe, so the broker's remaining
# output takes SIGPIPE and the pipeline reports failure. Capture instead.
check "[[ \"\$('$BROKER' status)\" == *'NOT INSTALLED'* ]]" \
  "status reports a missing credential without failing"
check "[[ \"\$('$BROKER' status)\" == *'chmod 600'* ]]" \
  "status prints the install instructions"

printf '\n== 4. A malformed credential file is refused ==\n'
printf 'not-a-pgpass-line\n' > "$CRED"; chmod 600 "$CRED"
check_fails "'$BROKER' todos list" "a credential file with too few fields is refused"
printf 'h:notaport:d:orb_agent_ro:pw\n' > "$CRED"; chmod 600 "$CRED"
check_fails "'$BROKER' todos list" "a non-numeric port is refused"
printf ':5432:d:orb_agent_ro:pw\n' > "$CRED"; chmod 600 "$CRED"
check_fails "'$BROKER' todos list" "an empty host field is refused"

printf '\n== 4b. Loose credential-file permissions fail closed ==\n'
printf 'h:5432:d:orb_agent_ro:pw\n' > "$CRED"
chmod 644 "$CRED"
check_fails "'$BROKER' todos list" "a world-readable pgpass file is refused (psql only warns)"
chmod 600 "$CRED"

printf '\n== 4c. A symlinked credential file is refused ==\n'
mv "$CRED" "$SCRATCH/real.pgpass"
ln -s "$SCRATCH/real.pgpass" "$CRED"
check_fails "'$BROKER' todos list" "a symlinked credential file is refused"
rm -f "$CRED"; mv "$SCRATCH/real.pgpass" "$CRED"; chmod 600 "$CRED"

printf '\n== 5. Unknown verbs and options are rejected ==\n'
check_fails "'$BROKER' delete-everything"        "unknown top-level verb rejected"
check_fails "'$BROKER' todos drop"               "unknown todos verb rejected"
check_fails "'$BROKER' proposals nuke"           "unknown proposals verb rejected"
check_fails "'$BROKER' propose todo-delete ORB-1" "unsupported proposal kind rejected"

printf '\n== 6. Input validation (checked before the database is reached) ==\n'
# A well-formed credential, so validation is what rejects these — not a
# missing credential. The host is unroutable, so nothing can connect anyway.
printf 'h:5432:d:orb_agent_ro:pw\n' > "$CRED"
chmod 600 "$CRED"

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

printf '\n== 9. The session mechanism is gone (ORB-382) ==\n'
# These are ABSENCE checks. A grep proves absence of a string, which is exactly
# what is claimed here — no more. It is not evidence about database behaviour.
check "[[ ! -e '$HERE/orb-agent-session' ]]" \
  "orb-agent-session no longer exists in the repository"
check_fails "/usr/bin/grep -q 'orb-agent-session' '$HERE/orb-agent'" \
  "orb-agent no longer refers agents to a session launcher"
check_fails "/usr/bin/grep -q 'SESSION_FILE' '$HERE/orb-agent'" \
  "the session file constant is gone"
check_fails "/usr/bin/grep -q 'require_session' '$HERE/orb-agent'" \
  "require_session is gone"
check_fails "/usr/bin/grep -qE 'EXPIRES|SESSION_EXPIRES' '$HERE/orb-agent'" \
  "the local expiry check is gone (it was never a control an attacker faced)"
check "/usr/bin/grep -q 'require_credential' '$HERE/orb-agent'" \
  "require_credential replaces it"
check "/usr/bin/grep -q 'credential.pgpass' '$HERE/orb-agent'" \
  "the credential is a single standard pgpass file"
check_fails "/usr/bin/grep -q 'VALID UNTIL' '$HERE/orb-agent'" \
  "no VALID UNTIL claim survives in the broker"

# The boundary this file CANNOT test. Stated so the total is never mistaken
# for evidence about the database.
printf '  note  revocation (NOLOGIN) and the SELECT-only boundary are DB-side;\n'
printf '        only scripts/migrations/verify-orb-agent-ro.sql proves those.\n'

printf '\n== 9b. Approval validates at APPLY time, not just creation ==\n'
check "/usr/bin/grep -q 'validate_proposal' '$HERE/orb-agent-approve'" \
  "approve revalidates the complete proposal before applying"
check "/usr/bin/grep -q 'knowledge entry is MISSING' '$HERE/orb-agent-approve'" \
  "a stored proposal with null knowledge is rejected at apply time"
check "/usr/bin/grep -q 'proposal file changed after it was displayed' '$HERE/orb-agent-approve'" \
  "the bytes confirmed are bound to the bytes applied (hash re-check)"
check "/usr/bin/grep -q 'Writing the Knowledge entry first' '$HERE/orb-agent-approve'" \
  "Knowledge is written BEFORE the todo closes (recoverable half-state)"
check_fails "/usr/bin/grep -q 'Knowledge write could not be confirmed.*todo IS closed' '$HERE/orb-agent-approve'" \
  "the old close-first failure message is gone"

printf '\n== 10. The approval gate verifies its writes ==\n'
check "/usr/bin/grep -q 'the todo did NOT close' '$HERE/orb-agent-approve'" \
  "approve confirms the PATCH response before reporting success"
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
