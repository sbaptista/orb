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
# Installed-vs-repo divergence.
#
# The launchers that actually run are the root-owned copies in
# /usr/local/orb-bin, not the ones in this repository. Nothing kept them in
# step, and on 2026-09-03 orb-secrets-seal had silently diverged: the installed
# copy still required ELEVENLABS_API_KEY, which was removed from the store on
# 2026-08-05. Since seal refuses to run when a required name is absent, the
# version on PATH could not seal the store at all -- a broken recovery path,
# discovered only by diffing.
#
# Version control is not the control here. What runs is.
# ------------------------------------------------------------------
installed_dir="/usr/local/orb-bin"
if [[ -d "$installed_dir" ]]; then
  diverged=()
  checked=0
  for installed in "$installed_dir"/*; do
    [[ -f "$installed" ]] || continue
    name="$(basename "$installed")"
    repo_copy="$repo_root/scripts/security/$name"
    if [[ ! -f "$repo_copy" ]]; then
      printf 'WARNING: %s is installed but has no counterpart in scripts/security\n' "$name" >&2
      continue
    fi
    checked=$((checked + 1))
    /usr/bin/cmp -s "$installed" "$repo_copy" || diverged+=("$name")
  done

  if (( ${#diverged[@]} > 0 )); then
    printf '\nFAIL: installed launcher(s) differ from this repository:\n\n' >&2
    for name in "${diverged[@]}"; do
      printf '  %s\n' "$name" >&2
      /usr/bin/diff "$installed_dir/$name" "$repo_root/scripts/security/$name" >&2 || true
    done
    printf '\nThe installed copy is what runs. Decide which is correct, then\n' >&2
    printf 'reinstall (root-owned, not writable by the agent):\n\n' >&2
    for name in "${diverged[@]}"; do
      printf '  sudo install -o root -g wheel -m 755 %s %s/%s\n' \
        "scripts/security/$name" "$installed_dir" "$name" >&2
    done
    printf '\n' >&2
    exit 1
  fi
  printf 'Installed launchers match the repository (%d checked).\n' "$checked"
else
  printf 'NOTE: %s does not exist; skipped the installed-vs-repo check.\n' "$installed_dir"
fi

printf 'Security launcher syntax and helper checks passed.\n'
