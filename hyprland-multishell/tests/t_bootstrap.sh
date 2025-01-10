#!/usr/bin/env bash
# configs/sh/deploy.sh and the root bootstrap.sh: env.sh's block is copied
# into every shell's rc, once; every rice is set up inside its own profile;
# and a second bootstrap run overwrites nothing the first one, or you since,
# wrote. Packages, dotter and Caelestia's installer are stubbed, the cloned
# rices are local repos.
# shellcheck disable=SC2016  # literal on purpose: the rcs and the stubs expand them
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
ROOT="$(cd "$REPO/.." && pwd)"
P="$RICE_ROOT/profiles"

section "configs/sh/deploy.sh"
line='export PATH="$HOME/.rices/bin:$PATH"'
nu_line="\$env.PATH = (\$\"(\$env.HOME)/.rices/bin:(\$env.PATH | str join ':')\" | split row ':')"
mkdir -p "$HOME/.config/fish" "$HOME/.config/nushell"
echo "alias ll='ls -l'" > "$HOME/.bashrc"
echo 'set fish_greeting' > "$HOME/.config/fish/config.fish"
echo '$env.config.show_banner = false' > "$HOME/.config/nushell/config.nu"
cp "$ROOT/configs/zsh/zsh.rc" "$SANDBOX/zsh.rc"
ln -s "$SANDBOX/zsh.rc" "$HOME/.zshrc"      # as dotter links it
expect "runs"                                bash "$ROOT/configs/sh/deploy.sh"
expect "bash gets the block"                 has "$HOME/.bashrc" "$line"
expect "...after what was there"             has "$HOME/.bashrc" 'alias ll'
expect "fish gets it as it is"               has "$HOME/.config/fish/config.fish" "$line"
expect "nushell gets it rewritten"           has "$HOME/.config/nushell/config.nu" "$nu_line"
expect "zsh.rc in the repo already holds it" cmp -s "$SANDBOX/zsh.rc" "$ROOT/configs/zsh/zsh.rc"
expect "...and stays dotter's link"          test -L "$HOME/.zshrc"
bash "$ROOT/configs/sh/deploy.sh" > "$SANDBOX/out"
expect "a second run writes nothing"         test ! -s "$SANDBOX/out"

cp -r "$ROOT/configs/sh" "$SANDBOX/sh"
echo 'export EDITOR="nvim"' >> "$SANDBOX/sh/env.sh"
expect "an edited env.sh deploys"            bash "$SANDBOX/sh/deploy.sh"
expect "...replacing the block where it is"  test "$(grep -c '>>> daedalus' "$HOME/.bashrc")" -eq 1
expect "...with the new line"                has "$HOME/.bashrc" 'export EDITOR="nvim"'
expect "...as nushell writes it"             has "$HOME/.config/nushell/config.nu" '$env.EDITOR = $"nvim"'
echo 'alias vi=nvim' >> "$SANDBOX/sh/env.sh"
refute "anything but an export is refused"   bash "$SANDBOX/sh/deploy.sh"

