#!/usr/bin/env bash
# xfs-to-btrfs-mirror [--dry-run] -- rsync / into a btrfs subvolume on the backup
# disk, then snapshot it read-only. (send/receive needs btrfs on both ends; the
# root is XFS.) Each snapshot is an independent CoW copy, costing only changes.
#   $DEST/mirror              newest state
#   $DEST/snapshots/<stamp>   read-only history (KEEP newest kept)
# Env: DEST=/mnt/backup KEEP=14; extra rsync excludes: /etc/xfs-to-btrfs-mirror.exclude
set -euo pipefail

DEST="${DEST:-/mnt/backup}"
MIRROR="$DEST/mirror" SNAPDIR="$DEST/snapshots"
KEEP="${KEEP:-14}"
EXCLUDE_FILE="${EXCLUDE_FILE:-/etc/xfs-to-btrfs-mirror.exclude}"
die() { echo "xfs-to-btrfs-mirror: $*" >&2; exit 1; }

DRY=0
for a in "$@"; do
    case "$a" in
        -n|--dry-run) DRY=1 ;;
        -h|--help)    awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
        *)            echo "unknown option: $a" >&2; exit 2 ;;
    esac
done

[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "KEEP must be >= 1 (got '$KEEP')"
[ "$(id -u)" = 0 ] || die "must run as root"
mountpoint -q "$DEST" || die "$DEST is not mounted"
[ "$(findmnt -no FSTYPE "$DEST")" = btrfs ] || die "$DEST is not btrfs"
# From a live USB, --delete would make the mirror match the installer.
rootfs="$(findmnt -no FSTYPE /)"
case "$rootfs" in overlay|squashfs|tmpfs|ramfs|airootfs) die "/ is $rootfs - looks like a live environment" ;; esac

# Contents only, never the dirs: a restored root needs them as mountpoints.
# Path excludes instead of -x, so a separate /home or /boot is included.
EXCLUDES=(
    --exclude='/proc/*' --exclude='/sys/*' --exclude='/dev/*' --exclude='/run/*'
    --exclude='/tmp/*' --exclude='/var/tmp/*' --exclude='/var/cache/*' --exclude='/var/lib/pacman/sync/*'
    --exclude='/mnt/*' --exclude='/media/*' --exclude='/swap/*'
    --exclude='/lost+found' --exclude='/swapfile' --exclude='.cache/'
    --exclude="$DEST/*"
)
[ ! -f "$EXCLUDE_FILE" ] || EXCLUDES+=(--exclude-from="$EXCLUDE_FILE")
RSYNC=(rsync -aHAX --numeric-ids --delete "${EXCLUDES[@]}")

if [ "$DRY" = 1 ]; then
    rc=0; "${RSYNC[@]}" --dry-run --info=stats2 / "$MIRROR/" || rc=$?
    case $rc in 0|23|24) ;; *) die "rsync --dry-run failed ($rc)" ;; esac
    echo ":: dry run - would snapshot into $SNAPDIR, keeping $KEEP"
    exit 0
fi

exec 9>"$DEST/.mirror.lock"
flock -n 9 || die "another run is in progress"
mkdir -p "$SNAPDIR"
if [ ! -e "$MIRROR" ]; then btrfs subvolume create "$MIRROR" >/dev/null
elif ! btrfs subvolume show "$MIRROR" >/dev/null 2>&1; then die "$MIRROR exists but isn't a subvolume"
fi

echo ":: syncing / -> $MIRROR"
rc=0; "${RSYNC[@]}" --info=progress2 / "$MIRROR/" || rc=$?
suffix=""
case $rc in
    0|24) ;;                                   # 24: files vanished mid-run, normal
    23)   suffix="-partial"; echo "!! some files unreadable (rsync 23): snapshot marked partial" ;;
    *)    die "rsync failed ($rc) - mirror may be half-updated; snapshots are intact" ;;
esac

sync
base="$(date +%Y-%m-%dT%H%M%S)" n=1
name="$base$suffix"
while [ -e "$SNAPDIR/$name" ]; do n=$((n + 1)); name="$base-$n$suffix"; done   # same-second runs
btrfs subvolume snapshot -r "$MIRROR" "$SNAPDIR/$name" >/dev/null
echo ":: snapshot $name"

# Prune beyond KEEP; only our own names (they sort chronologically).
mapfile -t snaps < <(find "$SNAPDIR" -mindepth 1 -maxdepth 1 -printf '%f\n' \
    | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}([0-9]{2})?(-[0-9]+)?(-partial)?$' | sort)
for ((i = 0; i < ${#snaps[@]} - KEEP; i++)); do
    btrfs subvolume delete "$SNAPDIR/${snaps[$i]}" >/dev/null
    echo ":: pruned ${snaps[$i]}"
done
df -h "$DEST" | tail -1
[ -z "$suffix" ] || exit 1   # surface partial runs to systemd
