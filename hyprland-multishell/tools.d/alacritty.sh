# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Live-reloads its config and imports on its own.
DESC="Alacritty" EXT=".toml"
INCLUDE="in alacritty.toml:  general.import = [\"$TH/active/alacritty.toml\"]"
reload() { pgrep -x alacritty >/dev/null; }
