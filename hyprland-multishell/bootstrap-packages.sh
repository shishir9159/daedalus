#!/usr/bin/env bash
# Fresh CachyOS, Hyprland edition: packages and toolchains on top of what it
# ships, before `dotter deploy`. Re-runnable and unattended: installed packages
# are skipped and every prompt takes its default. Repo and AUR packages only,
# no curl installers: `update` in zsh.rc keeps them all current.
set -euo pipefail

pac() { sudo pacman -S --needed --noconfirm "$@"; }
aur() { paru -S --needed --noconfirm --skipreview "$@"; }
# Removes whichever of these are installed.
remove() {
    [ $# -gt 0 ] || return 0   # `pacman -Qq` alone lists every package
    local installed
    mapfile -t installed < <(pacman -Qq "$@" 2>/dev/null)
    [ ${#installed[@]} -eq 0 ] || sudo pacman -Rsn --noconfirm "${installed[@]}"
}

# One password for the whole run: paru's builds can outlast any sudo timeout.
# From now on 30 minutes between prompts (per terminal) instead of 5.
sudo -v
while sleep 60 && kill -0 "$$" 2>/dev/null; do sudo -n true 2>/dev/null || exit; done &
echo 'Defaults timestamp_timeout=30' | sudo tee /etc/sudoers.d/timestamp_timeout >/dev/null
sudo chmod 440 /etc/sudoers.d/timestamp_timeout

######### locale #########
# English everywhere. Calamares sets LANG to the chosen language but the
# numbers and dates locale (LC_*: the clock, units, paper) to the timezone's
# region, bn_BD for Asia/Dhaka. Generate en_US.UTF-8 alone, LANG the only setting.
if [ "$(cat /etc/locale.conf 2>/dev/null)" != LANG=en_US.UTF-8 ]; then
    sudo sed -i -E 's/^([^#[:space:]])/#\1/; s/^#(en_US\.UTF-8 UTF-8)/\1/' /etc/locale.gen
    sudo locale-gen
    echo LANG=en_US.UTF-8 | sudo tee /etc/locale.conf >/dev/null
fi
# The session keeps the installer's LC_* until the next login and bn_BD is gone
# now: without this every command below says "failed to set locale".
unset LANGUAGE "${!LC_@}"
export LANG=en_US.UTF-8
# A bar still on those LC_* restarts with this environment, so its clock is in
# English now rather than after the next login.
if [ -n "${WAYLAND_DISPLAY:-}" ] && pid=$(pgrep -xo noctalia) \
    && grep -qzE '^(LC_[A-Z]+|LANGUAGE)=' "/proc/$pid/environ"; then
    pkill -x noctalia
    for _ in {1..50}; do pgrep -x noctalia >/dev/null || break; sleep 0.1; done
    (cd ~ && setsid -f noctalia >/dev/null 2>&1)
fi

sudo cachyos-rate-mirrors

# mcfly

sudo pacman -Syyu --needed --noconfirm anki base-devel bat dust eza ghostty gping just keepassxc neovim obsidian qbittorrent radare2 wezterm wireshark-qt yazi zoxide
pac paru   # from CachyOS's repo

# kernel
pac strace

# nightly, the only toolchain. Removing a stable that isn't there just says so.
pac rustup
rustup default nightly
rustup toolchain uninstall stable

# Of the extras Manjaro KDE came with, the Hyprland edition ships only nano.
remove nano nano-syntax-highlighting
mapfile -t orphans < <(pacman -Qdtq)
remove "${orphans[@]}"
# dotter-rs builds with rustup's cargo.
aur dotter-rs fluent-reader imhex jetbrains-toolbox vesktop visual-studio-code-bin zen-browser-bin

# ghidra needs java-environment>=21. jdk25-openjdk: the newest LTS, and the
# floor of Ghidra's next release (jdk-openjdk jumps a major every six months).
# One transaction, so pacman doesn't ask which java to use.
pac jdk25-openjdk ghidra
sudo archlinux-java set java-25-openjdk

pac uv
uv tool install py-spy   # Python profiles for perfanno (configs/nvim)
# uv completions are in zsh.rc. Never `>> ~/.zshrc` here: once dotter links it,
# that appends to configs/zsh/zsh.rc in the repo.

pac bun fnm pnpm
# Node 22 in every shell: zsh.rc's `fnm env` starts on the default.
fnm install 22
fnm default 22

# Noctalia, which the edition ships, is the bar, launcher, notifications and
# wallpaper.
pac chromium qt5-wayland qt6-wayland

######### shells #########
# nushell, and the starship prompt for bash (configs/starship, the dotter
# package "starship"). ~/.bashrc isn't dotter's, so appending is safe.
pac nushell starship ttf-fantasque-nerd
grep -qF 'starship/starship.bash' ~/.bashrc 2>/dev/null \
  || echo '[[ -r ~/.config/starship/starship.bash ]] && . ~/.config/starship/starship.bash' >> ~/.bashrc
# just's package ships bash and zsh completions but none nushell finds; put
# upstream's (recipe names from `just --dump`) in its autoload dir.
# shellcheck disable=SC2016
nu -c 'let d = ($nu.user-autoload-dirs | last); mkdir $d; just --completions nushell | save -f ($d | path join just.nu)'

######### tui #########
pac lazygit

# language servers, debuggers, ruff/ty: configs/nvim/README.md, Prerequisites

# 100% Nordic Blue https://github.com/prasanthrangan/hyde-themes/tree/Nordic-Blue --skipcaching false
