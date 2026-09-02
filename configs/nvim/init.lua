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
