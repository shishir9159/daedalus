-- perfanno loads on first :Perf* command. Workflows (README.md): perf record
-- --call-graph dwarf (Go/Rust/Zig), py-spy record --format raw (Python).
vim.api.nvim_create_autocmd('CmdUndefined', {
  group = vim.api.nvim_create_augroup('config.profiling', {}),
  pattern = 'Perf*',
  callback = function()
    require('config.pack').load('perfanno.nvim', function()
      local util, hot = require('perfanno.util'), '#CC3300'
      local bg = vim.fn.synIDattr(vim.fn.hlID('Normal'), 'bg', 'gui')
      require('perfanno').setup({
        line_highlights = util.make_bg_highlights(bg ~= '' and bg or '#000000', hot, 10),
        vt_highlight = util.make_fg_highlight(hot),
      })
    end)
  end,
})
