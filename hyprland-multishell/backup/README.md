# Backups: XFS root → btrfs HDD

Run the commands below from `hyprland-multishell/`.

- **btrfs on the HDD: yes** — compression, checksums (`scrub` finds bit rot), cheap CoW snapshots. Not `send`/`receive`: that needs btrfs on both ends.
- **Timeshift** only works in RSYNC mode here, and its history is hard links: one corrupt block hits every "snapshot".
- **Recommended:** restic (primary) + an rsync→btrfs mirror (browsable, bootable). Both on the HDD.
- XFS has no local rollback, so the HDD is your *only* safety net. Keep `/var/cache/pacman/pkg` populated for `downgrade`.

**Identify the disk** by size and model (`/dev/sdX` names aren't stable):
```bash
lsblk -o NAME,SIZE,MODEL,SERIAL,MOUNTPOINTS,FSTYPE
```

**Format and mount**
```bash
sudo wipefs -a /dev/sdX && sudo sgdisk -Z -n 1:0:0 -t 1:8300 /dev/sdX
sudo mkfs.btrfs -L backup /dev/sdX1
```
`/etc/fstab` (`nofail`: a slow disk can't block boot):
```
UUID=<hdd-uuid>  /mnt/backup  btrfs  noatime,compress=zstd:3,nofail,x-systemd.device-timeout=10  0 0
```
```bash
sudo mkdir -p /mnt/backup && sudo systemctl daemon-reload && sudo mount -a
```

**restic** — password prompted, never in shell history; keep a copy off the SSD:
```bash
sudo pacman -S restic
sudo bash -c 'umask 077; read -rsp "passphrase: " p; echo; printf "%s\n" "$p" > /root/.restic-pass'
sudo restic init --repo /mnt/backup/restic --password-file /root/.restic-pass
sudo install -Dm755 backup/restic-backup.sh /usr/local/sbin/restic-backup
sudo restic-backup         # backup + prune (14 daily / 8 weekly / 12 monthly)
sudo restic-backup check   # monthly
```
Settings: `/etc/restic-backup.env`. Restore a file: `restic restore <id> --target /tmp/out --include <path>`, or `restic mount`.

**Mirror** — `/mnt/backup/mirror` (newest) + `/mnt/backup/snapshots/<stamp>` (read-only history):
```bash
sudo install -Dm755 backup/xfs-to-btrfs-mirror.sh /usr/local/sbin/xfs-to-btrfs-mirror
sudo xfs-to-btrfs-mirror --dry-run && sudo xfs-to-btrfs-mirror
```
Refuses to run from a live USB; one run at a time; unreadable files → snapshot named `…-partial`, non-zero exit; prunes only its own snapshots (`KEEP`, ≥ 1). Extra excludes: `/etc/xfs-to-btrfs-mirror.exclude`.

**Automate** — independent timers (mirror 03:00, restic 04:00, restic waits if both are due):
```bash
sudo install -Dm644 -t /etc/systemd/system backup/systemd/*
sudo systemctl daemon-reload && sudo systemctl enable --now backup-mirror.timer backup-restic.timer
sudo systemctl enable --now btrfs-scrub@$(systemd-escape -p /mnt/backup).timer
sudo pacman -S smartmontools && sudo systemctl enable --now smartd
```

**Restore** — a file: copy it out of `/mnt/backup/snapshots/<stamp>/`. The system, after replacing the SSD: from the live ISO, `mkfs.xfs` and mount the new drive, then
```bash
sudo rsync -aHAXx --numeric-ids /mnt/backup/snapshots/<stamp>/ /mnt/newroot/
```
fix `/etc/fstab` UUIDs and reinstall the bootloader via [cachy-chroot](https://wiki.cachyos.org/features/cachy_chroot/). **Test a restore once, now.**

`~/.rices` lives in `/home`: both backups cover it; keep it in if you narrow excludes. Profile repos are versioned, not backed up.

Sources: [Timeshift](https://github.com/teejee2008/timeshift) ([btrfs mode is same-disk](https://github.com/teejee2008/timeshift/issues/832)) ·
[restic](https://restic.net/) · [CachyOS filesystems](https://wiki.cachyos.org/installation/filesystem/)
