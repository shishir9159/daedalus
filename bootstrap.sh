#!/usr/bin/env bash
# bootstrap.sh -- README.md's install on a fresh CachyOS (Hyprland edition),
# start to finish. Re-runnable: a second run keeps .dotter/local.toml, the
# first .pre-dotter backups and whatever the noctalia profile holds by then.
set -euo pipefail
cd "$(dirname "$0")"

hyprland-multishell/bootstrap-packages.sh

[ -e .dotter/local.toml ] || echo 'packages = ["hyprland", "starship"]' > .dotter/local.toml
for f in ~/.zshrc ~/.p10k.zsh ~/.config/nvim; do [ ! -e "$f" ] || [ -L "$f" ] || mv "$f" "$f.pre-dotter"; done
dotter deploy

# shellcheck source=configs/sh/env.sh
. configs/sh/env.sh
hyprland-multishell/install.sh
hyprland-multishell/bootstrap-profiles.sh

PDIR=~/.rices/profiles/noctalia
if [ -z "$(ls -A "$PDIR/config/hypr")" ]; then
    cp -r ~/.config/noctalia/. "$PDIR/config/noctalia/"
    cp -r ~/.config/hypr/. "$PDIR/config/hypr/"
    rice-snapshot noctalia import
fi
rice-session noctalia

echo ":: done - log out and pick a session at the greeter"
