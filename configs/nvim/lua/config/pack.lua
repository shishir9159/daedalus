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
-- without tags track their default branch. mini.nvim is the one repo behind
-- every mini.* module used here.
vim.pack.add({
  { src = 'https://github.com/dmtrKovalenko/fff.nvim', version = vim.version.range('0.*') },
  { src = 'https://github.com/mfussenegger/nvim-dap', version = vim.version.range('0.*') },
  { src = 'https://github.com/igorlfs/nvim-dap-view', version = vim.version.range('1.*') },
  { src = 'https://github.com/theHamsta/nvim-dap-virtual-text' }, -- untagged
  { src = 'https://github.com/t-troebst/perfanno.nvim' }, -- untagged
  { src = 'https://github.com/nvim-mini/mini.nvim', version = vim.version.range('0.*') },
}, { load = function() end, confirm = false })

-- Surround is not here: pack/plugins/start/surround.nvim ships with this
-- config and maps ys/ds/cs/S at startup, loading the rest on first use.

--- mini.ai/pairs/diff/clue, set up once. Runs on the first real file buffer,
--- so a bare `nvim` never pays for them; keymaps that need them call it too.
function M.editing()
  M.load('mini.nvim', function()
    require('mini.ai').setup({
      -- a/i textobjects (brackets, quotes, args, calls); not treesitter-based.
      -- Its `an`/`in` would shadow 0.12's treesitter selection (v_an, v_in),
      -- and the default search already falls through to the next match.
      mappings = { around_next = '', inside_next = '' },
    })
    require('mini.pairs').setup()
    require('mini.diff').setup({
      view = { style = 'sign', signs = { add = '┃', change = '┃', delete = '▁' } },
    })
    require('config.clue')
  end)
end

vim.api.nvim_create_autocmd({ 'BufReadPost', 'BufNewFile' }, {
  group = vim.api.nvim_create_augroup('config.pack.editing', {}),
  once = true,
  callback = function()
    vim.schedule(M.editing)
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
-- Only inside a repo: `nvim ~/.zshrc` from ~ would index and watch all of $HOME.
local root = vim.fs.root(vim.uv.cwd(), '.git')
if root and root ~= vim.fs.normalize(vim.uv.os_homedir()) then
  vim.schedule(M.fff)
end

return M
