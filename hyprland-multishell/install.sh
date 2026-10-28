#!/usr/bin/env bash
# install.sh -- install or upgrade rice-theme into ~/.rices. Re-runnable; never
# touches ~/.config/rice-theme (your locks and themes). Nothing needs root.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/rice-common.sh
. "$SRC/lib/rice-common.sh"

[ $# -eq 0 ] || rice_usage "install.sh"

missing=()
for c in find sed awk grep cmp readlink mktemp; do command -v "$c" >/dev/null || missing+=("$c"); done
[ ${#missing[@]} -eq 0 ] || rice_die "missing: ${missing[*]}"
for pair in flock:util-linux inotifywait:inotify-tools pkill:procps-ng; do
    command -v "${pair%%:*}" >/dev/null || echo ":: optional: ${pair%%:*} missing (pacman -S ${pair#*:})"
done

mkdir -p "$RICE_ROOT"/{bin,lib,tools.d,templates}
# dotter (../.dotter) links these into the repo instead; `install` would
# replace each link with a copy.
if [ -L "$RICE_ROOT/bin/rice-theme" ]; then
    echo ":: $RICE_ROOT is linked by dotter - not copying (new files: dotter deploy)"
else
    echo ":: installing to $RICE_ROOT"
    install -m755 "$SRC"/bin/*        "$RICE_ROOT/bin/"
    install -m644 "$SRC"/lib/*.sh     "$RICE_ROOT/lib/"
    install -m644 "$SRC"/tools.d/*.sh "$RICE_ROOT/tools.d/"
    install -m644 "$SRC"/templates/*  "$RICE_ROOT/templates/"
fi
case ":$PATH:" in *":$RICE_ROOT/bin:"*) ;; *) echo ":: add to your shell rc: export PATH=\"$RICE_ROOT/bin:\$PATH\"" ;; esac
echo "done. next: rice-theme noctalia-config && rice-theme include"
