# shellcheck shell=bash disable=SC2034  # EXT/INCLUDE are read by rice-theme
# No runtime reload: SIGUSR1/2 only switch the [colors-dark]/[colors-light]
# sets loaded at startup. New windows get new colours. foot wants bare hex.
EXT=".ini"
INC_FILE="foot/foot.ini" INC_LINE="include=$TH/active/foot.ini" INC_TOP=1
INCLUDE="in foot.ini, in [main] or above the first section:  $INC_LINE"
transform() { sed 's/=#/=/'; }
