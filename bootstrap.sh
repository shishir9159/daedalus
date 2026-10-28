#!/usr/bin/env bash
# bootstrap.sh -- README.md's install on a fresh CachyOS (Hyprland edition),
# start to finish: packages, dotfiles, then the colour locks. Re-runnable: a
# second run keeps .dotter/local.toml, the first .pre-dotter backups and
# everything in ~/.config/rice-theme.
set -euo pipefail
cd "$(dirname "$0")"

hyprland-multishell/bootstrap-packages.sh

[ -e .dotter/local.toml ] || echo 'packages = ["hyprland", "starship"]' > .dotter/local.toml
# What the edition ships, aside: dotter links the repo's over it.
for f in ~/.zshrc ~/.p10k.zsh ~/.config/nvim ~/.config/hypr ~/.config/noctalia; do
    [ ! -e "$f" ] || [ -L "$f" ] || mv "$f" "$f.pre-dotter"
done
dotter deploy

# shellcheck source=configs/sh/env.sh
. configs/sh/env.sh
hyprland-multishell/install.sh

# Colour locks (README.md): Noctalia hands the apps' colours to rice-theme,
# and the apps read them from it.
rice-theme noctalia-config
rice-theme include

# Noctalia fetches a plugin when it is enabled through its IPC: the list in
# config.toml alone leaves the plugin's widgets unknown. And its first render
# of the colours puts hypr/noctalia.lua in place before Hyprland next starts
# (Hyprland follows the file from then on). Both need the running shell.
if pgrep -x noctalia >/dev/null; then
    awk '/^\[plugins\]/ { p = 1; next } /^\[/ { p = 0 } p && /^enabled/' configs/noctalia/config.toml \
        | grep -o '"[^"]*"' | tr -d '"' \
        | while IFS= read -r plugin; do noctalia msg plugins enable "$plugin"; done
    noctalia msg templates-apply
else
    echo ":: Noctalia isn't running: run ./bootstrap.sh again from its session, for its plugins"
fi

echo ":: done - log out and back in"
