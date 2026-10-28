#!/usr/bin/env bash
# rice-theme: where its state lives, locks surviving a wallpaper change, the
# foot transform, freezing the source format, drift detection, named themes,
# noctalia-config safety, `include` writing each app's config, the Ghostty
# version gate and Starship's palette merge.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
C="$HOME/.config"
TH="$C/rice-theme"
G="$TH/generated"; A="$TH/active"
stub pkill 'exit 1'     # nothing running, unless a test says otherwise
stub pgrep 'exit 1'

section "where the state lives"
expect "runs with no setup"                  rice-theme status
expect "...in ~/.config/rice-theme"          test -d "$A"
expect "\$XDG_CONFIG_HOME moves it"          env XDG_CONFIG_HOME="$SANDBOX/xdg" rice-theme status
expect "...there"                            test -d "$SANDBOX/xdg/rice-theme/active"
refute "--profile is gone"                   rice-theme --profile th status

wallpaper() { # simulate Noctalia re-rendering every template
    printf 'background = %s\n' "$1" > "$G/ghostty.conf"
    printf 'return { bg = "%s" }\n' "$1" > "$G/nvim.lua"
    printf '[colors-dark]\nbackground=%s\n' "$1" > "$G/foot.ini"
    rice-theme apply >/dev/null
}

section "publish and transform"
wallpaper '#111111'
expect "ghostty published"                   has "$A/ghostty.conf" '#111111'
expect "foot published without '#'"          has "$A/foot.ini" 'background=111111'

section "locks survive a wallpaper change"
expect "lock nvim + ghostty"                 rice-theme lock nvim ghostty
wallpaper '#ff0000'
expect "ghostty kept its colours"            has "$A/ghostty.conf" '#111111'
expect "nvim kept its colours"               has "$A/nvim.lua" '#111111'
expect "foot followed the wallpaper"         has "$A/foot.ini" 'background=ff0000'

section "freeze the source, not the transformed file"
expect "lock foot"                           rice-theme lock foot
expect "pinned copy is in source format"     has "$TH/locked/foot.ini" 'background=#ff0000'
expect "live copy is transformed"            has "$A/foot.ini" 'background=ff0000'
rice-theme check > "$SANDBOX/check"
expect "a transformed lock is not 'drifted'" has "$SANDBOX/check" $'foot\tlock\tcurrent'
expect "locking twice is a no-op"            rice-theme lock foot

section "drift"
echo 'tampered' > "$A/nvim.lua"
refute "check fails on a broken lock"        rice-theme check
rice-theme check > "$SANDBOX/check" || true
expect "...and names it"                     has "$SANDBOX/check" $'nvim\tlock\tdrifted'
rice-theme apply >/dev/null
expect "apply puts the pin back"             has "$A/nvim.lua" '#111111'
expect "check passes again"                  rice-theme check

section "named themes"
expect "save"                                rice-theme save calm ghostty
expect "unlock"                              rice-theme unlock ghostty
expect "ghostty follows the wallpaper again" has "$A/ghostty.conf" '#ff0000'
expect "set"                                 rice-theme set calm ghostty
expect "policy is lock:calm"                 has "$TH/theme.conf" 'ghostty = lock:calm'
expect "colours are the saved ones"          has "$A/ghostty.conf" '#111111'
refute "theme name traversal refused"        rice-theme save ../../x ghostty
refute "tool name traversal refused"         rice-theme lock ../../x

