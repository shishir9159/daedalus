#!/usr/bin/env bash
# configs/sh/deploy.sh -- copy env.sh's block into every shell's rc, between
# two marker lines: replaced where it already is, appended otherwise. Run by
# `dotter deploy` (.dotter/post_deploy.sh), or by hand. A shell that isn't
# installed and has no rc is skipped. ~/.zshrc is dotter's link, so zsh.rc
# in the repo holds its copy: commit it with env.sh.
set -euo pipefail
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"

BEGIN='# >>> daedalus configs/sh/env.sh: edit it there, then dotter deploy >>>'
END='# <<< daedalus configs/sh/env.sh <<<'

# The block as sh, and as nushell: $env.NAME = $"...", PATH as the list it is there.
# shellcheck disable=SC2016  # literal: these are nushell's $env, not ours
nu_var='($env.\1)' nu_path="(\$env.PATH | str join ':')"
line_re='^export ([A-Za-z_][A-Za-z0-9_]*)="([^"`\(){}]*)"$'
sh_block="$(sed '1,/^$/d' env.sh)"
nu_block=""
while IFS= read -r line; do
    if [[ $line =~ $line_re ]]; then
        name="${BASH_REMATCH[1]}"
        value="$(sed -E "s/\\\$([A-Za-z_][A-Za-z0-9_]*)/$nu_var/g" <<< "${BASH_REMATCH[2]}")"
        if [ "$name" = PATH ]; then
            # shellcheck disable=SC2016
            value=${value//'($env.PATH)'/$nu_path}
            line="\$env.PATH = (\$\"$value\" | split row ':')"
        else
            line="\$env.$name = \$\"$value\""
        fi
    elif [[ -n $line && $line != \#* ]]; then
        echo "env.sh: only comments and export NAME=\"value\" lines: $line" >&2
        exit 1
    fi
    nu_block+="$line"$'\n'
done <<< "$sh_block"

put() { # <shell> <rc> <block>
    local rc="$2" new
    command -v "$1" >/dev/null || [ -e "$rc" ] || return 0
    mkdir -p "${rc%/*}"
    [ -e "$rc" ] || : > "$rc"
    new="$(BLOCK="$BEGIN"$'\n'"${3%$'\n'}"$'\n'"$END" awk -v b="$BEGIN" -v e="$END" '
        $0 == b { print ENVIRON["BLOCK"]; skip = found = 1 }
        !skip   { print }
        $0 == e { skip = 0 }
        END     { if (skip) exit 1; if (!found) { if (NR) print ""; print ENVIRON["BLOCK"] } }' "$rc")" \
        || { echo "deploy.sh: $rc: the block's end marker is missing - fix it by hand" >&2; return 1; }
    # written through, not replaced: the rc may be a link
    [ "$new" = "$(cat "$rc")" ] || { printf '%s\n' "$new" > "$rc"; echo ":: env.sh -> $rc"; }
}

put bash "$HOME/.bashrc" "$sh_block"
put zsh  "$HOME/.zshrc" "$sh_block"
put fish "$HOME/.config/fish/config.fish" "$sh_block"
put nu   "$HOME/.config/nushell/config.nu" "$nu_block"
