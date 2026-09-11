# shellcheck shell=bash disable=SC2034  # INCLUDE is read by rice-theme
# SIGUSR1 reloads the whole config; no remote-control socket needed.
INCLUDE="in kitty.conf:  include $TH/active/kitty.conf"
reload() { pkill -USR1 -x kitty; }
