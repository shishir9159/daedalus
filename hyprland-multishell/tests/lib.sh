# shellcheck shell=bash
# Test helpers, sourced by every tests/t_*.sh. Each test file gets its own
# throwaway HOME with the toolkit installed into it (--user-only), and stub
# commands for anything that needs root or a desktop. Stubs append their
# argv to $CALLS so tests can assert on what would have run.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T_NAME="${0##*/}"
T_COUNT=0
T_FAILS=0

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@localhost
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@localhost
export GIT_CONFIG_NOSYSTEM=1

# Git for Windows: real symlinks, also when a test file is run on its own.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) export MSYS=winsymlinks:nativestrict ;; esac

setup() {
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    export HOME="$SANDBOX/home"
    export RICE_ROOT="$HOME/.rices"
    mkdir -p "$HOME/.config" "$HOME/.local/share" "$HOME/.local/state" "$HOME/.cache"
    unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME RICE_PROFILE RICE_HOME

    STUBS="$SANDBOX/stubs"
    mkdir -p "$STUBS"
    export CALLS="$SANDBOX/calls.log"
    : > "$CALLS"
    export PATH="$STUBS:$PATH"
    stub sudo 'exec "$@"'
    stub systemctl 'case "$*" in *is-active*) exit 3 ;; esac'   # no user units running
    stub dbus-update-activation-environment

    export RICE_SESSIONS_DIR="$SANDBOX/wayland-sessions"
    export RICE_STUB="$SANDBOX/usr-local-bin-hypr-profile"
    export RICE_SUDO=""

    "$REPO/install.sh" --user-only >/dev/null || { echo "install.sh --user-only failed"; exit 1; }
    export PATH="$RICE_ROOT/bin:$PATH"
}

# stub <name> [body]  -- a fake command that logs "name args..." to $CALLS
stub() {
    {
        echo '#!/usr/bin/env bash'
        echo "echo \"$1 \$*\" >> \"\$CALLS\""
        echo "${2:-exit 0}"
    } > "$STUBS/$1"
    chmod +x "$STUBS/$1"
}
unstub() { rm -f "$STUBS/$1"; }

pass() { T_COUNT=$((T_COUNT + 1)); printf '  ok    %s\n' "$1"; }
fail() {
    T_COUNT=$((T_COUNT + 1)); T_FAILS=$((T_FAILS + 1))
    printf '  FAIL  %s\n' "$1"
    [ -z "${2:-}" ] || printf '%s\n' "$2" | tail -8 | sed 's/^/        | /'
}

# expect "description" <command...>       passes if the command succeeds
# refute "description" <command...>       passes if the command fails
expect() { local d="$1" out; shift; if out="$("$@" 2>&1)"; then pass "$d"; else fail "$d" "$out"; fi; }
refute() { local d="$1" out; shift; if out="$("$@" 2>&1)"; then fail "$d (unexpectedly succeeded)" "$out"; else pass "$d"; fi; }

has()     { grep -qF -- "$2" "$1"; }          # has <file> <text>
has_not() { ! grep -qF -- "$2" "$1"; }
called()  { grep -qF -- "$1" "$CALLS"; }      # called <text>
same()    { cmp -s "$1" "$2"; }

section() { printf '\n%s\n' "$*"; }

finish() {
    printf '\n%s: %d/%d passed\n' "$T_NAME" "$((T_COUNT - T_FAILS))" "$T_COUNT"
    [ "$T_FAILS" -eq 0 ]
}
