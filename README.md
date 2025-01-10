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
hyprland-multishell/bootstrap-packages.sh
echo 'packages = ["hyprland", "starship"]' > .dotter/local.toml
for f in ~/.zshrc ~/.p10k.zsh ~/.config/nvim; do [ ! -e "$f" ] || mv "$f" "$f.pre-dotter"; done
dotter deploy
hyprland-multishell/install.sh && export PATH="$HOME/.rices/bin:$PATH"
hyprland-multishell/bootstrap-profiles.sh
rice-session noctalia
```

Then log out and back in. Update: `git pull`, plus `dotter deploy` after a new file.

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

**Noctalia** ships with the edition. GUI tweaks land in `state/noctalia/settings.toml`.
```bash
cp -r ~/.config/noctalia/. ~/.rices/profiles/noctalia/config/noctalia/
cp -r ~/.config/hypr/. ~/.rices/profiles/noctalia/config/hypr/
rice-snapshot noctalia import
```

**Caelestia**: edit only `~/.config/caelestia/` (`hypr-user.lua`, `hypr-vars.lua`, `shell.json`, `cli.json`).
```bash
paru -S caelestia-cli caelestia-shell
rice-snapshot caelestia empty && rice-do caelestia -- caelestia install && rice-snapshot caelestia installed
rice-session caelestia
```

**Persona** needs the [Qt6 Cava plugin](https://github.com/Yujonpradhananga/Qt6-Cava-plugin), or delete `CavaVisualizer.qml` and its use in `WallpaperEngine.qml` (commit it on `mine`).
```bash
rice-update persona
cp -r ~/.rices/profiles/noctalia/config/hypr/. ~/.rices/profiles/persona/config/hypr/
rice-session persona
```
```lua
hl.exec_once("qs -c persona")
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd("qs -c persona ipc call searchapp toggle"))
```

**Rivendell, moon**: copy their `.config/` into the profile; `rice-doctor` lists the `/home/zac` paths. Moon is a Flutter app to build first. Then `rice-session rivendell` / `rice-session moon`.
**skwd-wall** is a wallpaper tool, not a session: `rice-do <p> -- skwd-wall`.

### Colour locks

Once per profile, then remove those tools from Noctalia's `builtin_ids`/`community_ids` (they'd beat any lock):
```bash
rice-theme hints             # include line for each app's config
rice-theme noctalia-config   # writes noctalia/templates.toml
```
```bash
rice-theme lock nvim ghostty                     # keep colours across wallpaper changes
rice-theme unlock nvim
rice-theme save gruvbox nvim kitty && rice-theme set gruvbox
rice-theme render ghostty pic.png --save forest  # colours from any image
rice-theme status                                # `check`: exit 1 if a lock broke
rice-theme watch                                 # restore locks a rice overwrites
```
Outside a rice session add `--profile <p>`. Live reload: Ghostty ≥ 1.2, kitty, Neovim, Starship, Alacritty; foot, GTK, btop and fuzzel on next launch. New tool: `tools.d/<name>.sh` and `templates/<name>.tmpl`.

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