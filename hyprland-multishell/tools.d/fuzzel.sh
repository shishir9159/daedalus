# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Spawned per use; the next launch picks it up.
DESC="fuzzel" EXT=".ini"
INCLUDE="in fuzzel.ini:  include=$TH/active/fuzzel.ini"
reload() { return 1; }
