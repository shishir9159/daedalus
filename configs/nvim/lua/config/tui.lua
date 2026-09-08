local M = {}

--- Run a full-screen TUI in a floating terminal. No plugin: builtin floating
--- window + `jobstart(..., { term = true })`. Reusable for any TUI.
---@param cmd string[]
---@param opts? { cwd?: string, title?: string, on_exit?: fun() } on_exit runs once the float is closed
function M.float(cmd, opts)
  opts = opts or {}
  if vim.fn.executable(cmd[1]) == 0 then
    return vim.notify(cmd[1] .. ' not found in $PATH', vim.log.levels.ERROR)
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
    title = ' ' .. (opts.title or cmd[1]) .. ' ',
    title_pos = 'center',
  })

  -- the TUI owns <Esc>; drop the global terminal-escape mapping in this buffer
  vim.keymap.set('t', '<Esc><Esc>', '<Esc><Esc>', { buffer = buf })

  vim.fn.jobstart(cmd, {
    term = true,
    cwd = opts.cwd,
    on_exit = function()
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_close(win, true)
      end
      if vim.api.nvim_buf_is_valid(buf) then
        vim.api.nvim_buf_delete(buf, { force = true })
      end
      if opts.on_exit then
        opts.on_exit()
      end
    end,
  })
  vim.cmd.startinsert()
end

--- lazygit rooted at the current file's repo.
function M.lazygit()
  local root = vim.fs.root(vim.api.nvim_buf_get_name(0) ~= '' and 0 or vim.uv.cwd(), '.git')
  if not root then
    return vim.notify('not inside a git repository', vim.log.levels.WARN)
  end
  -- pick up commits/checkouts/rebases made inside lazygit
  M.float({ 'lazygit' }, { cwd = root, on_exit = vim.cmd.checktime })
end

return M