section "bootstrap.sh"
R="$SANDBOX/repo" UP="$SANDBOX/upstream"
mkdir -p "$R/.dotter" "$R/configs" "$HOME/.config/noctalia" "$HOME/.config/hypr" "$HOME/.config/fastfetch"
cp "$ROOT/bootstrap.sh" "$R/"
cp -r "$ROOT/configs/sh" "$R/configs/"
cp -r "$REPO" "$R/hyprland-multishell"
printf '%s\n' '#!/usr/bin/env bash' 'echo bootstrap-packages >> "$CALLS"' > "$R/hyprland-multishell/bootstrap-packages.sh"
stub dotter
stub paru
stub sudo   # install.sh's launcher goes to /usr/local/bin: logged, not written
# what `caelestia install` does to the config dir it is given
stub caelestia 'mkdir -p "$XDG_CONFIG_HOME/hypr" "$XDG_CONFIG_HOME/fish"
echo caelestia > "$XDG_CONFIG_HOME/hypr/hyprland.lua"
echo caelestia > "$XDG_CONFIG_HOME/fish/config.fish"'
rm -f "$HOME/.zshrc"
echo stock > "$HOME/.zshrc"
echo stock > "$HOME/.config/noctalia/config.toml"
echo stock > "$HOME/.config/hypr/hyprland.lua"
echo mine  > "$HOME/.config/fastfetch/config.jsonc"
# the three cloned rices, as local upstreams
mkdir -p "$UP/persona" "$UP/rivendell/.config/hypr" "$UP/rivendell/.config/fastfetch" "$UP/moon/dots"
echo shell > "$UP/persona/shell.qml"
echo 'exec-once = /home/zac/bar' > "$UP/rivendell/.config/hypr/hyprland.conf"
echo theirs > "$UP/rivendell/.config/fastfetch/config.jsonc"
echo moon > "$UP/moon/dots/hyprland.conf"
for r in persona rivendell moon; do
    git init -q -b main "$UP/$r" && git -C "$UP/$r" add -A && git -C "$UP/$r" commit -qm upstream
    mkdir -p "$P/$r"
done
echo "config/quickshell/persona  $UP/persona" > "$P/persona/repos.txt"
echo "src/rivendell  $UP/rivendell" > "$P/rivendell/repos.txt"
echo "src/moon_rice  $UP/moon" > "$P/moon/repos.txt"
# as the README runs it: no rice-* on PATH yet
boot() { PATH="${PATH#"$RICE_ROOT/bin:"}" "$R/bootstrap.sh"; }

expect "runs"                                boot
expect "packages first"                      called 'bootstrap-packages'
expect "picks the dotter packages"           has "$R/.dotter/local.toml" 'hyprland'
expect "moves the stock rc aside"            has "$HOME/.zshrc.pre-dotter" stock
expect "deploys"                             called 'dotter deploy'
expect "noctalia: its config copied in"      has "$P/noctalia/config/noctalia/config.toml" stock
expect "...and Hyprland's"                   has "$P/noctalia/config/hypr/hyprland.lua" stock
expect "...and snapshotted"                  git -C "$P/noctalia" rev-parse -q --verify HEAD
expect "persona: cloned"                     test -f "$P/persona/config/quickshell/persona/shell.qml"
expect "...onto Noctalia's Hyprland config"  has "$P/persona/config/hypr/hyprland.lua" stock
expect "rivendell: its .config copied in"    has "$P/rivendell/config/hypr/hyprland.conf" "exec-once = $HOME/bar"
expect "...but not over a shared config"     has "$HOME/.config/fastfetch/config.jsonc" mine
expect "moon: its hyprland.conf copied in"   has "$P/moon/config/hypr/hyprland.conf" moon
expect "caelestia: installed unattended"     called 'caelestia install --noconfirm'
expect "...into the profile"                 has "$P/caelestia/config/fish/config.fish" caelestia
expect "...not into the shared fish config"  has_not "$HOME/.config/fish/config.fish" caelestia
expect "all five are in the greeter"         test "$(find "$RICE_SESSIONS_DIR" -name 'rice-*.desktop' | wc -l)" -eq 5

section "bootstrap.sh, again"
echo linked > "$SANDBOX/zsh.rc"
ln -s "$SANDBOX/zsh.rc" "$HOME/.zshrc"      # what dotter leaves
echo 'packages = ["hyprland"]' > "$R/.dotter/local.toml"
for r in noctalia persona caelestia; do echo mine > "$P/$r/config/hypr/hyprland.lua"; done
: > "$CALLS"
expect "runs"                                boot
expect "keeps local.toml"                    has_not "$R/.dotter/local.toml" 'starship'
expect "leaves dotter's link"                test -L "$HOME/.zshrc"
expect "...and the first backup"             has "$HOME/.zshrc.pre-dotter" stock
expect "never copies over a profile again"   has "$P/noctalia/config/hypr/hyprland.lua" mine
expect "...persona's either"                 has "$P/persona/config/hypr/hyprland.lua" mine
refute "caelestia's installer runs once"     called 'caelestia install'

finish