section "templates"
# Noctalia renders comments too: a spelled-out {{ colors.<role> }} fails the whole file
refute "none carries a placeholder token"    grep -l '{{[^}]*<' "$REPO"/templates/*.tmpl

section "noctalia-config"
mkdir -p "$C/noctalia"
NT="$C/noctalia/templates.toml"
echo '[theme.templates.user.mine]' > "$NT"
expect "runs"                                rice-theme noctalia-config
expect "foreign file backed up, not clobbered" compgen -G "$NT.bak.*"
expect "post_hook applies the tool"          has "$NT" "post_hook   = \"$RICE_ROOT/bin/rice-theme apply ghostty\""
expect "the template is the installed one"   has "$NT" "input_path  = \"$RICE_ROOT/templates/ghostty.tmpl\""
expect "output goes to generated/"           has "$NT" "output_path = \"$G/ghostty.conf\""
rice-theme noctalia-config >/dev/null
expect "our own file is not backed up again" test "$(compgen -G "$NT.bak.*" | wc -l)" -eq 1

section "include"
mkdir -p "$C/foot" "$SANDBOX/dots/kitty"
printf '[main]\nfont=monospace\n' > "$C/foot/foot.ini"
echo 'font_size 12' > "$SANDBOX/dots/kitty/kitty.conf"
ln -s "$SANDBOX/dots/kitty" "$C/kitty"                  # a config dir dotter links
expect "runs"                                rice-theme include
expect "kitty gets its line"                 has "$C/kitty/kitty.conf" "include $A/kitty.conf"
expect "...through the link, after its own"  test "$(head -1 "$SANDBOX/dots/kitty/kitty.conf")" = 'font_size 12'
expect "ghostty's goes in config.ghostty"    has "$C/ghostty/config.ghostty" "config-file = ?$A/ghostty.conf"
expect "foot's goes above the first section" test "$(head -1 "$C/foot/foot.ini")" = "include=$A/foot.ini"
expect "...keeping what was there"           has "$C/foot/foot.ini" 'font=monospace'
expect "gtk gets it for 3 and 4"             has "$C/gtk-4.0/gtk.css" "@import url(\"$A/gtk.css\");"
expect "the file it points at exists by then" test -e "$A/kitty.conf"
rice-theme include >/dev/null
expect "a second run adds nothing"           test "$(grep -c . "$C/kitty/kitty.conf")" -eq 2
expect "the locks above still hold"          rice-theme check

section "Ghostty is never sent SIGUSR2 below 1.2 (it would close every terminal)"
stub pgrep 'exit 0'
stub ghostty 'echo "Ghostty 1.1.3"'
: > "$CALLS"
rice-theme unlock ghostty >/dev/null; wallpaper '#222222'
refute "1.1.3: no signal"                    called 'pkill -USR2'
stub ghostty 'echo "Ghostty 1.2.0"'
wallpaper '#333333'
expect "1.2.0: SIGUSR2"                      called 'pkill -USR2 -x ghostty'
stub ghostty 'echo "garbage"'
: > "$CALLS"
wallpaper '#444444'
refute "unknown version: no signal"          called 'pkill -USR2'

section "kitty reloads via SIGUSR1"
printf 'background %s\n' '#555555' > "$G/kitty.conf"
rice-theme apply kitty >/dev/null
expect "pkill -USR1 kitty"                   called 'pkill -USR1 -x kitty'

section "Starship: the generated palette over your config"
# shellcheck disable=SC2016  # $directory, $all: starship's variables
{
printf '%s\n' "palette = 'shishir'" 'format = "$directory"' '' '[palettes.shishir]' \
    "path = '#ff479c'" "clock = '#2e9599'" '' '[time]' 'disabled = false' > "$HOME/.config/starship.toml"
printf '[palettes.rice]\npath = "#123456"\n' > "$G/starship.toml"
rice-theme apply starship >/dev/null
S="$A/starship.toml"
expect "selects the generated palette"       has "$S" 'palette = "rice"'
expect "keeps your config"                   has "$S" 'format = "$directory"'
expect "its colours win"                     grep -qx 'path = "#123456"' "$S"
expect "the rest are your palette's"         grep -qx "clock = '#2e9599'" "$S"
expect "your palette stays"                  grep -qx "path = '#ff479c'" "$S"
echo 'format = "$all"' >> "$HOME/.config/starship.toml"
rice-theme check > "$SANDBOX/check" || true
expect "an edit to your config shows as drift" has "$SANDBOX/check" $'starship\tauto\tdrifted'
rice-theme apply starship >/dev/null
expect "apply takes the edit"                has "$S" 'format = "$all"'
}

finish
