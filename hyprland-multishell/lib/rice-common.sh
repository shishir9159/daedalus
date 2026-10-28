# shellcheck shell=bash
# Shared by rice-theme and install.sh. Sourced, never executed; found via bin/../lib.

: "${HOME:=$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f6)}"
export HOME
RICE_ROOT="${RICE_ROOT:-$HOME/.rices}"

rice_die()   { printf '%s: %s\n' "${0##*/}" "$*" >&2; exit 1; }
rice_usage() { printf 'usage: %s\n' "$*" >&2; exit 2; }

# shellcheck disable=SC2034  # used by sourcing scripts
rice_colors() { # sets c_r c_g c_y c_d c_0: escapes on a terminal, else empty
    if [ -t 1 ]; then c_r=$'\033[31m' c_g=$'\033[32m' c_y=$'\033[33m' c_d=$'\033[2m' c_0=$'\033[0m'
    else c_r='' c_g='' c_y='' c_d='' c_0=''; fi
}
