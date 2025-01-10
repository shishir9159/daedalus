#!/usr/bin/env bash
# configs/sh and the root bootstrap.sh: the shared environment is added once,
# and a second bootstrap run overwrites nothing the first one, or you since,
# wrote. Packages and dotter are stubbed.
# shellcheck disable=SC2016  # literal on purpose: sh -c and the stub expand them
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
ROOT="$(cd "$REPO/.." && pwd)"

section "configs/sh"
E="$ROOT/configs/sh"
once="$HOME/.rices/bin:/usr/bin:/bin"
twice() { PATH=/usr/bin:/bin "$1" -c '. "$0"; . "$0"; printf "%s\n" "$PATH"' "$E/env.sh"; }
expect "env.sh, sourced twice by bash, adds once" test "$(twice bash)" = "$once"
expect "...and by sh"                        test "$(twice sh)" = "$once"
out_has "env-changes.sh prints the new PATH" "PATH=$once" env PATH=/usr/bin:/bin sh "$E/env-changes.sh"
expect "...and nothing once it is there"     test "$(PATH="$once" sh "$E/env-changes.sh" | wc -c)" -eq 0

section "bootstrap.sh"
R="$SANDBOX/repo" PN="$RICE_ROOT/profiles/noctalia"
mkdir -p "$R/.dotter" "$R/configs" "$HOME/.config/noctalia" "$HOME/.config/hypr"
cp "$ROOT/bootstrap.sh" "$R/"
cp -r "$ROOT/configs/sh" "$R/configs/"
cp -r "$REPO" "$R/hyprland-multishell"
printf '%s\n' '#!/usr/bin/env bash' 'echo bootstrap-packages >> "$CALLS"' > "$R/hyprland-multishell/bootstrap-packages.sh"
stub dotter
stub sudo   # install.sh's launcher goes to /usr/local/bin: logged, not written
echo stock > "$HOME/.zshrc"
echo stock > "$HOME/.config/noctalia/config.toml"
echo stock > "$HOME/.config/hypr/hyprland.lua"
# as the README runs it: no rice-* on PATH yet
boot() { PATH="${PATH#"$RICE_ROOT/bin:"}" "$R/bootstrap.sh"; }

expect "runs"                                boot
expect "packages first"                      called 'bootstrap-packages'
expect "picks the dotter packages"           has "$R/.dotter/local.toml" 'hyprland'
expect "moves the stock rc aside"            has "$HOME/.zshrc.pre-dotter" stock
expect "deploys"                             called 'dotter deploy'
expect "copies Noctalia's config in"         has "$PN/config/noctalia/config.toml" stock
expect "...and Hyprland's"                   has "$PN/config/hypr/hyprland.lua" stock
expect "snapshots the import"                git -C "$PN" rev-parse -q --verify HEAD
expect "registers the session"               test -f "$RICE_SESSIONS_DIR/rice-noctalia.desktop"

section "bootstrap.sh, again"
echo linked > "$SANDBOX/zsh.rc"
ln -s "$SANDBOX/zsh.rc" "$HOME/.zshrc"      # what dotter leaves
echo 'packages = ["hyprland"]' > "$R/.dotter/local.toml"
echo mine > "$PN/config/hypr/hyprland.lua"
expect "runs"                                boot
expect "keeps local.toml"                    has_not "$R/.dotter/local.toml" 'starship'
expect "leaves dotter's link"                test -L "$HOME/.zshrc"
expect "...and the first backup"             has "$HOME/.zshrc.pre-dotter" stock
expect "never copies over the profile again" has "$PN/config/hypr/hyprland.lua" mine

finish
