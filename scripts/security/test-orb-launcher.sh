#!/bin/bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

/bin/bash -n "$repo_root/scripts/security/orb-dev"
/bin/bash -n "$repo_root/scripts/security/orb-secrets-seal"
/bin/bash -n "$repo_root/scripts/security/orb-secrets-set"

source "$repo_root/scripts/security/orb-dev"

[[ "$(mode_of "$repo_root/package.json")" =~ ^[0-7]{3,4}$ ]]

printf 'Security launcher syntax and helper checks passed.\n'
