--- surround.nvim -- add, change and delete surrounding delimiter pairs.
---
--- Design notes live next to the code they justify:
---   pos.lua      bit-packed positions
---   line.lua     chunked buffer reads
---   scan.lua     bounded byte scanner
---   ts.lua       treesitter fast path
---   resolve.lua  lazy, changedtick-keyed caching
---   edit.lua     descending-order edits
local api = vim.api

local config = require("surround.config")
local resolve = require("surround.resolve")
local edit = require("surround.edit")
local input = require("surround.input")
local line = require("surround.line")
local pos = require("surround.pos")

local M = {}

M.config = config

-- Bracket chars whose "open form" means padded: `ds(` strips one space of
-- inner padding, `ds)` does not. Matches vim-surround.
local OPEN_FORM = { ["("] = true, ["{"] = true, ["["] = true }

local function buf()
  return api.nvim_get_current_buf()
end

local CURSOR_NS = api.nvim_create_namespace("surround.cursor")

local function cursor()
  local c = api.nvim_win_get_cursor(0)
  local row, col = c[1] - 1, c[2]
  -- Normalise onto the first byte of the character. A cursor parked on a
  -- UTF-8 continuation byte makes every downstream column arithmetic wrong;
  -- nvim-surround carries the same helper for the same reason.
  if col > 0 then
    local l = api.nvim_buf_get_lines(0, row, row + 1, false)[1]
    if l then
      local b = l:byte(col + 1)
      while col > 0 and b and b >= 0x80 and b < 0xC0 do
        col = col - 1
        b = l:byte(col + 1)
      end
    end
  end
  return row, col
end

--- Run `fn` (which returns a cursor target) under the configured cursor policy.
---
--- "sticky" is the only case that needs an extmark: the delimiter coordinates
--- are kept valid by editing in descending order, but the position the user
--- was sitting on really does move, and only the buffer knows where to.
local function with_cursor_policy(b, row, col, fn)
  local mode = config.opts.move_cursor

  if mode == "sticky" then
    local id = api.nvim_buf_set_extmark(b, CURSOR_NS, row, col, { right_gravity = false })
    local r, c = fn()
    local m = api.nvim_buf_get_extmark_by_id(b, CURSOR_NS, id, {})
    api.nvim_buf_del_extmark(b, CURSOR_NS, id)
    if m and m[1] then
      return m[1], m[2]
    end
    return r, c
  end

  local r, c = fn()
  if mode == false then
    return row, col -- edit.set_cursor clamps if the line got shorter
  end
  return r, c
end

--- Advance past the (possibly multi-byte) character starting at byte `col`.
---@return integer exclusive end column
local function char_end(l, col)
  local n = #l
  local i = col + 2
  while i <= n do
    local b = l:byte(i)
    if b < 0x80 or b >= 0xC0 then
      break
    end
    i = i + 1
  end
  return i - 1
end

--- Swallow one space of inner padding on each side, if present.
local function trim_padding(b, region)
  local reader = line.reader(b)

  local oer, oec = pos.unpack(region[2])
  local l = reader(oer)
  if not l or l:byte(oec + 1) ~= 32 then
    return region
  end

  local csr, csc = pos.unpack(region[3])
  local l2 = reader(csr)
  if not l2 or csc == 0 or l2:byte(csc) ~= 32 then
    return region
  end

  -- `( )` has one space doing double duty. Trimming both sides would make the
  -- two delimiter regions overlap and corrupt the buffer, so require room.
  if region[2] + 2 > region[3] then
    return region
  end

  return { region[1], region[2] + 1, region[3] - 1, region[4] }
end

-----------------------------------------------------------------------------
-- Operations
-----------------------------------------------------------------------------

--- Replace the pair `char` names around the cursor; "" and "" deletes it.
local function do_change(char, left, right)
  local b = buf()
  local row, col = cursor()
  local region = resolve.find(b, row, col, char)
  if not region then
    return false
  end
  if OPEN_FORM[char] then
    region = trim_padding(b, region)
  end
  local r, c = with_cursor_policy(b, row, col, function()
    return edit.replace_pair(b, region, left, right)
  end)
  edit.set_cursor(r, c)
  return true
end

local function do_wrap(b, sr, sc, er, ec, left, right, linewise)
  local crow, ccol = cursor()
  local r, c = with_cursor_policy(b, crow, ccol, function()
    if linewise then
      return edit.wrap_lines(b, sr, er, left, right)
    end
    return edit.wrap(b, sr, sc, er, ec, left, right)
  end)
  edit.set_cursor(r, c)
