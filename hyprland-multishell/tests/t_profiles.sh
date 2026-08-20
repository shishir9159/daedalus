#!/usr/bin/env bash
# Profiles: creation, name validation, the symlink farm, owned-set layering,
# divergence/adopt, bootstrap idempotency, greeter entries.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
P="$RICE_ROOT/profiles"

section "names"
refute "rejects a name with a space"         rice-new "my rice"
refute "rejects path traversal"              rice-new "../escape"
expect "accepts a normal name"               rice-new alpha
expect "per-profile owned.txt is an overlay, not a full copy" has_not "$P/alpha/owned.txt" 'quickshell'

section "symlink farm"
mkdir -p "$HOME/.config/nvim" "$HOME/.config/kitty" "$HOME/.local/share/fonts"
rice-sync alpha --quiet
expect "shared app is linked"                test -L "$P/alpha/config/nvim"
expect "shared data is linked"               test -L "$P/alpha/data/fonts"
refute "owned-by-default app is not linked"  test -e "$P/alpha/config/kitty"

echo '!kitty' >> "$P/alpha/owned.txt"
rice-sync alpha --quiet
expect "!name in the profile layer shares it" test -L "$P/alpha/config/kitty"

echo 'nvim' >> "$RICE_ROOT/owned.txt"
rice-sync alpha --quiet
refute "global override layer owns it; stale link pruned" test -L "$P/alpha/config/nvim"
sed -i '/^nvim$/d' "$RICE_ROOT/owned.txt"
rice-sync alpha --quiet
expect "and it comes back when un-owned"     test -L "$P/alpha/config/nvim"

section "divergence"
mkdir -p "$P/alpha/config/newapp"                 # first launched inside the profile
mkdir -p "$HOME/.config/both" "$P/alpha/config/both"
rice-sync alpha --report > "$SANDBOX/report"
expect "profile-only entry reported as local" has "$SANDBOX/report" $'config\tnewapp\tlocal'
expect "duplicate reported as shadows"       has "$SANDBOX/report" $'config\tboth\tshadows'
rice-sync alpha --adopt --quiet
expect "adopt moved it into ~/.config"       test -d "$HOME/.config/newapp"
expect "...and linked it back"               test -L "$P/alpha/config/newapp"
expect "adopt leaves shadowing copies alone" test ! -L "$P/alpha/config/both"

section "bootstrap idempotency"
"$REPO/bootstrap-profiles.sh" >/dev/null
expect "caelestia uses uwsm"                 has "$P/caelestia/profile.env" 'USE_UWSM=1'
refute "caelestia clone line is disabled"    grep -qE '^config/quickshell/caelestia' "$P/caelestia/repos.txt"
echo "# mine" >> "$P/persona/repos.txt"
sed -i 's/^USE_UWSM=1/USE_UWSM=0/' "$P/caelestia/profile.env"
"$REPO/bootstrap-profiles.sh" >/dev/null
expect "re-run keeps an edited repos.txt"    has "$P/persona/repos.txt" '# mine'
expect "re-run keeps an edited USE_UWSM"     has "$P/caelestia/profile.env" 'USE_UWSM=0'

section "greeter entries"
expect "register"                            rice-session alpha "Alpha Rice"
D="$RICE_SESSIONS_DIR/rice-alpha.desktop"
expect "Exec line"                           has "$D" 'Exec=/usr/local/bin/hypr-profile alpha'
expect "TryExec hides it if the stub is gone" has "$D" 'TryExec=/usr/local/bin/hypr-profile'
expect "remove"                              rice-session alpha --remove
refute "entry is gone"                       test -e "$D"
refute "invalid name refused"                rice-session "a b"

finish
