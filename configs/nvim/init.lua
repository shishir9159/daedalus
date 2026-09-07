vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

require('config.options')
-- must run while init.lua is sourced: ShaDa is read at startup step 16
require('config.project').setup()
require('config.pack')
require('config.treesitter')
require('config.complete')
require('config.lsp')
require('config.keymaps')
require('config.autocmds')
require('config.profiling')

-- hyprland-multishell: this profile's colours from rice-theme (Normal, Visual,
-- ...). Shared config, so the path is per session; a no-op outside a rice.
pcall(dofile, vim.fn.expand('$XDG_CONFIG_HOME/rice-theme/active/nvim.lua'))
