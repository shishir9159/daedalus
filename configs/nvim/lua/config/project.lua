-- Per-project ShaDa (marks, jumps, registers, oldfiles).
--
-- Nvim reads the ShaDa file at startup step 16, *after* init.lua is sourced
-- (:h starting.txt), so setting 'shadafile' from here still takes effect.
--
-- Files are keyed by project path in one central store rather than dropped in
-- the project itself: that keeps repos clean, and makes the store directory
-- double as the recent-projects list (mtime = last visit).

local M = {}

local store = vim.fs.joinpath(vim.fn.stdpath('state'), 'shada', 'projects')

-- /home/carmack/src/app  <->  %home%carmack%src%app.shada
local function encode(path) return (path:gsub('/', '%%')) .. '.shada' end
local function decode(name) return (name:gsub('%.shada$', ''):gsub('%%', '/')) end

local function shada_for(path) return vim.fs.joinpath(store, encode(path)) end

--- Project dir when nvim was started on a directory (`nvim .`, `nvim ~/src/app`)
--- or bare (`nvim` in a project). A file argument returns nil -> global shada.
local function startup_dir()
  local argc = vim.fn.argc()
  if argc == 0 then
    return vim.uv.cwd()
  elseif argc == 1 and vim.fn.isdirectory(vim.fn.argv(0)) == 1 then
    return vim.fn.fnamemodify(vim.fn.argv(0), ':p:h')
  end
  return nil
end

--- Called from init.lua during sourcing, before ShaDa is read.
function M.setup()
  local dir = startup_dir()
  if not dir then return end
  -- `nvim ~/src/app` shows the directory but leaves cwd behind; move there so
  -- fff/live_grep/:find operate on the project.
  if dir ~= vim.uv.cwd() then vim.cmd.cd(dir) end
  -- ShaDa is keyed to the repo root, so opening a subdirectory of a project
  -- shares that project's marks and oldfiles.
  local root = vim.fs.root(dir, '.git') or dir
  vim.fn.mkdir(store, 'p')
  vim.o.shadafile = shada_for(root)
  M.root = root
end

--- Recent projects, most recently visited first.
function M.recent()
  local out = {}
  for name, type in vim.fs.dir(store) do
    if type == 'file' and name:match('%.shada$') then
      local path = decode(name)
      local stat = vim.uv.fs_stat(vim.fs.joinpath(store, name))
      -- skip projects that have since been deleted
      if stat and vim.fn.isdirectory(path) == 1 then
        out[#out + 1] = { path = path, mtime = stat.mtime.sec }
      end
    end
  end
  table.sort(out, function(a, b) return a.mtime > b.mtime end)
  return out
end

--- Switch to a project: flush current state, cd, load that project's ShaDa.
function M.open(path)
  vim.cmd.wshada() -- merge current session's state to disk first
  vim.cmd.cd(path)
  vim.o.shadafile = shada_for(path)
  pcall(vim.cmd.rshada) -- no bang: merge, don't clobber registers/history
  M.root = path
  vim.notify('project: ' .. vim.fn.fnamemodify(path, ':~'))
end

--- vim.ui.select picker over recent projects (builtin UI, no plugin).
function M.pick()
  local items = M.recent()
  if #items == 0 then
    return vim.notify('no recent projects recorded yet', vim.log.levels.INFO)
  end
  vim.ui.select(items, {
    prompt = 'Recent projects',
    format_item = function(it) return vim.fn.fnamemodify(it.path, ':~') end,
  }, function(choice)
    if choice then M.open(choice.path) end
  end)
end

--- Files remembered for this project, from v:oldfiles (populated from ShaDa).
function M.oldfiles()
  local items = vim.tbl_filter(function(f)
    return vim.fn.filereadable(f) == 1
  end, vim.v.oldfiles)
  if #items == 0 then
    return vim.notify('no remembered files yet', vim.log.levels.INFO)
  end
  vim.ui.select(items, {
    prompt = 'Recent files',
    format_item = function(f) return vim.fn.fnamemodify(f, ':~:.') end,
  }, function(choice)
    if choice then vim.cmd.edit(choice) end
  end)
end

return M
