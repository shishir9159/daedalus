--- Chunked, memoised line reader.
---
--- The naive Bracket Pair Colorizer's fatal flaw was reprocessing the whole
--- document per edit. The Lua equivalent is `nvim_buf_get_lines(buf, 0, -1)`
--- at the top of every query -- it allocates one Lua string per line of the
--- file before you've looked at a single character.
---
--- Instead we pull aligned windows of `chunk` lines on demand. A typical
--- ds/cs query touches one or two windows, so cost is bounded by the distance
--- to the delimiter, not by buffer size.
local api = vim.api
local config = require("surround.config")

local M = {}

---@param buf integer
---@return fun(row: integer): string|nil reader, integer line_count
function M.reader(buf)
  local count = api.nvim_buf_line_count(buf)
  local chunk = config.opts.chunk
  local lo, hi, cache = 0, -1, nil

  return function(row)
    if row < 0 or row >= count then
      return nil
    end
    if row < lo or row > hi then
      lo = row - (row % chunk)
      hi = math.min(lo + chunk, count) - 1
      cache = api.nvim_buf_get_lines(buf, lo, hi + 1, false)
    end
    return cache[row - lo + 1]
  end,
    count
end

return M
