#!/usr/bin/env bash
# hypr-profile and the system stub: environment, launcher choice, exit status,
# cleanup of the systemd/dbus environment at logout, log rotation, fallback.
# shellcheck disable=SC2016  # stub bodies are literal on purpose: they expand when the stub runs
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
mkprofile s1
# fake compositors: record what they were started with, then "log out" with
# status 7. Both, so a real start-hyprland on PATH is never launched.
fake='echo "env XDG_CONFIG_HOME=$XDG_CONFIG_HOME RICE_PROFILE=$RICE_PROFILE" >> "$CALLS"; exit 7'
stub Hyprland "$fake"
stub start-hyprland "$fake"

section "launch"
hypr-profile s1; rc=$?
expect "compositor's exit status is passed through" test "$rc" -eq 7
expect "compositor sees the profile's config dir"    called "env XDG_CONFIG_HOME=$PD/config RICE_PROFILE=s1"
expect "env pushed into systemd"             called 'systemctl --user import-environment RICE_PROFILE'
expect "...and removed again at logout"      called 'systemctl --user unset-environment RICE_PROFILE'
expect "dbus copy blanked at logout"         called 'XDG_CONFIG_HOME= '
expect "session log written"                 has "$PD/session.log" "starting profile 's1'"
hypr-profile s1
expect "previous log kept as .old"           test -f "$PD/session.log.old"
refute "log is not inside an XDG root"       test -e "$PD/state/hypr-profile.log"

section "launcher choice"
: > "$CALLS"; hypr-profile s1
expect "start-hyprland preferred when present" called 'start-hyprland'
echo 'HYPRLAND_CONFIG=/some/where.lua' >> "$PD/profile.env"
: > "$CALLS"; hypr-profile s1
expect "explicit config uses Hyprland -c"    called 'Hyprland -c /some/where.lua'
sed -i '/^HYPRLAND_CONFIG=/d' "$PD/profile.env"

section "a broken profile.env cannot lock you out"
echo 'EXTRA="$DEFINITELY_UNSET/x"' >> "$PD/profile.env"
: > "$CALLS"; hypr-profile s1
expect "unset variable in profile.env: session still starts" called 'start-hyprland'
sed -i '/^EXTRA=/d' "$PD/profile.env"

section "bad input"
refute "unknown profile"                     hypr-profile nope
refute "invalid name"                        hypr-profile '../s1'

section "system stub fallback"
: > "$CALLS"
RICE_ROOT="$SANDBOX/gone" bash "$REPO/system/hypr-profile" s1 2>/dev/null
expect "missing launcher -> plain session, not a bounce" called 'start-hyprland'
: > "$CALLS"
bash "$REPO/system/hypr-profile" s1
expect "normal case hands off to the user launcher"      called "env XDG_CONFIG_HOME=$PD/config"

finish
