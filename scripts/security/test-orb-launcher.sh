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
[[ "$(printf 'ALPHA=old\nBETA=keep\n' | remove_value ALPHA)" == 'BETA=keep' ]]
is_removable_name ELEVENLABS_API_KEY
! is_allowed_name ELEVENLABS_API_KEY

printf 'Security launcher syntax and helper checks passed.\n'
