# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# No runtime reload: SIGUSR1/2 only switch the [colors-dark]/[colors-light]
# sets loaded at startup. New windows get new colours. foot wants bare hex.
DESC="foot" EXT=".ini"
INCLUDE="in foot.ini, in [main] or above the first section:  include=$TH/active/foot.ini"
reload() { return 1; }
transform() { sed 's/=#/=/'; }
