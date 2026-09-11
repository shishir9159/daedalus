#!/usr/bin/env bash
# rice-theme: profile resolution, locks surviving a wallpaper change, the foot
# transform, freezing the source format, drift detection, named themes,
# noctalia-config safety, and the Ghostty version gate.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
mkprofile th
TH="$PD/config/rice-theme"
G="$TH/generated"; A="$TH/active"
stub pkill 'exit 1'     # nothing running, unless a test says otherwise
stub pgrep 'exit 1'

section "profile resolution"
refute "outside a profile session it refuses" rice-theme status
expect "--profile works"                     rice-theme --profile th status
expect "\$RICE_PROFILE works"                env RICE_PROFILE=th rice-theme status
refute "nothing created in ~/.config"        test -e "$HOME/.config/rice-theme"
export RICE_PROFILE=th

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

section "noctalia-config"
mkdir -p "$RICE_ROOT/profiles/th/config/noctalia"
NT="$RICE_ROOT/profiles/th/config/noctalia/templates.toml"
echo '[theme.templates.user.mine]' > "$NT"
expect "runs"                                rice-theme noctalia-config
expect "foreign file backed up, not clobbered" compgen -G "$NT.bak.*"
expect "post_hook names the profile"         has "$NT" 'rice-theme --profile th apply ghostty'
expect "output goes to generated/"           has "$NT" 'rice-theme/generated/ghostty.conf'
rice-theme noctalia-config >/dev/null
expect "our own file is not backed up again" test "$(compgen -G "$NT.bak.*" | wc -l)" -eq 1

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

finish
