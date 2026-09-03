--- Reading the delimiter the user typed.
local config = require("surround.config")

local M = {}

local ESC = "\27"

--- Read one keystroke. Returns nil if the user aborted.
---@return string|nil
function M.char()
  local ok, c = pcall(vim.fn.getcharstr)
  if not ok or c == nil or c == "" or c == ESC then
    return nil
  end
  return c
end

local function prompt(label)
  local ok, s = pcall(vim.fn.input, label)
  vim.cmd("redraw")
  if not ok or s == nil or s == "" then
    return nil
  end
  return s
end

--- Resolve the insertion text for a surround character, prompting for the
--- extra input that `t`, `<` and `f` need.
---@param char string
---@return string|nil left, string|nil right
function M.delimiters(char)
  if char == "t" or char == "<" then
    local body = prompt("<")
    if not body then
      return nil
    end
    body = body:gsub("^<", ""):gsub(">$", "")
    local name = body:match("^[%w_:%-%.]+")
    if not name then
      return nil
    end
    return "<" .. body .. ">", "</" .. name .. ">"
  end

  if char == "f" or char == "F" then
    local name = prompt("function: ")
    if not name then
      return nil
    end
    if char == "F" then
      return name .. "( ", " )"
    end
    return name .. "(", ")"
  end

  return config.delimiters(char)
end

return M
