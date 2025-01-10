# dotfiles

## hyprland-multishell

Several Hyprland rices (Noctalia, Caelestia, Persona, …) on one CachyOS
install, picked at the greeter. Each profile gets its own four XDG roots
(config, data, state, cache), so a rice can only clobber itself.

### Install

Fresh CachyOS, Hyprland edition:

```bash
sudo pacman -Syu --needed git
git clone https://github.com/shishir9159/daedalus.git ~/Projects/daedalus && cd ~/Projects/daedalus
./bootstrap.sh
```

Then log out and back in. Update: `git pull`, plus `dotter deploy` after a new file or a change to `configs/sh/env.sh`.

| Command | Does |
|---|---|
| `rice-new <p> ["Name"]` | create a profile (letters, digits, `-`, `_`) |
| `rice-do <p> -- <cmd>` | run a command in the profile's env (installers) |
| `rice-sync <p> [--report\|--adopt]` | rebuild links (also at login) / list or share profile-only configs |
| `rice-session <p> [--remove]` | add/remove the greeter entry |
| `rice-snapshot <p> [msg]` | commit the profile |
| `rice-update [p...]` | rebase upstream rices under your `mine` branch |
| `rice-theme …` | per-tool colour locks |
| `rice-doctor [p...]` | audit everything below; exit 1 on failures |

### How it works

- `~/.rices/profiles/<p>/`: `config/ data/ state/ cache/`, `profile.env`,
  `owned.txt`, `repos.txt`, `session.log`, and a git repo for snapshots.
- Owned entries (`hypr`, `quickshell`, `gtk-*`, `matugen`, `dconf`, `hyprpm`, …)
  are real dirs in the profile; the rest of `~/.config`, `~/.local/{share,state}`
  and `~/.cache` is linked in. `owned.default.txt` < `~/.rices/owned.txt` <
  `<p>/owned.txt`; `name` owns, `!name` shares.
- An app first started inside a profile gets a profile-only config:
  `rice-doctor` lists them, `rice-sync <p> --adopt` shares them.
- Shared by every profile: `~/.zshrc`, `~/.bashrc`, `~/.face`, wallpapers,
  systemd units. The stock `~/.config` session is always the fallback.

Gotchas:

- Hyprland ≥ 0.55 loads `hyprland.lua` and ignores `hyprland.conf`: port `.conf` rices to Lua.
- `caelestia install` overwrites `~/.config/hypr`, foot, btop, nvim, gtk: run installers through `rice-do <p> --`.
- matugen theming writes other apps' configs; hardcoded `~/.config` paths escape the profile (`rice-doctor` finds them).
- `hyprpm` plugins are ABI-locked to Hyprland: `HYPRLAND_BIN=/opt/hyprland-0.45/bin/Hyprland` in `profile.env`, `exec-once = hyprpm reload -n` in the hypr config.

### Rices

**Persona** needs the [Qt6 Cava plugin](https://github.com/Yujonpradhananga/Qt6-Cava-plugin), or delete `CavaVisualizer.qml` and its use in `WallpaperEngine.qml` (commit it on `mine`). Its Hyprland config is a copy of Noctalia's: start Persona in it instead.

to remove the widget:
```bash
cd ~/.rices/profiles/persona/config/quickshell/persona
rm Widgets/CavaVisualizer.qml
sed -i '171,180d' Widgets/WallpaperEngine.qml
git commit -am "no cava visualizer"
```

```lua
hl.exec_once("qs -c persona")
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd("qs -c persona ipc call searchapp toggle"))
```

**Rivendell, moon**: their `hyprland.conf` is in the profile, Rivendell's `/home/zac` replaced by your home; both are still to port to Lua. Moon's bar is a Flutter app in `src/moon_rice`, to build first.
**skwd-wall** is a wallpaper tool, not a session: `rice-do <p> -- skwd-wall`.

### Colour locks

Noctalia recolours your apps from the wallpaper, every time it changes. A lock makes one app keep the colours it has now; the others keep following the wallpaper. Optional: nothing else here needs it.

**Set it up once**, in each profile that runs Noctalia. Until then `lock` has nothing to act on.

1. `rice-theme noctalia-config`: from now on Noctalia gives each app's colours to `rice-theme` instead of writing them into the app.
2. `rice-theme hints`: prints one line per app. Paste each into that app's own config, so the app reads the colours `rice-theme` hands it.
3. In Noctalia's settings, turn off its own template for each of those apps (`builtin_ids` / `community_ids` in its config). That template writes straight into the app, so it would undo a lock at the next wallpaper change. `rice-doctor` warns while one is still on.

**Then use it whenever you like:**
```bash
rice-theme lock nvim ghostty                     # keep today's colours, whatever the wallpaper
rice-theme unlock nvim                           # follow the wallpaper again
rice-theme save gruvbox nvim kitty               # today's colours, under a name
rice-theme set gruvbox                           # switch to them later (locks those apps)
rice-theme render ghostty pic.png --save forest  # a named theme from any picture
rice-theme status                                # what is locked and whether it still holds (`check`: exit 1 if not)
rice-theme watch                                 # leave running: puts back a lock a rice overwrites
```
All of it works inside that rice's session; anywhere else add `--profile <p>`. Ghostty ≥ 1.2, kitty, Neovim, Starship and Alacritty recolour at once; foot, GTK, btop and fuzzel when next started. New app: `tools.d/<name>.sh` and `templates/<name>.tmpl`.

### Snapshots, backups, tests

`rice-snapshot` commits `config/`, `profile.env`, `owned.txt`, `repos.txt` and Noctalia's `settings.toml`; cloned rices as commit pointers. A dead disk: [backup/README.md](hyprland-multishell/backup/README.md).
Tests: `hyprland-multishell/tests/run.sh && hyprland-multishell/tests/shellcheck.sh`, also in CI.

[Hyprland Lua](https://hypr.land/news/26_lua/) ·
[caelestia](https://github.com/caelestia-dots/caelestia) ·
[noctalia](https://github.com/noctalia-dev/noctalia) ([templates](https://docs.noctalia.dev/noctalia/theming/templates/)) ·
[Persona](https://github.com/Yujonpradhananga/Persona-Quickshell) ·
[rivendell](https://codeberg.org/zacoons/rivendell-hyprdots) ·
[moon rice](https://github.com/FlafyDev/hyprland_moon_rice_public) ·
[skwd-wall](https://github.com/liixini/skwd-wall)

## Notes to Self

Todo:

- take inspiration again for new configuration: https://github.com/prasanthrangan/hyprdots 5766d02
- configure wezterm per distro: https://github.com/KevinSilvester/wezterm-config,
  https://github.com/XNM1/linux-nixos-hyprland-config-dotfiles, https://github.com/catppuccin/wezterm