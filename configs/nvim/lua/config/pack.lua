local M = {}

local loaded = {}

--- packadd an opt-registered plugin once, running `setup` on first load.
function M.load(name, setup)
  if loaded[name] then
    return
  end
  loaded[name] = true
  vim.cmd.packadd(name)
  if setup then
    setup()
  end
end

-- Build hooks must exist before the vim.pack.add() call that installs.
vim.api.nvim_create_autocmd('PackChanged', {
  group = vim.api.nvim_create_augroup('config.pack', {}),
  callback = function(ev)
    local name, kind = ev.data.spec.name, ev.data.kind
    if name == 'nvim-treesitter' and kind == 'update' then
      vim.schedule(function()
        require('nvim-treesitter').update()
      end)
    elseif name == 'fff.nvim' and (kind == 'install' or kind == 'update') then
      vim.schedule(function()
        M.load('fff.nvim')
        require('fff.download').download_or_build_binary()
      end)
    end
  end,
})

-- Loaded at startup: treesitter (highlighting) and blink.cmp (completion).
-- blink.cmp is pinned to a release tag so it fetches its prebuilt fuzzy
-- matcher instead of requiring a nightly Rust toolchain.
vim.pack.add({
  { src = 'https://github.com/nvim-treesitter/nvim-treesitter', version = 'main' },
  { src = 'https://github.com/Saghen/blink.cmp', version = vim.version.range('1.*') },
}, { confirm = false })

-- Installed and tracked by vim.pack, but not loaded until first use.
-- `version` pins to a release-tag range where upstream publishes tags; the two
-- without tags track their default branch.
vim.pack.add({
  { src = 'https://github.com/dmtrKovalenko/fff.nvim', version = vim.version.range('0.*') },
  { src = 'https://github.com/mikavilpas/yazi.nvim', version = vim.version.range('13.*') },
  { src = 'https://github.com/mfussenegger/nvim-dap', version = vim.version.range('0.*') },
  { src = 'https://github.com/igorlfs/nvim-dap-view', version = vim.version.range('1.*') },
  { src = 'https://github.com/theHamsta/nvim-dap-virtual-text' }, -- untagged
  { src = 'https://github.com/t-troebst/perfanno.nvim' }, -- untagged
  { src = 'https://github.com/echasnovski/mini.surround', version = vim.version.range('0.*') },
  { src = 'https://github.com/echasnovski/mini.ai', version = vim.version.range('0.*') },
  { src = 'https://github.com/echasnovski/mini.pairs', version = vim.version.range('0.*') },
  { src = 'https://github.com/echasnovski/mini.diff', version = vim.version.range('0.*') },
  { src = 'https://github.com/echasnovski/mini.clue', version = vim.version.range('0.*') },
}, { load = function() end, confirm = false })

-- Editing/diff plugins: deferred until a real file buffer exists, so a bare
-- `nvim` never pays for them.
vim.api.nvim_create_autocmd({ 'BufReadPost', 'BufNewFile' }, {
  group = vim.api.nvim_create_augroup('config.pack.editing', {}),
  once = true,
  callback = function()
    vim.schedule(function()
      M.load('mini.surround', function()
        require('mini.surround').setup() -- sa/sd/sr/sf/sn + `s` textobject
      end)
      M.load('mini.ai', function()
        require('mini.ai').setup() -- treesitter-aware a/i textobjects
      end)
      M.load('mini.pairs', function()
        require('mini.pairs').setup()
      end)
      M.load('mini.diff', function()
        require('mini.diff').setup({
          view = { style = 'sign', signs = { add = '┃', change = '┃', delete = '▁' } },
        })
      end)
      M.load('mini.clue', function()
        require('config.clue')
      end)
    end)
  end,
})

-- `:Update` — plugins + treesitter parsers in one go.
-- vim.pack.update() opens an interactive review tab (confirm with :write,
-- discard with :quit); parser updates run async first and report separately.
-- Note the PackChanged hook above only reinstalls parsers when the
-- nvim-treesitter *plugin* revision changes; grammar repos move independently,
-- so this refreshes them regardless.
vim.api.nvim_create_user_command('Update', function()
  require('nvim-treesitter').update()
  vim.pack.update()
end, { desc = 'Update plugins (vim.pack) + treesitter parsers' })

function M.fff()
  M.load('fff.nvim', function()
    require('fff').setup({})
  end)
  return require('fff')
end

-- Warm fff's file index right after startup so the first picker is instant.
vim.schedule(M.fff)

return M
