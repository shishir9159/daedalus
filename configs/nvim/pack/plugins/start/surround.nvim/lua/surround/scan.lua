--- Byte-level scanner: the fallback path when no treesitter parser is loaded.
---
--- Three things make this materially faster than the usual implementation:
---
---  1. `string.find(line, "[()]", i)` instead of a byte-at-a-time Lua loop.
---     The character-class search runs in C; the Lua loop does not.
---  2. Positions are packed scalars (see pos.lua), so the hot loop allocates
---     one reusable index buffer and nothing else.
---  3. The walk is bounded by `scan_radius`. VS Code bounds its recursive
---     descent with anchor sets so an unmatched bracket cannot drag the parser
---     across the document; here the same guarantee stops a failed `ds(` from
---     scanning to byte 0 of a 40k-line file.
local pos = require("surround.pos")
local config = require("surround.config")

local pack = pos.pack
local find_str = string.find
local byte = string.byte

local M = {}

-- Reusable buffer for right-to-left scanning. One query runs at a time, so a
-- module-level table is safe and saves an allocation per line.
local idxs = {}

local class_cache = {}

local function esc(c)
  return (c:gsub("%W", "%%%0"))
end

local function class_of(open, close)
  local key = open .. close
  local c = class_cache[key]
  if not c then
    c = "[" .. esc(open) .. esc(close) .. "]"
    class_cache[key] = c
  end
  return c
end

--- Odd number of preceding backslashes means escaped.
local function escaped(line, i)
  local n = 0
  local k = i - 1
  while k >= 1 and byte(line, k) == 92 do
    n = n + 1
    k = k - 1
  end
  return n % 2 == 1
end

-----------------------------------------------------------------------------
-- Balanced pairs
-----------------------------------------------------------------------------

--- Scan backwards for the unmatched opener enclosing (row, upto).
---@param upto integer|nil inclusive 0-indexed column on `row`; nil = whole line
local function back(reader, row, upto, open_b, close_b, cls, min_row)
  local depth = 0
  local r = row
  while r >= min_row do
    local line = reader(r)
    if not line then
      break
    end
    local stop = upto and (upto + 1) or #line
    local n, i = 0, 1
    while i <= stop do
      local s = find_str(line, cls, i)
      if not s or s > stop then
        break
      end
      n = n + 1
      idxs[n] = s
      i = s + 1
    end
    for k = n, 1, -1 do
      local s = idxs[k]
      if byte(line, s) == close_b then
        depth = depth + 1
      elseif depth == 0 then
        return pack(r, s - 1)
      else
        depth = depth - 1
      end
    end
    r = r - 1
    upto = nil
  end
  return nil
end

--- Scan forwards for the closer matching an opener at (row, from).
local function fwd(reader, row, from, open_b, close_b, cls, max_row)
  local depth = 0
  local r = row
  local i = from + 1
  while r <= max_row do
    local line = reader(r)
    if not line then
      break
    end
    while true do
      local s = find_str(line, cls, i)
      if not s then
        break
      end
      if byte(line, s) == open_b then
        depth = depth + 1
      elseif depth == 0 then
        return pack(r, s - 1)
      else
        depth = depth - 1
      end
      i = s + 1
    end
    r = r + 1
    i = 1
  end
  return nil
end

--- Find the single-character delimiter pair enclosing the cursor.
---@return integer|nil os, integer oe, integer cs, integer ce packed, end-exclusive
function M.pair(reader, count, row, col, open, close)
  local line = reader(row)
  if not line then
    return nil
  end

  local radius = config.opts.scan_radius
  local min_row = radius > 0 and math.max(0, row - radius) or 0
  local max_row = radius > 0 and math.min(count - 1, row + radius) or (count - 1)

  local open_b, close_b = byte(open), byte(close)
  local cls = class_of(open, close)
  local cur = byte(line, col + 1)

  local o
  if cur == open_b then
    -- Cursor sits on the opener: that pair is the target.
    o = pack(row, col)
  elseif cur == close_b then
    -- Cursor sits on the closer: find its own opener, not an enclosing one.
    if col == 0 then
      o = back(reader, row - 1, nil, open_b, close_b, cls, min_row)
    else
      o = back(reader, row, col - 1, open_b, close_b, cls, min_row)
    end
  else
    o = back(reader, row, col, open_b, close_b, cls, min_row)
  end
  if not o then
    return nil
  end

  local c = fwd(reader, pos.row(o), pos.col(o) + 1, open_b, close_b, cls, max_row)
  if not c then
    return nil
  end
  return o, o + 1, c, c + 1
end

-----------------------------------------------------------------------------
-- Quotes
-----------------------------------------------------------------------------

