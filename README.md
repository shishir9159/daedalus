# dotfiles

## Hyprland + Noctalia

CachyOS's Hyprland edition as it ships (Hyprland, the Noctalia shell), with
this repo's changes on top: `configs/hypr` and `configs/noctalia` are its own
configs, edited, and linked into `~/.config`. One session, no launchers: what
is worth having from other rices goes into these two as plain config. The
scratchpads, the motion and the wallpaper-coloured borders are
[caelestia](https://github.com/caelestia-dots/caelestia)'s ideas.

### Install

Fresh CachyOS, Hyprland edition:

```bash
sudo pacman -Syu --needed git
git clone https://github.com/shishir9159/daedalus.git ~/Projects/daedalus && cd ~/Projects/daedalus
./bootstrap.sh
```

Run it from the Hyprland session (Noctalia has to be up to fetch its plugins),
then log out and back in. The edition's own `~/.config/hypr` and
`~/.config/noctalia` are kept as `*.pre-dotter`. Update: `git pull`, plus
`dotter deploy` after a new file or a change to `configs/sh/env.sh`. Both
configs reload when a file in them is saved.

### Keys

`Super+F1` lists every bind, searchable. What differs from CachyOS's defaults:

| Key | Does |
|---|---|
| Caps Lock, Escape | swapped |
| `Super+1…0` | workspace 1–10 (five are always in the bar, the rest when used) |
| `Super+Shift+1…0` | window to that workspace; with `Alt`, without following it |
| `Super+Ctrl+1/2/3` | focus a monitor; with `Shift`, send the window (name them in `variables.lua`) |
| `Super+M`, `Super+D`, `Ctrl+Shift+Esc` | scratchpads: Spotify, Vesktop, btop |
| `Super+Alt+F` | maximize (it was `Super+D`) |
| tap `Super` | launcher (`Super+Space` still does) |
| `Super+Alt+R` | start or stop recording the focused screen, into `~/Videos/Recordings` |
| `Super+Return`, `Super+W` | Ghostty, Zen |

A scratchpad is an app on its own special workspace, slid in over whatever is
on screen. Its key starts the app if it isn't there yet; the bar shows a chip
for each one in use. They are a table in `configs/hypr/config/scratchpads.lua`:
name, key, which windows belong to it, the command.

### What else is changed

- **Hyprland**: natural scrolling on the touchpad; caelestia's animation curves; rounder corners, shadows, and wider gaps around a window that is alone on its workspace; borders in the wallpaper's colours (Noctalia's `hyprland` template writes `configs/hypr/noctalia.lua`, untracked).
- **Noctalia**: idle locks at 10 minutes, turns the screen off at 11 and suspends at 30 (the caffeine tile in the control centre holds that off); night light from 18:00 to 06:00; rounded screen corners; three plugins: `jamesfeeder/special-workspaces` (needs `socat`), `noctalia/screen_recorder` (needs `gpu-screen-recorder`) and `kenn/keybind-cheatsheet`.
- What you change in Noctalia's settings window goes to `~/.local/state/noctalia/settings.toml` and wins over `config.toml`: move a setting you want to keep into the repo's file.

Gotchas:

- Hyprland ≥ 0.55 loads `hyprland.lua` and ignores `hyprland.conf`.
- A new plugin in `config.toml` is fetched by `noctalia msg plugins enable <id>` (`bootstrap.sh` does it for the listed ones), and its bar widget, panel and service only start with Noctalia: restart it or log in again.
- A bind without a `description` shows in the cheatsheet as "Lua 42".

### Colour locks

Noctalia recolours your apps from the wallpaper, every time it changes. A lock makes one app keep the colours it has now; the others keep following the wallpaper. Optional: nothing else here needs it.

**Setup** is done by `bootstrap.sh`:
```bash
rice-theme noctalia-config   # Noctalia gives each app's colours to rice-theme, not to the app
rice-theme include           # each app's config reads them from rice-theme
```
One thing stays yours, for each app you want to lock: in Noctalia's settings, turn off its own template for that app (`builtin_ids` / `community_ids` in its config). That template writes straight into the app, so it would undo the lock at the next wallpaper change, and switching it off also trades Noctalia's look for that app against `templates/<app>.tmpl`. Of the apps rice-theme knows, `config.toml` has Noctalia's own template on for kitty and GTK.

**Then use it whenever you like:**
```bash
rice-theme lock nvim ghostty                     # keep today's colours, whatever the wallpaper
rice-theme unlock nvim                           # follow the wallpaper again
rice-theme save gruvbox nvim kitty               # today's colours, under a name
rice-theme set gruvbox                           # switch to them later (locks those apps)
rice-theme render ghostty pic.png --save forest  # a named theme from any picture
rice-theme status                                # what is locked and whether it still holds (`check`: exit 1 if not)
rice-theme watch                                 # leave running: puts back a lock something overwrites
```
Its state is `~/.config/rice-theme`. Ghostty ≥ 1.2, kitty, Neovim, Starship and Alacritty recolour at once; foot, GTK, btop and fuzzel when next started. New app: `tools.d/<name>.sh` and `templates/<name>.tmpl` in `hyprland-multishell/`, which still has its old name. A template is rendered by Noctalia, comments included: don't spell a `{{ … }}` token out in one.

### Backups, tests

A dead disk: [backup/README.md](hyprland-multishell/backup/README.md).
Tests: `hyprland-multishell/tests/run.sh && hyprland-multishell/tests/shellcheck.sh`, also in CI. Before saving a change to `configs/hypr` you are unsure of: `Hyprland --verify-config --config configs/hypr/hyprland.lua`; for Noctalia, `noctalia config validate configs/noctalia/config.toml`.

[Hyprland Lua](https://hypr.land/news/26_lua/) ·
[noctalia](https://github.com/noctalia-dev/noctalia) ([templates](https://docs.noctalia.dev/noctalia/theming/templates/)) ·
[caelestia](https://github.com/caelestia-dots/caelestia)

## Notes to Self

Todo:

- take inspiration again for new configuration: https://github.com/prasanthrangan/hyprdots 5766d02
- configure wezterm per distro: https://github.com/KevinSilvester/wezterm-config,
  https://github.com/XNM1/linux-nixos-hyprland-config-dotfiles, https://github.com/catppuccin/wezterm