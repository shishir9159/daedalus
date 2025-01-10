#!/usr/bin/env bash
# rice-doctor: exit status, no false drift for transformed locks, and the new
# checks (PRE_EXEC misuse, Noctalia templates bypassing locks, divergence).
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
mkprofile dr
echo 'return {}' > "$PD/config/hypr/hyprland.lua"
printf '[colors-dark]\nbackground=#123456\n' > "$PD/config/rice-theme/generated/foot.ini"
rice-theme -p dr lock foot >/dev/null

section "exit status"
refute "missing system stub is a failure"    rice-doctor dr
printf '#!/bin/sh\n' > "$RICE_STUB"; chmod +x "$RICE_STUB"
rice-doctor dr > "$SANDBOX/out"; rc=$?
expect "clean profile exits 0"               test "$rc" -eq 0
expect "transformed lock reported ok, not drifted" has "$SANDBOX/out" 'foot locked (lock)'

section "checks"
echo 'PRE_EXEC="hyprpm reload -n"' >> "$PD/profile.env"
refute "PRE_EXEC with hyprpm is a failure"   rice-doctor dr
sed -i '/^PRE_EXEC=/d' "$PD/profile.env"

mkdir -p "$PD/config/noctalia"
printf '[theme.templates]\nbuiltin_ids = [\n  "kitty",\n]\n' > "$PD/config/noctalia/config.toml"
out_has "warns when Noctalia's own kitty template bypasses locks" 'also target: kitty' rice-doctor dr

mkdir -p "$PD/config/brandnew"
out_has "reports profile-only copies" 'config/brandnew' rice-doctor dr

echo 'tampered' > "$PD/config/rice-theme/active/foot.ini"
out_has "reports a broken lock" 'foot is locked (lock) but its live file changed' rice-doctor dr

finish
