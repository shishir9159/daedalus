#!/usr/bin/env bash
# xfs-to-btrfs-mirror against fake rsync/btrfs: restorable excludes, KEEP
# validation, pruning that ignores strangers, partial runs, the live-USB guard.
# shellcheck disable=SC2016  # stub bodies are literal on purpose: they expand when the stub runs
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
M="$REPO/backup/xfs-to-btrfs-mirror.sh"
export DEST="$SANDBOX/backup" EXCLUDE_FILE="$SANDBOX/none"
mkdir -p "$DEST"

stub id          '[ "${1:-}" = -u ] && echo 0 || command -p id "$@"'
stub mountpoint  'exit 0'
stub flock       'exit 0'
stub df          'echo "fake df"'
stub sync        'exit 0'
stub findmnt     'case "${!#}" in /) echo "${ROOTFS:-xfs}" ;; *) echo btrfs ;; esac'
stub rsync       'exit "${RSYNC_RC:-0}"'
stub btrfs '
case "$1 $2" in
  "subvolume create")   mkdir -p "$3" ;;
  "subvolume show")     test -d "$3" ;;
  "subvolume snapshot") [ ! -e "$5" ] && mkdir -p "$5" ;;
  "subvolume delete")   rm -rf "$3" ;;
esac'
snaps() { find "$DEST/snapshots" -mindepth 1 -maxdepth 1 -printf '%f\n' 2>/dev/null | sort; }

section "restorable excludes"
expect "run succeeds"                        bash "$M"
expect "excludes /proc contents, keeps the mountpoint" called "--exclude=/proc/*"
refute "never excludes /proc itself"         called "--exclude=/proc/ "
expect "same for /dev, /sys, /run"           bash -c "grep -q -- '--exclude=/dev/\*' '$CALLS' && grep -q -- '--exclude=/sys/\*' '$CALLS' && grep -q -- '--exclude=/run/\*' '$CALLS'"
expect "one snapshot"                        test "$(snaps | wc -l)" -eq 1

section "KEEP validation"
refute "KEEP=0 refused (would delete everything)" env KEEP=0 bash "$M"
refute "KEEP=abc refused"                    env KEEP=abc bash "$M"

section "pruning"
rm -rf "$DEST/snapshots"; mkdir -p "$DEST/snapshots"
mkdir "$DEST/snapshots/2026-01-01T0300" "$DEST/snapshots/2026-01-02T030000" "$DEST/snapshots/2026-01-03T030000"
echo 'mine' > "$DEST/snapshots/notes.txt"
expect "run with KEEP=2"                     env KEEP=2 bash "$M"
expect "oldest two pruned"                   bash -c "! test -e '$DEST/snapshots/2026-01-01T0300' && ! test -e '$DEST/snapshots/2026-01-02T030000'"
expect "newest kept"                         test -d "$DEST/snapshots/2026-01-03T030000"
expect "unrelated file untouched"            test -f "$DEST/snapshots/notes.txt"

section "partial and failed runs"
refute "rsync 23 -> non-zero exit"           env RSYNC_RC=23 bash "$M"
expect "...but the snapshot is kept, marked partial" bash -c "find '$DEST/snapshots' -name '*-partial' | grep -q ."
n="$(snaps | wc -l)"
refute "rsync 11 -> failure"                 env RSYNC_RC=11 bash "$M"
expect "...and no snapshot of a broken mirror" test "$(snaps | wc -l)" -eq "$n"
expect "rsync 24 (vanished files) is fine"   env RSYNC_RC=24 bash "$M"
expect "two runs in one second don't collide" bash -c "bash '$M' && bash '$M'"

section "live USB guard"
: > "$CALLS"
refute "refuses when / is an overlay"        env ROOTFS=overlay bash "$M"
refute "...before touching rsync"            called 'rsync'

section "dry run"
: > "$CALLS"; n="$(snaps | wc -l)"
expect "dry run"                             bash "$M" --dry-run
expect "passes --dry-run to rsync"           called '--dry-run'
expect "no snapshot taken"                   test "$(snaps | wc -l)" -eq "$n"

finish
