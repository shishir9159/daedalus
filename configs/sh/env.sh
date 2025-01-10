# shellcheck shell=sh
# What every shell exports (dotter package `sh`). zsh.rc and ~/.bashrc source
# it; fish and nushell can't read sh, so their loaders (configs/fish,
# configs/nushell) set what env-changes.sh prints. POSIX sh, exports only, and
# nothing may add twice: a shell started from another one reads this again.
# Like zsh.rc, never XDG_*_HOME.

# hyprland-multishell's rice-* tools
case ":$PATH:" in *":$HOME/.rices/bin:"*) ;; *) export PATH="$HOME/.rices/bin:$PATH" ;; esac
