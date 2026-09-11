#!/usr/bin/env bash
# bootstrap-profiles.sh -- create the five profiles. Re-runnable: never
# overwrites a profile.env or repos.txt that already exists.
set -euo pipefail
# shellcheck source=lib/rice-common.sh
. "$(cd "$(dirname "$0")" && pwd)/lib/rice-common.sh"

mk() { # <name> <display name> <use_uwsm>
    local env="$RICE_ROOT/profiles/$1/profile.env" fresh=0
    [ -f "$env" ] || fresh=1
    "$RICE_ROOT/bin/rice-new" "$1" "$2" >/dev/null
    if [ "$fresh" = 1 ]; then sed -i "s/^USE_UWSM=.*/USE_UWSM=$3/" "$env"; echo "  + $1"; else echo "  = $1 (exists)"; fi
}
repos() { # <name>, content on stdin
    local f="$RICE_ROOT/profiles/$1/repos.txt"
    if [ -f "$f" ]; then cat >/dev/null; else cat > "$f"; fi
}

echo ":: profiles"
mk noctalia  "Hyprland - Noctalia"  0
mk caelestia "Hyprland - Caelestia" 1   # ships uwsm units
mk rivendell "Hyprland - Rivendell" 0
mk moon      "Hyprland - Moon Rice" 0
mk persona   "Hyprland - Persona"   0

repos caelestia <<'EOF'
# Install via AUR (caelestia-shell) + `caelestia install`. Only enable this if you
# also build it (cmake): an unbuilt clone here shadows the AUR copy and breaks it.
# config/quickshell/caelestia  https://github.com/caelestia-dots/shell  main
EOF
repos rivendell <<'EOF'
# No installer; hardcodes /home/zac. Copy its .config/ into config/, then rice-doctor.
# src/rivendell  https://codeberg.org/zacoons/rivendell-hyprdots  main
EOF
repos moon <<'EOF'
# Flutter app: build it, wire its dots/ into config/.
src/moon_rice  https://github.com/FlafyDev/hyprland_moon_rice_public  main
EOF
repos persona <<'EOF'
# Pure Quickshell; start it from hyprland.lua with: qs -c persona
config/quickshell/persona  https://github.com/Yujonpradhananga/Persona-Quickshell  main
EOF

echo ":: next: rice-session <name> for each, then rice-doctor"
