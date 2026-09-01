local group = vim.api.nvim_create_augroup('config.autocmds', {})
local au = function(event, opts)
  opts.group = group
  vim.api.nvim_create_autocmd(event, opts)
end

-- Flash yanked text.
au('TextYankPost', {
  callback = function() vim.hl.on_yank() end,
})

-- Restore the last cursor position when reopening a file.
au('BufReadPost', {
  callback = function(ev)
    local mark = vim.api.nvim_buf_get_mark(ev.buf, '"')
    local lcount = vim.api.nvim_buf_line_count(ev.buf)
    if mark[1] > 0 and mark[1] <= lcount then
      pcall(vim.api.nvim_win_set_cursor, 0, mark)
    end
  end,
})

-- Create missing parent directories when saving a new file.
au('BufWritePre', {
  callback = function(ev)
    if ev.match:match('^%w+://') then return end -- skip oil://, fugitive://, etc.
    vim.fn.mkdir(vim.fn.fnamemodify(ev.file, ':p:h'), 'p')
  end,
})

-- Close throwaway/utility buffers with a bare `q`.
au('FileType', {
  pattern = { 'help', 'qf', 'checkhealth', 'man', 'lspinfo' },
  callback = function(ev)
    vim.bo[ev.buf].buflisted = false
    vim.keymap.set('n', 'q', '<Cmd>close<CR>', { buffer = ev.buf, silent = true })
  end,
})

-- Equalize splits when the terminal window is resized.
au('VimResized', {
  callback = function() vim.cmd('tabdo wincmd =') end,
})
