#!/usr/bin/env bash
# Fresh CachyOS, Hyprland edition: packages and toolchains on top of what it
# ships. Run by hand, a step at a time, before ./install.sh. Repo packages
# only, no curl installers: `update` in zsh.rc keeps them all current.

sudo cachyos-rate-mirrors

# mcfly

sudo pacman -Syyu --needed anki base-devel bat dust eza gping just keepassxc neovim obsidian qbittorrent radare2 wezterm wireshark-qt yazi zoxide
sudo pacman -S --needed yay   # from CachyOS's repo

# kernel
sudo pacman -Syyu strace

sudo pacman -S --needed rustup
rustup default nightly

# Of the extras Manjaro KDE came with, the Hyprland edition ships only nano.
sudo pacman -Rsn nano nano-syntax-highlighting
# shellcheck disable=SC2046 # one argument per orphan
sudo pacman -Rsn $(sudo pacman -Qdtq)
yay -S --needed fluent-reader imhex jetbrains-toolbox vesktop visual-studio-code-bin

# ghidra needs java-environment>=21. jdk25-openjdk: the newest LTS, and the
# floor of Ghidra's next release (jdk-openjdk jumps a major every six months).
# One transaction, so pacman doesn't ask which java to use.
sudo pacman -S --needed jdk25-openjdk ghidra
sudo archlinux-java set java-25-openjdk

sudo pacman -S --needed uv
uv tool install py-spy   # Python profiles for perfanno (configs/nvim)
# uv completions are in zsh.rc. Never `>> ~/.zshrc` here: once dotter links it,
# that appends to configs/zsh/zsh.rc in the repo.

sudo pacman -S --needed bun fnm pnpm
# install the latest version with npm
fnm use --install-if-missing 22

# Noctalia, which the edition ships, is the bar, launcher, notifications and
# wallpaper.
sudo pacman -S --needed chromium qt5-wayland qt6-wayland

######### shells #########
# nushell, and the starship prompt for bash (configs/starship). Deploy with
# "starship" in .dotter/local.toml's packages, then hook bash up once; ~/.bashrc
# isn't dotter's, so appending is safe.
sudo pacman -S --needed nushell starship ttf-fantasque-nerd
grep -qF 'starship/starship.bash' ~/.bashrc 2>/dev/null \
  || echo '[[ -r ~/.config/starship/starship.bash ]] && . ~/.config/starship/starship.bash' >> ~/.bashrc
# just's package ships bash and zsh completions but none nushell finds; put
# upstream's (recipe names from `just --dump`) in its autoload dir.
# shellcheck disable=SC2016
nu -c 'let d = ($nu.user-autoload-dirs | last); mkdir $d; just --completions nushell | save -f ($d | path join just.nu)'

######### tui #########
sudo pacman -S lazygit

# language servers, debuggers, ruff/ty: configs/nvim/README.md, Prerequisites

# 100% Nordic Blue https://github.com/prasanthrangan/hyde-themes/tree/Nordic-Blue --skipcaching false
