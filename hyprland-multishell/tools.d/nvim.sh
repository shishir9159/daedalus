# shellcheck shell=bash disable=SC2034  # EXT/DESC/INCLUDE are read by rice-theme
# Shared config, so the include is env-relative: one init.lua, per-profile colours.
# reload() only announces the change (User RiceTheme, palette path as data) to
# every Neovim; each one applies its own profile's palette, or ignores it when
# locked (configs/nvim/lua/config/theme.lua). --remote-expr sends no keystrokes
# (you stay in insert mode); timeout guards a blocked instance.
DESC="Neovim" EXT=".lua"
# shellcheck disable=SC2016  # literal: nvim expands it
INCLUDE='in init.lua:  dofile(vim.fn.expand("$XDG_CONFIG_HOME/rice-theme/active/nvim.lua")) at startup and on autocmd User RiceTheme'
reload() {
    local sock hit=1 t=()
    command -v timeout >/dev/null && t=(timeout 3)
    for sock in "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"/nvim.*; do
        [ -S "$sock" ] || continue
        "${t[@]}" nvim --server "$sock" --remote-expr \
            "luaeval('vim.api.nvim_exec_autocmds(\"User\", { pattern = \"RiceTheme\", data = _A, modeline = false })', '$ACTIVE_F')" \
            >/dev/null 2>&1 && hit=0
    done
    return $hit
}
