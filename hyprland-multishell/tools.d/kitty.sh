# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# SIGUSR1 reloads the whole config; no remote-control socket needed.
DESC="kitty" EXT=".conf"
INCLUDE="in kitty.conf:  include $TH/active/kitty.conf"
reload() { pkill -USR1 -x kitty; }
