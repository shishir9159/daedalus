# configs/sh/env.sh (dotter package `sh`) is sh, which fish can't source:
# env-changes.sh runs it and prints what it changed. PATH arrives joined by
# colons; fish splits a *PATH variable itself.
if test -r ~/.config/sh/env-changes.sh
    for kv in (sh ~/.config/sh/env-changes.sh | string split0)
        set -gx (string split -m 1 -- = $kv)
    end
end
