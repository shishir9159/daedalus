local M = {}

--- Run a full-screen TUI in a floating terminal; `on_exit` runs once it closes.
--- No plugin: builtin floating window + `jobstart(..., { term = true })`.
local function float(cmd, cwd, title, on_exit)
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
    title = ' ' .. title .. ' ',
    title_pos = 'center',
  })

  -- the TUI owns <Esc>; drop the global terminal-escape mapping in this buffer
  vim.keymap.set('t', '<Esc><Esc>', '<Esc><Esc>', { buffer = buf })

  vim.fn.jobstart(cmd, {
    term = true,
    cwd = cwd,
    on_exit = function()
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_close(win, true)
      end
      if vim.api.nvim_buf_is_valid(buf) then
        vim.api.nvim_buf_delete(buf, { force = true })
      end
      on_exit()
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
  float({ 'lazygit' }, root, 'lazygit', vim.cmd.checktime)
end

--- yazi on `path` (a file is revealed in its directory); files opened in yazi
--- (<Enter>) are edited here. `--chooser-file` is yazi's own picker protocol.
function M.yazi(path)
  local chosen = vim.fn.tempname()
  float({ 'yazi', path, '--chooser-file', chosen }, nil, 'yazi', function()
    local ok, files = pcall(vim.fn.readfile, chosen)
    vim.fn.delete(chosen)
    for _, f in ipairs(ok and files or {}) do
      vim.cmd.edit(vim.fn.fnameescape(f))
    end
  end)
end

return M
