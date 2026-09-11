# shellcheck shell=bash disable=SC2034  # EXT/INCLUDE are read by rice-theme
# No runtime reload: SIGUSR1/2 only switch the [colors-dark]/[colors-light]
# sets loaded at startup. New windows get new colours. foot wants bare hex.
EXT=".ini"
INCLUDE="in foot.ini, in [main] or above the first section:  include=$TH/active/foot.ini"
transform() { sed 's/=#/=/'; }
