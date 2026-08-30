#!/usr/bin/env bash
# restic-backup [backup|prune|check|all] -- restic with one exclude list.
# Optional /etc/restic-backup.env: RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
#   KEEP_DAILY KEEP_WEEKLY KEEP_MONTHLY CHECK_SUBSET
set -euo pipefail
die() { echo "restic-backup: $*" >&2; exit 1; }

ENV_FILE="${ENV_FILE:-/etc/restic-backup.env}"
# shellcheck source=/dev/null  # runtime config
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
export RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/mnt/backup/restic}"
export RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-/root/.restic-pass}"
command -v restic >/dev/null || die "restic not installed"
[ -r "$RESTIC_PASSWORD_FILE" ] || die "can't read $RESTIC_PASSWORD_FILE"

# Contents only, never the dirs: a full restore needs the mountpoints.
EXCLUDES=(
    --exclude-caches
    --exclude='/proc/*' --exclude='/sys/*' --exclude='/dev/*' --exclude='/run/*'
    --exclude='/tmp/*' --exclude='/var/tmp/*' --exclude='/var/cache/*' --exclude='/var/lib/pacman/sync/*'
    --exclude='/mnt/*' --exclude='/media/*' --exclude='/swap/*'
    --exclude='/lost+found' --exclude='/swapfile' --exclude='/home/*/.cache'
)

do_backup() { # status 3 = snapshot saved but some files unreadable
    local rc=0
    restic backup / "${EXCLUDES[@]}" || rc=$?
    case $rc in 0|3) return "$rc" ;; *) die "backup failed ($rc)" ;; esac
}
do_prune() { restic forget --prune --keep-daily "${KEEP_DAILY:-14}" --keep-weekly "${KEEP_WEEKLY:-8}" --keep-monthly "${KEEP_MONTHLY:-12}"; }
do_check() { restic check --read-data-subset="${CHECK_SUBSET:-5%}"; }

case "${1:-all}" in
    backup) do_backup ;;
    prune)  do_prune ;;
    check)  do_check ;;
    all)    rc=0; do_backup || rc=$?; do_prune; exit "$rc" ;;
    *)      echo "usage: restic-backup [backup|prune|check|all]" >&2; exit 2 ;;
esac
