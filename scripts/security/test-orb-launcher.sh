#!/bin/bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

/bin/bash -n "$repo_root/scripts/security/orb-dev"
/bin/bash -n "$repo_root/scripts/security/orb-secrets-seal"
/bin/bash -n "$repo_root/scripts/security/orb-secrets-set"

source "$repo_root/scripts/security/orb-dev"
source "$repo_root/scripts/security/orb-secrets-set"

[[ "$(mode_of "$repo_root/package.json")" =~ ^[0-7]{3,4}$ ]]
[[ "$(printf 'ALPHA=old\nBETA=keep\n' | replace_value ALPHA new)" == $'ALPHA=new\nBETA=keep' ]]
[[ "$(printf 'ALPHA=keep\n' | replace_value MOONSHOT_API_KEY new)" == $'ALPHA=keep\nMOONSHOT_API_KEY=new' ]]
[[ "$(printf 'ALPHA=old\nBETA=keep\n' | remove_value ALPHA)" == 'BETA=keep' ]]
is_removable_name ELEVENLABS_API_KEY
! is_allowed_name ELEVENLABS_API_KEY

# ------------------------------------------------------------------
# Installed launcher integrity.
#
# The launchers that actually run are the root-owned copies in
# /usr/local/orb-bin, not the ones in this repository. Nothing keeps them in
# step, and on 2026-09-03 orb-secrets-seal had silently diverged: the installed
# copy still required ELEVENLABS_API_KEY, removed from the store on 2026-08-05.
# Seal refuses to run when a required name is absent, so the version on PATH
# could not seal the store at all -- a broken recovery path found only by
# diffing. Version control is not the control here. What runs is.
#
# R4-N3 (Codex, 2026-09-05): the first version of this check closed that one
# instance and not the class. It compared only files ALREADY PRESENT, so a
# MISSING launcher was never visited; an absent directory printed a note and
# exited 0; an unexpected extra file only warned; and ownership and mode were
# never asserted. All three of those paths failed OPEN. It now works from an
# expected manifest and fails closed.
# ------------------------------------------------------------------
installed_dir="/usr/local/orb-bin"
# orb-agent joined this list on 2026-09-06, when it was installed root-owned.
# It is the one AGENT-RUNNABLE launcher here and holds no credential, so it is
# not passphrase-bearing like the other four — but root ownership means an agent
# can no longer rewrite its own broker, which is worth asserting.
expected_launchers=(orb-dev orb-secrets-seal orb-secrets-set orb-agent-approve orb-agent)
integrity_errors=()

if [[ ! -d "$installed_dir" ]]; then
  integrity_errors+=("$installed_dir does not exist — no launcher is installed")
else
  for name in "${expected_launchers[@]}"; do
    installed="$installed_dir/$name"
    repo_copy="$repo_root/scripts/security/$name"

    [[ -f "$repo_copy" ]] || { integrity_errors+=("$name: missing from scripts/security"); continue; }
    [[ -f "$installed" ]] || { integrity_errors+=("$name: EXPECTED but not installed in $installed_dir"); continue; }

    owner="$(/usr/bin/stat -f '%Su:%Sg' "$installed")"
    mode="$(/usr/bin/stat -f '%Lp' "$installed")"
    [[ "$owner" == "root:wheel" ]] || integrity_errors+=("$name: owner is $owner, expected root:wheel")
    [[ "$mode" == "755" ]]        || integrity_errors+=("$name: mode is $mode, expected 755")
    /usr/bin/cmp -s "$installed" "$repo_copy" || integrity_errors+=("$name: installed bytes differ from the repository copy")
  done

  # Anything installed that is not in the manifest is an error, not a warning:
  # an unexpected root-owned executable on PATH is exactly what this should catch.
  for installed in "$installed_dir"/*; do
    [[ -e "$installed" ]] || continue
    name="$(basename "$installed")"
    found=0
    for expected in "${expected_launchers[@]}"; do
      [[ "$name" == "$expected" ]] && found=1
    done
    (( found == 1 )) || integrity_errors+=("$name: INSTALLED BUT NOT EXPECTED — not in the manifest")
  done
fi

if (( ${#integrity_errors[@]} > 0 )); then
  printf '\nFAIL: installed launcher integrity\n\n' >&2
  for e in "${integrity_errors[@]}"; do printf '  ✗ %s\n' "$e" >&2; done
  printf '\nThe installed copy is what runs. To reinstall one:\n' >&2
  printf '  sudo install -o root -g wheel -m 755 scripts/security/<name> %s/<name>\n\n' "$installed_dir" >&2
  exit 1
fi
printf 'Installed launchers match the repository (%d checked, owner and mode asserted).\n' "${#expected_launchers[@]}"

# Reported, never asserted: which command the shell would actually run. This
# cannot be fixed by reinstalling -- PATH order is set by owner-writable
# ~/.zshrc, so a shadowing copy earlier in PATH wins over the root-owned one
# (docs/agent-enforcement-hardening.md §2, still open).
for name in "${expected_launchers[@]}"; do
  resolved="$(command -v "$name" 2>/dev/null || true)"
  if [[ -n "$resolved" && "$resolved" != "$installed_dir/$name" ]]; then
    printf 'WARNING: %s resolves to %s, NOT %s/%s\n' "$name" "$resolved" "$installed_dir" "$name" >&2
  fi
done

printf 'Security launcher syntax and helper checks passed.\n'