end

--- `']` / `'>` are inclusive and can sit past EOL (an empty line, or
--- 'selection' "exclusive"): the exclusive end column.
local function end_col(b, er, ec)
  local l = api.nvim_buf_get_lines(b, er, er + 1, false)[1] or ""
  return ec >= #l and #l or char_end(l, ec)
end

--- Range between two marks, rows 0-based.
local function marks(b, first, last)
  local s, e = api.nvim_buf_get_mark(b, first), api.nvim_buf_get_mark(b, last)
  return s[1] - 1, s[2], e[1] - 1, e[2]
end

--- Read a char, then its delimiters; nil when cancelled.
local function prompt_delims()
  local c = input.char()
  if c then
    return input.delimiters(c)
  end
end

-----------------------------------------------------------------------------
-- Public API
-----------------------------------------------------------------------------

--- `g@l` goes to the front of the typeahead ("i"): appended, it would run
--- after whatever a macro or `:normal` queued behind `ds(`, at the wrong spot.
local function run_opfunc()
  vim.o.operatorfunc = "v:lua.require'surround'._repeat"
  api.nvim_feedkeys("g@l", "ni", false)
end

--- Delete the pair identified by `char` around the cursor.
function M.delete(char)
  M._pending = { kind = "delete", char = char }
  run_opfunc()
end

--- Replace the pair identified by `old` with the delimiters for `new`.
function M.change(old, left, right)
  M._pending = { kind = "change", char = old, left = left, right = right }
  run_opfunc()
end

--- Operator-pending / dot-repeat trampoline. Running the edit inside an
--- `operatorfunc` invocation is what makes `.` replay it natively, with no
--- dependency on vim-repeat.
function M._repeat()
  local p = M._pending
  if not p then
    return
  end
  local ok
  if p.kind == "delete" then
    ok = do_change(p.char, "", "")
  elseif p.kind == "change" then
    ok = do_change(p.char, p.left, p.right)
  end
  if ok == false then
    api.nvim_echo({ { "surround: no matching pair", "WarningMsg" } }, false, {})
  end
end

--- Interactive entry points used by the default keymaps.
function M.prompt_delete()
  local c = input.char()
  if c then
    M.delete(c)
  end
end

function M.prompt_change()
  local old = input.char()
  if not old then
    return
  end
  local left, right = prompt_delims()
  if left then
    M.change(old, left, right)
  end
end

--- `ys{motion}{char}` opfunc. `_fresh` is set by the mapping and cleared here,
--- so a subsequent `.` reuses the delimiters instead of re-prompting.
function M._add(mode)
  if M._fresh then
    local left, right = prompt_delims()
    if not left then
      return
    end
    M._add_delims = { left, right, M._linewise }
    M._fresh = false
  end
  local d = M._add_delims
  if not d then
    return
  end

  local b = buf()
  local sr, sc, er, ec = marks(b, "[", "]")
  if d[3] then
    return do_wrap(b, sr, 0, er, 0, d[1], d[2], true)
  end
  if mode == "line" then
    local l = api.nvim_buf_get_lines(b, sr, sr + 1, false)[1] or ""
    sc = #(l:match("^%s*") or "")
    ec = #(api.nvim_buf_get_lines(b, er, er + 1, false)[1] or "")
  else
    ec = end_col(b, er, ec)
  end
  do_wrap(b, sr, sc, er, ec, d[1], d[2], false)
end

--- Visual-mode `S`.
function M.visual(linewise)
  local left, right = prompt_delims()
  if not left then
    return
  end
  local b = buf()
  local sr, sc, er, ec = marks(b, "<", ">")
  if linewise then
    return do_wrap(b, sr, 0, er, 0, left, right, true)
  end
  do_wrap(b, sr, sc, er, end_col(b, er, ec), left, right, false)
end

function M.setup(opts)
  config.setup(opts)
  require("surround.keymaps").apply(config.opts.keymaps)
  -- With a `pack/*/start/` install, plugin/surround.lua is sourced *after*
  -- init.lua (:h load-plugins). This tells it not to apply the default
  -- keymaps over the ones just configured. Deliberately not `loaded_surround`,
  -- which guards the plugin file as a whole -- that file still has an autocmd
  -- to register.
  vim.g.surround_configured = 1
end

return M
