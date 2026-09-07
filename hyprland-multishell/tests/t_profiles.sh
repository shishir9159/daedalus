#!/usr/bin/env bash
# Profiles: creation, name validation, the symlink farm, owned-set layering,
# divergence/adopt, bootstrap idempotency, greeter entries, snapshots.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
P="$RICE_ROOT/profiles"

section "names"
refute "rejects a name with a space"         rice-new "my rice"
refute "rejects path traversal"              rice-new "../escape"
expect "accepts a normal name"               rice-new alpha
expect "profile-root git repo"               test -d "$P/alpha/.git"
expect "whitelist .gitignore"                has "$P/alpha/.gitignore" '!/state/noctalia/settings.toml'
expect "per-profile owned.txt is an overlay, not a full copy" has_not "$P/alpha/owned.txt" 'quickshell'
expect "theme templates copied in"           test -f "$P/alpha/config/rice-theme/templates/ghostty.tmpl"

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
expect ".git is never reported"              has_not "$SANDBOX/report" '.git'
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

section "snapshots"
mkdir -p "$P/alpha/state/noctalia" "$P/alpha/state/other"
echo 'gui = "tweak"' > "$P/alpha/state/noctalia/settings.toml"
echo 'x' > "$P/alpha/state/other/junk"
echo 'x' > "$P/alpha/config/rice-theme/generated/ghostty.conf"
echo 'return {}' > "$P/alpha/config/hypr/hyprland.lua"
expect "snapshot commits"                    rice-snapshot alpha "first"
git -C "$P/alpha" ls-files > "$SANDBOX/tracked"
expect "Noctalia GUI state is captured"      has "$SANDBOX/tracked" 'state/noctalia/settings.toml'
expect "hypr config is captured"             has "$SANDBOX/tracked" 'config/hypr/hyprland.lua'
expect "generated colours are not"           has_not "$SANDBOX/tracked" 'rice-theme/generated'
expect "other state is not"                  has_not "$SANDBOX/tracked" 'state/other'
mkdir -p "$P/alpha/config/.git"
refute "old config/.git layout is refused, not nested" rice-snapshot alpha
rm -rf "$P/alpha/config/.git"

section "dotter-linked install"
for f in bin/rice-new bin/rice-sync templates/nvim.tmpl; do ln -sf "$REPO/$f" "$RICE_ROOT/$f"; done
expect "install.sh succeeds"                 "$REPO/install.sh" --user-only
expect "it keeps dotter's links"             test -L "$RICE_ROOT/bin/rice-sync" -a -L "$RICE_ROOT/templates/nvim.tmpl"
expect "linked tools still work"             rice-new beta
mv "$HOME/.config/nvim" "$SANDBOX/repo-nvim" && ln -s "$SANDBOX/repo-nvim" "$HOME/.config/nvim"
rice-sync beta --quiet
expect "a linked ~/.config/nvim reaches the profile" test "$(readlink -f "$P/beta/config/nvim")" = "$(readlink -f "$SANDBOX/repo-nvim")"

finish
