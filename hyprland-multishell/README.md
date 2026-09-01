# hyprland-multishell

Run several Hyprland rices (Noctalia, Caelestia, Persona, …) side by side on one
CachyOS install, pick one at the greeter, update each independently.

**Rule: one rice = one XDG root.** A rice can only clobber what it reaches —
`$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_STATE_HOME`, `$XDG_CACHE_HOME` — so
each profile gets its own four.

## 1. What breaks

| Problem | Effect | Handled by |
|---|---|---|
| Hyprland ≥ 0.55 loads `hyprland.lua` and **silently ignores** `hyprland.conf` | Caelestia (Lua) installs → every `.conf` rice in a shared `~/.config/hypr` stops loading | per-profile `hypr/`; `rice-doctor` warns on both. Hyprlang is deprecated: port `.conf` rices to Lua |
| `caelestia install` overwrites `~/.config/hypr` (+ fish, foot, btop, nvim, gtk, …) | your config replaced | run it via `rice-do caelestia --` |
| matugen-based theming (Caelestia, Noctalia, skwd-wall) writes *other* apps' configs: gtk, kitty, foot, qt, dconf | last rice used wins everywhere | those dirs are owned per profile; hardcoded `~/.config` paths escape — `rice-doctor` finds them |
| `hyprpm` state is shared; plugins are ABI-locked to the Hyprland version | plugins leak across rices; Rivendell's (comp #4) won't build on 0.55+ | `hyprpm` owned per profile; `HYPRLAND_BIN` for an older build |
| Not covered by XDG: `~/.bashrc`/`.zshrc`, `~/.face`, `~/Pictures/Wallpapers`, systemd unit files | shared by all profiles | `rice-doctor` flags rice lines in rc files |

### The rices

