-- :colorscheme rice -- this rice profile's palette (rice-theme writes it; see
-- hyprland-multishell/templates/nvim.tmpl) over Neovim's default scheme.
vim.cmd.highlight('clear')
pcall(dofile, require('config.theme').rice)
vim.g.colors_name = 'rice'
