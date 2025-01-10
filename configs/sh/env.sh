# shellcheck shell=sh
# What every shell exports. `dotter deploy` copies the lines below this
# paragraph into each shell's rc (deploy.sh, next to this file): edit them
# here, never there. Only comments and `export NAME="value"` lines, with
# $NAME for other variables: bash, zsh and fish read those as they are, and
# deploy.sh rewrites them for nushell. Like zsh.rc, never XDG_*_HOME.

# hyprland-multishell's rice-* tools
export PATH="$HOME/.rices/bin:$PATH"