| Rice | Status |
|---|---|
| **Noctalia v5** | Native binary (not Quickshell; v4 theming docs don't apply). Profile-aware via `NOCTALIA_CONFIG_HOME`/`NOCTALIA_STATE_HOME`. |
| **Caelestia** | AUR + `caelestia install`. Lua config; customise only `~/.config/caelestia/hypr-user.lua`, `hypr-vars.lua`, `shell.json`, `shell-tokens.json`, `cli.json`. Ships uwsm units. |
| **Persona** | Pure Quickshell (`qs -c persona`), Lua-era keybinds. Needs the [Qt6 Cava plugin](https://github.com/Yujonpradhananga/Qt6-Cava-plugin) or delete `CavaVisualizer.qml` + lines 171–180 of `WallpaperEngine.qml`. No compositor config of its own. |
| **Rivendell** | No installer; hardcoded `/home/zac` paths; two custom plugins likely broken on 0.55+. |
| **Moon rice** | A Flutter app (+ `devenv.nix`) to build and wire up by hand. |
| ~~hypr-comp~~ | Dropped: QML depending on components only in the author's NixOS config. |
| **skwd-wall** | Not a session: a wallpaper/matugen tool. Run it per profile (`rice-do <p> -- skwd-wall`). V1; Rust rewrite pending. |

## 2. Design

```
~/.rices/
├── bin/  lib/  tools.d/  templates/   # tools, shared lib, colour adapters, theme templates
├── owned.default.txt                  # shipped owned set (replaced on install)
├── owned.txt                          # your changes, all profiles
└── profiles/<name>/
    ├── config/ data/ state/ cache/    # the four XDG roots (config/rice-theme: §5)
    ├── profile.env  owned.txt  repos.txt
    ├── .git  .gitignore               # snapshots (§6)
    └── session.log (+ .old)
```

- **Symlink farm.** Owned entries (`hypr`, `quickshell`, `gtk-*`, `matugen`, `dconf`, `hyprpm`, …) are real dirs in the profile; everything else in `~/.config`, `~/.local/{share,state}`, `~/.cache` is symlinked in. nvim, git, browsers stay shared.
- **Layered ownership:** `owned.default.txt` < `~/.rices/owned.txt` < `<profile>/owned.txt`. `name` owns, `!name` shares (e.g. `!kitty`).
- **Divergence:** an app first launched *inside* a profile gets a profile-only config. `rice-doctor` lists these; `rice-sync <p> --adopt` shares them.
- **Login/logout:** `hypr-profile` pushes the profile's paths into systemd/dbus and removes them at logout, so the next session doesn't inherit them. Launches via `start-hyprland` (≥ 0.53: crash recovery) when available.
- **Greeter:** `rice-session <p>` writes `/usr/share/wayland-sessions/rice-<p>.desktop` (the greeter can't read your home). noctalia-greeter, regreet, tuigreet, SDDM, ly all read it; F3 in noctalia-greeter. Entries use `TryExec`; if `~/.rices` vanishes the stub starts plain Hyprland instead of bouncing.
- Your stock `~/.config` session is never touched — always a fallback.

## 3. Install

```bash
git clone https://github.com/shishir9159/daedalus.git ~/src/daedalus && cd ~/src/daedalus/hyprland-multishell
./install.sh && export PATH="$HOME/.rices/bin:$PATH" && ./bootstrap-profiles.sh
rice-session noctalia   # per profile
```

Upgrade: `git pull && ./install.sh` (profiles and your `owned.txt` untouched). `--user-only` skips the root step.

**Or with [dotter](https://github.com/SuperCuber/dotter)** (`../.dotter/global.toml`): `bin/ lib/ tools.d/ templates/` are linked into `~/.rices` instead of copied, so `git pull` alone upgrades them — and a checkout or half-done edit in `bin/` is what your next login runs.
```bash
cd ~/src/daedalus && echo 'packages = ["hyprland"]' > .dotter/local.toml
dotter deploy               # --force once if install.sh copies are already there
hyprland-multishell/install.sh   # deps check + greeter stub; it leaves dotter's links alone
```
`dotter deploy` again after adding a file. Everything is linked, never templated: dotter would otherwise render the `{{ colors.* }}` tokens in `templates/` itself.

| Command | Does |
|---|---|
| `rice-new <p> ["Name"]` | create a profile (names: letters, digits, `-`, `_`) |
| `rice-do <p> -- <cmd>` | run a command in the profile's env (use for installers) |
| `rice-sync <p> [--report\|--adopt]` | rebuild links (also at login) / list or share profile-only configs |
| `rice-session <p> [--remove]` | add/remove the greeter entry |
| `rice-snapshot <p> [msg]` | commit the profile |
| `rice-update [p...]` | rebase upstream rices under your `mine` branch |
| `rice-theme …` | per-tool colour locks (§5) |
| `rice-doctor [p...]` | audit everything in §1; exit 1 on failures |

Tests: `./tests/run.sh && ./tests/shellcheck.sh` — scenario tests in a throwaway `HOME` with stand-ins for sudo, systemctl, rsync, btrfs and Hyprland; run in an Arch container on every push that touches this folder (`../.github/workflows/ci.yml`).

## 4. Recipes

**Noctalia** — import your current setup:
```bash
cp -r ~/.config/noctalia/. ~/.rices/profiles/noctalia/config/noctalia/
cp -r ~/.config/hypr/. ~/.rices/profiles/noctalia/config/hypr/
rice-snapshot noctalia "import" && rice-session noctalia
```
GUI tweaks land in `state/noctalia/settings.toml` (overrides config) — snapshots include it. Updates come via pacman; never edit `/usr/share/noctalia`.

**Caelestia**
```bash
paru -S caelestia-cli caelestia-shell
rice-snapshot caelestia empty && rice-do caelestia -- caelestia install && rice-snapshot caelestia installed
```
The diff shows what the installer did. The shell's clone line in `repos.txt` is off on purpose: an unbuilt clone shadows the AUR copy.

**Persona**
```bash
rice-update persona   # clones to config/quickshell/persona on branch 'mine'
cp -r ~/.rices/profiles/noctalia/config/hypr/. ~/.rices/profiles/persona/config/hypr/
```
```lua
hl.exec_once("qs -c persona")
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd("qs -c persona ipc call searchapp toggle"))
```
Commit local edits (e.g. the Cava removal) on `mine`; updates rebase underneath. On conflict the rebase is aborted and the rice stays on your version.

**Rivendell / moon**: copy their `.config/` into the profile, then `rice-doctor` lists `/home/zac` paths to fix. For plugins needing an older Hyprland: `HYPRLAND_BIN=/opt/hyprland-0.45/bin/Hyprland` in `profile.env`, and `exec-once = hyprpm reload -n` in the hypr config (not `PRE_EXEC`, which runs before Hyprland).

## 5. Colour locks

Noctalia's `[theme] source = "builtin"` freezes everything, bar included. `rice-theme` makes it per tool:

```
palette change → generated/<tool> → post_hook: rice-theme --profile <p> apply <tool>
  → policy: auto (publish generated) | lock (republish the pin)
  → adapter transform → active/<tool> (what the app reads) → reload
```

Setup, once per profile:
```bash
rice-theme hints             # include line for each app's config
rice-theme noctalia-config   # writes noctalia/templates.toml (backs up a foreign one)
```
**Remove managed tools from Noctalia's `builtin_ids`/`community_ids`** — those templates write straight to the apps and beat any lock (`rice-doctor` warns). Starter templates: ghostty, kitty, foot, gtk, nvim; verify role names against the [template reference](https://docs.noctalia.dev/noctalia/theming/templates/).

```bash
rice-theme lock nvim ghostty                     # keep current colours across wallpaper changes
rice-theme unlock nvim
rice-theme save gruvbox nvim kitty && rice-theme set gruvbox
rice-theme render ghostty pic.png --save forest  # colours from any image, wallpaper untouched
rice-theme status                                # or `check`: exit 1 if a lock broke
rice-theme watch                                 # restore locks if a rice writes into active/
```
Outside a rice session add `--profile <p>`.

| Tool | Live reload |
|---|---|
| Ghostty | SIGUSR2, only if ≥ 1.2 (below that it closes every terminal; version checked) |
| kitty | SIGUSR1 |
| Neovim | `--remote-expr` (stays in insert mode) |
| Alacritty | automatic |
| foot, GTK, btop, fuzzel | none — new windows/launches pick it up |

New tool: `~/.rices/tools.d/<name>.sh` with `EXT`, `DESC`, `INCLUDE`, `reload()`, optional `transform()`.

## 6. Snapshots and rollback

Each profile is a git repo (`rice-snapshot`). The `.gitignore` whitelist captures `config/`, `profile.env`, `owned.txt`, `repos.txt` and `state/noctalia/settings.toml` — not caches, generated colours, logs or key files. Cloned rices are recorded as commit pointers (uncommitted work in them is reported).
```bash
cd ~/.rices/profiles/caelestia && git log --oneline
```
That covers a broken rice, not a dead disk — §7.

## 7. Backups: XFS root → btrfs HDD

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

## Sources

[Hyprland Lua configs](https://hypr.land/news/26_lua/) ·
[caelestia](https://github.com/caelestia-dots/caelestia) ([shell](https://github.com/caelestia-dots/shell), [hypr](https://github.com/caelestia-dots/hypr)) ·
[noctalia](https://github.com/noctalia-dev/noctalia) ([config](https://docs.noctalia.dev/noctalia/configuration/), [app theming](https://docs.noctalia.dev/noctalia/theming/app-theming/), [templates](https://docs.noctalia.dev/noctalia/theming/templates/)) ·
[noctalia-greeter](https://github.com/noctalia-dev/noctalia-greeter) ·
[Persona-Quickshell](https://github.com/Yujonpradhananga/Persona-Quickshell) ·
[rivendell-hyprdots](https://codeberg.org/zacoons/rivendell-hyprdots) ·
[moon rice](https://github.com/FlafyDev/hyprland_moon_rice_public) ·
[skwd-wall](https://github.com/liixini/skwd-wall) ·
[Ghostty SIGUSR2](https://github.com/ghostty-org/ghostty/issues/7747) ·
[foot reload](https://codeberg.org/dnkl/foot/issues/708) ·
[Timeshift](https://github.com/teejee2008/timeshift) ([btrfs mode is same-disk](https://github.com/teejee2008/timeshift/issues/832)) ·
[restic](https://restic.net/) · [uwsm](https://github.com/Vladimir-csp/uwsm) ·
[CachyOS filesystems](https://wiki.cachyos.org/installation/filesystem/)
