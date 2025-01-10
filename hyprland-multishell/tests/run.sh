#!/usr/bin/env bash
# tests/run.sh [t_name.sh ...]  -- run the scenario tests (default: all).
# Needs bash >= 4.4, git, GNU find/sed/grep. Nothing outside a temp dir is touched.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

tests=("$@")
[ ${#tests[@]} -gt 0 ] || tests=(t_*.sh)

failed=()
for t in "${tests[@]}"; do
    echo "=== $t"
    bash "$t" || failed+=("$t")
    echo
done

if [ ${#failed[@]} -gt 0 ]; then
    echo "FAILED: ${failed[*]}"
    exit 1
fi
echo "all ${#tests[@]} test files passed"
