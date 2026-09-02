--- Bit-packed buffer positions.
---
--- Borrowed from VS Code's bracket-pair AST, which packs a node's line/column
--- length into a single machine word ("up to 26 bits each for lines and
--- columns"). Lua numbers are IEEE doubles, exact up to 2^53, so we get 28
--- bits of row and 24 bits of column for free.
---
--- The point is allocation, not arithmetic: the scanner touches thousands of
--- candidate positions per query, and returning `{row, col}` tables from that
--- loop is what actually shows up in a profile. A packed position is a scalar.
local M = {}

local SHIFT = 16777216 -- 2^24

---@param row integer 0-indexed row
---@param col integer 0-indexed byte column
---@return integer packed
function M.pack(row, col)
  return row * SHIFT + col
end

---@param p integer
---@return integer row, integer col
function M.unpack(p)
  local col = p % SHIFT
  return (p - col) / SHIFT, col
end

function M.row(p)
  return (p - p % SHIFT) / SHIFT
end

function M.col(p)
  return p % SHIFT
end

M.MAX_COL = SHIFT

return M
