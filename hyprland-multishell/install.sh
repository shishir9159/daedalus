#!/usr/bin/env bash
# install.sh [--user-only] -- install or upgrade. Re-runnable; never touches
# profiles or your owned.txt. --user-only skips the root step (the launcher stub).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/rice-common.sh
. "$SRC/lib/rice-common.sh"

case "${1:-}" in --user-only) USER_ONLY=1 ;; "") USER_ONLY=0 ;; *) rice_usage "install.sh [--user-only]" ;; esac

missing=()
for c in git find sed awk grep cmp readlink mktemp; do command -v "$c" >/dev/null || missing+=("$c"); done
[ ${#missing[@]} -eq 0 ] || rice_die "missing: ${missing[*]}"
for pair in flock:util-linux inotifywait:inotify-tools pkill:procps-ng; do
    command -v "${pair%%:*}" >/dev/null || echo ":: optional: ${pair%%:*} missing (pacman -S ${pair#*:})"
done

mkdir -p "$RICE_ROOT"/{bin,lib,tools.d,templates,profiles}
# dotter (../.dotter) links these into the repo instead; `install` would
# replace each link with a copy.
if [ -L "$RICE_ROOT/bin/rice-new" ]; then
    echo ":: $RICE_ROOT is linked by dotter - not copying (new files: dotter deploy)"
else
    echo ":: installing to $RICE_ROOT"
    install -m755 "$SRC"/bin/*        "$RICE_ROOT/bin/"
    install -m644 "$SRC"/lib/*.sh     "$RICE_ROOT/lib/"
    install -m644 "$SRC"/tools.d/*.sh "$RICE_ROOT/tools.d/"
    install -m644 "$SRC"/templates/*  "$RICE_ROOT/templates/"
    install -m644 "$SRC/owned.default.txt" "$RICE_ROOT/"
fi
[ -f "$RICE_ROOT/owned.txt" ] \
    || echo '# Your changes to owned.default.txt, all profiles: "name" owns, "!name" shares.' > "$RICE_ROOT/owned.txt"

if [ "$USER_ONLY" = 0 ]; then
    echo ":: installing $RICE_LAUNCHER (sudo)"
    sudo install -Dm755 "$SRC/system/hypr-profile" "$RICE_LAUNCHER"
fi
case ":$PATH:" in *":$RICE_ROOT/bin:"*) ;; *) echo ":: add to your shell rc: export PATH=\"$RICE_ROOT/bin:\$PATH\"" ;; esac
echo "done. next: ./bootstrap-profiles.sh"
