# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Starship reads a single file, so active/ gets a whole config: the shared one
# (~/.config/starship.toml, from configs/starship) with a [palettes.rice]
# table, its own palette with this profile's colours over it, selected. The
# shared config's edits reach a profile at its next apply (`check` shows it
# drifted). Starship re-reads its config at every prompt: nothing to reload.
DESC="Starship" EXT=".toml"
# shellcheck disable=SC2016  # literal: starship.bash expands it
INCLUDE='nothing: configs/starship/starship.bash prefers $XDG_CONFIG_HOME/rice-theme/active/starship.toml'
reload() { :; }

transform() { # stdin: key = "#hex" lines (templates/starship.tmpl)
    local base="$HOME/.config/starship.toml"
    if [ ! -f "$base" ]; then
        echo "# rice-theme: no $base to put this profile's palette in"
        return 0
    fi
    awk '
        FNR == NR {   # the profile palette
            if ($0 ~ /^[A-Za-z0-9_]+[ \t]*=/) { k = $0; sub(/[ \t]*=.*/, "", k); v = $0; sub(/^[^=]*=[ \t]*/, "", v); over[k] = v }
            next
        }
        /^palette[ \t]*=/ { name = $0; sub(/^[^=]*=[ \t]*/, "", name); gsub(/["\047]/, "", name); print "palette = \"rice\""; next }
        /^\[/ { inpal = ($0 == "[palettes." name "]") }
        inpal && /^[A-Za-z0-9_]+[ \t]*=/ { k = $0; sub(/[ \t]*=.*/, "", k); v = $0; sub(/^[^=]*=[ \t]*/, "", v); keys[++n] = k; val[k] = v }
        { print }
        END {
            print "\n[palettes.rice]"
            for (i = 1; i <= n; i++) print keys[i] " = " (keys[i] in over ? over[keys[i]] : val[keys[i]])
        }
    ' - "$base"
}
