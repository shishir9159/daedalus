# If the $XDG_DATA_HOME env variable is set, then $XDG_DATA_HOME/pnpm/global

# prompt yes with golang automation

sudo pacman-mirrors --geoip

# :: Repository extra for ghidra
#    1) jdk-openjdk  2) jdk17-openjdk  3) jdk21-openjdk

# add and configure exa
sudo pacman -Syyu --needed alacritty base-devel bat btop cairo-dock cairo-dock-plug-ins discord dust duf eza fluent-reader git ghidra gping hyperfine kitty keepassxc meld mcfly neovim nyxt obsidian python-pynvim postman-bin qbittorrent radare2 tldr unzip wezterm wireshark-qt yazi zoxide
git clone https://aur.archlinux.org/yay.git && cd yay && makepkg -si

# kernel
# pacman -syyu strace

# rustup prompt
# 1) Proceed with standard installation (default - just press enter)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo pacman -Rsn cups cups-pdf elisa gutenprint gwenview kate kcalc kdeconnect kfind khelpcenter kfind manjaro-hello manjaro-printer nano nano-syntax-highlighting print-manager skanlite system-config-printer vi yakuake
sudo pacman -Rsn $(sudo pacman -Qdtq)
yay -Syyu anki bruno conan imhex miniconda3 nomacs raindrop swww visual-studio-code-bin

sudo ln -s /opt/miniconda3/etc/profile.d/conda.sh /etc/profile.d/conda.sh
conda config --set auto_activate_base false

# java
# pacman -sS java | grep jdk
# archlinux-java status
sudo pacman -Syyu jre21-openjdk

# TODO: make conda installation optional
sudo pacman -Syuu uv
echo 'eval "$(uv generate-shell-completion zsh)"' >> ~/.zshrc
echo 'eval "$(uvx --generate-shell-completion zsh)"' >> ~/.zshrc

# optional --- yay -S galaxybudsclient-bin

# remove Bangla from Manjaro Settings Manager -> Locale

# jetbrains toolbox

# n
# curl -L https://bit.ly/n-install | N_PREFIX=~/.n bash -s -- -y

#bun
curl -fsSL https://bun.sh/install | bash

#fnm
curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
fnm completions --shell zsh

# install the latest version with npm
fnm use --install-if-missing 22

curl -fsSL https://get.pnpm.io/install.sh | sh -
# add ~/.local/share/pnpm/global to the PATH

pnpm install tree-sitter-cli

sudo pip3 install patch-ng --break-system-packages

# neovim
LV_BRANCH='release-1.4/neovim-0.9' bash <(curl -s https://raw.githubusercontent.com/LunarVim/LunarVim/release-1.4/neovim-0.9/utils/installer/install.sh)
# Would you like to install LunarVim's NodeJS/BunJS dependencies: neovim, tree-sitter-cli?
# [y]es or [n]o (default: no) : y
# Would you like to install LunarVim's Rust dependencies: fd::fd-find, rg::ripgrep?
# [y]es or [n]o (default: no) : y

#
sudo pacman -S hyprland waybar rofi-wayland dunst xdg-desktop-portal-hyprland qt5-wayland qt6-wayland hyprpaper chromium ttf-font-awesome

######### tui #########
sudo pacman -S lazygit

yay -S py-spy # uv tool

# uv tool install basedpyright
uv tool install ty@latest ruff@latest

sudo pacman -S --needed gopls delve zls basedpyright ruff python-debugpy lldb py-spy ty

# neovim

# 100% 12:0=41s Nordic Blue https://github.com/prasanthrangan/hyde-themes/tree/Nordic-Blue --skipcaching false