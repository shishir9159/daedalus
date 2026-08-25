# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# SIGUSR2 reloads config only from 1.2; below that it TERMINATES Ghostty
# (every terminal closes). So: check the version, and when unsure, don't.
DESC="Ghostty" EXT=".conf"
INCLUDE="in ghostty/config:  config-file = ?$TH/active/ghostty.conf"

reload() {
    command -v ghostty >/dev/null && pgrep -x ghostty >/dev/null || return 1
    local maj min
    IFS=. read -r maj min <<< "$(ghostty --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
    [[ "${maj:-}" =~ ^[0-9]+$ && "${min:-}" =~ ^[0-9]+$ ]] || return 1
    if [ "$maj" -lt 1 ] || { [ "$maj" -eq 1 ] && [ "$min" -lt 2 ]; }; then return 1; fi
    if systemctl --user --quiet is-active app-com.mitchellh.ghostty.service 2>/dev/null; then
        systemctl --user reload app-com.mitchellh.ghostty.service && return 0
    fi
    pkill -USR2 -x ghostty
}
