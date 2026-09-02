-- perfanno loads on first :Perf* command.
-- Workflows: perf record -g (Go/Rust/Zig), py-spy record --format raw (Python);
-- see README.md.
vim.api.nvim_create_autocmd('CmdUndefined', {
  group = vim.api.nvim_create_augroup('config.profiling', {}),
  pattern = 'Perf*',
  callback = function()
    require('config.pack').load('perfanno.nvim', function()
      local util = require('perfanno.util')
      local bg = vim.fn.synIDattr(vim.fn.hlID('Normal'), 'bg', 'gui')
      if bg == '' then
        bg = '#000000'
      end
      require('perfanno').setup({
        line_highlights = util.make_bg_highlights(bg, '#CC3300', 10),
        vt_highlight = util.make_fg_highlight('#CC3300'),
      })
    end)
  end,
})
