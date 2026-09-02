local M = {}

--- Run lazygit in a floating terminal rooted at the current file's repo.
--- No plugin: builtin floating window + `jobstart(..., { term = true })`.
function M.lazygit()
  if vim.fn.executable('lazygit') == 0 then
    return vim.notify('lazygit not found in $PATH', vim.log.levels.ERROR)
  end

  local root = vim.fs.root(vim.api.nvim_buf_get_name(0) ~= '' and 0 or vim.uv.cwd(), '.git')
  if not root then
    return vim.notify('not inside a git repository', vim.log.levels.WARN)
  end

  local buf = vim.api.nvim_create_buf(false, true)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = math.floor(vim.o.columns * 0.9),
    height = math.floor(vim.o.lines * 0.9),
    row = math.floor(vim.o.lines * 0.05),
    col = math.floor(vim.o.columns * 0.05),
    style = 'minimal',
    border = 'rounded',
    title = ' lazygit ',
    title_pos = 'center',
  })

  -- lazygit owns <Esc>; drop the global terminal-escape mapping in this buffer
  vim.keymap.set('t', '<Esc><Esc>', '<Esc><Esc>', { buffer = buf })

  vim.fn.jobstart({ 'lazygit' }, {
    term = true,
    cwd = root,
    on_exit = function()
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_close(win, true)
      end
      if vim.api.nvim_buf_is_valid(buf) then
        vim.api.nvim_buf_delete(buf, { force = true })
      end
      -- pick up commits/checkouts/rebases made inside lazygit
      vim.cmd.checktime()
    end,
  })
  vim.cmd.startinsert()
end

return M
