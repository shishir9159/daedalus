--- Locating the pair to operate on.
---
--- Note the inverted caching strategy relative to the article. VS Code keeps a
--- persistent (2,3)-tree and pays O(log^3 N) on *every* edit, because it must
--- re-colorize every visible bracket on every keystroke. A surround plugin has
--- the opposite access pattern: queries are human-triggered (a few per second
--- at most) and edits are constant. Maintaining an incremental structure on
--- `on_bytes` would cost strictly more than it ever returns.
---
--- So: nothing is maintained eagerly. Results are memoised against
--- `b:changedtick` and thrown away wholesale when the buffer changes. Cheap
--- invalidation, zero idle cost, and the cold query is fast enough that the
--- cache is a bonus rather than a load-bearing part of the design.
local api = vim.api
local pos = require("surround.pos")
local config = require("surround.config")
local scan = require("surround.scan")
local ts = require("surround.ts")
local line = require("surround.line")

local M = {}

local cache = {}

function M.invalidate(buf)
  cache[buf] = nil
end

local function cache_get(buf, key)
  local c = cache[buf]
  local tick = api.nvim_buf_get_changedtick(buf)
  if not c or c.tick ~= tick then
    c = { tick = tick, entries = {}, n = 0 }
    cache[buf] = c
  end
  return c, c.entries[key]
end

local function cache_put(c, key, value)
  -- Bound the table so a long editing session on one changedtick (possible
  -- while only moving the cursor) cannot grow it without limit.
  if c.n > 64 then
    c.entries = {}
    c.n = 0
  end
  c.entries[key] = value
  c.n = c.n + 1
  return value
end

local QUOTES = { '"', "'", "`" }

--- Extend an opening `(` region leftwards over the callee name, so `f`
--- targets `foo.bar(x)` and not just `(x)`.
local function extend_callee(reader, o_s)
  local row, col = pos.unpack(o_s)
  local l = reader(row)
  if not l then
    return o_s
  end
  local prefix = l:sub(1, col)
  local name = prefix:match("[%w_%.:%->]+$")
  if not name or name == "" then
    return o_s
  end
  return pos.pack(row, col - #name)
end

--- Treesitter answers first: it is right about brackets inside strings and
--- comments, and about multi-line strings. The scanner runs without a parser,
--- or after a treesitter miss when `scan_fallback` is set.
local function scan_too(use_ts, found)
  return not found and (not use_ts or config.opts.scan_fallback)
end

---@return integer|nil os, integer oe, integer cs, integer ce
local function quote(buf, reader, row, col, q, use_ts)
  local a, b, d, e
  if use_ts then
    a, b, d, e = ts.pair(buf, row, col, q, q)
  end
  if scan_too(use_ts, a) then
    return scan.quote(reader, row, col, q)
  end
  return a, b, d, e
end

--- Find the delimiter pair enclosing the cursor.
---@param buf integer
---@param row integer 0-indexed
---@param col integer 0-indexed byte column
---@param char string target key, e.g. "(", "q", "t", "f"
---@return integer[]|nil region {o_start, o_end, c_start, c_end} packed, end-exclusive
function M.find(buf, row, col, char)
  local key = char .. ":" .. pos.pack(row, col)
  local c, hit = cache_get(buf, key)
  if hit ~= nil then
    return hit or nil
  end

  local target = config.find[char]
  if not target then
    -- Unknown char: treat it as its own delimiter on both sides (`ds*`).
    target = { kind = "quote", open = char, close = char }
  end

  local reader, count = line.reader(buf)
  local use_ts = config.opts.treesitter and ts.available(buf)
  local o_s, o_e, c_s, c_e

  if target.kind == "custom" then
    o_s, o_e, c_s, c_e = target.fn(buf, row, col)
  elseif target.kind == "tag" then
    if use_ts then
      o_s, o_e, c_s, c_e = ts.tag(buf, row, col)
    end
    if scan_too(use_ts, o_s) then
      o_s, o_e, c_s, c_e = scan.tag(reader, count, row, col)
    end
  elseif target.kind == "quote" and target.open == "q" then
    -- `q`: innermost of the three quote styles.
    local best
    for _, q in ipairs(QUOTES) do
      local a, b, d, e = quote(buf, reader, row, col, q, use_ts)
      if a and (not best or a > best[1]) then
        best = { a, b, d, e }
      end
    end
    if best then
      o_s, o_e, c_s, c_e = best[1], best[2], best[3], best[4]
    end
  elseif target.kind == "quote" then
    o_s, o_e, c_s, c_e = quote(buf, reader, row, col, target.open, use_ts)
  else
    if use_ts then
      o_s, o_e, c_s, c_e = ts.pair(buf, row, col, target.open, target.close)
    end
    if scan_too(use_ts, o_s) then
      o_s, o_e, c_s, c_e = scan.pair(reader, count, row, col, target.open, target.close)
    end
    if o_s and target.kind == "func" then
      o_s = extend_callee(reader, o_s)
    end
  end

  if not o_s then
    cache_put(c, key, false)
    return nil
  end
  return cache_put(c, key, { o_s, o_e, c_s, c_e })
end

return M
