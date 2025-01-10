#!/usr/bin/env bash
# bootstrap.sh -- README.md's install on a fresh CachyOS (Hyprland edition),
# start to finish: packages, dotfiles, then every rice as far as a script can
# take it (README.md, Rices, has what is left by hand). Re-runnable: a second
# run keeps .dotter/local.toml, the first .pre-dotter backups and every
# profile whose config/hypr holds something by then.
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

P=~/.rices/profiles
fresh() { [ -z "$(ls -A "$P/$1/config/hypr")" ]; }

if fresh noctalia; then
    cp -r ~/.config/noctalia/. "$P/noctalia/config/noctalia/"
    cp -r ~/.config/hypr/. "$P/noctalia/config/hypr/"
    rice-snapshot noctalia import
fi
# Colour locks (README.md): Noctalia hands the apps' colours to rice-theme,
# and the profile's apps read them from it.
rice-theme --profile noctalia noctalia-config
rice-theme --profile noctalia include
rice-session noctalia

# The rices that are a clone. A failed one is reported and skipped.
rice-update persona rivendell moon || true

# Persona's wallpaper needs the Qt6 Cava plugin, which no package has: built
# from its clone into the profile's qml/, which profile.env puts on the QML
# import path. quickshell-git, not extra's quickshell: caelestia-shell depends
# on it and the two conflict.
paru -S --needed --noconfirm --skipreview quickshell-git cmake fftw
build="$(mktemp -d)"
cmake -S "$P/persona/src/qt6-cava-plugin" -B "$build" -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$P/persona/qml"
cmake --build "$build"
cmake --install "$build"
rm -rf "$build"
grep -q '^QML_IMPORT_PATH=' "$P/persona/profile.env" || cat >> "$P/persona/profile.env" <<'ENV'
# The Qt6 Cava plugin, built into qml/ by daedalus's bootstrap.sh.
QML_IMPORT_PATH="$RICE_HOME/qml${QML_IMPORT_PATH:+:$QML_IMPORT_PATH}"
QML2_IMPORT_PATH="$QML_IMPORT_PATH"
ENV
if fresh persona; then
    cp -r "$P/noctalia/config/hypr/." "$P/persona/config/hypr/"
    rice-snapshot persona import
fi
rice-session persona

# A name linked to the shared ~/.config (nvim) stays shared: not copied over.
if fresh rivendell && [ -d "$P/rivendell/src/rivendell/.config" ]; then
    for d in "$P"/rivendell/src/rivendell/.config/*; do
        [ -L "$P/rivendell/config/${d##*/}" ] || cp -r "$d" "$P/rivendell/config/"
    done
    { grep -rIlZ /home/zac "$P/rivendell/config" || true; } | xargs -0r sed -i "s|/home/zac|$HOME|g"
    rice-snapshot rivendell import
fi
rice-session rivendell

if fresh moon && [ -f "$P/moon/src/moon_rice/dots/hyprland.conf" ]; then
    cp "$P/moon/src/moon_rice/dots/hyprland.conf" "$P/moon/config/hypr/"
    rice-snapshot moon import
fi
rice-session moon

# Last: the one that builds and installs the most. Its installer also writes
# fish, fastfetch, micro, Thunar and starship.toml, which profiles share by
# default: owned here, so they land in the profile, not in ~/.config.
paru -S --needed --noconfirm --skipreview caelestia-cli caelestia-shell
if fresh caelestia; then
    grep -q '^fish ' "$P/caelestia/owned.txt" || echo 'fish fastfetch micro Thunar starship.toml' >> "$P/caelestia/owned.txt"
    rice-snapshot caelestia empty
    rice-do caelestia -- caelestia install --noconfirm --aur-helper paru --enable-components uwsm
    rice-snapshot caelestia installed
fi
rice-session caelestia

echo ":: done - log out and pick a session at the greeter"
