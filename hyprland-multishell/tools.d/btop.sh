# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Theme read at startup; the next launch picks it up.
DESC="btop" EXT=".theme"
INCLUDE="in btop.conf:  color_theme = \"$TH/active/btop.theme\""
reload() { return 1; }