--- Quotes do not nest, so depth counting is meaningless. Pair them off from
--- the start of the line instead, which is also what makes `"a", "b"` behave.
function M.quote(reader, row, col, q)
  local line = reader(row)
  if not line then
    return nil
  end
  local honour_escapes = config.opts.escapes
  local n, i = 0, 1
  while true do
    local s = find_str(line, q, i, true)
    if not s then
      break
    end
    if not (honour_escapes and escaped(line, s)) then
      n = n + 1
      idxs[n] = s
    end
    i = s + 1
  end
  if n < 2 then
    return nil
  end

  local c1 = col + 1
  for k = 1, n - 1, 2 do
    local a, b = idxs[k], idxs[k + 1]
    if c1 >= a and c1 <= b then
      local o, c = pack(row, a - 1), pack(row, b - 1)
      return o, o + 1, c, c + 1
    end
  end

  if config.opts.quote_search_forward then
    for k = 1, n - 1, 2 do
      local a, b = idxs[k], idxs[k + 1]
      if a >= c1 then
        local o, c = pack(row, a - 1), pack(row, b - 1)
        return o, o + 1, c, c + 1
      end
    end
  end
  return nil
end

-----------------------------------------------------------------------------
-- Tags
-----------------------------------------------------------------------------

local VOID = {
  area = true, base = true, br = true, col = true, embed = true, hr = true,
  img = true, input = true, link = true, meta = true, param = true,
  source = true, track = true, wbr = true,
}

--- Returns "opening", "closing", or nil for tokens that do not affect depth
--- (void elements, self-closing tags, comments, doctypes).
local function tag_kind(tk)
  local b2 = byte(tk, 2)
  if b2 == 33 or b2 == 63 then
    return nil
  end
  if b2 == 47 then
    return "closing"
  end
  if byte(tk, #tk - 1) == 47 then
    return nil
  end
  local name = tk:match("^<%s*([%w_:%-%.]+)")
  if not name or VOID[name:lower()] then
    return nil
  end
  return "opening"
end

local TAG = "<[^<>]->"

--- Collect `<...>` tokens on a line into `out` as flat (start, end) pairs.
---@param max_start integer|nil ignore tokens starting after this 1-based index
---@return integer slots number of slots written (2 per token)
local function tag_tokens(line, max_start, out)
  local n, i = 0, 1
  while true do
    local s, e = find_str(line, TAG, i)
    if not s or (max_start and s > max_start) then
      break
    end
    out[n + 1] = s
    out[n + 2] = e
    n = n + 2
    i = e + 1
  end
  return n
end

function M.tag(reader, count, row, col)
  local radius = config.opts.scan_radius
  local min_row = radius > 0 and math.max(0, row - radius) or 0
  local max_row = radius > 0 and math.min(count - 1, row + radius) or (count - 1)

  local line = reader(row)
  if not line then
    return nil
  end

  local c1 = col + 1
  local o_s, o_e
  local upto

  -- Resolve the cursor's own token first. Sitting on `<div>` means that tag is
  -- the target; sitting on `</div>` means we want *its* opener, so the token
  -- must be excluded from the depth scan rather than counted by it.
  local n = tag_tokens(line, nil, idxs)
  local hit_s, hit_e
  for k = 1, n, 2 do
    if idxs[k] <= c1 and c1 <= idxs[k + 1] then
      hit_s, hit_e = idxs[k], idxs[k + 1]
      break
    end
  end

  if hit_s then
    if tag_kind(line:sub(hit_s, hit_e)) == "opening" then
      o_s, o_e = pack(row, hit_s - 1), pack(row, hit_e)
    else
      upto = hit_s - 1
    end
  else
    upto = c1
  end

  -- Backwards for the unmatched opening tag.
  if not o_s then
    local depth = 0
    local r = row
    while r >= min_row do
      local l = reader(r)
      if not l then
        break
      end
      local m = tag_tokens(l, upto, idxs)
      for k = m - 1, 1, -2 do
        local s, e = idxs[k], idxs[k + 1]
        local kind = tag_kind(l:sub(s, e))
        if kind == "closing" then
          depth = depth + 1
        elseif kind == "opening" then
          if depth == 0 then
            o_s, o_e = pack(r, s - 1), pack(r, e)
            break
          end
          depth = depth - 1
        end
      end
      if o_s then
        break
      end
      r = r - 1
      upto = nil
    end
  end
  if not o_s then
    return nil
  end

  -- Forwards for its matching closing tag.
  local depth = 0
  local r = pos.row(o_e)
  local i = pos.col(o_e) + 1
  while r <= max_row do
    local l = reader(r)
    if not l then
      break
    end
    while true do
      local s, e = find_str(l, TAG, i)
      if not s then
        break
      end
      local kind = tag_kind(l:sub(s, e))
      if kind == "opening" then
        depth = depth + 1
      elseif kind == "closing" then
        if depth == 0 then
          return o_s, o_e, pack(r, s - 1), pack(r, e)
        end
        depth = depth - 1
      end
      i = e + 1
    end
    r = r + 1
    i = 1
  end
  return nil
end

return M
