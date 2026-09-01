local ts = require('nvim-treesitter')

-- Parser installer only; highlighting itself is builtin vim.treesitter.
ts.install({
  'bash', 'c', 'cpp', 'go', 'gomod', 'gosum', 'gowork', 'json', 'lua', 'luadoc',
  'markdown', 'markdown_inline', 'python', 'rust', 'toml', 'yaml', 'zig',
  -- filetype detection for all four is builtin; only the parsers were missing
  'nu', 'just', 'proto', 'dockerfile',
})

vim.api.nvim_create_autocmd('FileType', {
  group = vim.api.nvim_create_augroup('config.treesitter', {}),
  callback = function(ev)
    pcall(vim.treesitter.start, ev.buf)
  end,
})
