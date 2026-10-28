# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# gtk.css is read once at startup: restart GTK apps (no reload()).
DESC="GTK 3/4" EXT=".css"
INC_FILE="gtk-3.0/gtk.css gtk-4.0/gtk.css" INC_LINE="@import url(\"$TH/active/gtk.css\");" INC_TOP=1
INCLUDE="in gtk-3.0/gtk.css and gtk-4.0/gtk.css:  $INC_LINE"
