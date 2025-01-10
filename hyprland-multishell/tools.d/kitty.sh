# shellcheck shell=bash disable=SC2034  # INCLUDE is read by rice-theme
# SIGUSR1 reloads the whole config; no remote-control socket needed.
INC_FILE="kitty/kitty.conf" INC_LINE="include $TH/active/kitty.conf"
INCLUDE="in kitty.conf:  $INC_LINE"
reload() { pkill -USR1 -x kitty; }
