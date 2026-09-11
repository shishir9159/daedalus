# shellcheck shell=bash disable=SC2034  # DESC/INCLUDE are read by rice-theme
# SIGUSR2 reloads config only from 1.2; below that it TERMINATES Ghostty
# (every terminal closes). So: check the version, and when unsure, don't.
DESC="Ghostty"
INCLUDE="in ghostty/config:  config-file = ?$TH/active/ghostty.conf"

reload() {
    command -v ghostty >/dev/null && pgrep -x ghostty >/dev/null || return 1
    local v
    v="$(ghostty --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
    [ -n "$v" ] && [ "$(printf '1.2\n%s\n' "$v" | sort -V | head -1)" = 1.2 ] || return 1
    if systemctl --user --quiet is-active app-com.mitchellh.ghostty.service 2>/dev/null; then
        systemctl --user reload app-com.mitchellh.ghostty.service && return 0
    fi
    pkill -USR2 -x ghostty
}
