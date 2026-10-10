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
| `hyprpm` state is shared; plugins are ABI-locked to the Hyprland version | plugins leak across rices; Rivendell's won't build on 0.55+ | `hyprpm` owned per profile; `HYPRLAND_BIN` for an older build |
| Not covered by XDG: `~/.bashrc`/`.zshrc`, `~/.face`, `~/Pictures/Wallpapers`, systemd unit files | shared by all profiles | `rice-doctor` flags rice lines in rc files |

### Rices

| Rice | Status |
|---|---|
| **Noctalia v5** | Native binary (not Quickshell; v4 theming docs don't apply). Profile-aware via `NOCTALIA_CONFIG_HOME`/`NOCTALIA_STATE_HOME`. |
| **Caelestia** | AUR + `caelestia install`. Lua config; customise only `~/.config/caelestia/hypr-user.lua`, `hypr-vars.lua`, `shell.json`, `shell-tokens.json`, `cli.json`. Ships uwsm units. |
| **Persona** | Pure Quickshell (`qs -c persona`), Lua-era keybinds. Needs the [Qt6 Cava plugin](https://github.com/Yujonpradhananga/Qt6-Cava-plugin) or delete `CavaVisualizer.qml` and its use in `WallpaperEngine.qml`. No compositor config of its own. |
| **Rivendell** | No installer; hardcoded `/home/zac` paths; two custom plugins likely broken on 0.55+. |
| **Moon rice** | A Flutter app (+ `devenv.nix`) to build and wire up by hand. |
| **skwd-wall** | Not a session: a wallpaper/matugen tool. Run it per profile (`rice-do <p> -- skwd-wall`). |

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
- **Greeter:** `rice-session <p>` writes `/usr/share/wayland-sessions/rice-<p>.desktop` (the greeter can't read your home); any greeter that reads wayland-sessions lists it (F3 in noctalia-greeter). Entries use `TryExec`; if `~/.rices` vanishes the stub starts plain Hyprland instead of bouncing.
- Your stock `~/.config` session is never touched — always a fallback.

## 3. Install

On a fresh CachyOS (Hyprland edition), go through `bootstrap-packages.sh` first,
by hand, a step at a time: an English-only locale, packages and toolchains
(nightly Rust, uv, Ghidra).

```bash
sudo pacman -Syu --needed git   # -u: never -Sy alone, a partial upgrade
git clone https://github.com/shishir9159/daedalus.git ~/src/daedalus && cd ~/src/daedalus/hyprland-multishell
./install.sh && export PATH="$HOME/.rices/bin:$PATH" && ./bootstrap-profiles.sh
rice-session noctalia   # per profile
```

Upgrade: `git pull && ./install.sh` (profiles and your `owned.txt` untouched). `--user-only` skips the root step.

**Or with [dotter](https://github.com/SuperCuber/dotter)**: the `hyprland` package links `bin/ lib/ tools.d/ templates/` into `~/.rices` (`git pull` upgrades them, and your working tree is what the next login runs) and pulls in the shared `zsh` and `nvim` configs; see `../.dotter/global.toml`.
```bash
cd ~/src/daedalus && echo 'packages = ["hyprland"]' > .dotter/local.toml
mv ~/.zshrc ~/.zshrc.pre-dotter; mv ~/.p10k.zsh ~/.p10k.zsh.pre-dotter; mv ~/.config/nvim ~/.config/nvim.pre-dotter   # if present; --force would delete them
dotter deploy                    # again after adding a file under hyprland-multishell/
hyprland-multishell/install.sh   # deps check + greeter stub; leaves dotter's links alone
```

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
The diff shows what the installer did.

**Persona**
```bash
rice-update persona   # clones to config/quickshell/persona on branch 'mine'
cp -r ~/.rices/profiles/noctalia/config/hypr/. ~/.rices/profiles/persona/config/hypr/
```
```lua
hl.exec_once("qs -c persona")
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd("qs -c persona ipc call searchapp toggle"))
```
Commit local edits (e.g. the Cava removal) on `mine`; `rice-update` rebases them onto upstream.

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
**Remove managed tools from Noctalia's `builtin_ids`/`community_ids`** — those templates write straight to the apps and beat any lock (`rice-doctor` warns). Starter templates: ghostty, kitty, foot, gtk, nvim, starship; verify role names against the [template reference](https://docs.noctalia.dev/noctalia/theming/templates/).

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
| Neovim | `User RiceTheme` via `--remote-expr`; each instance applies its own profile's palette, unless locked with `:ThemeLock` (`../configs/nvim`) |
| Starship | next prompt: `starship.bash` reads `active/starship.toml`, the shared config with the profile's palette laid over its own (`../configs/starship`) |
| Alacritty | automatic |
| foot, GTK, btop, fuzzel | none — new windows/launches pick it up |

alacritty, btop and fuzzel have adapters but no starter template, so `noctalia-config` skips them until a `templates/<tool>.tmpl` exists.

New tool: `~/.rices/tools.d/<name>.sh` setting `INCLUDE` (plus `EXT` and `DESC` when not `.conf` and the name), optionally `reload()` and `transform()`; and `templates/<name>.tmpl` for `noctalia-config`.

## 6. Snapshots and rollback

Each profile is a git repo (`rice-snapshot`). The `.gitignore` whitelist captures `config/`, `profile.env`, `owned.txt`, `repos.txt` and `state/noctalia/settings.toml` — not caches, generated colours, logs or key files. Cloned rices are recorded as commit pointers (uncommitted work in them is reported).
```bash
cd ~/.rices/profiles/caelestia && git log --oneline
```
That covers a broken rice, not a dead disk: see §7.

## 7. Backups

XFS root → btrfs HDD: restic plus a browsable, bootable rsync mirror, on timers. Setup and restore: [backup/README.md](backup/README.md). `~/.rices` lives in `/home`, so both cover it.

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
[uwsm](https://github.com/Vladimir-csp/uwsm)