-- Colours. Unlocked, Neovim follows its environment: this rice profile's
-- palette (`:colorscheme rice`, re-applied when rice-theme pushes a change)
-- and the terminal's light/dark background. Locked, none of that reaches it:
--   :ThemeLock     freeze what's on screen into colors/locked.lua (rerun: refreeze)
--   :ThemeUnlock   delete the freeze and follow the environment again, now
--   vim.g.theme_lock = true | '<colorscheme>'   in init.lua: a name wins over
--                  the freeze; true uses the freeze, or the default scheme
-- The freeze lives in the config dir, which every rice profile shares; the
-- .gitignore whitelist leaves it untracked unless you add it.

local M = {}

M.rice = vim.fn.expand('$XDG_CONFIG_HOME/rice-theme/active/nvim.lua')
local frozen = vim.fs.joinpath(vim.fn.stdpath('config'), 'colors', 'locked.lua')

local held -- { name, background } a lock holds; nil while unlocked
local synced -- freeze file's mtime at the last apply(): spots other instances

local function mtime(f)
  local st = vim.uv.fs_stat(f)
  return st and ('%d.%d'):format(st.mtime.sec, st.mtime.nsec)
end

--- Scheme a lock holds, or false while unlocked.
local function lock_target()
  local g = vim.g.theme_lock
  if type(g) == 'string' then return g end
  if vim.uv.fs_stat(frozen) then return 'locked' end
  return (g == true or g == 1) and (vim.g.colors_name or 'default')
end

local function apply()
  local was = held
  held, synced = nil, mtime(frozen)
  local name = lock_target()
  if not name then
    -- coming out of a lock: ask the terminal for its background again; 0.12's
    -- detection handler applies the reply
    if was and #vim.api.nvim_list_uis() > 0 then vim.api.nvim_ui_send('\27]11;?\7') end
    vim.cmd.colorscheme(vim.uv.fs_stat(M.rice) and 'rice' or 'default')
    return
  end
  -- hex colours, never the terminal's 16-colour palette (a rice recolours it)
  if vim.env.TERM ~= 'linux' then vim.o.termguicolors = true end
  if name ~= 'locked' then vim.o.background = 'dark' end -- not the terminal's pick; the scheme may set its own
  local ok, err = pcall(vim.cmd.colorscheme, name)
  if not ok then return vim.notify(err, vim.log.levels.WARN) end
  -- The freeze's background is set after loading it, not by it: Neovim drops a
  -- scheme that changes 'background' while being reloaded for that option.
  if name == 'locked' then vim.o.background = vim.g.locked_background or vim.o.background end
  held = { name = name, background = vim.o.background }
end

local function hex(n) return n and ('#%06x'):format(n) end

--- Write every highlight group as a colorscheme; returns the source's name.
local function freeze()
  local from = vim.g.colors_name == 'locked' and vim.g.locked_from or vim.g.colors_name or 'default'
  local groups = vim.api.nvim_get_hl(0, {})
  local names = vim.tbl_keys(groups)
  table.sort(names)
  local out = {
    ('-- %s, frozen by :ThemeLock on %s. :ThemeUnlock deletes this file.'):format(from, os.date('%F')),
    "vim.cmd.highlight('clear')",
    'local hl = vim.api.nvim_set_hl',
  }
  for _, name in ipairs(names) do -- empty ones too: `hi clear` may refill them
    local a = groups[name]
    a.fg, a.bg, a.sp = hex(a.fg), hex(a.bg), hex(a.sp)
    out[#out + 1] = ('hl(0, %q, %s)'):format(name, vim.inspect(a, { newline = ' ', indent = '' }))
  end
  vim.list_extend(out, {
    ('vim.g.locked_from, vim.g.locked_background = %q, %q'):format(from, vim.o.background),
    "vim.g.colors_name = 'locked'",
  })
  vim.fn.mkdir(vim.fs.dirname(frozen), 'p')
  vim.fn.writefile(out, frozen)
  return from
end

-- Cursor colour per mode, for the groups 'guicursor' names (options.lua). `fg`
-- is the glyph under a block cursor, so it is the UI background.
local function set_cursor_colors()
  for group, color in pairs({
    CursorNormal = '#cdd6f4', -- lavender / text
    CursorVisual = '#cba6f7', -- mauve
    CursorInsert = '#a6e3a1', -- green: "go"
    CursorReplace = '#f38ba8', -- red
    CursorOp = '#f9e2af', -- yellow
    CursorCommand = '#89b4fa', -- blue
  }) do
    vim.api.nvim_set_hl(0, group, { fg = '#1e1e2e', bg = color })
  end
end

--- Called from init.lua, after any `vim.g.theme_lock` and after vim.pack has
--- loaded the startup plugins (a locked scheme may come from one).
function M.setup()
  local from_lua = vim.g.theme_lock ~= nil
  local group = vim.api.nvim_create_augroup('config.theme', {})
  local function au(event, opts)
    opts.group = group
    vim.api.nvim_create_autocmd(event, opts)
  end

  au('ColorScheme', { callback = set_cursor_colors })

  -- rice-theme's nvim adapter fires this at every Neovim, with the palette
  -- path of the profile that changed: follow only our own. These handlers
  -- load schemes, so they're nested: the ColorScheme hooks must still run.
  au('User', {
    pattern = 'RiceTheme',
    nested = true,
    callback = function(ev)
      local own = vim.uv.fs_realpath(M.rice)
      if lock_target() or not own or type(ev.data) ~= 'string' then return end
      if vim.uv.fs_realpath(ev.data) == own then vim.cmd.colorscheme('rice') end
    end,
  })

  -- 0.12 re-sets 'background' from the terminal's colour report (at start, and
  -- on a theme switch in mode-2031 terminals) even over init.lua's value: it
  -- can't tell a Lua config from itself. A lock sets it back, and reloads the
  -- held scheme if Neovim dropped it (one that sets its own background).
  au('OptionSet', {
    pattern = 'background',
    nested = true,
    callback = function()
      if not held or vim.o.background == held.background then return end
      vim.o.background = held.background
      if vim.g.colors_name ~= held.name then pcall(vim.cmd.colorscheme, held.name) end
    end,
  })

  -- :ThemeLock/:ThemeUnlock ran in another instance
  au('FocusGained', {
    nested = true,
    callback = function()
      if mtime(frozen) ~= synced then apply() end
    end,
  })

  vim.api.nvim_create_user_command('ThemeLock', function()
    local from = freeze()
    apply()
    local g = vim.g.theme_lock
    vim.notify(type(g) == 'string' and ('froze %s, but vim.g.theme_lock = %q wins'):format(from, g)
      or ('theme locked: %s (%s)'):format(from, vim.o.background))
  end, { desc = 'Freeze the colours on screen; palette, terminal and session changes stop reaching Neovim' })

  vim.api.nvim_create_user_command('ThemeUnlock', function()
    vim.g.theme_lock = nil
    os.remove(frozen)
    apply()
    vim.notify('theme follows ' .. (vim.g.colors_name == 'rice' and 'the rice palette' or 'Neovim defaults')
      .. (from_lua and '; init.lua locks it again at the next start' or ''))
  end, { desc = 'Delete the freeze; follow the rice palette and terminal again' })

  apply()
end

return M
