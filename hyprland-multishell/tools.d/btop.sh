# shellcheck shell=bash disable=SC2034  # EXT/INCLUDE are read by rice-theme
# Theme read at startup; the next launch picks it up (no reload()).
EXT=".theme"
INCLUDE="in btop.conf:  color_theme = \"$TH/active/btop.theme\""
