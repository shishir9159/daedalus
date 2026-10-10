#!/usr/bin/env bash
# tests/shellcheck.sh  -- lint every shell file in the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v shellcheck >/dev/null || { echo "shellcheck not installed (pacman -S shellcheck)" >&2; exit 1; }
files=(
    bin/* lib/*.sh tools.d/*.sh system/hypr-profile
    install.sh bootstrap-profiles.sh bootstrap-packages.sh
    backup/*.sh
    tests/*.sh
)
shellcheck "${files[@]}"   # .shellcheckrc follows `source`s
echo "shellcheck: ${#files[@]} files clean"
