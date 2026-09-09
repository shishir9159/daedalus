local pack = require('config.pack')
local map = vim.keymap.set

map('n', '<Esc>', '<Cmd>nohlsearch<CR>')
map('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

-- find (fff)
map('n', '<leader>ff', function() pack.fff().find_files() end, { desc = 'Files' })
map('n', '<leader>fg', function() pack.fff().live_grep() end, { desc = 'Live grep' })
map('n', '<leader>fr', function() pack.fff().resume() end, { desc = 'Resume last picker' })
map('n', '<leader>fw', function()
  pack.fff().live_grep_under_cursor()
end, { desc = 'Grep word under cursor' })
map('n', '<leader>fp', function() require('config.project').pick() end, { desc = 'Recent projects' })
map('n', '<leader>fo', function() require('config.project').oldfiles() end, { desc = 'Recent files' })

-- buffer
map('n', '<leader>bd', '<Cmd>bdelete<CR>', { desc = 'Delete buffer' })
map('n', '<leader>bo', '<Cmd>%bdelete|edit#|bdelete#<CR>', { desc = 'Delete other buffers' })

-- toggle
map('n', '<leader>tw', '<Cmd>set wrap!<CR>', { desc = 'Wrap' })
map('n', '<leader>ts', '<Cmd>set spell!<CR>', { desc = 'Spell' })

-- file manager (yazi)
local function yazi()
  pack.load('yazi.nvim', function()
    vim.cmd.packadd('plenary.nvim') -- yazi.nvim's declared dependency
    require('yazi').setup({})
  end)
  return require('yazi')
end
map({ 'n', 'v' }, '<leader>e', function() yazi().yazi() end, { desc = 'Yazi (file)' })
map('n', '<leader>E', function() yazi().yazi(nil, vim.fn.getcwd()) end, { desc = 'Yazi (cwd)' })

-- git: lazygit in a float (builtin terminal), mini.diff hunk overlay
map('n', '<leader>gg', function() require('config.tui').lazygit() end, { desc = 'Lazygit' })
map('n', '<leader>gd', function()
  pack.editing()
  require('mini.diff').toggle_overlay(0)
end, { desc = 'Toggle diff overlay' })

-- lsp (builtin defaults: grn grr gri gra grt gO K [d ]d)
map('n', 'gd', vim.lsp.buf.definition, { desc = 'Go to definition' })
map('n', '<leader>xq', vim.diagnostic.setqflist, { desc = 'Diagnostics to quickfix' })

-- debugger (nvim-dap, loaded on first use)
local function dap()
  pack.load('nvim-dap', function()
    vim.cmd.packadd('nvim-dap-view')
    vim.cmd.packadd('nvim-dap-virtual-text')
    require('config.dap')
  end)
  return require('dap')
end
map('n', '<F5>', function() dap().continue() end, { desc = 'Debug: continue' })
map('n', '<F10>', function() dap().step_over() end, { desc = 'Debug: step over' })
map('n', '<F11>', function() dap().step_into() end, { desc = 'Debug: step into' })
map('n', '<F12>', function() dap().step_out() end, { desc = 'Debug: step out' })
map('n', '<leader>db', function() dap().toggle_breakpoint() end, { desc = 'Toggle breakpoint' })
map('n', '<leader>dB', function()
  dap().set_breakpoint(vim.fn.input('Breakpoint condition: '))
end, { desc = 'Conditional breakpoint' })
map('n', '<leader>dt', function() dap().terminate() end, { desc = 'Debug: terminate' })
map('n', '<leader>dk', function()
  dap()
  require('dap.ui.widgets').hover()
end, { desc = 'Debug: inspect value' })
map('n', '<leader>dv', function()
  dap()
  require('dap-view').toggle()
end, { desc = 'Debug: toggle view' })
