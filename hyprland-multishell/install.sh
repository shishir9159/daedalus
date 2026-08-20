#!/usr/bin/env bash
# install.sh [--user-only] -- install or upgrade. Re-runnable; never touches
# profiles or your owned.txt. --user-only skips the root step (the launcher stub).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/rice-common.sh
. "$SRC/lib/rice-common.sh"

case "${1:-}" in --user-only) USER_ONLY=1 ;; "") USER_ONLY=0 ;; *) echo "usage: install.sh [--user-only]" >&2; exit 2 ;; esac

missing=()
for c in git find sed awk grep cmp readlink mktemp; do command -v "$c" >/dev/null || missing+=("$c"); done
[ ${#missing[@]} -eq 0 ] || rice_die "missing: ${missing[*]}"

echo ":: installing to $RICE_ROOT"
mkdir -p "$RICE_ROOT"/{bin,lib,profiles}
install -m755 "$SRC"/bin/*        "$RICE_ROOT/bin/"
install -m644 "$SRC"/lib/*.sh     "$RICE_ROOT/lib/"
install -m644 "$SRC/owned.default.txt" "$RICE_ROOT/"
[ -f "$RICE_ROOT/owned.txt" ] \
    || echo '# Your changes to owned.default.txt, all profiles: "name" owns, "!name" shares.' > "$RICE_ROOT/owned.txt"

if [ "$USER_ONLY" = 0 ]; then
    echo ":: installing /usr/local/bin/hypr-profile (sudo)"
    sudo install -Dm755 "$SRC/system/hypr-profile" /usr/local/bin/hypr-profile
fi
case ":$PATH:" in *":$RICE_ROOT/bin:"*) ;; *) echo ":: add to your shell rc: export PATH=\"\$HOME/.rices/bin:\$PATH\"" ;; esac
echo "done. next: ./bootstrap-profiles.sh"
