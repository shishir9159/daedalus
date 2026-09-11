# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# gtk.css is read once at startup: restart GTK apps (no reload()).
DESC="GTK 3/4" EXT=".css"
INCLUDE="in gtk-3.0/gtk.css and gtk-4.0/gtk.css:  @import url(\"$TH/active/gtk.css\");"
