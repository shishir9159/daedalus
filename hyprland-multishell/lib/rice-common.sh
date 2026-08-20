# shellcheck shell=bash
# Shared by every rice-* tool. Sourced, never executed; found via bin/../lib.

: "${HOME:=$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f6)}"
export HOME
RICE_ROOT="${RICE_ROOT:-$HOME/.rices}"

# Pushed into systemd/dbus at login, cleared at logout.
# shellcheck disable=SC2034  # used by sourcing scripts
RICE_ENV_VARS="RICE_PROFILE RICE_HOME XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME NOCTALIA_CONFIG_HOME NOCTALIA_STATE_HOME"
# Never linked, adopted or reported inside a profile's XDG roots.
# shellcheck disable=SC2034  # used by sourcing scripts
RICE_INTERNAL_NAMES=".git .gitignore"

rice_die() { printf '%s: %s\n' "${0##*/}" "$*" >&2; exit 1; }

# Names land in paths, a .desktop Exec= line and the systemd env: keep them boring.
rice_valid_name() { [[ "${1:-}" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$ ]]; }

rice_profile_dir() { # <name> [--must-exist]
    rice_valid_name "${1:-}" || rice_die "invalid profile name '${1:-}' (letters, digits, '-', '_')"
    local d="$RICE_ROOT/profiles/$1"
    if [ "${2:-}" = --must-exist ] && [ ! -d "$d" ]; then rice_die "no such profile: $1"; fi
    printf '%s' "$d"
}

rice_list_profiles() {
    find "$RICE_ROOT/profiles" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
}

# Owned set, layered: owned.default.txt (shipped) < owned.txt (all profiles)
# < <profile>/owned.txt. "name" owns, "!name" shares; several names per line.
rice_owned() { # <profile-dir>
    local f line w words
    local -A owned=()
    for f in "$RICE_ROOT/owned.default.txt" "$RICE_ROOT/owned.txt" "${1:-/nonexistent}/owned.txt"; do
        [ -f "$f" ] || continue
        while IFS= read -r line || [ -n "$line" ]; do
            read -ra words <<< "${line%%#*}"
            for w in "${words[@]}"; do
                if [ "${w:0:1}" = "!" ]; then unset "owned[${w:1}]"; else owned["$w"]=1; fi
            done
        done < "$f"
    done
    [ ${#owned[@]} -eq 0 ] || printf '%s\n' "${!owned[@]}" | sort
}

rice_export_env() { # <name> <profile-dir>
    export RICE_PROFILE="$1" RICE_HOME="$2"
    export XDG_CONFIG_HOME="$2/config" XDG_DATA_HOME="$2/data"
    export XDG_STATE_HOME="$2/state"   XDG_CACHE_HOME="$2/cache"
    export NOCTALIA_CONFIG_HOME="$XDG_CONFIG_HOME" NOCTALIA_STATE_HOME="$XDG_STATE_HOME"
}

# profile.env is hand-edited: relax the caller's nounset while sourcing it, or
# one unset variable would kill hypr-profile -- and with it the login.
rice_source_env_file() { # <profile-dir>
    [ -f "$1/profile.env" ] || return 0
    local had_u=0 rc=0
    case $- in *u*) had_u=1 ;; esac
    set +u -a
    # shellcheck disable=SC1091
    . "$1/profile.env" || rc=$?
    set +a
    [ "$had_u" = 0 ] || set -u
    return "$rc"
}
