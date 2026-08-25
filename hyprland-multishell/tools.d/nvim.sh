# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Shared config, so the include is env-relative: one init.lua, per-profile colours.
# --remote-expr sends no keystrokes (you stay in insert mode); timeout guards a
# blocked instance.
DESC="Neovim" EXT=".lua"
# shellcheck disable=SC2016  # literal: nvim expands it
INCLUDE='in init.lua:  pcall(dofile, vim.fn.expand("$XDG_CONFIG_HOME/rice-theme/active/nvim.lua"))'
reload() {
    local sock hit=1 t=()
    command -v timeout >/dev/null && t=(timeout 3)
    for sock in "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"/nvim.*; do
        [ -S "$sock" ] || continue
        "${t[@]}" nvim --server "$sock" --remote-expr "luaeval('select(1, pcall(dofile, _A))', '$ACTIVE_F')" \
            >/dev/null 2>&1 && hit=0
    done
    return $hit
}
