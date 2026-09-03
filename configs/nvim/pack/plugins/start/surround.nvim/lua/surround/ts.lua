--- Treesitter fast path.
---
--- This is the article's central lesson applied to Neovim. The Bracket Pair
--- Colorizer extension was slow largely because it could not see VS Code's
--- token stream and had to rebuild bracket structure itself; the fix was to
--- move into the core and reuse the tree that already exists.
---
--- Neovim already ships that tree. The treesitter parser maintains an
--- incrementally-updated CST for the buffer whether or not this plugin exists,
--- so "find the pair enclosing the cursor" is an O(depth) walk up ancestors --
--- typically under 25 hops regardless of file size -- instead of a scan whose
--- cost grows with the distance to the delimiter.
---
--- It also inherits the correctness property the article calls out: a `(` in a
--- comment or string is a different node type, so it never matches. No regex
--- scanner can get that right without reimplementing the lexer.
local api = vim.api
local pos = require("surround.pos")

local pack = pos.pack
local M = {}

local ELEMENT = {
  element = true,
  jsx_element = true,
  jsx_self_closing_element = true,
  script_element = true,
  style_element = true,
}

local OPEN_TAG = {
  start_tag = true,
  open_tag = true,
  jsx_opening_element = true,
  self_closing_tag = true,
}

local CLOSE_TAG = {
  end_tag = true,
  close_tag = true,
  jsx_closing_element = true,
}

--- Cheap per-query line cache. Ancestors cluster around a few rows, so this
--- turns ~2 API calls per hop into ~2 per distinct row.
local function char_at(buf, cache, row, col)
  local l = cache[row]
  if l == nil then
    l = api.nvim_buf_get_lines(buf, row, row + 1, false)[1] or false
    cache[row] = l
  end
  if l == false then
    return nil
  end
  return string.byte(l, col + 1)
end

---@return boolean
function M.available(buf)
  local ok, parser = pcall(vim.treesitter.get_parser, buf)
  if not ok or not parser then
    return false
  end
  return true
end

local function node_at(buf, row, col)
  local ok, node = pcall(vim.treesitter.get_node, { bufnr = buf, pos = { row, col } })
  if ok then
    return node
  end
  return nil
end

--- Walk ancestors looking for a node whose first and last bytes are the
--- requested delimiters. Checking the node's own boundary bytes (rather than
--- its child *types*) keeps this grammar-agnostic: it works for
--- `parenthesized_expression`, `arguments`, `table_constructor`, `string`, and
--- anything else, without a per-language node-type table.
---@return integer|nil os, integer oe, integer cs, integer ce packed, end-exclusive
function M.pair(buf, row, col, open, close)
  local node = node_at(buf, row, col)
  if not node then
    return nil
  end

  local ob, cb = string.byte(open), string.byte(close)
  local cache = {}

  local function walk(n)
    while n do
      local sr, sc, er, ec = n:range()
      if ec > 0 then
        local lr, lc = er, ec - 1
        -- Reject zero/one-char nodes: a pair needs two distinct delimiters.
        if not (sr == lr and lc <= sc) then
          if char_at(buf, cache, sr, sc) == ob and char_at(buf, cache, lr, lc) == cb then
            local o, c = pack(sr, sc), pack(lr, lc)
            return o, o + 1, c, c + 1
          end
        end
      end
      n = n:parent()
    end
    return nil
  end

  local a, b, c, d = walk(node)
  if a then
    return a, b, c, d
  end

  -- Cursor may be at a node boundary (just past a closer). Retry one byte left.
  if col > 0 then
    local prev = node_at(buf, row, col - 1)
    if prev and prev ~= node then
      return walk(prev)
    end
  end
  return nil
end

--- Enclosing markup element. Far more reliable than the scanner: the grammar
--- already knows which tags are void and which are self-closing.
function M.tag(buf, row, col)
  local node = node_at(buf, row, col)
  while node do
    if ELEMENT[node:type()] then
      local o_s, o_e, c_s, c_e
      for child in node:iter_children() do
        local t = child:type()
        if OPEN_TAG[t] and not o_s then
          local sr, sc, er, ec = child:range()
          o_s, o_e = pack(sr, sc), pack(er, ec)
        elseif CLOSE_TAG[t] then
          local sr, sc, er, ec = child:range()
          c_s, c_e = pack(sr, sc), pack(er, ec)
        end
      end
      if o_s and c_s then
        return o_s, o_e, c_s, c_e
      end
    end
    node = node:parent()
  end
  return nil
end

return M
