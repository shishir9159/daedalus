# configs/sh/env.sh (dotter package `sh`) is sh, which nushell can't source:
# env-changes.sh runs it and prints what it changed. PATH arrives joined by
# colons and is a list here.
(^sh ~/.config/sh/env-changes.sh | complete).stdout
| split row (char nul)
| parse --regex '(?s)^(?<name>[^=]+)=(?<value>.*)$'
| reduce --fold {} {|v, acc|
    $acc | upsert $v.name (if $v.name == "PATH" { $v.value | split row (char esep) } else { $v.value })
}
| load-env
