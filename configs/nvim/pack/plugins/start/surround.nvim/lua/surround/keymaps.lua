--- Default keymaps.
---
--- Every handler `require`s the plugin lazily, so loading this file at startup
--- pulls in nothing else. Nothing under lua/surround/ is read until the first
--- surround command is actually pressed.
local M = {}

local DEFAULTS = {
  normal = "ys",
  normal_cur = "yss",
  normal_line = "yS",
  normal_cur_line = "ySS",
  visual = "S",
  delete = "ds",
  change = "cs",
}

local applied = {}

local function map(mode, lhs, rhs, opts)
  if not lhs or lhs == "" then
    return
  end
  vim.keymap.set(mode, lhs, rhs, opts)
  applied[#applied + 1] = { mode, lhs }
end

local function clear()
  for _, m in ipairs(applied) do
    pcall(vim.keymap.del, m[1], m[2])
  end
  applied = {}
end

--- Arm the `ys` family: remember whether this invocation is line-wrapping,
--- mark it as a fresh (prompting) run, and hand control to `g@`.
local function arm(linewise, motion)
  return function()
    local s = require("surround")
    s._fresh = true
    s._linewise = linewise
    vim.o.operatorfunc = "v:lua.require'surround'._add"
    return motion
  end
end

function M.apply(keys)
  keys = vim.tbl_extend("force", DEFAULTS, keys or {})
  clear()

  local expr = { expr = true, silent = true, desc = "surround: add" }
  map("n", keys.normal, arm(false, "g@"), expr)
  map("n", keys.normal_cur, arm(false, "g@_"), expr)
  map("n", keys.normal_line, arm(true, "g@"), expr)
  map("n", keys.normal_cur_line, arm(true, "g@_"), expr)

  map("x", keys.visual, function()
    local m = vim.fn.mode()
    local esc = vim.api.nvim_replace_termcodes("<Esc>", true, false, true)
    -- Leave visual mode synchronously so '< and '> reflect this selection.
    vim.api.nvim_feedkeys(esc, "nx", false)
    require("surround").visual(m == "V")
  end, { silent = true, desc = "surround: add around selection" })

  map("n", keys.delete, function()
    require("surround").prompt_delete()
  end, { silent = true, desc = "surround: delete" })

  map("n", keys.change, function()
    require("surround").prompt_change()
  end, { silent = true, desc = "surround: change" })
end

return M
