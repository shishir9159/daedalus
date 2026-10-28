#!/usr/bin/env bash
# configs/sh/deploy.sh and the root bootstrap.sh: env.sh's block is copied
# into every shell's rc, once; the edition's own configs are moved aside for
# dotter's links; the colour locks are wired up; and a second bootstrap run
# overwrites nothing the first one, or you since, wrote. Packages and dotter
# are stubbed.
# shellcheck disable=SC2016  # literal on purpose: the rcs and the stubs expand them
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
ROOT="$(cd "$REPO/.." && pwd)"
C="$HOME/.config"

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
R="$SANDBOX/repo"
mkdir -p "$R/.dotter" "$R/configs/noctalia" "$C/noctalia" "$C/hypr" "$C/kitty"
cp "$ROOT/bootstrap.sh" "$R/"
cp -r "$ROOT/configs/sh" "$R/configs/"
printf '%s\n' '[plugins]' 'enabled = [ "a/one", "b/two" ]' '' '[shell]' 'enabled = [ "not/a-plugin" ]' > "$R/configs/noctalia/config.toml"
cp -r "$REPO" "$R/hyprland-multishell"
printf '%s\n' '#!/usr/bin/env bash' 'echo bootstrap-packages >> "$CALLS"' > "$R/hyprland-multishell/bootstrap-packages.sh"
stub dotter
stub noctalia           # never the real shell's IPC
stub pgrep 'exit 0'     # ...which is running
stub pkill 'exit 1'     # and no signal ever reaches a real terminal
rm -f "$HOME/.zshrc"
echo stock > "$HOME/.zshrc"
echo stock > "$C/noctalia/config.toml"
echo stock > "$C/hypr/hyprland.lua"
echo 'font_size 12' > "$C/kitty/kitty.conf"
# as the README runs it: no rice-theme on PATH yet
boot() { PATH="${PATH#"$RICE_ROOT/bin:"}" "$R/bootstrap.sh"; }

expect "runs"                                boot
expect "packages first"                      called 'bootstrap-packages'
expect "picks the dotter packages"           has "$R/.dotter/local.toml" 'hyprland'
expect "moves the stock rc aside"            has "$HOME/.zshrc.pre-dotter" stock
expect "...and Hyprland's config"            has "$C/hypr.pre-dotter/hyprland.lua" stock
expect "...and Noctalia's"                   has "$C/noctalia.pre-dotter/config.toml" stock
expect "deploys"                             called 'dotter deploy'
expect "colours go through rice-theme"       has "$C/noctalia/templates.toml" "$RICE_ROOT/bin/rice-theme apply kitty"
expect "...which the apps read"              has "$C/kitty/kitty.conf" "include $C/rice-theme/active/kitty.conf"
expect "...after their own settings"         has "$C/kitty/kitty.conf" 'font_size 12'
expect "Noctalia fetches the listed plugins" called 'noctalia msg plugins enable a/one'
expect "...each of them"                     called 'noctalia msg plugins enable b/two'
refute "...and nothing from another table"   called 'not/a-plugin'
expect "...and renders the colours"          called 'noctalia msg templates-apply'

section "bootstrap.sh, again"
echo linked > "$SANDBOX/zsh.rc"
ln -s "$SANDBOX/zsh.rc" "$HOME/.zshrc"      # what dotter leaves
mkdir -p "$SANDBOX/dots/hypr"
echo mine > "$SANDBOX/dots/hypr/hyprland.lua"
ln -s "$SANDBOX/dots/hypr" "$C/hypr"
echo 'packages = ["hyprland"]' > "$R/.dotter/local.toml"
echo 'kitty = lock:calm' >> "$C/rice-theme/theme.conf"
stub pgrep 'exit 1'     # from a tty this time: no shell to talk to
: > "$CALLS"
expect "runs"                                boot
refute "without Noctalia, no IPC"            called 'noctalia msg'
expect "keeps local.toml"                    has_not "$R/.dotter/local.toml" 'starship'
expect "leaves dotter's links"               test -L "$HOME/.zshrc"
expect "...Hyprland's too"                   has "$C/hypr/hyprland.lua" mine
expect "...and the first backups"            has "$C/hypr.pre-dotter/hyprland.lua" stock
expect "keeps your locks"                    has "$C/rice-theme/theme.conf" 'kitty = lock:calm'
expect "adds no second include"              test "$(grep -c 'rice-theme/active' "$C/kitty/kitty.conf")" -eq 1

finish
